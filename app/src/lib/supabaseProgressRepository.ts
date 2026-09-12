// Iteration 8+ (optional cross-device sync): Supabase-backed
// ProgressRepository, the multi-user counterpart to sqliteProgressRepository.ts
// / capacitorProgressRepository.ts. Same card_states/last_session_summaries
// shape as the Tauri/Capacitor SQLite schemas, plus a user_id column and
// Postgres row-level security instead of a single-user local file - see
// data/supabase/schema.sql for the exact DDL and RLS policies. Only ever
// constructed when a Supabase client exists AND a user is signed in (see
// progressSync.ts) - never imported/used for the default signed-out path.
//
// Conflict resolution: last-write-wins per row, via Postgres upsert
// (ON CONFLICT ... DO UPDATE), same as sqliteProgressRepository.ts's
// ON CONFLICT clauses and the localStorage repository's plain overwrite.
// See DECISIONS.md's "Cross-device sync (Supabase)" entry for why this is
// fine here: a single person's own progress across their own devices, not a
// multi-writer document - the same simplification the local backends already
// made.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CardState, ProgressRepository, SessionSummary } from './progressRepository';

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

export function createSupabaseProgressRepository(
	client: SupabaseClient,
	userId: string
): ProgressRepository {
	return {
		async getCardStates(mapId) {
			const { data, error } = await client
				.from('card_states')
				.select('target_id, ease_factor, interval, repetitions, due_date, last_reviewed_at')
				.eq('user_id', userId)
				.eq('map_id', mapId);
			if (error) throw error;
			return ((data as CardStateRow[]) ?? []).map((row) => ({
				targetId: row.target_id,
				easeFactor: row.ease_factor,
				interval: row.interval,
				repetitions: row.repetitions,
				dueDate: row.due_date,
				lastReviewedAt: row.last_reviewed_at
			}));
		},

		async saveCardState(mapId, state: CardState) {
			const { error } = await client.from('card_states').upsert(
				{
					user_id: userId,
					map_id: mapId,
					target_id: state.targetId,
					ease_factor: state.easeFactor,
					interval: state.interval,
					repetitions: state.repetitions,
					due_date: state.dueDate,
					last_reviewed_at: state.lastReviewedAt
				},
				{ onConflict: 'user_id,map_id,target_id' }
			);
			if (error) throw error;
		},

		async getLastSessionSummary(mapId) {
			const { data, error } = await client
				.from('session_summaries')
				.select('total, perfect, total_errors, completed_at')
				.eq('user_id', userId)
				.eq('map_id', mapId)
				.maybeSingle();
			if (error) throw error;
			const row = data as SessionSummaryRow | null;
			if (!row) return undefined;
			return {
				total: row.total,
				perfect: row.perfect,
				totalErrors: row.total_errors,
				completedAt: row.completed_at
			};
		},

		async saveLastSessionSummary(mapId, summary: SessionSummary) {
			const { error } = await client.from('session_summaries').upsert(
				{
					user_id: userId,
					map_id: mapId,
					total: summary.total,
					perfect: summary.perfect,
					total_errors: summary.totalErrors,
					completed_at: summary.completedAt
				},
				{ onConflict: 'user_id,map_id' }
			);
			if (error) throw error;
		}
	};
}
