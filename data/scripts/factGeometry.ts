// The geometry behind the derived fact (FT-34, docs/PLAN_V0.8.md). Pure and
// unit-tested; build-facts.ts does the file and process work around it.
//
// Everything here answers one of four questions about a place, and each one
// earns its keep as a memory hook: is it on the sea, what is it sitting in,
// what is its biggest town, and whereabouts in the country is it.

export type Bbox = [number, number, number, number];
export type Position = [number, number];

/** Any GeoJSON geometry, walked generically - we only ever need its points. */
export interface AnyGeometry {
	coordinates: unknown;
}

/** Calls `visit` for every coordinate pair in a geometry, however nested. */
export function eachPosition(geometry: AnyGeometry, visit: (position: Position) => void): void {
	const walk = (coords: unknown): void => {
		if (!Array.isArray(coords)) return;
		if (typeof coords[0] === 'number') {
			visit(coords as Position);
			return;
		}
		for (const part of coords) walk(part);
	};
	walk(geometry.coordinates);
}

// --- Is it on the sea? -----------------------------------------------------
//
// Natural Earth's admin-1 polygons and its coastline come from the same
// generalisation of the same land, so a coastal region's boundary does not
// merely run near the coastline - it shares vertices with it. That makes the
// test a hash lookup rather than a distance computation, and it is exact
// rather than approximate: checked against Italy, where it returns precisely
// the five landlocked regions (Valle d'Aosta, Piemonte, Lombardia,
// Trentino-Alto Adige, Umbria) and the fifteen coastal ones.

/** Grid cells per degree. 100 is about a kilometre at the equator. */
export const COAST_PRECISION = 100;

function cellKey(lon: number, lat: number): string {
	return `${Math.round(lon * COAST_PRECISION)}:${Math.round(lat * COAST_PRECISION)}`;
}

/** Every coastline vertex, as a set of grid cells to test against. */
export function coastIndex(geometries: AnyGeometry[]): Set<string> {
	const cells = new Set<string>();
	for (const geometry of geometries) {
		eachPosition(geometry, ([lon, lat]) => cells.add(cellKey(lon, lat)));
	}
	return cells;
}

/** True when a region's own boundary runs along the coast. */
export function touchesCoast(geometry: AnyGeometry, coast: Set<string>): boolean {
	let found = false;
	eachPosition(geometry, ([lon, lat]) => {
		if (!found && coast.has(cellKey(lon, lat))) found = true;
	});
	return found;
}

/**
 * True when a point sits within `cells` grid steps of the coast - the test
 * for a town, which has no boundary of its own to share.
 *
 * Approximate on purpose: a grid step is a degree of longitude, so the
 * search box narrows towards the poles (0.15 deg is about 17 km at the
 * equator and 8 km at 60 deg N). For "is this a coastal city" that is well
 * inside the margin the answer itself has.
 */
export function nearCoast([lon, lat]: Position, coast: Set<string>, cells = 15): boolean {
	const x = Math.round(lon * COAST_PRECISION);
	const y = Math.round(lat * COAST_PRECISION);
	for (let dx = -cells; dx <= cells; dx++) {
		for (let dy = -cells; dy <= cells; dy++) {
			if (coast.has(`${x + dx}:${y + dy}`)) return true;
		}
	}
	return false;
}

// --- What is it sitting in, and what is inside it? -------------------------

/**
 * Ray casting, counting crossings of every ring. A point in a hole of a
 * polygon crosses the outer ring once and the hole's ring once, so it comes
 * out even - which is the right answer without treating holes specially.
 */
export function pointInPolygon([lon, lat]: Position, geometry: AnyGeometry): boolean {
	const rings: Position[][] = [];
	const collect = (coords: unknown, depth: number): void => {
		if (!Array.isArray(coords) || coords.length === 0) return;
		const first = coords[0];
		if (Array.isArray(first) && typeof first[0] === 'number') {
			rings.push(coords as Position[]);
			return;
		}
		for (const part of coords) collect(part, depth + 1);
	};
	collect(geometry.coordinates, 0);

	let inside = false;
	for (const ring of rings) {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [xi, yi] = ring[i];
			const [xj, yj] = ring[j];
			if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
				inside = !inside;
			}
		}
	}
	return inside;
}

/** The bounding box of a geometry. */
export function bboxOf(geometry: AnyGeometry): Bbox {
	let minLon = Infinity;
	let minLat = Infinity;
	let maxLon = -Infinity;
	let maxLat = -Infinity;
	eachPosition(geometry, ([lon, lat]) => {
		if (lon < minLon) minLon = lon;
		if (lon > maxLon) maxLon = lon;
		if (lat < minLat) minLat = lat;
		if (lat > maxLat) maxLat = lat;
	});
	return [minLon, minLat, maxLon, maxLat];
}

