import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbProgressJournal, ProgressJournalError } from './indexedDbProgressJournal';
import { projectProgress, type ProgressEvent, type ProgressOperation } from './progressEvents';
const owner = { projectId: 'test-project', uid: 'account-A' };
const answer: ProgressOperation = {
	kind: 'answer',
	mapId: 'italy-regions',
	targetId: 'one',
	roundId: 'round-one',
	grade: 'good',
	date: '2026-11-01'
};
const open: IndexedDbProgressJournal[] = [],
	names = new Set<string>();
const name = () => {
	const value = 'progress-journal-test-' + crypto.randomUUID();
	names.add(value);
	return value;
};
function journal(databaseName: string, uid = 'account-A', idFactory?: () => string) {
	const value = new IndexedDbProgressJournal(
		{ ...owner, uid },
		{ databaseName, ...(idFactory ? { idFactory } : {}) }
	);
	open.push(value);
	return value;
}
afterEach(async () => {
	for (const value of open.splice(0)) await value.close().catch(() => undefined);
	for (const databaseName of names) {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(databaseName);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}
	names.clear();
});

describe('durable account-bound IndexedDB journal', () => {
	it('reports denied storage rather than falling back to another namespace', async () => {
		const denied = new IndexedDbProgressJournal(owner, {
			indexedDB: {
				open() {
					throw new DOMException('Denied by test', 'SecurityError');
				}
			} as unknown as IDBFactory
		});
		open.push(denied);
		await expect(denied.append(answer, 'one')).rejects.toMatchObject({ name: 'SecurityError' });
	});

	it('commits before resolving, survives reopen, and retries the same operation once', async () => {
		const db = name(),
			first = journal(db);
		const a = await first.append(answer, 'answer/one');
		await first.close();
		const reopened = journal(db);
		const retry = await reopened.append(answer, 'answer/one');
		const second = await reopened.append({ ...answer, grade: 'again' }, 'answer/two');
		expect(retry).toEqual(a);
		expect(second.sequence).toBe(2);
		expect(second.parents).toEqual([a.id]);
		expect(second.deviceId).toBe(a.deviceId);
		expect((await reopened.pending()).map((e) => e.id)).toEqual([a.id, second.id]);
		expect(
			projectProgress(await reopened.snapshot(), 'italy-regions', new Set(['one'])).cards[0]
				.cleanStreak
		).toBe(0);
	});
	it('serializes simultaneous writers and deduplicates simultaneous retries', async () => {
		const db = name(),
			a = journal(db),
			b = journal(db);
		const retries = await Promise.all([
			a.append(answer, 'same-action'),
			b.append(answer, 'same-action')
		]);
		expect(retries[0]).toEqual(retries[1]);
		const more = await Promise.all([
			a.append(answer, 'action-two'),
			b.append(answer, 'action-three')
		]);
		expect(more.map((e) => e.sequence).sort()).toEqual([2, 3]);
		expect((await a.snapshot()).events).toHaveLength(3);
	});
	it('pins owner/input values despite mutation and does not redirect old writes to a new account', async () => {
		const db = name(),
			mutable = { ...owner };
		const a = new IndexedDbProgressJournal(mutable, { databaseName: db });
		open.push(a);
		const payload = { ...answer };
		const pending = a.append(payload, 'action');
		mutable.uid = 'account-B';
		payload.grade = 'again';
		const stored = await pending;
		const b = journal(db, 'account-B');
		await b.append(answer, 'action');
		expect(stored.uid).toBe('account-A');
		expect(stored.operation).toEqual(answer);
		expect((await a.snapshot()).events.every((e) => e.uid === 'account-A')).toBe(true);
		expect((await b.snapshot()).events.every((e) => e.uid === 'account-B')).toBe(true);
		expect(await b.pending()).toHaveLength(1);
	});
	it('requires exact owner/content acknowledgement and preserves unacked events across reopen', async () => {
		const db = name(),
			a = journal(db);
		const first = await a.append(answer, 'one'),
			second = await a.append(answer, 'two');
		await expect(a.acknowledge([{ ...first, uid: 'account-B' }])).rejects.toBeInstanceOf(
			ProgressJournalError
		);
		await expect(
			a.acknowledge([first, { ...second, operation: { ...answer, grade: 'again' } }])
		).rejects.toBeInstanceOf(ProgressJournalError);
		expect(await a.pending()).toHaveLength(2);
		await a.acknowledge([first]);
		await a.close();
		const reopened = journal(db);
		expect((await reopened.pending()).map((e) => e.id)).toEqual([second.id]);
	});
	it('receipt alone is not an acknowledgement and duplicate remote delivery is idempotent', async () => {
		const db = name(),
			a = journal(db);
		const local = await a.append(answer, 'local');
		await a.ingest([local, local]);
		expect(await a.pending()).toHaveLength(1);
		const remote: ProgressEvent = {
			...local,
			id: 'remote',
			deviceId: 'other-device',
			sequence: 1,
			logicalTime: 2,
			parents: [local.id],
			operationKey: 'remote-action'
		};
		await a.ingest([remote, remote]);
		expect((await a.snapshot()).events).toHaveLength(2);
		expect(await a.pending()).toHaveLength(1);
	});
	it('preserves conflicting variants without overwriting either or uploading a conflict', async () => {
		const db = name(),
			a = journal(db);
		const local = await a.append(answer, 'one');
		await a.ingest([{ ...local, operation: { ...answer, grade: 'again' } }]);
		const snapshot = await a.snapshot();
		expect(snapshot.events).toEqual([]);
		expect(snapshot.quarantined.some((q) => q.reason === 'conflicting-event')).toBe(true);
		expect(await a.pending()).toEqual([]);
		await expect(a.acknowledge([local])).rejects.toBeInstanceOf(ProgressJournalError);
	});
	it('defers incomplete remote ancestry without blocking unrelated local practice', async () => {
		const db = name(),
			a = journal(db);
		const root: ProgressEvent = {
			version: 1,
			id: 'remote-root',
			...owner,
			deviceId: 'remote-device',
			sequence: 1,
			logicalTime: 1,
			parents: [],
			operationKey: 'remote-root-action',
			operation: answer
		};
		const child: ProgressEvent = {
			...root,
			id: 'remote-child',
			sequence: 2,
			logicalTime: 2,
			parents: [root.id],
			operationKey: 'remote-child-action'
		};
		await a.ingest([child]);
		expect((await a.snapshot()).deferred).toEqual([child.id]);
		const local = await a.append(answer, 'local');
		expect(local.parents).toEqual([]);
		await a.ingest([root]);
		expect((await a.snapshot()).events).toHaveLength(3);
		expect((await a.snapshot()).deferred).toEqual([]);
	});
	it('atomically aborts metadata allocation if append fails and never fabricates a saved result', async () => {
		const db = name();
		let calls = 0;
		const broken = journal(db, 'account-A', () => {
			if (++calls === 2) throw new Error('simulated interrupted append');
			return 'discarded-device';
		});
		await expect(broken.append(answer, 'one')).rejects.toThrow('simulated interrupted append');
		expect((await broken.snapshot()).events).toEqual([]);
		await broken.close();
		let next = 0;
		const recovered = journal(db, 'account-A', () => `fresh-${++next}`);
		const saved = await recovered.append(answer, 'one');
		expect(saved.deviceId).toBe('fresh-1');
		expect(saved.sequence).toBe(1);
	});
	it('quarantines bounded unsupported own JSON, but never persists another owner or unowned malformed data', async () => {
		const db = name(),
			a = journal(db);
		const event = await a.append(answer, 'one');
		const future = { ...event, id: 'future', version: 2 };
		const foreign = { ...future, uid: 'account-B' };
		await a.ingest([future, future, foreign, 'unowned-private-data']);
		const held = await a.quarantined();
		expect(held).toHaveLength(1);
		expect(held[0].raw).toEqual(future);
		expect((await a.snapshot()).events).toHaveLength(1);
		expect(await journal(db, 'account-B').quarantined()).toEqual([]);
	});
	it('rejects reused operation keys with changed meaning, invalid operations and closed storage', async () => {
		const a = journal(name());
		await a.append(answer, 'one');
		await expect(a.append({ ...answer, grade: 'again' }, 'one')).rejects.toBeInstanceOf(
			ProgressJournalError
		);
		await expect(a.append({ ...answer, date: '2026-02-30' }, 'two')).rejects.toBeInstanceOf(
			ProgressJournalError
		);
		await a.close();
		await expect(a.append(answer, 'three')).rejects.toBeInstanceOf(ProgressJournalError);
	});
	it('does not expose mutable references to stored events', async () => {
		const a = journal(name());
		const saved = await a.append(answer, 'one');
		saved.uid = 'changed';
		const snapshot = await a.snapshot();
		snapshot.events[0].parents.push('changed');
		expect((await a.snapshot()).events[0].uid).toBe(owner.uid);
		expect((await a.snapshot()).events[0].parents).toEqual([]);
	});
});
