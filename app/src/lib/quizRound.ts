// A round you are in the middle of, kept while the app is open (FT-26).
//
// Until v0.6.0 a quiz round covered only what was due, and anything already
// placed was not due again that day - so leaving the quiz to look a region up
// in the Overview and coming back showed it still solved. Rounds now cover
// the whole map every time (docs/PLAN_V0.6.md), which would have made that
// same trip wipe the round: the quiz's own step 8 in the tutorial, and the
// manual's advice to look a name up in the Overview, both send the player out
// and back mid-round.
//
// So the round is held here, by map, for as long as the app is open. It is
// deliberately memory only - not localStorage, not SQLite: a round is a
// sitting, and a player coming back tomorrow, or after a reload, should get a
// fresh map rather than someone else's half-finished round. It is dropped as
// soon as the round is finished, or when the tutorial's sandbox ends.

import type { QuizSession } from '@geoclick/quiz-engine';

/** What it takes to carry on exactly where the player left off: the round
 * itself and the names the tray was offering (FT-21's hand). */
export interface RoundInProgress {
	session: QuizSession;
	hand: string[];
}

// Plain Map: nothing renders from it, QuizView copies what it needs into its
// own state on mount.
const rounds = new Map<string, RoundInProgress>();

/** Keeps this map's round, replacing whatever was there. */
export function rememberRound(mapId: string, round: RoundInProgress): void {
	rounds.set(mapId, { session: round.session, hand: [...round.hand] });
}

/** The round this map was left in the middle of, if there is one. */
export function roundInProgress(mapId: string): RoundInProgress | undefined {
	const round = rounds.get(mapId);
	return round && { session: round.session, hand: [...round.hand] };
}

/** Throws this map's round away: it is finished, restarted, was played in
 * the tutorial's sandbox (which keeps nothing), or is about to be shadowed
 * by a tutorial starting on its map (FT-60). */
export function forgetRound(mapId: string): void {
	rounds.delete(mapId);
}
