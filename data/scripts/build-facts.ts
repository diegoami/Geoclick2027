// Builds data/maps/<id>/facts.json - the derived half of the fact box
// (FT-34, docs/PLAN_V0.8.md).
//
// It writes STRUCTURED FIELDS, NOT SENTENCES. The sentence is composed at
// run time by app/src/lib/facts.ts from i18n templates, which is what makes
// the derived half trilingual without a word of it being translated: the
// numbers and the proper nouns are the same in every language, and only the
// words around them change. Anything written as prose here would have to be
// written three times and would go stale in two of them.
//
// Everything in this file is computed from data already in data/source/.
// The authored half - the elephants-in-Yunnan sentence - comes from
// data/facts/<country>.json and is merged in by FT-36.
//
// Usage:
//   npx tsx data/scripts/build-facts.ts --map=italy-regions
//   npx tsx data/scripts/build-facts.ts --all

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
	REPO_ROOT,
	ADMIN1_SHP,
	TERRAIN_SHP,
	PEAKS_SHP,
	parseArgs,
	overallBboxOf,
	crossesAntimeridian,
	padBbox
} from './mapBuildUtils.js';
import { adjacencyForMapDir } from './mapColors.js';
import {
	bboxOf,
	coastIndex,
	compassPosition,
	nearCoast,
	pointInPolygon,
	touchesCoast,
	type AnyGeometry,
	type Bbox,
	type Position,
	type Position2Words
} from './factGeometry.js';
import type { LangHooks } from './authoredHooks.js';
import { authoredResolver, withHooks } from './factsHooks.js';

const MAPS_DIR = path.join(REPO_ROOT, 'data/maps');
const COASTLINE_SHP = path.join(REPO_ROOT, 'data/source/ne_10m_coastline/ne_10m_coastline.shp');
const PLACES_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_populated_places/ne_10m_populated_places.shp'
);

/** One target's derived facts. Every field is optional: a fact that cannot
 *  be computed is left out rather than guessed, and the app renders only
 *  what it is given. */
export interface DerivedFact {
	kind?: 'region' | 'city';
	/** Natural Earth's own word for it: Region, Province, Autonomous region. */
	type?: string;
	/** Only when it differs from the name the map already shows. */
	localName?: string;
	/** Which of this map's other targets it shares a border with. */
	borders?: string[];
	coastal?: boolean;
	/** Named ranges, deserts or basins this place sits in. */
	terrain?: string[];
	/** The tallest named summit inside it. */
	peak?: { name: string; elevation: number };
	/** Whereabouts in its country: "north-west", "east", "centre". */
	position?: Position2Words;
	// Regions only.
	largestCity?: { name: string; nameDe?: string; nameIt?: string; population: number };
	// Cities only.
	population?: number;
	/** Its place on this map by population: 1 is the biggest. */
	populationRank?: number;
	/** The region it stands in. */
	region?: string;
	capitalOf?: 'country' | 'region';
	/** What it had in 1950, when that says something about how it grew. */
	population1950?: number;
	/**
	 * The authored name-facts for this place (FT-36), copied in from
	 * data/facts/<country>.json. A list: the card shows a different one each
	 * time you meet the place, and the first is always about the NAME.
	 */
	hooks?: string[] | LangHooks;
}

interface Feature<G = AnyGeometry> {
	properties: Record<string, string | number | null | undefined>;
	geometry: G;
}

const asName = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);

const tmp = (name: string) => path.join(MAPS_DIR, `.tmp-facts-${name}.geojson`);

function readGeojson(file: string): Feature[] {
	return (JSON.parse(readFileSync(file, 'utf8')) as { features: Feature[] }).features;
}

function exportGeojson(source: string, args: string[], out: string): Feature[] {
	execFileSync('ogr2ogr', ['-f', 'GeoJSON', ...args, out, source]);
	const features = readGeojson(out);
	rmSync(out);
	return features;
}

