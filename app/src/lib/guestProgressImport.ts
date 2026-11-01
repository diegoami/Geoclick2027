import {
	parseProgressOperation,
	progressFingerprint,
	progressOwnerKey,
	projectProgress,
	type ProgressEvent,
	type ProgressGraph,
	type ProgressOperation,
	type ProgressOwner
} from './progressEvents';
import type { ProgressRepository } from './progressRepository';

/** The journal stays bound to its original account, including across awaited calls. */
export interface GuestImportJournal {
	readonly owner: Readonly<ProgressOwner>;
	snapshot(): Promise<ProgressGraph>;
	append(operation: ProgressOperation, key: string): Promise<ProgressEvent>;
}
type GuestReader = Pick<
	ProgressRepository,
	'getCardStates' | 'getLastSessionSummary' | 'getMapRecords'
>;
export interface ImportMap {
	mapId: string;
	targetIds: ReadonlySet<string>;
}
export interface GuestImportRow {
	readonly mapId: string;
	readonly targetId?: string;
	readonly kind: 'card' | 'map';
	readonly disposition: 'add' | 'account-wins' | 'unsupported';
}
export interface GuestImportPreview {
	readonly owner: Readonly<ProgressOwner>;
	readonly rows: readonly GuestImportRow[];
}
interface Candidate {
	operation: ProgressOperation;
	key: string;
}
interface Plan {
	candidates: Candidate[];
	maps: Map<string, Set<string>>;
}
export class GuestImportError extends Error {
	constructor(
		readonly code:
			| 'account-changed'
			| 'unrecognized-preview'
			| 'account-history-unavailable'
			| 'invalid-map-selection'
	) {
		super(code);
		this.name = 'GuestImportError';
	}
}
function historyReady(graph: ProgressGraph): void {
	if (graph.deferred.length || graph.quarantined.length)
		throw new GuestImportError('account-history-unavailable');
}
function conflicts(graph: ProgressGraph, operation: ProgressOperation): boolean {
	if (operation.kind !== 'import-card' && operation.kind !== 'import-map')
		throw new Error('Not an import');
	return graph.events.some(({ operation: other }) => {
		if (other.kind === 'reset' && other.scope === 'all') return true;
		if (!('mapId' in other) || other.mapId !== operation.mapId) return false;
		if (other.kind === 'reset') return true;
		if (operation.kind === 'import-card')
			return (
				(other.kind === 'answer' || other.kind === 'import-card') &&
				other.targetId === operation.targetId
			);
		return other.kind === 'answer' || other.kind === 'round' || other.kind === 'import-map';
	});
}
async function importKey(operation: ProgressOperation): Promise<string> {
	const bytes = new TextEncoder().encode(progressFingerprint(operation));
	const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	return (
		'guest-import/v1/' + Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('')
	);
}

/** prepare only reads. Only confirm can append; neither method can erase guest data.
 * The UI must obtain a synchronized account history before offering the preview.
 * Counts are provisional: account activity arriving after preview always wins.
 */
