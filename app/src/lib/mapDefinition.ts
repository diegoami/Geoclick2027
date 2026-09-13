// Mirrors the map.json shape produced by data/scripts/build-map.ts.

// 'county' added for Sweden's län - carried as metadata only, like every
// other value here (confirmed nothing in app/ branches on TargetType).
export type TargetType = 'region' | 'state' | 'province' | 'city' | 'county';

export interface Target {
	id: string;
	name: string;
	type: TargetType;
	tier: number;
	aliases: string[];
	centroid: [number, number];
	// For a point target (type: 'city'), degenerate - the centroid repeated
	// as both corners - rather than a separate nullable field, since a
	// point genuinely has no area. The one place bbox is read (TourView's
	// camera framing) already branches on target type instead of assuming
	// bbox always describes a real extent - see MAPS.md's "Point-target
	// design" section.
	bbox: [number, number, number, number];
	// Categorical colour slot 0-5, chosen at build time so no two adjacent
	// targets share one (data/scripts/mapColors.ts). Applied as feature-state
	// by createMap; optional so an older map.json still renders (fallback colour).
	colorIndex?: number;
	// Set only on a target whose bbox wraps the antimeridian (west > east).
	crossesAntimeridian?: true;
}

export interface MapDefinition {
	id: string;
	name: string;
	country: string;
	attribution: string;
	tiles: string;
	targets: Target[];
	tourOrder: string[];
}

/** Overall bounds across every target, for the initial camera fit. Built
 * from centroids rather than per-target bboxes: a target's bbox can wrap
 * the antimeridian (see build-map.ts), and merging wrapping and
 * non-wrapping bboxes into one outer box is ambiguous in general. Centroids
 * are already unwrapped single points, so plain min/max is safe — and
 * covering every centroid with padding is enough for an initial "see the
 * whole map" camera, without needing pixel-exact coverage of every target's
 * full extent (e.g. Alaska's Aleutian tip). */
export function overallBounds(map: MapDefinition): [number, number, number, number] {
	let minLon = Infinity,
		minLat = Infinity,
		maxLon = -Infinity,
		maxLat = -Infinity;
	for (const { centroid } of map.targets) {
		minLon = Math.min(minLon, centroid[0]);
		maxLon = Math.max(maxLon, centroid[0]);
		minLat = Math.min(minLat, centroid[1]);
		maxLat = Math.max(maxLat, centroid[1]);
	}
	return [minLon, minLat, maxLon, maxLat];
}
