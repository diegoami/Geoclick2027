// Iteration 7 (desktop POC): SQLite-backed ProgressRepository for the
// Tauri desktop shell, talking to the `tauri-plugin-sql` database opened
// in desktop/src-tauri/src/lib.rs (migrations() there is the schema's
// single source of truth - keep the columns read/written here in sync
// with it). Only ever imported when running inside Tauri (see
// createProgressRepository in progressRepository.ts) - a plain-browser
// build never touches this module or its @tauri-apps/plugin-sql import.

import Database from '@tauri-apps/plugin-sql';
import type { CardState, ProgressRepository, SessionSummary } from './progressRepository';

let dbPromise: ReturnType<typeof Database.load> | undefined;

function getDb() {
	dbPromise ??= Database.load('sqlite:geoclick.db');
	return dbPromise;
}

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

export function createSqliteProgressRepository(): ProgressRepository {
	return {
		async getCardStates(mapId) {
			const db = await getDb();
			const rows = await db.select<CardStateRow[]>(
				'SELECT target_id, ease_factor, interval, repetitions, due_date, last_reviewed_at FROM card_states WHERE map_id = $1',
				[mapId]
			);
			return rows.map((row) => ({
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
			await db.execute(
				`INSERT INTO card_states (map_id, target_id, ease_factor, interval, repetitions, due_date, last_reviewed_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)
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
			const rows = await db.select<SessionSummaryRow[]>(
				'SELECT total, perfect, total_errors, completed_at FROM last_session_summaries WHERE map_id = $1',
				[mapId]
			);
			const row = rows[0];
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
			await db.execute(
				`INSERT INTO last_session_summaries (map_id, total, perfect, total_errors, completed_at)
				 VALUES ($1, $2, $3, $4, $5)
				 ON CONFLICT (map_id) DO UPDATE SET
				   total = excluded.total,
				   perfect = excluded.perfect,
				   total_errors = excluded.total_errors,
				   completed_at = excluded.completed_at`,
				[mapId, summary.total, summary.perfect, summary.totalErrors, summary.completedAt]
			);
		},

		// Two statements, not one transaction: tauri-plugin-sql exposes no
		// transaction API, and a hand-sent BEGIN can land on a different pooled
		// connection than the DELETEs. Worst case on a mid-way failure is a map
		// with its cards cleared but its summary kept - harmless, and a retry
		// finishes the job.
		async clearMap(mapId) {
			const db = await getDb();
			await db.execute('DELETE FROM card_states WHERE map_id = $1', [mapId]);
			await db.execute('DELETE FROM last_session_summaries WHERE map_id = $1', [mapId]);
		},

		async clearAll() {
			const db = await getDb();
			await db.execute('DELETE FROM card_states');
			await db.execute('DELETE FROM last_session_summaries');
		}
	};
}
