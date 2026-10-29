// Name-it mode (#264): a place lights up and the player picks its name from a
// few. The wrong names on offer are the nearest places, so the choice has to
// be made on knowledge rather than on which name is obviously far away, and
// the better the map is known, the more names are on offer - the same ladder
// the tray's hand climbs the other way (difficulty.ts).
//
// Pure: no DOM, no map. QuizView owns the highlight and the buttons.

import type { Level } from './difficulty';

/** How many names are offered at each level, the right one included. */
export const CHOICE_COUNTS = [4, 4, 5, 6] as const;

export function choiceCount(level: Level): number {
	return CHOICE_COUNTS[level];
}

interface Place {
	id: string;
	centroid: [number, number];
}

/** The `count` places nearest to `id`, nearest first. Longitude is scaled by
 * the cosine of the latitude, so a degree east counts for less far north. */
export function nearestOthers(places: readonly Place[], id: string, count: number): string[] {
	const from = places.find((p) => p.id === id);
	if (!from) return [];
	const [lng0, lat0] = from.centroid;
	const scale = Math.cos((lat0 * Math.PI) / 180);
	return places
		.filter((p) => p.id !== id)
		.map((p) => {
			const dx = (p.centroid[0] - lng0) * scale;
			const dy = p.centroid[1] - lat0;
			return { id: p.id, d: dx * dx + dy * dy };
		})
		.sort((a, b) => a.d - b.d || a.id.localeCompare(b.id))
		.slice(0, count)
		.map((p) => p.id);
}

/** The names on offer for `askedId`: it and its nearest neighbours, shuffled. */
export function choicesFor(
	places: readonly Place[],
	askedId: string,
	count: number,
	random: () => number = Math.random
): string[] {
	const ids = [askedId, ...nearestOthers(places, askedId, count - 1)];
	for (let i = ids.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[ids[i], ids[j]] = [ids[j], ids[i]];
	}
	return ids;
}