export class GuestProgressImporter {
	readonly owner: Readonly<ProgressOwner>;
	private readonly ownerKey: string;
	private readonly plans = new WeakMap<GuestImportPreview, Plan>();
	constructor(
		private readonly guest: GuestReader,
		private readonly journal: GuestImportJournal,
		private readonly currentOwner: () => ProgressOwner | undefined
	) {
		this.owner = Object.freeze({ ...journal.owner });
		this.ownerKey = progressOwnerKey(this.owner);
	}
	private checkOwner(): void {
		const current = this.currentOwner();
		if (
			!current ||
			progressOwnerKey(current) !== this.ownerKey ||
			progressOwnerKey(this.journal.owner) !== this.ownerKey
		)
			throw new GuestImportError('account-changed');
	}
	async prepare(selection: readonly ImportMap[]): Promise<GuestImportPreview> {
		this.checkOwner();
		const maps = new Map<string, Set<string>>();
		for (const { mapId, targetIds } of selection) {
			if (maps.has(mapId) || !parseProgressOperation({ kind: 'reset', scope: 'map', mapId }))
				throw new GuestImportError('invalid-map-selection');
			maps.set(mapId, new Set(targetIds));
		}
		const graph = await this.journal.snapshot();
		this.checkOwner();
		historyReady(graph);
		const rows: GuestImportRow[] = [],
			candidates: Candidate[] = [];
		const offer = async (
			mapId: string,
			kind: 'card' | 'map',
			input: unknown,
			supported: boolean,
			targetId?: string
		) => {
			const operation = supported ? parseProgressOperation(input) : undefined;
			const disposition = !operation
				? 'unsupported'
				: conflicts(graph, operation)
					? 'account-wins'
					: 'add';
			rows.push(
				Object.freeze({ mapId, kind, ...(targetId === undefined ? {} : { targetId }), disposition })
			);
			if (operation && disposition === 'add')
				candidates.push({ operation, key: await importKey(operation) });
		};
		for (const [mapId, targets] of maps) {
			// Clone each read immediately: a mutable guest repository must not change a reviewed plan.
			const cards = structuredClone(await this.guest.getCardStates(mapId));
			this.checkOwner();
			const summary = structuredClone(await this.guest.getLastSessionSummary(mapId));
			this.checkOwner();
			const records = structuredClone(await this.guest.getMapRecords(mapId));
			this.checkOwner();
			const seen = new Set<string>(),
				duplicates = new Set<string>();
			for (const { targetId } of cards) {
				if (seen.has(targetId)) duplicates.add(targetId);
				seen.add(targetId);
			}
			for (const card of cards) {
				const { targetId, easeFactor, interval, repetitions, dueDate, lastReviewedAt } = card;
				const streak = card.cleanStreak ?? 0;
				const state = {
					easeFactor,
					interval,
					repetitions,
					dueDate,
					lastReviewedAt,
					cleanStreak: Number.isInteger(streak) && streak >= 0 ? Math.min(streak, 3) : streak
				};
				await offer(
					mapId,
					'card',
					{ kind: 'import-card', mapId, targetId, state },
					targets.has(targetId) && !duplicates.has(targetId),
					targetId
				);
			}
			if (summary || Object.keys(records).length) {
				const supported = !records.confusions?.some(
					(pair) => !targets.has(pair.targetId) || !targets.has(pair.chosenId)
				);
				await offer(
					mapId,
					'map',
					{ kind: 'import-map', mapId, ...(summary ? { summary } : {}), records },
					supported
				);
			}
		}
		this.checkOwner();
		const preview = Object.freeze({ owner: this.owner, rows: Object.freeze(rows) });
		this.plans.set(preview, { maps, candidates });
		return preview;
	}
	async confirm(
		preview: GuestImportPreview
	): Promise<{ accepted: number; accountWins: number; unsupported: number }> {
		this.checkOwner();
		const plan = this.plans.get(preview);
		if (!plan) throw new GuestImportError('unrecognized-preview');
		const committed: ProgressEvent[] = [];
		let skipped = 0;
		for (const candidate of plan.candidates) {
			this.checkOwner();
			const graph = await this.journal.snapshot();
			this.checkOwner();
			historyReady(graph);
			const existing = graph.events.find((event) => event.operationKey === candidate.key);
			if (
				existing &&
				progressFingerprint(existing.operation) === progressFingerprint(candidate.operation)
			) {
				committed.push(existing);
				continue;
			}
			if (conflicts(graph, candidate.operation)) {
				skipped++;
				continue;
			}
			// An in-flight append may finish in A after sign-out. The fixed journal never redirects it to B.
			committed.push(await this.journal.append(candidate.operation, candidate.key));
		}
		this.checkOwner();
		const graph = await this.journal.snapshot();
		this.checkOwner();
		historyReady(graph);
		const rejected = new Set<string>();
		for (const [mapId, targets] of plan.maps) {
			const projected = projectProgress(graph, mapId, targets);
			for (const issue of [...projected.ignored, ...projected.quarantined])
				if (issue.id) rejected.add(issue.id);
		}
		const accepted = committed.filter((event) => !rejected.has(event.id)).length;
		return {
			accepted,
			accountWins:
				preview.rows.filter((row) => row.disposition === 'account-wins').length +
				skipped +
				committed.length -
				accepted,
			unsupported: preview.rows.filter((row) => row.disposition === 'unsupported').length
		};
	}
}
