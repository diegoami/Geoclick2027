/** One Wikidata SPARQL binding; labels and coordinates travel with population. */
export interface TownBinding {
	[key: string]: { value: string } | undefined;
}
/** Newest observed statement wins, even over a larger old preferred census. */
export function newestTownRows(
	rows: readonly TownBinding[],
	observedAt: string,
	supportedCoordinate: (row: TownBinding) => boolean = () => true
): TownBinding[] {
	const cutoff = Date.parse(observedAt);
	if (!Number.isFinite(cutoff)) throw new Error('Invalid snapshot observation date');
	const newest = new Map<
		string,
		{ row: TownBinding; date: number; population: number; precision: number; supported: boolean }
	>();
	for (const row of rows) {
		const id = row.item?.value;
		const population = Number(row.population?.value);
		if (!id || !Number.isFinite(population) || population < 0)
			throw new Error('Missing item or invalid population in Wikidata row');
		const date = row.date?.value ? Date.parse(row.date.value) : -Infinity;
		if (row.date?.value && !Number.isFinite(date))
			throw new Error('Invalid population date for ' + id);
		if (date > cutoff) continue; // Projections must not replace observed counts.
		const rawPrecision = Number(row.precision?.value);
		const precision = Number.isFinite(rawPrecision) && rawPrecision > 0 ? rawPrecision : Infinity;
		const supported = supportedCoordinate(row);
		const previous = newest.get(id);
		if (
			!previous ||
			date > previous.date ||
			(date === previous.date &&
				(population > previous.population ||
					(population === previous.population &&
						((supported && !previous.supported) ||
							(supported === previous.supported && precision < previous.precision)))))
		)
			newest.set(id, { row, date, population, precision, supported });
	}
	return [...newest.values()].map((entry) => entry.row);
}

/** A replacement point never inherits the unrelated source point's accuracy. */
export function townCoordinate(
	row: TownBinding,
	override?: [number, number]
): {
	coordinates: [number, number];
	precision: number;
} {
	const match = /^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(row.coord?.value ?? '');
	if (!match) throw new Error('Missing or invalid coordinate for ' + row.item?.value);
	const coordinates: [number, number] = override
		? [...override]
		: [Number(match[1]), Number(match[2])];
	if (
		!coordinates.every(Number.isFinite) ||
		Math.abs(coordinates[0]) > 180 ||
		Math.abs(coordinates[1]) > 90
	)
		throw new Error('Coordinate outside Earth bounds for ' + row.item?.value);
	const rawPrecision = Number(row.precision?.value ?? 0);
	return {
		coordinates,
		precision: !override && Number.isFinite(rawPrecision) && rawPrecision > 0 ? rawPrecision : 0
	};
}
