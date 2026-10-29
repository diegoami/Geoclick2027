// What to play next (#263): one line on the start screen, so a player coming
// back has a place to start among two hundred maps. Taken from what is known,
// never from dates - names do not fade with time (#256).
//
// Pure: the start screen hands in its recent maps, masteries and records.

import type { Mastery } from './homeProgress';

export type Suggestion =
	| { kind: 'continue'; mapId: string; known: number; total: number }
	| { kind: 'slipped'; mapId: string; slipped: number }
	| { kind: 'next'; mapId: string; from: string };

/**
 * The first of: the most recent map not yet complete (said as "slipped" when
 * its last round cost names a level), then the next map of a country whose
 * recent map is complete. Undefined when there is nothing to suggest.
 */
export function suggestNext({
	recent,
	masteries,
	slipped,
	siblingsOf
}: {
	/** Recently opened maps, newest first. */
	recent: readonly string[];
	masteries: Record<string, Mastery | undefined>;
	/** Names that lost a level in each map's last round. */
	slipped: Record<string, number | undefined>;
	/** The other main (not detailed) maps of a map's country, in catalogue order. */
	siblingsOf: (mapId: string) => string[];
}): Suggestion | undefined {
	const complete = (m: Mastery | undefined) => !!m && m.known === m.total;
	for (const mapId of recent) {
		const mastery = masteries[mapId];
		if (!mastery || complete(mastery)) continue;
		const count = slipped[mapId] ?? 0;
		return count > 0
			? { kind: 'slipped', mapId, slipped: count }
			: { kind: 'continue', mapId, known: mastery.known, total: mastery.total };
	}
	for (const mapId of recent) {
		if (!complete(masteries[mapId])) continue;
		const next = siblingsOf(mapId).find((id) => !complete(masteries[id]));
		if (next) return { kind: 'next', mapId: next, from: mapId };
	}
	return undefined;
}
