// Small helpers shared between build-map.ts (polygon targets) and
// build-points-map.ts (point targets) - kept here rather than duplicated,
// since both scripts need them identically. See MAPS.md's "Point-target
// design" section for why point maps get a separate script instead of
// branches added throughout build-map.ts.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverageOf, interiorPoint, type AnyGeometry } from './factGeometry.js';
import { sqlIn } from './multiCountry.js';

export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const LAKES_SHP = path.join(REPO_ROOT, 'data/source/ne_10m_lakes/ne_10m_lakes.shp');
export const ADMIN1_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_admin_1_states_provinces/ne_10m_admin_1_states_provinces.shp'
);
// Countries, for the maps that span several of them (#39).
export const ADMIN0_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_admin_0_countries/ne_10m_admin_0_countries.shp'
);
// The Terrain layer's sources (FT-33, docs/PLAN_V0.8.md).
export const OCEAN_SHP = path.join(REPO_ROOT, 'data/source/ne_10m_ocean/ne_10m_ocean.shp');
export const RIVERS_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_rivers_lake_centerlines/ne_10m_rivers_lake_centerlines.shp'
);
export const TERRAIN_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_geography_regions_polys/ne_10m_geography_regions_polys.shp'
);
export const MARINE_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_geography_marine_polys/ne_10m_geography_marine_polys.shp'
);
// FT-37's two landmark sources.
export const PEAKS_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_geography_regions_elevation_points/ne_10m_geography_regions_elevation_points.shp'
);
export const LINES_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_geographic_lines/ne_10m_geographic_lines.shp'
);

/** Every source the Terrain layer needs; both builders require all of them. */
export const PHYSICAL_SHPS = [OCEAN_SHP, RIVERS_SHP, TERRAIN_SHP, MARINE_SHP, PEAKS_SHP, LINES_SHP];

/**
 * Which of the given shapefiles have not been downloaded. Named rather than
 * boolean so the error can say *which* one is missing - with eight datasets
 * now, "source shapefile not found" on its own is not a useful message.
 */
export function missingSources(required: string[]): string[] {
	return required.filter((file) => !existsSync(file));
}

export function parseArgs(argv: string[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const arg of argv) {
		const match = /^--([^=]+)=(.*)$/.exec(arg);
		if (match) out[match[1]] = match[2];
	}
	return out;
}

// The pmtiles CLI, from PATH by default. Set PMTILES_BIN to point elsewhere
// (e.g. PMTILES_BIN=$HOME/.local/bin/pmtiles if ~/.local/bin is not on PATH).
// Replaced a hardcoded $HOME/.local/bin path that only worked on one machine.
export const PMTILES_BIN = process.env.PMTILES_BIN ?? 'pmtiles';

export function pmtilesConvert(mbtilesPath: string, pmtilesPath: string): void {
	try {
		execFileSync(PMTILES_BIN, ['convert', mbtilesPath, pmtilesPath]);
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new Error(
				`pmtiles CLI not found ("${PMTILES_BIN}"). Put it on PATH, or set PMTILES_BIN to its full path - see MAPS.md.`,
				{ cause: e }
			);
		}
		throw e;
	}
}