/**
 * A point guaranteed to be INSIDE the shape, not merely in the middle of
 * its box (FT-33 fix, 2026-09-19).
 *
 * The middle of the box is wrong for anything long, curved or bent round a
 * coast, and it put two real labels in the sea on the Italy map: the
 * Apennines, which follow the peninsula, and the Balkan Peninsula, whose
 * box straddles the Adriatic. This walks the widest horizontal slice
 * through the shape and takes the middle of the longest run that is inside
 * it - the standard "representative point", and cheap enough at this scale.
 */
export function interiorPoint(geometry: AnyGeometry): Position {
	const [minLon, minLat, maxLon, maxLat] = bboxOf(geometry);
	const centre: Position = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
	if (pointInPolygon(centre, geometry)) return centre;

	// Scan a few heights rather than only the middle one: a crescent has no
	// interior at its own mid-latitude.
	const SLICES = 9;
	let best: { point: Position; width: number } | undefined;
	for (let i = 1; i < SLICES; i++) {
		const lat = minLat + ((maxLat - minLat) * i) / SLICES;
		const crossings: number[] = [];
		for (const ring of ringsOf(geometry)) {
			for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
				const [xa, ya] = ring[a];
				const [xb, yb] = ring[b];
				if (ya > lat !== yb > lat) crossings.push(((xb - xa) * (lat - ya)) / (yb - ya) + xa);
			}
		}
		crossings.sort((p, q) => p - q);
		// Crossings pair up into inside-spans: [0,1] is inside, [1,2] is not.
		for (let k = 0; k + 1 < crossings.length; k += 2) {
			const width = crossings[k + 1] - crossings[k];
			if (!best || width > best.width) {
				best = { point: [(crossings[k] + crossings[k + 1]) / 2, lat], width };
			}
		}
	}
	return best?.point ?? centre;
}

/** Every linear ring of a polygon or multipolygon. */
function ringsOf(geometry: AnyGeometry): Position[][] {
	const rings: Position[][] = [];
	const collect = (coords: unknown): void => {
		if (!Array.isArray(coords) || coords.length === 0) return;
		const first = coords[0];
		if (Array.isArray(first) && typeof first[0] === 'number') {
			rings.push(coords as Position[]);
			return;
		}
		for (const part of coords) collect(part);
	};
	collect(geometry.coordinates);
	return rings;
}

/**
 * Roughly how much of `box` this shape covers, by sampling a grid.
 *
 * Used to answer "is this name about this map?" for a feature whose own
 * middle lies elsewhere. The Sahara's middle is in Algeria, but it covers
 * most of a map of Egypt and belongs on it; the Balkan Peninsula's middle
 * is in Serbia and it clips only the eastern edge of a map of Italy, where
 * its name helps nobody.
 */
export function coverageOf(geometry: AnyGeometry, box: Bbox, steps = 12): number {
	let inside = 0;
	for (let i = 0; i < steps; i++) {
		for (let j = 0; j < steps; j++) {
			const lon = box[0] + ((box[2] - box[0]) * (i + 0.5)) / steps;
			const lat = box[1] + ((box[3] - box[1]) * (j + 0.5)) / steps;
			if (pointInPolygon([lon, lat], geometry)) inside++;
		}
	}
	return inside / (steps * steps);
}

// --- Whereabouts in the country is it? -------------------------------------

/**
 * Where a place sits inside the country's own extent, in words: "in the
 * north-west", "on the east side", "in the middle". The middle third of each
 * axis counts as neither, so only a place genuinely towards an edge is
 * described as being there - otherwise every region in a small country would
 * be in a corner of it.
 */
export function compassPosition(centre: Position, extent: Bbox): Position2Words {
	const [lon, lat] = centre;
	const [minLon, minLat, maxLon, maxLat] = extent;
	const fraction = (value: number, min: number, max: number) =>
		max === min ? 0.5 : (value - min) / (max - min);
	const band = (f: number): -1 | 0 | 1 => (f < 1 / 3 ? -1 : f > 2 / 3 ? 1 : 0);

	const ew = band(fraction(lon, minLon, maxLon));
	const ns = band(fraction(lat, minLat, maxLat));
	if (ns === 0 && ew === 0) return 'centre';
	if (ns === 0) return ew === -1 ? 'west' : 'east';
	if (ew === 0) return ns === -1 ? 'south' : 'north';
	if (ns === 1) return ew === -1 ? 'north-west' : 'north-east';
	return ew === -1 ? 'south-west' : 'south-east';
}

export type Position2Words =
	| 'north'
	| 'south'
	| 'east'
	| 'west'
	| 'north-east'
	| 'north-west'
	| 'south-east'
	| 'south-west'
	| 'centre';
