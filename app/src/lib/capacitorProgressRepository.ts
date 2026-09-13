// Iteration 8+ (Android POC): SQLite-backed ProgressRepository for the
// Capacitor native shell, via @capacitor-community/sqlite. Same schema as
// desktop/src-tauri/src/lib.rs's migrations() (card_states/
// last_session_summaries, identical columns - enforced by
// capacitorMigrations.test.ts) so the row-mapping logic mirrors
// sqliteProgressRepository.ts. The schema itself and its versioning live in
// capacitorMigrations.ts. Only ever imported when running on a native
// Capacitor platform (see createProgressRepository in progressRepository.ts) -
// a plain-browser or Tauri build never touches this module.

import {
	CapacitorSQLite,
	SQLiteConnection,
	type SQLiteDBConnection
} from '@capacitor-community/sqlite';
import { migrate } from './capacitorMigrations';
import type { CardState, ProgressRepository, SessionSummary } from './progressRepository';

const DB_NAME = 'geoclick';

interface CardStateRow {
	target_id: string;
	ease_factor: number;
	interval: number;
	repetitions: number;
	due_date: string;
	last_reviewed_at: string;
}

interface SessionSummaryRow {
	total: number;
	perfect: number;
	total_errors: number;
	completed_at: string;
}

let dbPromise: Promise<SQLiteDBConnection> | undefined;

// Retained across calls (not just the connection) - closing then
// re-opening the same connection name without going through the
// connection's own close() first throws inside the plugin.
function getDb(): Promise<SQLiteDBConnection> {
	dbPromise ??= (async () => {
		const sqlite = new SQLiteConnection(CapacitorSQLite);
		const isConsistent = (await sqlite.checkConnectionsConsistency()).result;
		const alreadyOpen = (await sqlite.isConnection(DB_NAME, false)).result;
		// The `1` is the plugin's own version argument. Its native open() only
		// acts on it when upgrade statements were registered via
		// addUpgradeStatement (Database.java, @capacitor-community/sqlite 8.1.1),
		// and none are - so the plugin never touches user_version, and
		// migrate() below owns it outright. Do not start using
		// addUpgradeStatement alongside it: two owners of one version number.
		const db =
			isConsistent && alreadyOpen
				? await sqlite.retrieveConnection(DB_NAME, false)
				: await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
		await db.open();
		await migrate(db);
		return db;
	})();
	return dbPromise;
}

export function createCapacitorProgressRepository(): ProgressRepository {
	return {
		async getCardStates(mapId) {
			const db = await getDb();
			const result = await db.query(
				'SELECT target_id, ease_factor, interval, repetitions, due_date, last_reviewed_at FROM card_states WHERE map_id = ?',
				[mapId]
			);
			return ((result.values as CardStateRow[] | undefined) ?? []).map((row) => ({
				targetId: row.target_id,
				easeFactor: row.ease_factor,
				interval: row.interval,
				repetitions: row.repetitions,
				dueDate: row.due_date,
				lastReviewedAt: row.last_reviewed_at
			}));
		},

		async saveCardState(mapId, state: CardState) {
			const db = await getDb();
			await db.run(
				`INSERT INTO card_states (map_id, target_id, ease_factor, interval, repetitions, due_date, last_reviewed_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT (map_id, target_id) DO UPDATE SET
				   ease_factor = excluded.ease_factor,
				   interval = excluded.interval,
				   repetitions = excluded.repetitions,
				   due_date = excluded.due_date,
				   last_reviewed_at = excluded.last_reviewed_at`,
				[
					mapId,
					state.targetId,
					state.easeFactor,
					state.interval,
					state.repetitions,
					state.dueDate,
					state.lastReviewedAt
				]
			);
		},

		async getLastSessionSummary(mapId) {
			const db = await getDb();
			const result = await db.query(
				'SELECT total, perfect, total_errors, completed_at FROM last_session_summaries WHERE map_id = ?',
				[mapId]
			);
			const row = (result.values as SessionSummaryRow[] | undefined)?.[0];
			if (!row) return undefined;
			return {
				total: row.total,
				perfect: row.perfect,
				totalErrors: row.total_errors,
				completedAt: row.completed_at
			};
		},

		async saveLastSessionSummary(mapId, summary: SessionSummary) {
			const db = await getDb();
			await db.run(
				`INSERT INTO last_session_summaries (map_id, total, perfect, total_errors, completed_at)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (map_id) DO UPDATE SET
				   total = excluded.total,
				   perfect = excluded.perfect,
				   total_errors = excluded.total_errors,
				   completed_at = excluded.completed_at`,
				[mapId, summary.total, summary.perfect, summary.totalErrors, summary.completedAt]
			);
		}
	};
}
