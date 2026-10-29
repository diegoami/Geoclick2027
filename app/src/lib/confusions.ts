// The mix-ups a map remembers (#266): which name was dropped on which other
// place, and how often. The quiz deals a remembered partner next to its name,
// so the two have to be told apart, and the score panel names the pairs.
//
// Pure: no DOM, no storage. QuizView keeps the list in the map's records
// (progressRepository.ts MapRecords).

import { KNOWN_CLEAN_STREAK } from '@geoclick/srs';
import type { Confusion } from './progressRepository';

/** How many pairs a map keeps, the most frequent first. */
export const CONFUSION_LIMIT = 20;

/** Counts one more mix-up of `targetId` with `chosenId`. */
export function recordConfusion(
	list: readonly Confusion[],
	targetId: string,
	chosenId: string
): Confusion[] {
	if (targetId === chosenId) return [...list];
	const found = list.find((c) => c.targetId === targetId && c.chosenId === chosenId);
	const next = found
		? list.map((c) => (c === found ? { ...c, count: c.count + 1 } : c))
		: [...list, { targetId, chosenId, count: 1 }];
	// Stable: among equal counts the older pair stays ahead.
	return next
		.map((c, i) => ({ c, i }))
		.sort((a, b) => b.c.count - a.c.count || a.i - b.i)
		.slice(0, CONFUSION_LIMIT)
		.map(({ c }) => c);
}

/** Drops the pairs whose two names are both known now: told apart at last. */
export function forgetLearned(
	list: readonly Confusion[],
	levels: ReadonlyMap<string, number>
): Confusion[] {
	const known = (id: string) => (levels.get(id) ?? 0) >= KNOWN_CLEAN_STREAK;
	return list.filter((c) => !(known(c.targetId) && known(c.chosenId)));
}

/** The names paired with any of `ids`, either way round, most frequent pair
 * first, without repeats and without `ids` themselves. */
export function partnersOf(list: readonly Confusion[], ids: readonly string[]): string[] {
	const given = new Set(ids);
	const partners: string[] = [];
	for (const c of list) {
		const partner = given.has(c.targetId)
			? c.chosenId
			: given.has(c.chosenId)
				? c.targetId
				: undefined;
		if (partner && !given.has(partner) && !partners.includes(partner)) partners.push(partner);
	}
	return partners;
}
