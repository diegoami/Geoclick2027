import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rmSync } from 'node:fs';
import { migrate } from './capacitorMigrations';
import {
	createSqliteJournalStore,
	SqliteProgressJournal,
	type JournalSqlDatabase,
	type SqliteJournalStore
} from './sqliteProgressJournal';
import {
	progressOwnerKey,
	projectProgress,
	type ProgressEvent,
	type ProgressOperation
} from './progressEvents';
import { ProgressSync } from './progressSync';
const owner = { projectId: 'test-project', uid: 'account-A' },
	answer: ProgressOperation = {
		kind: 'answer',
		mapId: 'italy-regions',
		targetId: 'one',
		roundId: 'round-one',
		grade: 'good',
		date: '2026-11-02'
	};
const handles = new Set<DatabaseSync>(),
	files = new Set<string>();
function connection(filename = ':memory:') {
	const db = new DatabaseSync(filename);
	handles.add(db);
	db.exec('PRAGMA busy_timeout=5000;');
	if (filename !== ':memory:') {
		files.add(filename);
		db.exec('PRAGMA journal_mode=WAL;');
	}
	return db;
}
async function initialize(db: DatabaseSync) {
	await migrate({
		query: async (sql) => ({ values: db.prepare(sql).all() }),
		execute: async (sql, transaction = true) => {
			if (!transaction) {
				db.exec(sql);
				return;
			}
			db.exec('BEGIN');
			try {
				db.exec(sql);
				db.exec('COMMIT');
			} catch (error) {
				db.exec('ROLLBACK');
				throw error;
			}
		}
	});
}
function driver(db: DatabaseSync): JournalSqlDatabase {
	return {
		query: async (sql, values) => db.prepare(sql).all(...values),
		execute: async (sql, values) => Number(db.prepare(sql).run(...values).changes)
	};
}
function journal(db: DatabaseSync, uid = owner.uid, deviceId?: string) {
	return new SqliteProgressJournal({ ...owner, uid }, createSqliteJournalStore(driver(db)), {
		deviceId
	});
}
const filename = () => path.join(tmpdir(), 'geoclick-native-journal-' + randomUUID() + '.sqlite');
async function projected(j: SqliteProgressJournal) {
	return projectProgress(await j.snapshot(), 'italy-regions', new Set(['one']));
}
afterEach(() => {
	for (const db of handles) {
		try {
			db.close();
		} catch {
			/* Already closed by a reopen test. */
		}
	}
	handles.clear();
	for (const file of files) {
		expect(path.dirname(path.resolve(file))).toBe(path.resolve(tmpdir()));
		expect(path.basename(file)).toMatch(/^geoclick-native-journal-/);
		for (const suffix of ['', '-wal', '-shm']) rmSync(file + suffix, { force: true });
	}
	files.clear();
});
describe('native SQLite account journal', () => {
	it('commits metadata/events/queue together and reopens with stable identity and idempotent caller keys', async () => {
		const file = filename(),
			first = connection(file);
		await initialize(first);
		const a = journal(first);
		const event = await a.append(answer, 'one');
		await a.close();
		first.close();
		handles.delete(first);
		const reopened = connection(file);
		await initialize(reopened);
		const b = journal(reopened);
		expect(await b.append(answer, 'one')).toEqual(event);
		const second = await b.append({ ...answer, roundId: 'round-two', grade: 'again' }, 'two');
		expect(second.sequence).toBe(2);
		expect(second.deviceId).toBe(event.deviceId);
		expect(second.parents).toEqual([event.id]);
		expect((await b.pending()).map((e) => e.id)).toEqual([event.id, second.id]);
		expect((await projected(b)).cards[0].cleanStreak).toBe(0);
	});
	it('serializes CAS writers through independent connections and deduplicates concurrent retries', async () => {
		const file = filename(),
			left = connection(file);
		await initialize(left);
		const right = connection(file);
		await initialize(right);
		const a = journal(left),
			b = journal(right);
		await Promise.all(
			Array.from({ length: 12 }, (_, i) =>
				(i % 2 ? a : b).append({ ...answer, roundId: 'round-' + i }, 'attempt/' + i)
			)
		);
		const retries = await Promise.all(
			Array.from({ length: 8 }, (_, i) =>
				(i % 2 ? a : b).append({ ...answer, roundId: 'retry' }, 'same')
			)
		);
		expect(new Set(retries.map((e) => e.id)).size).toBe(1);
		const graph = await a.snapshot();
		expect(graph.events).toHaveLength(13);
		expect(graph.events.map((e) => e.sequence)).toEqual(
			Array.from({ length: 13 }, (_, i) => i + 1)
		);
		expect(new Set(graph.events.map((e) => e.deviceId)).size).toBe(1);
		await expect(a.append({ ...answer, grade: 'again' }, 'same')).rejects.toMatchObject({
			code: 'operation-conflict'
		});
		expect((await a.snapshot()).events).toHaveLength(13);
	});
	it('recovers a commit whose success response was interrupted without duplicating an attempt', async () => {
		const db = connection();
		await initialize(db);
		const base = createSqliteJournalStore(driver(db));
		const interrupted = new SqliteProgressJournal(owner, {
			...base,
			async compareAndSwap(...args) {
				await base.compareAndSwap(...args);
				throw new Error('response-lost');
			}
		});
		await expect(interrupted.append(answer, 'one')).rejects.toThrow('response-lost');
		const reopened = journal(db);
		expect((await reopened.snapshot()).events).toHaveLength(1);
		await reopened.append(answer, 'one');
		expect((await reopened.snapshot()).events).toHaveLength(1);
		expect((await projected(reopened)).cards[0].cleanStreak).toBe(1);
	});
	it('reports failed writes and bounded contention without a partial metadata/queue commit', async () => {
		const db = connection();
		await initialize(db);
		const base = createSqliteJournalStore(driver(db));
		const denied = new SqliteProgressJournal(owner, {
			...base,
			compareAndSwap: async () => {
				throw new Error('denied');
			}
		});
		await expect(denied.append(answer, 'one')).rejects.toThrow('denied');
		expect(db.prepare('SELECT COUNT(*) AS n FROM account_progress_journal_v1').get()).toEqual({
			n: 0
		});
		const busy = new SqliteProgressJournal(
			owner,
			{ ...base, compareAndSwap: async () => false },
			{ attempts: 2 }
		);
		await expect(busy.append(answer, 'one')).rejects.toMatchObject({ code: 'storage-contention' });
		expect(await journal(db).pending()).toEqual([]);
		await journal(db).append(answer, 'one');
		expect((await journal(db).snapshot()).events).toHaveLength(1);
	});
	it('pins owners, binds SQL values, isolates accounts and leaves original guest tables intact', async () => {
		const db = connection();
		await initialize(db);
		db.prepare('INSERT INTO card_states VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
			'guest-map',
			'guest-target',
			2.5,
			1,
			1,
			'2026-11-03',
			'2026-11-02',
			1
		);
		const mutable = { ...owner },
			a = new SqliteProgressJournal(mutable, createSqliteJournalStore(driver(db)));
		mutable.uid = 'account-B';
		const event = await a.append(answer, 'one'),
			b = journal(db, 'account-B');
		expect(a.owner.uid).toBe('account-A');
		expect(Object.isFrozen(a.owner)).toBe(true);
		expect((await b.snapshot()).events).toEqual([]);
		await expect(b.acknowledge([event])).rejects.toMatchObject({
			code: 'acknowledgement-owner-or-schema-mismatch'
		});
		const quoted = journal(db, "user'); DROP TABLE card_states; --");
		await quoted.append(answer, 'one');
		expect((await quoted.snapshot()).events).toHaveLength(1);
		expect(db.prepare('SELECT COUNT(*) AS n FROM card_states').get()).toEqual({ n: 1 });
		expect(await a.pending()).toHaveLength(1);
		expect(await b.pending()).toEqual([]);
	});
	it('keeps remote receipt separate from exact atomic acknowledgements', async () => {
		const db = connection();
		await initialize(db);
		const a = journal(db),
			event = await a.append(answer, 'one');
		await a.ingest([event]);
		expect(await a.pending()).toHaveLength(1);
		await expect(a.acknowledge([event, { ...event, id: 'absent' }])).rejects.toMatchObject({
			code: 'acknowledgement-content-mismatch'
		});
		expect(await a.pending()).toHaveLength(1);
		await expect(a.acknowledge([{ ...event, operationKey: 'changed' }])).rejects.toMatchObject({
			code: 'acknowledgement-content-mismatch'
		});
		await a.acknowledge([event]);
		expect(await a.pending()).toEqual([]);
	});
	it('defers out-of-order remote events and quarantines conflicts and only bounded own-account unsupported data', async () => {
		const db = connection();
		await initialize(db);
		const a = journal(db);
		const parent: ProgressEvent = {
			version: 1,
			...owner,
			id: 'remote-one',
			deviceId: 'remote',
			sequence: 1,
			logicalTime: 1,
			parents: [],
			operationKey: 'remote/1',
			operation: answer
		};
		const child: ProgressEvent = {
			...parent,
			id: 'remote-two',
			sequence: 2,
			logicalTime: 2,
			parents: [parent.id],
			operationKey: 'remote/2',
			operation: { ...answer, roundId: 'remote-two' }
		};
		await a.ingest([child]);
		expect((await a.snapshot()).deferred).toEqual([child.id]);
		await a.ingest([parent]);
		expect((await a.snapshot()).events).toHaveLength(2);
		expect(await a.pending()).toEqual([]);
		await a.ingest([
			{ ...owner, version: 2, id: 'future', marker: 'own-future' },
			{ ...owner, uid: 'foreign', version: 2, marker: 'foreign-only' }
		]);
		expect(await a.quarantined()).toHaveLength(1);
		expect(
			db.prepare('SELECT payload FROM account_progress_journal_v1').get()!.payload
		).not.toContain('foreign-only');
		await a.ingest([{ ...parent, operationKey: 'conflicting' }]);
		expect((await a.snapshot()).quarantined.length).toBeGreaterThan(0);
		await expect(a.acknowledge([parent])).rejects.toMatchObject({
			code: 'acknowledgement-content-mismatch'
		});
	});
	it('does not overwrite future/corrupt/foreign local payloads or silently fall back to an empty account', async () => {
		const db = connection();
		await initialize(db);
		const key = progressOwnerKey(owner),
			future = JSON.stringify({ version: 2, ...owner });
		db.prepare('INSERT INTO account_progress_journal_v1 VALUES (?, ?, ?)').run(key, 1, future);
		await expect(journal(db).append(answer, 'one')).rejects.toMatchObject({
			code: 'unsupported-local-journal'
		});
		expect(db.prepare('SELECT payload FROM account_progress_journal_v1').get()!.payload).toBe(
			future
		);
		db.prepare('UPDATE account_progress_journal_v1 SET payload=?').run(
			JSON.stringify({ version: 1, owner: { ...owner, uid: 'foreign' }, rows: [], quarantine: [] })
		);
		await expect(journal(db).snapshot()).rejects.toMatchObject({ code: 'invalid-local-journal' });
		db.prepare('UPDATE account_progress_journal_v1 SET payload=?').run('{broken');
		await expect(journal(db).snapshot()).rejects.toMatchObject({ code: 'invalid-local-journal' });
	});
	it('supports a new installation actor after a restored database while retaining causal history', async () => {
		const file = filename(),
			db = connection(file);
		await initialize(db);
		const old = journal(db, owner.uid, 'old-installation');
		const first = await old.append(answer, 'one');
		const fresh = journal(db, owner.uid, 'new-installation');
		const second = await fresh.append({ ...answer, roundId: 'new-installation' }, 'two');
		expect(first.deviceId).toBe('old-installation');
		expect(second.deviceId).toBe('new-installation');
		expect(second.sequence).toBe(1);
		expect(second.parents).toEqual([first.id]);
		expect((await fresh.snapshot()).events).toHaveLength(2);
	});
	it('can finish an issued commit only in its pinned owner after a handle closes, without closing the shared database', async () => {
		const db = connection();
		await initialize(db);
		const base = createSqliteJournalStore(driver(db));
		let started!: () => void, release!: () => void;
		const ready = new Promise<void>((resolve) => {
			started = resolve;
		});
		const a = new SqliteProgressJournal(owner, {
			...base,
			async compareAndSwap(...args) {
				started();
				await new Promise<void>((resolve) => {
					release = resolve;
				});
				return base.compareAndSwap(...args);
			}
		});
		const writing = a.append(answer, 'one');
		await ready;
		await a.close();
		release();
		expect((await writing).uid).toBe(owner.uid);
		await expect(a.snapshot()).rejects.toMatchObject({ code: 'storage-closed' });
		const b = journal(db, 'account-B');
		await b.append(answer, 'one');
		expect((await b.snapshot()).events).toHaveLength(1);
		expect((await journal(db).snapshot()).events).toHaveLength(1);
	});
	it('retains the queue after an interrupted upload acknowledgement and converges reset-wins through sync', async () => {
		const db = connection();
		await initialize(db);
		const a = journal(db),
			other = connection();
		await initialize(other);
		const b = journal(other),
			events = new Map<string, ProgressEvent>();
		const transport = {
			owner,
			currentOwner: () => owner,
			pull: async () => ({ records: [...events.values()] }),
			put: async (event: ProgressEvent) => {
				events.set(event.id, structuredClone(event));
			}
		};
		await a.append(answer, 'one');
		let failAck = true;
		const interrupted = {
			owner,
			snapshot: () => a.snapshot(),
			append: (op: ProgressOperation, key: string) => a.append(op, key),
			ingest: (rows: readonly unknown[]) => a.ingest(rows),
			pending: () => a.pending(),
			acknowledge: async (rows: readonly ProgressEvent[]) => {
				if (failAck) {
					failAck = false;
					throw new Error('interrupted-ack');
				}
				await a.acknowledge(rows);
			}
		};
		const sa = new ProgressSync(interrupted, transport),
			sb = new ProgressSync(b, transport);
		await expect(sa.sync()).rejects.toThrow('interrupted-ack');
		expect(await a.pending()).toHaveLength(1);
		await sa.sync();
		expect(events.size).toBe(1);
		await sb.sync();
		await a.append({ ...answer, roundId: 'stale' }, 'stale');
		await b.append({ kind: 'reset', scope: 'known', mapId: 'italy-regions' }, 'reset');
		await sb.sync();
		await sa.sync();
		await sb.sync();
		expect((await projected(a)).cards).toEqual([]);
		expect(await projected(a)).toEqual(await projected(b));
		await a.append({ ...answer, roundId: 'after-reset' }, 'after-reset');
		await sa.sync();
		await sb.sync();
		expect((await projected(b)).cards[0].cleanStreak).toBe(1);
	});
	it('rejects bridge failures and unexpected affected-row counts rather than treating them as contention', async () => {
		const db = connection();
		await initialize(db);
		const real = driver(db);
		const bad = new SqliteProgressJournal(
			owner,
			createSqliteJournalStore({ ...real, execute: async () => -1 })
		);
		await expect(bad.append(answer, 'one')).rejects.toMatchObject({ code: 'storage-write-failed' });
		const invalid = createSqliteJournalStore({
			...real,
			query: async () => [{ revision: 0, payload: '{}' }]
		});
		await expect(new SqliteProgressJournal(owner, invalid).snapshot()).rejects.toMatchObject({
			code: 'invalid-local-journal'
		});
		const unavailable: SqliteJournalStore = {
			read: async () => {
				throw new Error('unavailable');
			},
			compareAndSwap: async () => true
		};
		await expect(new SqliteProgressJournal(owner, unavailable).snapshot()).rejects.toThrow(
			'unavailable'
		);
	});
});

it('refuses a new attempt when the current device history is conflicted instead of saving an unreplayable event', async () => {
	const db = connection();
	await initialize(db);
	const a = journal(db, owner.uid, 'host-installation');
	const first = await a.append(answer, 'first');
	await a.ingest([{ ...first, id: 'conflicting-event', operationKey: 'conflicting-operation' }]);
	expect((await a.snapshot()).quarantined.length).toBeGreaterThan(0);
	await expect(a.append({ ...answer, roundId: 'new-round' }, 'new-attempt')).rejects.toMatchObject({
		code: 'actor-history-unavailable'
	});
	expect(db.prepare('SELECT revision FROM account_progress_journal_v1').get()).toEqual({
		revision: 2
	});
});