// Strips combining diacritics after NFD (U+0300-U+036F: "München" -> "munchen").
// LIMITATIONS, documented rather than fixed (GC-031):
// - No non-Latin fallback. Every character outside a-z/0-9 becomes "-", so a
//   name in Cyrillic, CJK, Devanagari etc. slugs to "" - a future
//   --name-field=NAME_RU or NAME_ZH would give every target the id "".
//   GC-030's mapData.test.ts would catch the duplicate ids; pick a
//   transliteration (or keep the English name for the id) first.
// - Latin letters with no NFD decomposition (Ł, Ø, ß, Đ, Æ...) are dropped, not
//   transliterated. Shipped ids already carry this: "ma-opolskie", "wroc-aw",
//   "bia-ystok", "odz", "odzkie" (Poland). Do NOT "fix" slugify in place:
//   target ids key every player's saved progress (card_states), so changing
//   them silently orphans it. A fix needs a transliteration applied to NEW maps
//   only, or an id migration in the progress stores.
export function slugify(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * True when a bbox wraps the antimeridian: build-map.ts's boundsOf unwraps a
 * shape spanning +/-180deg (Chukotka, the Aleutians) and emits west > east,
 * e.g. [157.692, 61.8148, -169.7009, 71.6]. MapLibre handles that
 * (cameraForBounds adjusts for it), but naive min/max consumers do not -
 * overallBboxOf below is one (it mis-clips the lake -spat filter for Russia).
 * The bbox is deliberately NOT "fixed"; targets like this get an explicit
 * `crossesAntimeridian: true` so the condition is documented, not rediscovered.
 */
export function crossesAntimeridian(bbox: [number, number, number, number]): boolean {
	return bbox[0] > bbox[2];
}

export function overallBboxOf(
	targets: { bbox: [number, number, number, number] }[]
): [number, number, number, number] {
	return targets.reduce(
		(acc: [number, number, number, number], t) => [
			Math.min(acc[0], t.bbox[0]),
			Math.min(acc[1], t.bbox[1]),
			Math.max(acc[2], t.bbox[2]),
			Math.max(acc[3], t.bbox[3])
		],
		[Infinity, Infinity, -Infinity, -Infinity]
	);
}

// Water context: without lakes rendered, a target whose border runs along
// one (Michigan on the Great Lakes is the worst case) reads as an
// unexplained gap next to its neighbors rather than a coastline. Selected
// by bounding-box intersection with the map's overall extent (`-spat`, a
// feature filter, not a geometry clip) rather than by country - lakes
// aren't tagged to an admin boundary the way states/provinces are, and a
// lake is still worth rendering even if it pokes slightly outside the
// map's bounds.
export function selectNearbyLakes(bbox: [number, number, number, number], outPath: string): void {
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-spat',
		...bbox.map(String),
		'-select',
		'name',
		outPath,
		LAKES_SHP
	]);
}

// Land context for a point map: without any shape at all behind the
// markers, a towns map has no sense of the country's outline or its
// internal region/state borders - a polygon map doesn't have this problem
// (the targets themselves, filled edge to edge, already show the whole
// country), but a point map has nothing filling that role. Reuses the
// same admin-1 dataset build-map.ts already uses for the actual polygon
// maps, purely for visual context here - not hit-tested, no feature-state,
// same treatment as the lakes layer.
export function selectCountryContext(country: string, outPath: string): void {
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-where',
		`admin='${country}'`,
		'-select',
		'name',
		outPath,
		ADMIN1_SHP
	]);
}

// Land context for a map of several countries (#39): every country's outline
// inside the box, clipped to it. A continent's cities need the borders
// between countries rather than one country's admin-1 lines, and a
// Countries map needs its neighbours - Europe without Turkey or Morocco
// drawn in is a continent floating on sand. `exceptAdmins` leaves out the
// targets themselves, which the targets layer already draws.
export function selectAdmin0Context(
	bbox: [number, number, number, number],
	outPath: string,
	exceptAdmins: string[] = []
): void {
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-clipsrc',
		...bbox.map(String),
		...(exceptAdmins.length > 0 ? ['-where', `NOT (${sqlIn('ADMIN', exceptAdmins)})`] : []),
		'-select',
		'ADMIN',
		'-nlt',
		'MULTIPOLYGON',
		outPath,
		ADMIN0_SHP
	]);
}

