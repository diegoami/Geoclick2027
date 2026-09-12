// Iteration 8+ (optional cross-device sync): the one place that decides
// whether progress reads/writes go to the existing local backend
// (localStorage/SQLite/Capacitor SQLite, picked by createProgressRepository
// in progressRepository.ts - completely unchanged by this file) or to
// Supabase, once someone's actually signed in. Call sites (QuizView, the
// home page) should call createActiveProgressRepository() instead of
// createProgressRepository() directly to get sync behavior automatically -
// while signed out (the default, every existing user) it's a pure pass-
// through to the local repository, byte-for-byte the same as before this
// feature existed.
//
// Sync strategy (see DECISIONS.md's "Cross-device sync (Supabase)" entry
// for the full reasoning):
// - Signed out: behave exactly as today. No Supabase calls at all.
// - Signed in, a given map has no remote rows yet: push that map's local
//   card states + summary up on first read, so a device's existing
//   progress isn't silently discarded the first time someone signs in.
// - Signed in, a given map already has remote rows: remote is the source
//   of truth from then on - local storage on this device is left alone
//   (stale) until the next sign-in elsewhere reconciles it. This is a
//   deliberate simplification for a portfolio-project sync feature, not a
//   general offline-first merge system - see DECISIONS.md.
// - All writes while signed in go to Supabase only, per the above.

import { getSupabaseClient } from './supabaseClient';
import { authState } from './authStore.svelte';
import { createProgressRepository, type ProgressRepository } from './progressRepository';
import { createSupabaseProgressRepository } from './supabaseProgressRepository';

// Per-mapId "have we already checked/pushed this map's local data up?"
// cache, so a map visited repeatedly in one session doesn't re-run the
// empty-remote check every single read. Cleared implicitly on page reload -
// deliberately not persisted, since it's just an optimization, not state
// anything depends on for correctness (re-checking an already-populated
// remote map is a harmless no-op read).
const reconciledMapIds = new Set<string>();

function wrapWithSync(local: ProgressRepository, remote: ProgressRepository): ProgressRepository {
	async function pushLocalIfRemoteEmpty(mapId: string): Promise<void> {
		if (reconciledMapIds.has(mapId)) return;
		reconciledMapIds.add(mapId);
		const [remoteStates, remoteSummary] = await Promise.all([
			remote.getCardStates(mapId),
			remote.getLastSessionSummary(mapId)
		]);
		if (remoteStates.length > 0 || remoteSummary) return; // remote already has data - remote wins, nothing to push
		const [localStates, localSummary] = await Promise.all([
			local.getCardStates(mapId),
			local.getLastSessionSummary(mapId)
		]);
		await Promise.all(localStates.map((state) => remote.saveCardState(mapId, state)));
		if (localSummary) await remote.saveLastSessionSummary(mapId, localSummary);
	}

	return {
		async getCardStates(mapId) {
			await pushLocalIfRemoteEmpty(mapId);
			return remote.getCardStates(mapId);
		},
		async saveCardState(mapId, state) {
			reconciledMapIds.add(mapId); // an explicit write means this map no longer needs a local->remote push
			return remote.saveCardState(mapId, state);
		},
		async getLastSessionSummary(mapId) {
			await pushLocalIfRemoteEmpty(mapId);
			return remote.getLastSessionSummary(mapId);
		},
		async saveLastSessionSummary(mapId, summary) {
			reconciledMapIds.add(mapId);
			return remote.saveLastSessionSummary(mapId, summary);
		}
	};
}

// The function call sites should use in place of createProgressRepository()
// directly. Falls back to the plain local repository (identical to today's
// behavior) whenever Supabase isn't configured or nobody's signed in.
export async function createActiveProgressRepository(): Promise<ProgressRepository> {
	const local = await createProgressRepository();
	const client = getSupabaseClient();
	if (!client || !authState.session) return local;
	const remote = createSupabaseProgressRepository(client, authState.session.user.id);
	return wrapWithSync(local, remote);
}
