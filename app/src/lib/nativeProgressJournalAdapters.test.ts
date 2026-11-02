import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from './capacitorMigrations';
import { GuestProgressImporter } from './guestProgressImport';
import { createAccountProgressRepository } from './accountProgressRepository';
const mocked = vi.hoisted(() => ({
	tauri: undefined as unknown,
	cap: undefined as unknown,
	load: vi.fn(async () => mocked.tauri)
}));
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: mocked.load } }));
vi.mock('@capacitor-community/sqlite', () => ({
	CapacitorSQLite: {},
	SQLiteConnection: class {
		async checkConnectionsConsistency() {
			return { result: true };
		}
		async isConnection() {
			return { result: true };
		}
		async retrieveConnection() {
			return mocked.cap;
		}
		async createConnection() {
			return mocked.cap;
		}
	}
}));
const owner = { projectId: 'test-project', uid: 'account-A' },
	device = 'host-installation';
const card = {
	targetId: 'one',
	easeFactor: 2.5,
	interval: 1,
	repetitions: 2,
	cleanStreak: 2,
	dueDate: '2026-11-03',
	lastReviewedAt: '2026-11-02'
};
let db: DatabaseSync;
function statement(sql: string, values: unknown[] = []) {
	const parameters = values as (string | number)[];
	const named = Object.fromEntries(parameters.map((value, index) => ['$' + (index + 1), value]));
	return {
		all: () =>
			/\$\d+/.test(sql) ? db.prepare(sql).all(named) : db.prepare(sql).all(...parameters),
		run: () => (/\$\d+/.test(sql) ? db.prepare(sql).run(named) : db.prepare(sql).run(...parameters))
	};
}
function fixtures() {
	const tauri = {
		select: vi.fn(async (sql: string, values: unknown[] = []) => statement(sql, values).all()),
		execute: vi.fn(async (sql: string, values: unknown[] = []) => ({
			rowsAffected: Number(statement(sql, values).run().changes),
			lastInsertId: 0
		})),
		close: vi.fn()
	};
	const cap = {
		open: vi.fn(async () => {}),
		query: vi.fn(async (sql: string, values: unknown[] = []) => ({
			values: statement(sql, values).all()
		})),
		run: vi.fn(async (sql: string, values: unknown[] = [], transaction = true) => {
			if (transaction) db.exec('BEGIN');
			try {
				const changes = Number(statement(sql, values).run().changes);
				if (transaction) db.exec('COMMIT');
				return { changes: { changes } };
			} catch (error) {
				if (transaction) db.exec('ROLLBACK');
				throw error;
			}
		}),
		execute: vi.fn(async (sql: string, transaction = true) => {
			if (transaction) db.exec('BEGIN');
			try {
				db.exec(sql);
				if (transaction) db.exec('COMMIT');
				return { changes: { changes: 0 } };
			} catch (error) {
				if (transaction) db.exec('ROLLBACK');
				throw error;
			}
		}),
		close: vi.fn()
	};
	mocked.tauri = tauri;
	mocked.cap = cap;
	return { tauri, cap };
}
beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	db = new DatabaseSync(':memory:');
	for (const sql of MIGRATIONS) db.exec(sql);
	db.exec('PRAGMA user_version=' + MIGRATIONS.length);
	fixtures();
});
afterEach(() => db.close());
for (const platform of ['tauri', 'capacitor'] as const) {
	describe(platform + ' journal adapter', () => {
		async function factory() {
			return platform === 'tauri'
				? (await import('./tauriProgressJournal')).createTauriProgressJournal
				: (await import('./capacitorProgressJournal')).createCapacitorProgressJournal;
		}
		async function guest() {
			return platform === 'tauri'
				? (await import('./sqliteProgressRepository')).createSqliteProgressRepository()
				: (await import('./capacitorProgressRepository')).createCapacitorProgressRepository();
		}
		it('reuses the migrated guest database, imports explicitly, and closes only the journal handle', async () => {
			const create = await factory(),
				original = await guest();
			await original.saveCardState('italy-regions', card);
			await original.saveLastSessionSummary('italy-regions', {
				total: 2,
				perfect: 1,
				totalErrors: 1,
				completedAt: '2026-11-02T12:00:00.000Z'
			});
			await original.saveMapRecords('italy-regions', { bestTimeMs: 4000 });
			const journal = await create(owner, device),
				account = createAccountProgressRepository(journal, async () => new Set(['one', 'two']));
			expect(await account.getCardStates('italy-regions')).toEqual([]);
			const importer = new GuestProgressImporter(original, journal, () => owner),
				preview = await importer.prepare([
					{ mapId: 'italy-regions', targetIds: new Set(['one', 'two']) }
				]);
			expect(preview.rows.filter((row) => row.disposition === 'add')).toHaveLength(2);
			await importer.confirm(preview);
			expect((await account.getCardStates('italy-regions'))[0].cleanStreak).toBe(2);
			expect((await account.getMapRecords('italy-regions')).bestTimeMs).toBe(4000);
			expect(await journal.pending()).toHaveLength(2);
			expect(await original.getCardStates('italy-regions')).toEqual([card]);
			expect((await original.getLastSessionSummary('italy-regions'))?.perfect).toBe(1);
			await journal.close();
			const other = await create({ ...owner, uid: 'account-B' }, device);
			expect((await other.snapshot()).events).toEqual([]);
			const f = platform === 'tauri' ? mocked.tauri : mocked.cap;
			expect((f as { close: ReturnType<typeof vi.fn> }).close).not.toHaveBeenCalled();
			if (platform === 'tauri') expect(mocked.load).toHaveBeenCalledTimes(1);
			else {
				const cap = mocked.cap as ReturnType<typeof fixtures>['cap'];
				expect(cap.open).toHaveBeenCalledTimes(1);
				const journalWrites = cap.run.mock.calls.filter((call) =>
					call[0].includes('account_progress_journal_v1')
				);
				expect(journalWrites.length).toBeGreaterThan(0);
				expect(journalWrites.every((call) => call[2] === false)).toBe(true);
			}
		});
		it('captures the owner before awaiting connection setup and requires a valid host actor', async () => {
			const create = await factory();
			await expect(create(owner, 'bad/device')).rejects.toMatchObject({
				code: 'invalid-device-id'
			});
			expect(mocked.load).not.toHaveBeenCalled();
			const mutable = { ...owner },
				opening = create(mutable, device);
			mutable.uid = 'account-B';
			const journal = await opening;
			expect(journal.owner).toEqual(owner);
			await journal.append({ kind: 'reset', scope: 'all' }, 'reset');
			expect((await journal.pending())[0].deviceId).toBe(device);
		});
	});
}
it('rejects Android result error envelopes instead of treating a failed query as an empty journal', async () => {
	const { createCapacitorProgressJournal } = await import('./capacitorProgressJournal'),
		journal = await createCapacitorProgressJournal(owner, device),
		cap = mocked.cap as ReturnType<typeof fixtures>['cap'];
	cap.query.mockResolvedValue({ values: [], message: 'denied' } as unknown as Awaited<
		ReturnType<typeof cap.query>
	>);
	await expect(journal.snapshot()).rejects.toMatchObject({ code: 'storage-read-failed' });
});