// --- The Terrain layer (FT-33, docs/PLAN_V0.8.md) -------------------------
//
// Four files per map, off by default in the app, behind the map bar's
// Terrain button. The point isn't decoration: until v0.8.0 the sea was the
// same sand colour as the land, so no coastline read at all, and a region
// had nothing to sit against. A name is easier to keep once it has
// somewhere to hang - "behind the Alps", "on the Adriatic", "where the Po
// runs" - which is the same reason the named features here also feed the
// derived half of the fact box (FT-34).
//
// Unlike the lakes layer above, these are CLIPPED (`-clipsrc`) rather than
// filtered (`-spat`): the ocean is a single global polygon, so a filter
// would hand every map the whole world's coastline. Clipping also keeps
// each label where the visible part of a feature is - the Alps label lands
// over the slice of the Alps this map actually shows.

// Which named land features are worth drawing. Islands and island groups
// (455 of the 1 047) only restate the coastline the sea layer already
// draws; a continent across the whole map is noise, not a mnemonic; NE's
// three "Lake" polygons duplicate the lakes layer; and "Dragons-be-here"
// is the dataset's own joke entry.
const TERRAIN_SKIP = ['Island', 'Island group', 'Continent', 'Lake', 'Dragons-be-here'];

// Lake centerlines are left out for the same reason as the "Lake" polygons:
// the lakes layer already draws them, and a line through a lake reads as a
// river that isn't there. Canals aren't rivers.
const RIVER_CLASSES = ['River', 'River (Intermittent)'];

const quoted = (values: string[]) => values.map((v) => `'${v}'`).join(', ');

function clipToBbox(
	source: string,
	bbox: [number, number, number, number],
	select: string[],
	outPath: string
): void {
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-clipsrc',
		...bbox.map(String),
		...select,
		outPath,
		source
	]);
}

/** The files tippecanoe needs for one map's Terrain layer. */
export interface PhysicalPaths {
	sea: string;
	rivers: string;
	terrain: string;
	labels: string;
	peaks: string;
	lines: string;
}

/** Where those files live while a map is being built. */
export function physicalPaths(absOutDir: string): PhysicalPaths {
	return {
		sea: path.join(absOutDir, '.tmp-sea.geojson'),
		rivers: path.join(absOutDir, '.tmp-rivers.geojson'),
		terrain: path.join(absOutDir, '.tmp-terrain.geojson'),
		labels: path.join(absOutDir, '.tmp-physical-labels.geojson'),
		peaks: path.join(absOutDir, '.tmp-peaks.geojson'),
		lines: path.join(absOutDir, '.tmp-lines.geojson')
	};
}

export function cleanupPhysical(paths: PhysicalPaths): void {
	for (const file of Object.values(paths)) rmSync(file);
}

// Terrain gets its OWN tileset (terrain.pmtiles) rather than four more
// layers inside tiles.pmtiles, and a lower maximum zoom than the targets.
// Both were measured on italy-regions rather than guessed:
//
//   in tiles.pmtiles, z0-8, unsimplified   +238 KB  (45 KB -> 283 KB)
//   in tiles.pmtiles, z0-8, simplified     +130 KB
//   own tileset, z0-6, simplified            31 KB
//
// The layer is off by default, and geoclickMap.ts pulls a whole archive
// into memory on desktop and Android (neither shell serves range
// requests), so folding it into tiles.pmtiles would charge every player
// who never switches it on - on every map open. As its own file the app
// fetches it the first time the button is pressed and not before.
//
// The maximum zoom follows the map rather than being one number for all 63,
// because the cost is driven by extent, not by detail: Russia's terrain is
// 850 KB at zoom 6 and simplifying its vertices ten times harder only gets
// it to 547 KB, while one zoom level less gets it to 553 KB and two to
// 385 KB. So the rule below spends zoom levels where they can be seen. A
// map opens at roughly log2(360 / its widest span) - the whole country in
// view - and terrainMaxZoom gives it three levels of headroom above that,
// which is as far in as anyone zooms to read a region's shape. Past it
// MapLibre over-zooms the tiles: a slightly soft coastline on a background
// layer, and nothing else.
// The same simplification the targets themselves get (see build-map.ts).
const TERRAIN_SIMPLIFY = '10%';

