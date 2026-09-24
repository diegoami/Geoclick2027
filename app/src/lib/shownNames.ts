// Which names the Known map draws, and what a tap does (FT-39,
// docs/PLAN_V0.9.md).
//
// Two inputs, one rule. What the player has EARNED is the clean streak the
// quiz keeps (FT-22): a name placed right at least once is drawn, in three
// strengths. What the player has CHOSEN is an override recorded by tapping
// the place, kept for the session in mapPrefs.svelte.ts (#11).
//
//   override            name is drawn
//   ------------------  -----------------------------------------
//   none                if cleanStreak >= 1, as it always was
//   'shown'             always, as Chosen ('asked'), whatever the streak
//   'hidden'            never, whatever the streak
//
// A tap writes whichever override contradicts what is on the screen right
// now. That is the whole of it, and it matters that it stays that small:
// the player never has to know there are two inputs, because tapping always
// does the visible thing.

import { KNOWN_CLEAN_STREAK } from './difficulty';

export type NameOverride = 'shown' | 'hidden';

/** How strongly a name is drawn, or undefined for "don't draw it". */
export type NameTier = 'known' | 'nearly' | 'seen' | 'asked';

/** What the clean streak alone would draw (FT-22's three strengths). */
export function earnedTier(cleanStreak: number): NameTier | undefined {
	if (cleanStreak >= KNOWN_CLEAN_STREAK) return 'known';
	if (cleanStreak === 2) return 'nearly';
	if (cleanStreak === 1) return 'seen';
	return undefined;
}

/**
 * The strength a name is drawn at, taking the player's choice into account.
 *
 * A name the player tapped onto the map is drawn as Chosen ('asked'), even
 * one they have already earned: an explicit tap outranks the streak
 * (product owner, #11). The choice lasts for the session, so the earned
 * strengths come back when the app is reopened.
 */
export function visibleTier(
	cleanStreak: number,
	override: NameOverride | undefined
): NameTier | undefined {
	if (override === 'hidden') return undefined;
	if (override === 'shown') return 'asked';
	return earnedTier(cleanStreak);
}

/** Whether a name is on the map at all. */
export function isVisible(cleanStreak: number, override: NameOverride | undefined): boolean {
	return visibleTier(cleanStreak, override) !== undefined;
}

/**
 * What tapping this place should record. Always the opposite of what can be
 * seen, so a tap on a visible name hides it and a tap on a blank one shows
 * it - whichever of the two inputs put it there.
 */
export function tapOverride(cleanStreak: number, override: NameOverride | undefined): NameOverride {
	return isVisible(cleanStreak, override) ? 'hidden' : 'shown';
}
