import {
	parseProgressOperation,
	progressOwnerKey,
	projectProgress,
	type ProgressJournal,
	type ProgressOperation
} from './progressEvents';
import type { ProgressRepository, QuizProgressWriter } from './progressRepository';

export class AccountProgressError extends Error {
	constructor(
		readonly code: 'snapshot-write-not-supported' | 'invalid-quiz-operation' | 'unknown-target'
	) {
		super(code);
		this.name = 'AccountProgressError';
	}
}
/** Production adapter; the guest factory is deliberately not switched here.
 * Every callback/queue is bound to one journal, never a mutable current UID.
 */
export function createAccountProgressRepository(
	journal: ProgressJournal,
	loadTargets: (mapId: string) => Promise<ReadonlySet<string>>
): ProgressRepository {
	const scope = 'account:' + progressOwnerKey(journal.owner);
	const catalog = new Map<string, Promise<ReadonlySet<string>>>();
	let writes: Promise<unknown> = Promise.resolve();
	const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
		const next = writes.then(action);
		writes = next.catch(() => undefined);
		return next;
	};
	const targets = (mapId: string) => {
		if (!catalog.has(mapId)) {
			const pending = loadTargets(mapId).then((ids) => new Set(ids));
			catalog.set(mapId, pending);
			pending.catch(() => {
				if (catalog.get(mapId) === pending) catalog.delete(mapId);
			});
		}
		return catalog.get(mapId)!;
	};
	const append = (input: ProgressOperation, key: string) => {
		// Copy before queueing: a caller cannot change an answer while another saves.
		const operation = parseProgressOperation(input);
		if (!operation) return Promise.reject(new AccountProgressError('invalid-quiz-operation'));
		return enqueue(async () => {
			if ('mapId' in operation) {
				const ids = await targets(operation.mapId);
				if ('targetId' in operation && !ids.has(operation.targetId))
					throw new AccountProgressError('unknown-target');
				if (
					operation.kind === 'answer' &&
					operation.chosenId !== undefined &&
					!ids.has(operation.chosenId)
				)
					throw new AccountProgressError('unknown-target');
			}
			await journal.append(operation, key);
		});
	};
	const read = async (mapId: string) => {
		await writes;
		const ids = await targets(mapId);
		return projectProgress(await journal.snapshot(), mapId, ids);
	};
	const unsupported = async () => {
		throw new AccountProgressError('snapshot-write-not-supported');
	};
	return {
		progressScope: () => scope,
		quizOperations(mapId): QuizProgressWriter {
			return {
				answer: (answer) =>
					append(
						{ ...answer, kind: 'answer', mapId },
						`answer/${answer.roundId}/${answer.targetId}`
					),
				round: (round) => append({ ...round, kind: 'round', mapId }, `round/${round.roundId}`)
			};
		},
		getCardStates: async (mapId) => (await read(mapId)).cards,
		getLastSessionSummary: async (mapId) => (await read(mapId)).lastSession,
		getMapRecords: async (mapId) => (await read(mapId)).records,
		saveCardState: unsupported,
		saveLastSessionSummary: unsupported,
		saveMapRecords: unsupported,
		resetKnown: (mapId) =>
			append({ kind: 'reset', scope: 'known', mapId }, 'reset/' + crypto.randomUUID()),
		clearMap: (mapId) =>
			append({ kind: 'reset', scope: 'map', mapId }, 'reset/' + crypto.randomUUID()),
		clearAll: () => append({ kind: 'reset', scope: 'all' }, 'reset/' + crypto.randomUUID())
	};
}