/** How far in this map's terrain tiles are worth building. */
export function terrainMaxZoom(bbox: [number, number, number, number]): number {
	const span = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1], 0.01);
	const openingZoom = Math.log2(360 / span);
	return Math.min(6, Math.max(4, Math.round(openingZoom) + 3));
}

/**
 * Simplifies the four physical files and writes `terrain.pmtiles` next to
 * the map's `tiles.pmtiles`. Labels are points already - nothing to
 * simplify - so they go in as they are.
 */
export function buildTerrainTileset(
	paths: PhysicalPaths,
	options: { absOutDir: string; mapName: string; bbox: [number, number, number, number] }
): string {
	const simplified: Record<string, string> = {};
	for (const layer of ['sea', 'rivers', 'terrain'] as const) {
		const out = `${paths[layer]}.simplified.json`;
		execFileSync(
			'npx',
			[
				'mapshaper',
				paths[layer],
				'-simplify',
				TERRAIN_SIMPLIFY,
				'keep-shapes',
				'-o',
				out,
				'format=geojson',
				'precision=0.0001'
			],
			{ stdio: 'ignore' }
		);
		simplified[layer] = out;
	}

	const mbtilesPath = path.join(options.absOutDir, '.tmp-terrain.mbtiles');
	const pmtilesPath = path.join(options.absOutDir, 'terrain.pmtiles');
	execFileSync('tippecanoe', [
		'--output',
		mbtilesPath,
		'--force',
		'--minimum-zoom=0',
		`--maximum-zoom=${terrainMaxZoom(options.bbox)}`,
		// Without this tippecanoe thins point features out at low zoom, the
		// general-basemap assumption that already cost this project four of
		// forty city markers once (see build-points-map.ts). Here it silently
		// dropped ALPS and APPENNINI from Italy - the two names the layer
		// exists for - while keeping smaller ranges further out.
		'--drop-rate=1',
		`--name=${options.mapName} (terrain)`,
		'--attribution=Natural Earth (public domain)',
		'--generate-ids',
		'-L',
		`sea:${simplified.sea}`,
		'-L',
		`rivers:${simplified.rivers}`,
		'-L',
		`terrain:${simplified.terrain}`,
		'-L',
		`physical_labels:${paths.labels}`,
		'-L',
		`peaks:${paths.peaks}`,
		'-L',
		`lines:${paths.lines}`
	]);
	pmtilesConvert(mbtilesPath, pmtilesPath);

	for (const file of Object.values(simplified)) rmSync(file);
	rmSync(mbtilesPath);
	return pmtilesPath;
}

/**
 * The map's extent with room around it. The app fits a map to its targets
 * and then pads that fit in pixels (mapFit.ts), so the visible area is
 * always wider than the targets themselves - without this margin the sea
 * would stop short of the screen edge and the coastline would end in
 * mid-air.
 */
export function padBbox(
	bbox: [number, number, number, number],
	fraction = 0.25
): [number, number, number, number] {
	const [minLon, minLat, maxLon, maxLat] = bbox;
	const lonMargin = Math.max((maxLon - minLon) * fraction, 0.5);
	const latMargin = Math.max((maxLat - minLat) * fraction, 0.5);
	return [
		Math.max(-180, minLon - lonMargin),
		Math.max(-90, minLat - latMargin),
		Math.min(180, maxLon + lonMargin),
		Math.min(90, maxLat + latMargin)
	];
}

export interface NamedFeature {
	properties: Record<string, string | number | null | undefined>;
	geometry: { coordinates: unknown };
}

export interface LabelPoint {
	type: 'Feature';
	properties: {
		name: string;
		name_de: string | number | null;
		name_it: string | number | null;
		kind: string | number | null;
		rank: string | number | null;
	};
	geometry: { type: 'Point'; coordinates: [number, number] };
}

