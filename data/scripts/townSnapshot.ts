/** One Wikidata SPARQL binding; labels and coordinates travel with population. */
export interface TownBinding {
	[key: string]: { value: string } | undefined;
}
/** Newest observed statement wins, even over a larger old preferred census. */
export function newestTownRows(rows: readonly TownBinding[], observedAt: string): TownBinding[] {
	const cutoff = Date.parse(observedAt);
	if (!Number.isFinite(cutoff)) throw new Error('Invalid snapshot observation date');
	const newest = new Map<string, { row: TownBinding; date: number; population: number }>();
	for (const row of rows) {
		const id = row.item?.value;
		const population = Number(row.population?.value);
		if (!id || !Number.isFinite(population) || population < 0)
			throw new Error('Missing item or invalid population in Wikidata row');
		const date = row.date?.value ? Date.parse(row.date.value) : -Infinity;
		if (row.date?.value && !Number.isFinite(date))
			throw new Error('Invalid population date for ' + id);
		if (date > cutoff) continue; // Projections must not replace observed counts.
		const previous = newest.get(id);
		if (
			!previous ||
			date > previous.date ||
			(date === previous.date && population > previous.population)
		)
			newest.set(id, { row, date, population });
	}
	return [...newest.values()].map((entry) => entry.row);
}
