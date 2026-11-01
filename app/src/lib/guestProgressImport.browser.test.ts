import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbProgressJournal } from './indexedDbProgressJournal';
import { GuestProgressImporter } from './guestProgressImport';
import {
	projectProgress,
	type ProgressOperation,
	type ProgressJournal,
	type ProgressOwner
} from './progressEvents';
import { createInMemoryProgressRepository, type ProgressRepository } from './progressRepository';
import { rate } from '@geoclick/srs';
const owner = { projectId: 'test-project', uid: 'account-A' },
	mapId = 'italy-regions';
const selection = [{ mapId, targetIds: new Set(['one', 'two']) }];
const summary = { total: 2, perfect: 2, totalErrors: 0, completedAt: '2026-11-01T12:00:00.000Z' };
const answer: ProgressOperation = {
	kind: 'answer',
	mapId,
	targetId: 'one',
	roundId: 'account-round',
	grade: 'again',
	date: '2026-11-01'
};
const opened: IndexedDbProgressJournal[] = [],
	databases: string[] = [];
function open() {
	const databaseName = 'guest-import-test-' + crypto.randomUUID();
	databases.push(databaseName);
	const journal = new IndexedDbProgressJournal(owner, { databaseName });
	opened.push(journal);
	return journal;
}
async function guest() {
	const repository = createInMemoryProgressRepository();
	for (const targetId of ['one', 'two'])
		await repository.saveCardState(mapId, { targetId, ...rate(undefined, 'good', '2026-11-01') });
	await repository.saveLastSessionSummary(mapId, summary);
	await repository.saveMapRecords(mapId, {
		bestTimeMs: 2500,
		confusions: [{ targetId: 'one', chosenId: 'two', count: 1 }]
	});
	return repository;
}
function importer(
	source: ProgressRepository,
	journal: ProgressJournal,
	current: () => ProgressOwner | undefined = () => owner
) {
	return new GuestProgressImporter(source, journal, current);
}
const project = async (journal: IndexedDbProgressJournal) =>
	projectProgress(await journal.snapshot(), mapId, selection[0].targetIds);