/** The middle of a geometry's own box - good enough for a decorative label. */
export function boxCentre(geometry: { coordinates: unknown }): [number, number] {
	let minLon = Infinity;
	let minLat = Infinity;
	let maxLon = -Infinity;
	let maxLat = -Infinity;
	const walk = (coords: unknown): void => {
		if (typeof (coords as number[])[0] === 'number') {
			const [lon, lat] = coords as [number, number];
			if (lon < minLon) minLon = lon;
			if (lon > maxLon) maxLon = lon;
			if (lat < minLat) minLat = lat;
			if (lat > maxLat) maxLat = lat;
		} else {
			for (const c of coords as unknown[]) walk(c);
		}
	};
	walk(geometry.coordinates);
	const round = (n: number) => Math.round(n * 1e4) / 1e4;
	return [round((minLon + maxLon) / 2), round((minLat + maxLat) / 2)];
}

/**
 * One label point per named feature in the given files. The app draws these
 * as DOM popups through labelCollision.ts, not as a MapLibre symbol layer:
 * the style's glyph URL points at a public font server, and the desktop and
 * Android builds have to work with no network at all. Same rule as every
 * other name in the app - see data/styles/base.json's note.
 */
// Natural Earth's own translations, where they are wrong rather than merely
// different. Same mechanism and the same reasoning as build-map.ts's
// NAME_FIXUPS: a curated correction for the handful of rows that are
// actually incorrect, not a heuristic over 581 features that are mostly
// fine. Found by the product owner reading the map, which is the only way
// these get found.
const TERRAIN_NAME_FIXUPS: Record<string, { de?: string; it?: string }> = {
	// The feature is the whole chain, the length of Italy. NE's German and
	// Italian both name the LIGURIAN Apennines, one sub-range of it at the
	// north-west end - so the label pointed at the wrong mountains and
	// contradicted the English name on the same shape.
	APPENNINI: { de: 'Apenninen', it: 'Appennini' }
};

export function labelPointsFrom(
	collections: { features: NamedFeature[] }[],
	labelBbox: [number, number, number, number]
): LabelPoint[] {
	const points: LabelPoint[] = [];
	for (const collection of collections) {
		for (const feature of collection.features) {
			const name = feature.properties.name;
			if (typeof name !== 'string' || name === '') continue;

			// Where the name goes: a point INSIDE the shape, computed from the
			// shape's WHOLE geometry rather than from the part this map happens
			// to clip. Both halves matter, and each fixed a label the product
			// owner found in the sea: the middle of a box is outside anything
			// long or curved (the Apennines follow the peninsula), and the
			// middle of a clipped remnant is nowhere in particular (the Balkan
			// Peninsula, cut to its western sliver, lands in the Adriatic).
			const at = interiorPoint(feature.geometry);
			const [lon, lat] = at;
			const onThisMap =
				lon >= labelBbox[0] && lon <= labelBbox[2] && lat >= labelBbox[1] && lat <= labelBbox[3];

			// A feature whose own middle is elsewhere still belongs here if it
			// covers this map: the Sahara's middle is in Algeria, and a map of
			// Egypt should still say SAHARA. One that neither sits here nor
			// covers it is about somewhere else, and its name helps nobody.
			if (!onThisMap && coverageOf(feature.geometry, labelBbox) < MAP_SPANNING_COVERAGE) continue;
			const placed = onThisMap ? at : interiorPoint(clipGeometryTo(feature.geometry, labelBbox));

			const fixup = TERRAIN_NAME_FIXUPS[name];
			points.push({
				type: 'Feature',
				properties: {
					name,
					name_de: fixup?.de ?? feature.properties.name_de ?? null,
					name_it: fixup?.it ?? feature.properties.name_it ?? null,
					kind: feature.properties.kind ?? null,
					rank: feature.properties.rank ?? null
				},
				geometry: { type: 'Point', coordinates: placed }
			});
		}
	}
	// Sorted so a rebuild of an unchanged map produces an identical file -
	// the same reproducibility rule MAPS.md states for map.json/tour.json.
	points.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'en'));
	return points;
}

