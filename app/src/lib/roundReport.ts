// What a finished round did to a map (#259, #267): the names it made known,
// the ones it cost a level, and whether it counts for a best time. The score
// panel shows it; this module only works it out.
//
// Pure: no DOM, no storage, no Svelte. QuizView takes a snapshot of every
// target's earned level when a round starts and hands it in with the levels
// the round left behind.

import { KNOWN_CLEAN_STREAK } from '@geoclick/srs';

/** How many names a list on the score panel shows before "+N more". */
export const LIST_LIMIT = 8;

export interface RoundChange {
	/** Targets known now that were not known when the round started. */
	newlyKnown: string[];
	/** Targets whose earned level went down during the round. */
	slipped: string[];
}

/** A missing level means "never placed right": 0. */
export function roundChange(
	targetIds: readonly string[],
	before: ReadonlyMap<string, number>,
	after: ReadonlyMap<string, number>
): RoundChange {
	const newlyKnown: string[] = [];
	const slipped: string[] = [];
	for (const id of targetIds) {
		const was = Math.min(KNOWN_CLEAN_STREAK, before.get(id) ?? 0);
		const now = Math.min(KNOWN_CLEAN_STREAK, after.get(id) ?? 0);
		if (now >= KNOWN_CLEAN_STREAK && was < KNOWN_CLEAN_STREAK) newlyKnown.push(id);
		if (now < was) slipped.push(id);
	}
	return { newlyKnown, slipped };
}

/** The first LIST_LIMIT items, and how many more there are. */
export function capped<T>(items: readonly T[]): { shown: T[]; more: number } {
	return { shown: items.slice(0, LIST_LIMIT), more: Math.max(0, items.length - LIST_LIMIT) };
}

/** A round is timed when every name was known as it started (#267): the map
 * has nothing left to learn, so speed is what is left to improve. */
export function isTimedRound(
	targetIds: readonly string[],
	levels: ReadonlyMap<string, number>
): boolean {
	return (
		targetIds.length > 0 && targetIds.every((id) => (levels.get(id) ?? 0) >= KNOWN_CLEAN_STREAK)
	);
}

/** Whether a finished timed round sets a new best: only a round with no
 * mistakes counts, so guessing fast does not pay (#267). */
export function isNewBest(
	elapsedMs: number,
	totalErrors: number,
	bestMs: number | undefined
): boolean {
	return totalErrors === 0 && (bestMs === undefined || elapsedMs < bestMs);
}

/** "1:42", or "12:05"; whole seconds, rounded down. */
export function formatDuration(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
