// Map-data integrity (GC-030). Enforces invariants the app relies on but that
// nothing checked before: every assertion here would have silently passed a
// broken 45th map. Runs against the repo's committed data/maps files.
//
// Deliberately asserts invariants, never an exact object shape - GC-032 adds a
// `colorIndex` field to every target, and extra fields must stay legal.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MAPS_DIR,
	buildMapIndex,
	listMapIds,
	serializeMapIndex
} from '../../../data/scripts/build-map-index';
import { mapGroups } from './mapCatalog';

interface TargetLike {
	id: unknown;
	name: unknown;
	centroid: unknown;
	bbox: unknown;
}
interface MapLike {
	targets: TargetLike[];
	tourOrder: unknown;
}

const isFiniteTuple = (v: unknown, length: number) =>
	Array.isArray(v) && v.length === length && v.every((n) => Number.isFinite(n));

function duplicates(values: unknown[]): unknown[] {
	const seen = new Set<unknown>();
	const dup = new Set<unknown>();
	for (const v of values) (seen.has(v) ? dup : seen).add(v);
	return [...dup];
}

/** Every broken invariant in one map, as readable strings. Empty = clean. */
function mapProblems(map: MapLike): string[] {
	const problems: string[] = [];
	// Names are the feature-state key (base.json promoteId: "name") and what
	// quiz correctness compares - two same-named targets collide silently.
	for (const n of duplicates(map.targets.map((t) => t.name)))
		problems.push(`duplicate name ${String(n)}`);
	for (const id of duplicates(map.targets.map((t) => t.id)))
		problems.push(`duplicate id ${String(id)}`);
	for (const t of map.targets) {
		if (!isFiniteTuple(t.centroid, 2))
			problems.push(`${String(t.id)}: centroid not 2 finite numbers`);
		if (!isFiniteTuple(t.bbox, 4)) problems.push(`${String(t.id)}: bbox not 4 finite numbers`);
	}
	const ids = new Set(map.targets.map((t) => t.id));
	const tour = map.tourOrder;
	if (
		!Array.isArray(tour) ||
		tour.length !== ids.size ||
		new Set(tour).size !== tour.length ||
		!tour.every((id) => ids.has(id))
	) {
		problems.push('tourOrder is not a permutation of the target ids');
	}
	return problems;
}

/** Map directories and catalog ids must be the same set, both ways. */
function catalogDrift(dirIds: string[], catalogIds: string[]) {
	const dirs = new Set(dirIds);
	const catalog = new Set(catalogIds);
	return {
		notInCatalog: dirIds.filter((id) => !catalog.has(id)).sort(),
		noDirectory: catalogIds.filter((id) => !dirs.has(id)).sort(),
		duplicatedInCatalog: duplicates(catalogIds) as string[]
	};
}

const mapIds = listMapIds();
const loadMap = (id: string): MapLike =>
	JSON.parse(readFileSync(path.join(DEFAULT_MAPS_DIR, id, 'map.json'), 'utf8'));

describe('map data integrity - every committed map', () => {
	it('finds the maps at all', () => {
		expect(mapIds.length).toBeGreaterThanOrEqual(44);
	});

	it.each(mapIds)('%s: unique names and ids, finite geometry, tourOrder a permutation', (id) => {
		expect(mapProblems(loadMap(id))).toEqual([]);
	});

	it('map directories and mapCatalog list exactly the same ids', () => {
		const catalogIds = mapGroups.flatMap((g) => g.maps.map((m) => m.id));
		expect(catalogDrift(mapIds, catalogIds)).toEqual({
			notInCatalog: [],
			noDirectory: [],
			duplicatedInCatalog: []
		});
	});

	// FT-33: the Terrain layer is its own archive, fetched only when the
	// player switches it on. A map missing one would fail silently - the
	// button would do nothing at all on that map and nowhere else.
	it.each(mapIds)('%s: has both its tileset and its terrain tileset', (id) => {
		expect(existsSync(path.join(DEFAULT_MAPS_DIR, id, 'tiles.pmtiles'))).toBe(true);
		expect(existsSync(path.join(DEFAULT_MAPS_DIR, id, 'terrain.pmtiles'))).toBe(true);
	});

	it('data/maps/index.json is in sync with the map.json files', () => {
		const committed = readFileSync(path.join(DEFAULT_MAPS_DIR, 'index.json'), 'utf8');
		// Compare line endings-insensitively: the file is LF in git (.gitattributes).
		expect(committed.replace(/\r\n/g, '\n')).toBe(serializeMapIndex(buildMapIndex()));
	});
});

// The checks above only mean something if they can fail. These fixtures prove
// each one catches what it claims to - including with extra fields present.
describe('map data integrity - the checks catch what they claim to', () => {
	const target = (id: string, name: string) => ({
		id,
		name,
		centroid: [10, 50],
		bbox: [9, 49, 11, 51],
		colorIndex: 3 // an extra field (GC-032) must not be a problem
	});
	const clean = (): MapLike => ({
		targets: [target('a', 'Alpha'), target('b', 'Beta')],
		tourOrder: ['a', 'b']
	});

	it('a clean map with extra fields has no problems', () => {
		expect(mapProblems(clean())).toEqual([]);
	});

	it('flags a duplicated name', () => {
		const m = clean();
		m.targets[1].name = 'Alpha';
		expect(mapProblems(m)).toContain('duplicate name Alpha');
	});

	it('flags a duplicated id', () => {
		const m = clean();
		m.targets[1].id = 'a';
		expect(mapProblems(m)).toContain('duplicate id a');
	});

	it('flags non-finite geometry', () => {
		const m = clean();
		m.targets[0].centroid = [NaN, 50];
		m.targets[1].bbox = [9, 49, 11];
		expect(mapProblems(m)).toEqual(
			expect.arrayContaining(['a: centroid not 2 finite numbers', 'b: bbox not 4 finite numbers'])
		);
	});

	it('flags a tourOrder that is not a permutation', () => {
		for (const tourOrder of [['a'], ['a', 'a'], ['a', 'zzz'], undefined]) {
			expect(mapProblems({ ...clean(), tourOrder })).toContain(
				'tourOrder is not a permutation of the target ids'
			);
		}
	});

	it('flags catalog drift in both directions', () => {
		expect(catalogDrift(['x', 'y'], ['x'])).toMatchObject({ notInCatalog: ['y'] });
		expect(catalogDrift(['x'], ['x', 'ghost'])).toMatchObject({ noDirectory: ['ghost'] });
		expect(catalogDrift(['x'], ['x', 'x'])).toMatchObject({ duplicatedInCatalog: ['x'] });
	});
});