afterEach(async () => {
	for (const journal of opened.splice(0)) await journal.close();
	for (const databaseName of databases.splice(0))
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(databaseName);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
});
describe('explicit guest import', () => {
	it('previews without writing, normalizes legacy levels and preserves the original guest copy', async () => {
		const source = await guest(),
			journal = open();
		await source.saveCardState(mapId, {
			...(await source.getCardStates(mapId))[0],
			cleanStreak: 8
		});
		const service = importer(source, journal),
			preview = await service.prepare(selection);
		expect(preview.rows.map((row) => row.disposition)).toEqual(['add', 'add', 'add']);
		expect(await journal.pending()).toEqual([]);
		expect(await service.confirm(preview)).toEqual({ accepted: 3, accountWins: 0, unsupported: 0 });
		expect((await project(journal)).cards[0].cleanStreak).toBe(3);
		expect((await source.getCardStates(mapId))[0].cleanStreak).toBe(8);
		expect((await project(journal)).lastSession).toEqual(summary);
		expect((await project(journal)).records.bestTimeMs).toBe(2500);
	});
	it('keeps account target history and map records while adding only untouched targets', async () => {
		const source = await guest(),
			journal = open();
		await journal.append(answer, 'account-answer');
		const service = importer(source, journal),
			preview = await service.prepare(selection);
		expect(preview.rows.map((row) => row.disposition)).toEqual([
			'account-wins',
			'add',
			'account-wins'
		]);
		expect(await service.confirm(preview)).toEqual({ accepted: 1, accountWins: 2, unsupported: 0 });
		expect((await project(journal)).cards.map((card) => card.cleanStreak)).toEqual([0, 1]);
		expect((await project(journal)).lastSession).toBeUndefined();
	});
	it('treats reset history as an account decision rather than an empty account', async () => {
		const source = await guest(),
			journal = open();
		await journal.append({ kind: 'reset', scope: 'all' }, 'reset');
		const service = importer(source, journal),
			preview = await service.prepare(selection);
		expect(preview.rows.every((row) => row.disposition === 'account-wins')).toBe(true);
		expect(await service.confirm(preview)).toEqual({ accepted: 0, accountWins: 3, unsupported: 0 });
		expect((await project(journal)).cards).toEqual([]);
	});
	it('freezes the reviewed data and has no side effect when a preview is declined', async () => {
		const source = await guest(),
			journal = open(),
			service = importer(source, journal);
		const preview = await service.prepare(selection);
		await source.clearAll();
		expect(await journal.pending()).toEqual([]);
		expect(Object.isFrozen(preview.rows[0])).toBe(true);
		await service.confirm(preview);
		expect((await project(journal)).cards).toHaveLength(2);
		expect(await source.getCardStates(mapId)).toEqual([]);
	});
	it('rejects forged/cross-service previews and confirmation after sign-out/account switch', async () => {
		const source = await guest(),
			journal = open();
		let current: ProgressOwner | undefined = owner;
		const service = importer(source, journal, () => current),
			preview = await service.prepare(selection);
		await expect(service.confirm({ ...preview })).rejects.toMatchObject({
			code: 'unrecognized-preview'
		});
		await expect(importer(source, journal).confirm(preview)).rejects.toMatchObject({
			code: 'unrecognized-preview'
		});
		current = { ...owner, uid: 'account-B' };
		await expect(service.confirm(preview)).rejects.toMatchObject({ code: 'account-changed' });
		current = undefined;
		await expect(service.confirm(preview)).rejects.toMatchObject({ code: 'account-changed' });
		expect(await journal.pending()).toEqual([]);
	});
	it('stops if the active account changes during a guest read', async () => {
		const source = await guest(),
			journal = open();
		let current: ProgressOwner = owner;
		const service = importer(
			{
				...source,
				async getCardStates(id) {
					const cards = await source.getCardStates(id);
					current = { ...owner, uid: 'account-B' };
					return cards;
				}
			},
			journal,
			() => current
		);
		await expect(service.prepare(selection)).rejects.toMatchObject({ code: 'account-changed' });
		expect(await journal.pending()).toEqual([]);
	});
	it('finishes an in-flight write only in its original account and stops the remaining batch', async () => {
		const source = await guest(),
			journal = open();
		let current: ProgressOwner = owner;
		const service = importer(
			source,
			{
				owner,
				snapshot: () => journal.snapshot(),
				async append(operation, key) {
					current = { ...owner, uid: 'account-B' };
					return journal.append(operation, key);
				}
			},
			() => current
		);
		const preview = await service.prepare(selection);
		await expect(service.confirm(preview)).rejects.toMatchObject({ code: 'account-changed' });
		const pending = await journal.pending();
		expect(pending).toHaveLength(1);
		expect(pending[0].uid).toBe(owner.uid);
		const accountB = new IndexedDbProgressJournal(current, { databaseName: databases.at(-1) });
		opened.push(accountB);
		expect(await accountB.pending()).toEqual([]);
	});
	it('pins the map selection before asynchronous reads and rejects duplicate maps', async () => {
		const source = await guest(),
			journal = open();
		const targets = new Set(['one', 'two']);
		const service = importer(
			{
				...source,
				async getCardStates(id) {
					targets.clear();
					return source.getCardStates(id);
				}
			},
			journal
		);
		const preview = await service.prepare([{ mapId, targetIds: targets }]);
		expect(preview.rows.every((row) => row.disposition === 'add')).toBe(true);
		expect((await service.confirm(preview)).accepted).toBe(3);
		await expect(service.prepare([...selection, ...selection])).rejects.toMatchObject({
			code: 'invalid-map-selection'
		});
	});
	it('retries an interrupted batch without duplicating committed baselines', async () => {
		const source = await guest(),
			journal = open();
		let calls = 0;
		const service = importer(source, {
			owner,
			snapshot: () => journal.snapshot(),
			append(operation, key) {
				if (++calls === 2) return Promise.reject(new Error('interrupted'));
				return journal.append(operation, key);
			}
		});
		const preview = await service.prepare(selection);
		await expect(service.confirm(preview)).rejects.toThrow('interrupted');
		expect(await journal.pending()).toHaveLength(1);
		expect(await service.confirm(preview)).toEqual({ accepted: 3, accountWins: 0, unsupported: 0 });
		expect(await journal.pending()).toHaveLength(3);
	});
	it('uses stable operation keys across concurrent previews and importer instances', async () => {
		const source = await guest(),
			journal = open(),
			first = importer(source, journal),
			second = importer(source, journal);
		const a = await first.prepare(selection),
			b = await second.prepare(selection);
		const results = await Promise.all([first.confirm(a), second.confirm(b)]);
		expect(results).toEqual([
			{ accepted: 3, accountWins: 0, unsupported: 0 },
			{ accepted: 3, accountWins: 0, unsupported: 0 }
		]);
		expect(await journal.pending()).toHaveLength(3);
	});
	it('rechecks account history changed after preview and leaves conflicting account data intact', async () => {
		const source = await guest(),
			journal = open(),
			service = importer(source, journal),
			preview = await service.prepare(selection);
		await journal.append(answer, 'new-account-practice');
		expect(await service.confirm(preview)).toEqual({ accepted: 1, accountWins: 2, unsupported: 0 });
		expect((await project(journal)).cards[0].cleanStreak).toBe(0);
	});
	it('lets a reset racing the actual append defeat every imported baseline', async () => {
		const source = await guest(),
			journal = open();
		let reset = false;
		const service = importer(source, {
			owner,
			snapshot: () => journal.snapshot(),
			async append(operation, key) {
				if (!reset) {
					reset = true;
					await journal.append({ kind: 'reset', scope: 'all' }, 'racing-reset');
				}
				return journal.append(operation, key);
			}
		});
		const preview = await service.prepare(selection);
		expect(await service.confirm(preview)).toEqual({ accepted: 0, accountWins: 3, unsupported: 0 });
		expect((await project(journal)).cards).toEqual([]);
		expect((await project(journal)).lastSession).toBeUndefined();
	});
	it('does not reinterpret unknown/duplicate targets or malformed legacy progress as valid baselines', async () => {
		const source = await guest(),
			journal = open();
		const one = (await source.getCardStates(mapId))[0];
		const service = importer(
			{
				...source,
				async getCardStates() {
					return [
						one,
						{ ...one, cleanStreak: 2 },
						{ ...one, targetId: 'removed-target' },
						{ ...one, targetId: 'two', dueDate: 'invalid' }
					];
				},
				async getMapRecords() {
					return { confusions: [{ targetId: 'one', chosenId: 'removed-target', count: 2 }] };
				}
			},
			journal
		);
		const preview = await service.prepare(selection);
		expect(preview.rows.every((row) => row.disposition === 'unsupported')).toBe(true);
		expect(await service.confirm(preview)).toEqual({ accepted: 0, accountWins: 0, unsupported: 5 });
		expect(await journal.pending()).toEqual([]);
	});
	it('refuses incomplete account history and reports read/storage failures', async () => {
		const source = await guest(),
			journal = open();
		const incomplete = importer(source, {
			owner,
			append: (op, key) => journal.append(op, key),
			async snapshot() {
				return { ...(await journal.snapshot()), deferred: ['missing-parent'] };
			}
		});
		await expect(incomplete.prepare(selection)).rejects.toMatchObject({
			code: 'account-history-unavailable'
		});
		const brokenGuest = importer(
			{
				...source,
				async getCardStates() {
					throw new Error('guest read failed');
				}
			},
			journal
		);
		await expect(brokenGuest.prepare(selection)).rejects.toThrow('guest read failed');
		const service = importer(source, journal),
			preview = await service.prepare(selection);
		await journal.close();
		await expect(service.confirm(preview)).rejects.toMatchObject({ code: 'storage-closed' });
	});
});
