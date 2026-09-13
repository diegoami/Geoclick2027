// Schema migrations for the Android (Capacitor) SQLite backend, driven by
// SQLite's own `PRAGMA user_version`. Kept free of any @capacitor-community
// import so it can be tested in plain Node against a real SQLite (node:sqlite)
// - see capacitorMigrations.test.ts. The desktop backend's equivalent is
// tauri-plugin-sql's versioned migrations() in desktop/src-tauri/src/lib.rs;
// the test also checks the two produce the same schema.
//
// Before GC-040 this backend ran `CREATE TABLE IF NOT EXISTS` on every open and
// tracked no version at all, so the first schema change would have had no way
// to know which devices had already applied it.

/** The subset of the plugin's SQLiteDBConnection that migrating needs. */
export interface MigratableDb {
	query(statement: string): Promise<{ values?: unknown[] }>;
	/** Runs every statement in `statements`; with `transaction` true (the
	 * plugin's default) they commit together or roll back together. */
	execute(statements: string, transaction?: boolean): Promise<unknown>;
}

/**
 * MIGRATIONS[n] upgrades a database from user_version n to n + 1. Append only:
 * never edit or reorder a migration that has shipped - devices that already
 * ran it will not run it again.
 *
 * Migration 0 is today's schema, column for column identical to lib.rs, and is
 * the one migration that must be IDEMPOTENT (`IF NOT EXISTS`). The reason is
 * the upgrade path that matters most: every Android install made before
 * GC-040 already HAS these tables (created by the old on-open
 * `CREATE TABLE IF NOT EXISTS`) yet reports user_version = 0, because nothing
 * ever set it. On those devices migration 0 must be a no-op over the existing
 * tables and their data, and simply stamp user_version = 1. On a fresh install
 * the same statements create the tables. Either way the device converges to
 * version 1 with an identical schema and no data touched. Every later
 * migration runs exactly once per device, so it can be a plain ALTER.
 */
export const MIGRATIONS: readonly string[] = [
	`CREATE TABLE IF NOT EXISTS card_states (
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
	);`
];

export async function getUserVersion(db: MigratableDb): Promise<number> {
	const result = await db.query('PRAGMA user_version;');
	const row = result.values?.[0] as { user_version?: number } | undefined;
	return Number(row?.user_version ?? 0);
}

/**
 * Applies every migration the database has not seen yet, in order. Each one
 * runs in its own transaction together with the `PRAGMA user_version` bump -
 * user_version is transactional in SQLite, so a failed migration rolls back
 * both its changes and the version, and the next launch retries it cleanly.
 *
 * A database NEWER than this build (user_version > MIGRATIONS.length, e.g. an
 * app downgrade) is left completely alone: guessing at a down-migration is
 * exactly how progress gets destroyed.
 */
export async function migrate(
	db: MigratableDb,
	migrations: readonly string[] = MIGRATIONS
): Promise<{ from: number; to: number }> {
	const from = await getUserVersion(db);
	for (let v = from; v < migrations.length; v++) {
		await db.execute(`${migrations[v]}\nPRAGMA user_version = ${v + 1};`, true);
	}
	return { from, to: Math.max(from, migrations.length) };
}
