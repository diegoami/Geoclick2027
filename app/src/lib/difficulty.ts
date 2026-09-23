// How hard a map plays, from how well it is known (FT-21, docs/PLAN_V0.6.md).
//
// The quiz used to lay every remaining name in the tray, so the last few drops
// could be worked out by elimination and a map you knew well played exactly
// like the first time. Instead the tray now holds a *hand*: a few names at a
// time, refilled as they are placed. The better the map is known, the smaller
// the hand, until each name has to be placed on its own merits.
//
// Pure: no DOM, no storage, no Svelte. QuizView owns when to draw.

import { KNOWN_CLEAN_STREAK } from '@geoclick/srs';

/** 0 = new map, 3 = known map. */
export type Level = 0 | 1 | 2 | 3;

/** The share of a map's names that must be known to reach each level. */
export const LEVEL_SHARES = [0, 0.25, 0.6, 0.85] as const;

/** How many names the tray offers at each level. Level 0 was Infinity ("all
 * of them") until FT-60: a new map laid its whole deck in the tray - 110 slips
 * on italy-provinces - so the first hand now holds 10 (product owner,
 * 2026-09-23). The rest of the curve is a first guess, not measured. */
export const HAND_SIZES = [10, 6, 3, 1] as const;

/** A name counts towards the level once it has been placed right this many
 * times in a row with no mistake (packages/srs). */
export { KNOWN_CLEAN_STREAK };

/** How many of a map's targets are known: their clean streak, in any order,
 * with a missing entry meaning "never played". */
export function knownCount(streaks: readonly number[]): number {
	return streaks.filter((s) => s >= KNOWN_CLEAN_STREAK).length;
}

/** The map's level, from one clean streak per target of the map. An empty map
 * (no targets at all) is level 0. */
export function mapLevel(streaks: readonly number[]): Level {
	if (streaks.length === 0) return 0;
	const share = knownCount(streaks) / streaks.length;
	let level: Level = 0;
	for (let i = 1; i < LEVEL_SHARES.length; i++) {
		if (share >= LEVEL_SHARES[i]) level = i as Level;
	}
	return level;
}

/** How many names the tray offers at that level. */
export function handSize(level: Level): number {
	return HAND_SIZES[level];
}

/**
 * The names on offer after a drop: whatever is still pending and was already
 * on offer, topped back up to `size` with a random pick of the rest. Keeping
 * the survivors means a name the player has been staring at doesn't vanish
 * mid-thought.
 *
 * `preferred` names, where still pending, are dealt ahead of the random pick:
 * the tutorial spotlights Sicilia and Sardegna, and a hand of ten from Italy's
 * twenty regions would otherwise leave each out half the time (FT-60).
 */
export function refillHand(
	pendingIds: readonly string[],
	hand: readonly string[],
	size: number,
	random: () => number = Math.random,
	preferred: readonly string[] = []
): string[] {
	const pending = new Set(pendingIds);
	const kept = [...new Set(hand)].filter((id) => pending.has(id));
	if (kept.length >= size) return kept.slice(0, size);
	for (const id of preferred) {
		if (kept.length < size && pending.has(id) && !kept.includes(id)) kept.push(id);
	}
	const pool = pendingIds.filter((id) => !kept.includes(id));
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	return [...kept, ...pool.slice(0, size - kept.length)];
}
