// Finding one map among sixty (FT-31, docs/PLAN_V0.7.md).
//
// The home page lists every map grouped by country. At 22 countries that
// was a page to scroll; at 28 countries and 60 maps it is a page to hunt
// through, and the maps a player wants most are often the ones furthest
// down it. A search box over the list is the smallest thing that fixes it,
// and it needs no new concepts: type a few letters, see what matches.
//
// What a query matches: the country's name as shown ("Germany", "South
// Korea") and the map's own label ("States", "Cities — East"). Both are
// what the player can see on the card, which is the only honest thing to
// search. Matching ignores case and accents, so "espana" finds España's
// entries and "cote" would find a Côte, and it matches anywhere in the
// word, so "korea" finds South Korea.

/** One map as the list shows it: its id, and the label under its country. */
export interface SearchableMap {
	id: string;
	label: string;
}

export interface SearchableGroup<T extends SearchableMap = SearchableMap> {
	country: string;
	maps: T[];
}

/** Lower-cased and stripped of accents, so a query can be typed plainly. */
export function fold(text: string): string {
	return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Whether a query matches this country/label pair. An empty query matches
 * everything, which is what an untouched search box should do. */
export function matches(query: string, country: string, label: string): boolean {
	const needle = fold(query);
	if (!needle) return true;
	const haystack = fold(`${country} ${label}`);
	// Every word has to appear somewhere, so "korea towns" narrows rather than
	// widens - the way a player expects two words to work.
	return needle.split(/\s+/).every((word) => haystack.includes(word));
}

/**
 * The groups that still have something to show, with only their matching
 * maps. A country whose own name matches keeps all of its maps: searching
 * "japan" should show everything Japan has, not just the map whose label
 * happens to contain the word.
 */
export function filterGroups<T extends SearchableMap>(
	groups: SearchableGroup<T>[],
	query: string
): SearchableGroup<T>[] {
	const needle = fold(query);
	if (!needle) return groups;
	const result: SearchableGroup<T>[] = [];
	for (const group of groups) {
		const wholeCountry = matches(query, group.country, '');
		const maps = wholeCountry
			? group.maps
			: group.maps.filter((m) => matches(query, group.country, m.label));
		if (maps.length > 0) result.push({ ...group, maps });
	}
	return result;
}

/** How many maps a filtered list holds, for the "N maps" line. */
export function countMaps(groups: SearchableGroup[]): number {
	return groups.reduce((total, group) => total + group.maps.length, 0);
}
