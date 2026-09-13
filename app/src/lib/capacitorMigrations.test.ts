// Exercises the Android migration logic against a REAL SQLite (Node's built-in
// node:sqlite), through an adapter with the same transaction semantics as
// @capacitor-community/sqlite's execute(): begin, run every statement, commit,
// or roll back on any failure. What this cannot cover is the plugin's native
// bridge itself - that part needs a device (manual test plan: GC-040 worklog).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, getUserVersion, migrate, type MigratableDb } from './capacitorMigrations';

function adapter(db: DatabaseSync): MigratableDb {
	return {
		async query(statement) {
			return { values: db.prepare(statement).all() };
		},
		async execute(statements, transaction = true) {
			if (!transaction) {
				db.exec(statements);
				return;
			}
			db.exec('BEGIN');
			try {
				db.exec(statements);
				db.exec('COMMIT');
			} catch (e) {
				db.exec('ROLLBACK');
				throw e;
			}
		}
	};
}

// Verbatim copy of what capacitorProgressRepository.ts ran on every open BEFORE
// GC-040 - i.e. the state of every Android install made until now. Kept as an
// independent fixture on purpose: it is history, and must not follow later
// edits to MIGRATIONS[0].
const PRE_GC040_ON_OPEN_SQL = `
	CREATE TABLE IF NOT EXISTS card_states (
		map_id TEXT NOT NULL,
		target_id TEXT NOT NULL,
		ease_factor REAL NOT NULL,
		interval INTEGER NOT NULL,
		repetitions INTEGER NOT NULL,
		due_date TEXT NOT NULL,
		last_reviewed_at TEXT NOT NULL,
		PRIMARY KEY (map_id, target_id)
	);
	CREATE TABLE IF NOT EXISTS last_session_summaries (
		map_id TEXT PRIMARY KEY,
		total INTEGER NOT NULL,
		perfect INTEGER NOT NULL,
		total_errors INTEGER NOT NULL,
		completed_at TEXT NOT NULL
	);
`;

const TABLES = ['card_states', 'last_session_summaries'] as const;
const schemaOf = (db: DatabaseSync) =>
	Object.fromEntries(TABLES.map((t) => [t, db.prepare(`PRAGMA table_info(${t})`).all()]));

/** Every migration's SQL from lib.rs's migrations(), in declaration order -
 * all of them, so adding a desktop migration without its Android twin (or the
 * reverse) fails the schema comparison below. */
function tauriMigrationSql(): string[] {
	const libRs = readFileSync(
		path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'../../../desktop/src-tauri/src/lib.rs'
		),
		'utf8'
	);
	const blocks = [...libRs.matchAll(/sql:\s*"([\s\S]*?)",/g)].map((m) => m[1]);
	if (blocks.length === 0) throw new Error('could not find any migration SQL in lib.rs');
	return blocks;
}

describe('Capacitor SQLite migrations (GC-040)', () => {
	it('a fresh install ends at user_version 1 with both tables', async () => {
		const db = new DatabaseSync(':memory:');
		expect(await getUserVersion(adapter(db))).toBe(0);
		expect(await migrate(adapter(db))).toEqual({ from: 0, to: 1 });
		expect(await getUserVersion(adapter(db))).toBe(1);
		expect(Object.keys(schemaOf(db))).toEqual([...TABLES]);
		expect(schemaOf(db).card_states).toHaveLength(7);
	});

	it('an existing pre-GC-040 install (tables present, user_version 0) keeps every row', async () => {
		const db = new DatabaseSync(':memory:');
		db.exec(PRE_GC040_ON_OPEN_SQL);
		db.prepare('INSERT INTO card_states VALUES (?, ?, ?, ?, ?, ?, ?)').run(
			'germany-states',
			'bayern',
			2.35,
			6,
			2,
			'2026-09-20',
			'2026-09-14'
		);
		db.prepare('INSERT INTO last_session_summaries VALUES (?, ?, ?, ?, ?)').run(
			'germany-states',
			16,
			14,
			3,
			'2026-09-14T10:00:00.000Z'
		);
		const schemaBefore = schemaOf(db);
		expect(await getUserVersion(adapter(db))).toBe(0);

		expect(await migrate(adapter(db))).toEqual({ from: 0, to: 1 });

		expect(await getUserVersion(adapter(db))).toBe(1);
		expect(schemaOf(db)).toEqual(schemaBefore);
		expect(db.prepare('SELECT * FROM card_states').all()).toEqual([
			{
				map_id: 'germany-states',
				target_id: 'bayern',
				ease_factor: 2.35,
				interval: 6,
				repetitions: 2,
				due_date: '2026-09-20',
				last_reviewed_at: '2026-09-14'
			}
		]);
		expect(
			db.prepare('SELECT total, perfect, total_errors FROM last_session_summaries').get()
		).toEqual({
			total: 16,
			perfect: 14,
			total_errors: 3
		});
	});

	it('is a no-op on every open after the first', async () => {
		const db = new DatabaseSync(':memory:');
		await migrate(adapter(db));
		db.prepare('INSERT INTO card_states VALUES (?, ?, ?, ?, ?, ?, ?)').run(
			'm',
			't',
			2.5,
			1,
			1,
			'd',
			'd'
		);
		expect(await migrate(adapter(db))).toEqual({ from: 1, to: 1 });
		expect(db.prepare('SELECT COUNT(*) AS n FROM card_states').get()).toEqual({ n: 1 });
	});

	it('produces exactly the same schema as the Tauri backend (lib.rs)', async () => {
		const tauri = tauriMigrationSql();
		// Same number of migrations on both sides: Tauri's version N is
		// Android's user_version N.
		expect(MIGRATIONS).toHaveLength(tauri.length);
		const android = new DatabaseSync(':memory:');
		await migrate(adapter(android));
		const desktop = new DatabaseSync(':memory:');
		for (const sql of tauri) desktop.exec(sql);
		expect(schemaOf(android)).toEqual(schemaOf(desktop));
	});

	it('a failing migration rolls back its changes AND the version bump', async () => {
		const db = new DatabaseSync(':memory:');
		await migrate(adapter(db));
		const broken = [
			...MIGRATIONS,
			'ALTER TABLE card_states ADD COLUMN streak INTEGER NOT NULL DEFAULT 0;\nSELECT * FROM no_such_table;'
		];
		await expect(migrate(adapter(db), broken)).rejects.toThrow();
		expect(await getUserVersion(adapter(db))).toBe(1);
		const columns = (db.prepare('PRAGMA table_info(card_states)').all() as { name: string }[]).map(
			(c) => c.name
		);
		expect(columns).not.toContain('streak');
	});

	it('applies a later migration exactly once, and leaves a newer database alone', async () => {
		const db = new DatabaseSync(':memory:');
		const withV2 = [
			...MIGRATIONS,
			'ALTER TABLE card_states ADD COLUMN streak INTEGER NOT NULL DEFAULT 0;'
		];
		expect(await migrate(adapter(db), withV2)).toEqual({ from: 0, to: 2 });
		expect(await migrate(adapter(db), withV2)).toEqual({ from: 2, to: 2 });
		// An older build (knows only migration 0) opening this v2 database must
		// not touch it - no guessed down-migration.
		expect(await migrate(adapter(db), MIGRATIONS)).toEqual({ from: 2, to: 2 });
		expect(await getUserVersion(adapter(db))).toBe(2);
	});
});