/** The source data one map needs, all clipped to its own box. */
function sourcesFor(bbox: Bbox, placesPath: string = PLACES_SHP) {
	const spat = ['-spat', ...bbox.map(String)];
	return {
		coast: exportGeojson(COASTLINE_SHP, [...spat, '-select', 'featurecla'], tmp('coast')),
		terrain: exportGeojson(TERRAIN_SHP, [...spat, '-select', 'name,featurecla'], tmp('terrain')),
		peaks: exportGeojson(
			PEAKS_SHP,
			[...spat, '-select', 'name,elevation,featurecla'],
			tmp('peaks')
		),
		places: exportGeojson(
			placesPath,
			[...spat, '-select', 'NAME,NAME_DE,NAME_IT,POP_MAX,POP1950,ADM0CAP,ADM1NAME,ADM0NAME'],
			tmp('places')
		),
		admin1: exportGeojson(
			ADMIN1_SHP,
			[...spat, '-select', 'name,type_en,name_local,region,admin'],
			tmp('adm1')
		)
	};
}

type Sources = ReturnType<typeof sourcesFor>;

interface MapTarget {
	id: string;
	name: string;
	type: string;
	centroid: Position;
	bbox: Bbox;
	crossesAntimeridian?: boolean;
}

/** The named ranges and deserts a point sits inside. */
function terrainAt(point: Position, sources: Sources): string[] {
	const names = sources.terrain
		.filter((f) => typeof f.properties.name === 'string' && pointInPolygon(point, f.geometry))
		.map((f) => String(f.properties.name));
	return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Which source rows make up each target, matched by EXTENT rather than by
 * name.
 *
 * Name matching does not work here and the failure is silent: a map may be
 * dissolved (Italy's twenty regions come from its hundred and ten provinces,
 * so no admin-1 row is called "Piemonte"), and the names that do survive are
 * often rewritten on the way out - Apulia becomes Puglia, Sicily becomes
 * Sicilia (build-map.ts's NAME_FIXUPS). What is stable is the geometry:
 * map.json's bbox for a target was computed from exactly the union of these
 * rows, so grouping the rows by each candidate field and comparing the
 * group's extent to the target's finds the right group whatever it is
 * called.
 */
function rowsByTarget(
	targets: MapTarget[],
	rows: Feature[],
	// A Countries map (#39) groups every admin-1 row by its country instead.
	fields: readonly string[] = ['name', 'region']
): Map<string, Feature[]> {
	const groups = new Map<string, Feature[]>();
	for (const row of rows) {
		// Both the row's own name and the field a dissolve would have grouped
		// on; whichever produced this map, one of them is the right grouping.
		for (const field of fields) {
			const key = row.properties[field];
			if (typeof key !== 'string' || key === '') continue;
			const groupKey = `${field}:${key}`;
			groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
		}
	}

	const extents = new Map<string, Bbox>();
	for (const [key, group] of groups) {
		const boxes = group.map((f) => bboxOf(f.geometry));
		extents.set(key, [
			Math.min(...boxes.map((b) => b[0])),
			Math.min(...boxes.map((b) => b[1])),
			Math.max(...boxes.map((b) => b[2])),
			Math.max(...boxes.map((b) => b[3]))
		]);
	}

	// The test is CONTAINMENT, then smallest. Comparing corners does not
	// work: a target's geometry is simplified to 10% before its bbox is
	// taken, and simplification drops small outlying islands - Sicily's
	// source rows reach Lampedusa at 35.5 N while the target stops at
	// 36.7 N, so its corners are more than a degree out while the shape is
	// plainly the same one. A group that covers the target and is the
	// smallest such group is the right group: for a dissolved map that is
	// the region, and for an undissolved one the province itself, which is
	// tighter than the region group also covering it.
	const area = (b: Bbox) => Math.max(b[2] - b[0], 0) * Math.max(b[3] - b[1], 0);
	const covered = (outer: Bbox, inner: Bbox) => {
		const overlap: Bbox = [
			Math.max(outer[0], inner[0]),
			Math.max(outer[1], inner[1]),
			Math.min(outer[2], inner[2]),
			Math.min(outer[3], inner[3])
		];
		const innerArea = area(inner);
		return innerArea === 0 ? 0 : area(overlap) / innerArea;
	};
	const ENOUGH = 0.9;

	const matched = new Map<string, Feature[]>();
	for (const target of targets) {
		if (crossesAntimeridian(target.bbox)) continue;
		let best: { key: string; size: number } | undefined;
		for (const [key, extent] of extents) {
			if (covered(extent, target.bbox) < ENOUGH) continue;
			const size = area(extent);
			if (!best || size < best.size) best = { key, size };
		}
		if (best) matched.set(target.id, groups.get(best.key)!);
	}
	return matched;
}

function factsForRegionMap(
	targets: MapTarget[],
	sources: Sources,
	extent: Bbox,
	borders: Map<string, Set<string>>,
	// Targets from a register outside Natural Earth (#39): no admin-1 row is
	// theirs, and the smallest one covering a district is its whole state.
	ownRows = true
): Record<string, DerivedFact> {
	const coast = coastIndex(sources.coast.map((f) => f.geometry));
	const countryMap = targets[0]?.type === 'country';
	const sourceRows = ownRows
		? rowsByTarget(targets, sources.admin1, countryMap ? ['admin'] : ['name', 'region'])
		: new Map<string, Feature[]>();

	const facts: Record<string, DerivedFact> = {};
	for (const target of targets) {
		const fact: DerivedFact = { kind: 'region' };
		const rows = sourceRows.get(target.id) ?? [];
		const shapes = rows.map((r) => r.geometry);
		// A row's type and local name describe that admin-1 area, never a
		// whole country, even one with a single row.
		const row = rows.length === 1 && !countryMap ? rows[0] : undefined;

		// Only for an undissolved target: "Province" is the right word for
		// Torino, but the row's word for a piece of Piemonte is not the right
		// word for Piemonte itself.
		if (typeof row?.properties.type_en === 'string') fact.type = row.properties.type_en;
		const local = row?.properties.name_local;
		if (typeof local === 'string' && local !== '' && local !== target.name) {
			fact.localName = local;
		}

		const neighbours = [...(borders.get(target.name) ?? [])].sort((a, b) =>
			a.localeCompare(b, 'en')
		);
		if (neighbours.length > 0) fact.borders = neighbours;

		// Sicily is an island: testing its own boundary against the coastline
		// is the only answer that gets it right. Only a target with no source
		// rows at all falls back to its centroid.
		fact.coastal =
			shapes.length > 0
				? shapes.some((s) => touchesCoast(s, coast))
				: nearCoast(target.centroid, coast, 25);

		const terrain = terrainAt(target.centroid, sources);
		if (terrain.length > 0) fact.terrain = terrain.slice(0, 2);

		if (shapes.length > 0) {
			const inside = (f: Feature) =>
				shapes.some((s) => pointInPolygon(f.geometry.coordinates as Position, s));
			const towns = sources.places
				.filter((f) => typeof f.properties.POP_MAX === 'number' && inside(f))
				.sort((a, b) => Number(b.properties.POP_MAX) - Number(a.properties.POP_MAX));
			if (towns[0]) {
				fact.largestCity = {
					name: String(towns[0].properties.NAME),
					// The same trilingual trick the Terrain labels use: the source
					// already carries the names, so nothing has to be translated.
					nameDe: asName(towns[0].properties.NAME_DE),
					nameIt: asName(towns[0].properties.NAME_IT),
					population: Number(towns[0].properties.POP_MAX)
				};
			}
			const summits = sources.peaks
				.filter(
					(f) =>
						f.properties.featurecla === 'mountain' &&
						typeof f.properties.name === 'string' &&
						inside(f)
				)
				.sort((a, b) => Number(b.properties.elevation) - Number(a.properties.elevation));
			if (summits[0]) {
				fact.peak = {
					name: String(summits[0].properties.name),
					elevation: Math.round(Number(summits[0].properties.elevation))
				};
			}
		}

		fact.position = compassPosition(target.centroid, extent);
		facts[target.id] = fact;
	}
	return facts;
}

function factsForCityMap(
	targets: MapTarget[],
	sources: Sources,
	extent: Bbox
): Record<string, DerivedFact> {
	const coast = coastIndex(sources.coast.map((f) => f.geometry));
	// Matched on position, not on name: a town's name on the map may have
	// been localised or fixed up (NAME_FIXUPS), while the source row has not.
	const byPosition = new Map<string, Feature>();
	for (const place of sources.places) {
		const [lon, lat] = place.geometry.coordinates as Position;
		byPosition.set(`${lon.toFixed(3)}:${lat.toFixed(3)}`, place);
	}
	const findRow = (target: MapTarget): Feature | undefined => {
		const [lon, lat] = target.centroid;
		return byPosition.get(`${lon.toFixed(3)}:${lat.toFixed(3)}`);
	};

	const ranked = [...targets]
		.map((t) => ({ t, pop: Number(findRow(t)?.properties.POP_MAX ?? 0) }))
		.sort((a, b) => b.pop - a.pop);
	const rank = new Map(ranked.map((r, i) => [r.t.id, i + 1]));

	const facts: Record<string, DerivedFact> = {};
	for (const target of targets) {
		const fact: DerivedFact = { kind: 'city' };
		const row = findRow(target);
		if (row) {
			const population = Number(row.properties.POP_MAX);
			if (Number.isFinite(population) && population > 0) {
				fact.population = population;
				fact.populationRank = rank.get(target.id);
			}
			// POP1950..POP2050 are in THOUSANDS, unlike POP_MAX, which is
			// absolute. Checked rather than assumed: the row for Seattle reads
			// 795 against a POP_MAX of 3 074 000, and Detroit reads 2 769 - both
			// right once multiplied out, and both nonsense if they are not.
			const in1950 = Number(row.properties.POP1950);
			if (Number.isFinite(in1950) && in1950 > 0) fact.population1950 = in1950 * 1000;
			const region = row.properties.ADM1NAME;
			if (typeof region === 'string' && region !== '' && region !== target.name) {
				fact.region = region;
			}
			if (Number(row.properties.ADM0CAP) === 1) fact.capitalOf = 'country';
		}
		fact.coastal = nearCoast(target.centroid, coast);
		const terrain = terrainAt(target.centroid, sources);
		if (terrain.length > 0) fact.terrain = terrain.slice(0, 2);
		fact.position = compassPosition(target.centroid, extent);
		facts[target.id] = fact;
	}
	return facts;
}

async function buildOne(mapId: string): Promise<number> {
	const absOutDir = path.join(MAPS_DIR, mapId);
	const map = JSON.parse(readFileSync(path.join(absOutDir, 'map.json'), 'utf8')) as {
		country?: string;
		placesSource?: string;
		boundarySource?: string;
		targets: (MapTarget & { country?: string })[];
	};
	const usable = map.targets.filter((t) => !t.crossesAntimeridian && !crossesAntimeridian(t.bbox));
	const extent = overallBboxOf(usable.length > 0 ? usable : map.targets);
	// A towns map built from a Wikidata snapshot (#39) is matched against
	// that snapshot: its towns are not in Natural Earth's places at all.
	const sources = sourcesFor(
		padBbox(extent, 0.1),
		map.placesSource ? path.join(REPO_ROOT, map.placesSource) : undefined
	);

	const isCityMap = map.targets[0]?.type === 'city';
	const facts = isCityMap
		? factsForCityMap(map.targets, sources, extent)
		: factsForRegionMap(
				map.targets,
				sources,
				extent,
				await adjacencyForMapDir(absOutDir),
				!map.boundarySource
			);

	// The authored name-facts, where a person has written any (FT-36).
	const hooksFor = authoredResolver(map.country);

	// Keys in the map's own target order, so a rebuild of an unchanged map
	// produces an identical file - MAPS.md's reproducibility rule.
	const ordered: Record<string, DerivedFact> = {};
	for (const target of map.targets) {
		// A kind-specific list wins over the catch-all (factsHooks.ts).
		ordered[target.id] = withHooks(facts[target.id], hooksFor(target));
	}
	writeFileSync(path.join(absOutDir, 'facts.json'), `${JSON.stringify(ordered, null, '\t')}\n`);
	return Object.keys(ordered).length;
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const all = 'all' in args || process.argv.includes('--all');
	for (const file of [COASTLINE_SHP, PLACES_SHP, TERRAIN_SHP, PEAKS_SHP, ADMIN1_SHP]) {
		if (existsSync(file)) continue;
		console.error(`Source shapefile not found: ${file}\nRun data/scripts/fetch-natural-earth.sh.`);
		process.exit(1);
	}

	const mapIds = all
		? readdirSync(MAPS_DIR).filter((d) => existsSync(path.join(MAPS_DIR, d, 'map.json')))
		: [args.map];
	if (mapIds.length === 0 || !mapIds[0]) {
		console.error('Give --map=<id> or --all.');
		process.exit(1);
	}

	for (const [index, mapId] of mapIds.entries()) {
		const count = await buildOne(mapId);
		console.log(`[${String(index + 1).padStart(2)}/${mapIds.length}] ${mapId.padEnd(24)} ${count}`);
	}
}

await main();
