// Choosing which places go on a city map, and what each one is called
// (FT-27, docs/PLAN_V0.7.md).
//
// Both halves are pure and live here, away from build-points-map.ts's
// ogr2ogr/tippecanoe plumbing, so they can be tested against real cases
// without a toolchain: app/src/lib/placeSelection.test.ts does exactly that,
// the same way mapColors.ts is tested.
//
// Why a slice at all: the United States has 281 cities over 100 000 and 177
// over 200 000, far more than one map can ask a player to place - and on a
// country-wide map Newark and New York are 16.8 km apart, about two pixels,
// which no amount of label work can make playable. A map of one part of the
// country is both shorter and zoomed in enough to be fair.

/** A place as the builder sees it, before it becomes a target. */
export interface Place {
	name: string;
	/** The admin-1 region it sits in (Natural Earth's ADM1NAME), for telling
	 * two places of the same name apart. */
	region?: string;
	population: number;
	lon: number;
	lat: number;
}

/** The box a slice keeps, in degrees. Any side left out is unbounded. */
export interface Bounds {
	lonMin: number;
	lonMax: number;
	latMin: number;
	latMax: number;
}

export const UNBOUNDED: Bounds = {
	lonMin: -Infinity,
	lonMax: Infinity,
	latMin: -Infinity,
	latMax: Infinity
};

/** Reads --lon-min/--lon-max/--lat-min/--lat-max, all optional. */
export function parseBounds(args: Record<string, string>): Bounds {
	const read = (key: string, fallback: number) => {
		if (args[key] === undefined) return fallback;
		const value = Number(args[key]);
		if (!Number.isFinite(value)) throw new Error(`--${key} must be a number, got "${args[key]}"`);
		return value;
	};
	const bounds: Bounds = {
		lonMin: read('lon-min', -Infinity),
		lonMax: read('lon-max', Infinity),
		latMin: read('lat-min', -Infinity),
		latMax: read('lat-max', Infinity)
	};
	if (bounds.lonMin > bounds.lonMax || bounds.latMin > bounds.latMax)
		throw new Error('The slice is empty: its minimum is above its maximum.');
	return bounds;
}

/** Whether a slice was asked for at all - used only to say so in the log. */
export function isUnbounded(bounds: Bounds): boolean {
	return (
		bounds.lonMin === -Infinity &&
		bounds.lonMax === Infinity &&
		bounds.latMin === -Infinity &&
		bounds.latMax === Infinity
	);
}

/**
 * The places inside the slice. Deliberately applied before the population
 * threshold and before --min-count/--max-count, so "the 50 biggest" means the
 * 50 biggest *of this slice* rather than of the country.
 */
export function withinBounds<T extends { lon: number; lat: number }>(
	places: T[],
	bounds: Bounds
): T[] {
	return places.filter(
		(p) =>
			p.lon >= bounds.lonMin &&
			p.lon <= bounds.lonMax &&
			p.lat >= bounds.latMin &&
			p.lat <= bounds.latMax
	);
}

/**
 * Tells apart places that share a name, by adding the region they are in:
 * "Kansas City" becomes "Kansas City, Missouri" and "Kansas City, Kansas".
 *
 * A map's target names have to be unique - data/styles/base.json keys every
 * feature by its name (promoteId) - and the United States alone has fifteen
 * repeated city names above 100 000 (Springfield, Columbus, Portland,
 * Charleston...). Dropping the smaller one would quietly lose a real city, so
 * both are kept and named apart, with the plain name added as an alias so the
 * quiz's own matching still accepts what a player would type or expect.
 *
 * A place whose name is already unique is left exactly as it was, which is why
 * every map built before this existed rebuilds identically.
 */
export function disambiguate<T extends { name: string; region?: string }>(
	places: T[]
): (T & { name: string; aliases: string[] })[] {
	// Two rows with the same name AND the same region are the same place twice
	// - Natural Earth has a few (Turkey has both "Sakarya" and "Adapazarı" for
	// the same city, 3 km apart, and both are Adapazarı in Turkish). Renaming
	// those would hide a duplicate behind two different names instead of
	// letting the builder collapse them, so a name is only split apart when
	// the places really are in different regions.
	const regionsByName = new Map<string, Set<string>>();
	for (const place of places) {
		const regions = regionsByName.get(place.name) ?? new Set<string>();
		regions.add(place.region ?? '');
		regionsByName.set(place.name, regions);
	}

	return places.map((place) => {
		const shared = (regionsByName.get(place.name)?.size ?? 0) > 1;
		if (!shared || !place.region) return { ...place, aliases: [] };
		return {
			...place,
			name: `${place.name}, ${place.region}`,
			// What the player knows the place as; the quiz matches aliases too.
			aliases: [place.name]
		};
	});
}

/** Great-circle distance in km, on the sphere - plenty for "too close". */
export function distanceKm(
	a: { lon: number; lat: number },
	b: { lon: number; lat: number }
): number {
	const rad = Math.PI / 180;
	const dLat = (b.lat - a.lat) * rad;
	const dLon = (b.lon - a.lon) * rad;
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
	return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

/**
 * Skips any place within `minKm` of one already kept, in the order given
 * (#39, batch C). Given places sorted by population, a suburb gives way to
 * the city it borders: around Frankfurt, Maintal and Mühlheim am Main are
 * 2 km apart, a few pixels at the zoom a map of Hessen opens at, against a
 * slip's 24 px drop target. The next town down takes the freed place, so a
 * map keeps its size and spreads out instead.
 */
export function spacedOut<T extends { lon: number; lat: number }>(places: T[], minKm: number): T[] {
	if (!(minKm > 0)) return places;
	const kept: T[] = [];
	for (const place of places) {
		if (kept.every((other) => distanceKm(place, other) >= minKm)) kept.push(place);
	}
	return kept;
}