/** How much of a map a feature must cover to earn its name on it anyway. */
const MAP_SPANNING_COVERAGE = 0.35;

/**
 * The shape with everything outside `box` dropped, ring by ring. Crude - it
 * keeps whichever vertices are inside rather than intersecting properly -
 * but it is only ever used to find somewhere sensible to put a name.
 */
function clipGeometryTo(geometry: AnyGeometry, box: [number, number, number, number]): AnyGeometry {
	const inside = ([lon, lat]: [number, number]) =>
		lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
	const rings: [number, number][][] = [];
	const collect = (coords: unknown): void => {
		if (!Array.isArray(coords) || coords.length === 0) return;
		const first = coords[0];
		if (Array.isArray(first) && typeof first[0] === 'number') {
			const kept = (coords as [number, number][]).filter(inside);
			if (kept.length >= 3) rings.push(kept);
			return;
		}
		for (const part of coords) collect(part);
	};
	collect(geometry.coordinates);
	return { coordinates: rings.length > 0 ? rings : geometry.coordinates };
}

// --- Peaks (FT-37) ---------------------------------------------------------
//
// Natural Earth's 711 named elevation points. Only two of its six feature
// classes are usable: `mountain` (633 of them, the famous volcanoes among
// them - Vesuvio, Monte Etna, Fuji, Nevado del Ruiz - even though the
// dataset does not flag a volcano as such) and `depression`, which is nine
// features but includes the Qattara Depression, exactly the sort of thing
// that fixes a place in the mind. The other four classes are unusable
// rather than merely uninteresting: every `spot elevation` row has a null
// name, and the `plateau` rows are Antarctic research stations ("Vostok
// Station (Rus.)", "Fuji Station (Japan)" - which is why Japan's real Fuji
// has to come from the `mountain` class, not from the tallest row).
const PEAK_CLASSES = ['mountain', 'depression'];

// How many named peaks one map may draw. China has 97 in its box and Russia
// 87; a map that writes all of them is a wall of text the collision pass
// then has to hide, which costs tile bytes to achieve nothing.
export const PEAKS_PER_MAP = 12;

export interface PeakFeature {
	properties: {
		name?: string | null;
		elevation?: number | null;
		// `kind` rather than `featurecla`: the ogr2ogr select below renames it,
		// so that every layer in this tileset calls its class the same thing.
		kind?: string | null;
		[field: string]: string | number | null | undefined;
	};
	geometry: { coordinates: [number, number] };
}

/**
 * The peaks one map should draw: named, of a usable class, inside the box,
 * tallest first and capped. Depressions are kept whichever way the cap
 * falls - there are nine in the world and each one is a landmark.
 */
export function selectPeaks<T extends PeakFeature>(
	features: T[],
	bbox: [number, number, number, number],
	limit = PEAKS_PER_MAP
): T[] {
	const usable = features.filter((f) => {
		const { name, kind } = f.properties;
		if (typeof name !== 'string' || name === '') return false;
		if (!PEAK_CLASSES.includes(String(kind))) return false;
		const [lon, lat] = f.geometry.coordinates;
		return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
	});
	const isDepression = (f: T) => f.properties.kind === 'depression';
	const height = (f: T) =>
		typeof f.properties.elevation === 'number' ? f.properties.elevation : 0;
	const mountains = usable
		.filter((f) => !isDepression(f))
		.sort((a, b) => height(b) - height(a))
		.slice(0, limit);
	return [...usable.filter(isDepression), ...mountains].sort((a, b) =>
		(a.properties.name as string).localeCompare(b.properties.name as string, 'en')
	);
}

function writeLabelPoints(
	sourcePaths: string[],
	outPath: string,
	labelBbox: [number, number, number, number]
): void {
	const collections = sourcePaths.map(
		(sourcePath) => JSON.parse(readFileSync(sourcePath, 'utf8')) as { features: NamedFeature[] }
	);
	writeFileSync(
		outPath,
		JSON.stringify({
			type: 'FeatureCollection',
			features: labelPointsFrom(collections, labelBbox)
		})
	);
}

/**
 * Writes the map's sea, rivers, named-terrain and physical-label files,
 * each clipped to `bbox`. The marine polygons are only ever a source of
 * names - the sea layer already fills that water - so they go into the
 * label file and no further.
 */
export function selectPhysical(
	bbox: [number, number, number, number],
	paths: PhysicalPaths,
	labelBbox: [number, number, number, number] = bbox
): void {
	clipToBbox(OCEAN_SHP, bbox, ['-select', 'featurecla'], paths.sea);
	clipToBbox(
		RIVERS_SHP,
		bbox,
		[
			'-sql',
			`SELECT name AS name, name_de AS name_de, name_it AS name_it, scalerank AS rank ` +
				`FROM ne_10m_rivers_lake_centerlines WHERE featurecla IN (${quoted(RIVER_CLASSES)})`
		],
		paths.rivers
	);
	clipToBbox(
		TERRAIN_SHP,
		bbox,
		[
			'-sql',
			`SELECT name AS name, name_de AS name_de, name_it AS name_it, ` +
				`featurecla AS kind, scalerank AS rank ` +
				`FROM ne_10m_geography_regions_polys WHERE featurecla NOT IN (${quoted(TERRAIN_SKIP)})`
		],
		paths.terrain
	);
	// The label pass reads WHOLE features (`-spat`, a filter) rather than the
	// clipped ones above (`-clipsrc`, a cut). Where a name goes depends on
	// the shape the name belongs to, not on the part this map happens to
	// show - see labelPointsFrom.
	const wholeTerrain = `${paths.labels}.terrain.tmp`;
	const wholeMarine = `${paths.labels}.marine.tmp`;
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-spat',
		...bbox.map(String),
		'-sql',
		`SELECT name AS name, name_de AS name_de, name_it AS name_it, ` +
			`featurecla AS kind, scalerank AS rank ` +
			`FROM ne_10m_geography_regions_polys WHERE featurecla NOT IN (${quoted(TERRAIN_SKIP)})`,
		wholeTerrain,
		TERRAIN_SHP
	]);
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-spat',
		...bbox.map(String),
		'-sql',
		`SELECT name AS name, name_de AS name_de, name_it AS name_it, ` +
			`featurecla AS kind, scalerank AS rank FROM ne_10m_geography_marine_polys`,
		wholeMarine,
		MARINE_SHP
	]);
	writeLabelPoints([wholeTerrain, wholeMarine], paths.labels, labelBbox);
	rmSync(wholeTerrain);
	rmSync(wholeMarine);

	// Peaks (FT-37). Clipped to the label box, not the padded one, for the
	// same reason the names are: a summit two countries away is not a hook.
	clipToBbox(
		PEAKS_SHP,
		labelBbox,
		[
			'-sql',
			`SELECT name AS name, name_de AS name_de, name_it AS name_it, ` +
				`featurecla AS kind, elevation AS elevation ` +
				`FROM ne_10m_geography_regions_elevation_points`
		],
		paths.peaks
	);
	const peaks = JSON.parse(readFileSync(paths.peaks, 'utf8')) as { features: PeakFeature[] };
	writeFileSync(
		paths.peaks,
		JSON.stringify({
			type: 'FeatureCollection',
			features: selectPeaks(peaks.features, labelBbox)
		})
	);

	// The great circles, on the padded box so a line crossing the corner of
	// the map still reaches both edges.
	clipToBbox(
		LINES_SHP,
		bbox,
		[
			'-sql',
			`SELECT name AS name, name_de AS name_de, name_it AS name_it ` +
				`FROM ne_10m_geographic_lines WHERE name IS NOT NULL`
		],
		paths.lines
	);
}
