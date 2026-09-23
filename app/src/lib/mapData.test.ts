// Map-data integrity (GC-030). Enforces invariants the app relies on but that
// nothing checked before: every assertion here would have silently passed a
// broken 45th map. Runs against the repo's committed data/maps files.
//
// Deliberately asserts invariants, never an exact object shape - GC-032 adds a
// `colorIndex` field to every target, and extra fields must stay legal.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MAPS_DIR,
	buildMapIndex,
	listMapIds,
	serializeMapIndex
} from '../../../data/scripts/build-map-index';
import { hooksForCountry, storedHooksFor } from '../../../data/scripts/factsHooks';
import { mapGroups } from './mapCatalog';

interface TargetLike {
	id: unknown;
	name: unknown;
	centroid: unknown;
	bbox: unknown;
	crossesAntimeridian?: unknown;
	spine?: unknown;
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

/**
 * FT-66: a spine is three finite [lon, lat] points and a positive aspect, and
 * its ends lie in the target's own bbox - a spine built for the wrong target
 * would draw a name across a neighbour. The bbox gets a little slack: spines
 * come from the tiles, bboxes from the source shapes.
 */
function spineProblems(t: TargetLike): string[] {
	const spine = t.spine as { curve?: unknown; aspect?: unknown } | null;
	const curve = spine?.curve;
	const aspect = spine?.aspect;
	if (
		!Array.isArray(curve) ||
		curve.length !== 3 ||
		!curve.every((p) => isFiniteTuple(p, 2)) ||
		!(typeof aspect === 'number' && aspect > 0 && Number.isFinite(aspect))
	)
		return [`${String(t.id)}: spine is not 3 finite points and a positive aspect`];
	if (!isFiniteTuple(t.bbox, 4)) return [];
	const [west, south, east, north] = t.bbox as number[];
	if (west > east) return []; // wraps the antimeridian: no simple containment
	const slack = 0.02 * Math.max(east - west, north - south);
	const outside = [curve[0], curve[2]].some(
		([lon, lat]: number[]) =>
			lon < west - slack || lon > east + slack || lat < south - slack || lat > north + slack
	);
	return outside ? [`${String(t.id)}: spine ends outside its bbox`] : [];
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
		else {
			// FT-52: the bbox is authoritative for antimeridian wrapping
			// (west > east), but build-map.ts also writes a documentary
			// `crossesAntimeridian` flag. The two must agree, or one of them
			// is lying and a target's label silently loses every collision it
			// enters.
			const [west, , east] = t.bbox as number[];
			const wraps = west > east;
			const flagged = t.crossesAntimeridian === true;
			if (wraps !== flagged)
				problems.push(
					`${String(t.id)}: crossesAntimeridian ${flagged} disagrees with bbox west${wraps ? '>' : '<='}east`
				);
		}
		if (t.spine !== undefined) problems.push(...spineProblems(t));
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

	// FT-34: every target gets a derived fact, and every fact belongs to a
	// target. A key that matches nothing would be a fact nobody ever sees;
	// a target with no entry would be a blank box on one place and not the
	// next, which reads as a bug rather than as "nothing to say".
	it.each(mapIds)('%s: has a derived fact for each of its targets', (id) => {
		const factsFile = path.join(DEFAULT_MAPS_DIR, id, 'facts.json');
		expect(existsSync(factsFile)).toBe(true);
		const facts = JSON.parse(readFileSync(factsFile, 'utf8')) as Record<string, unknown>;
		const targetIds = loadMap(id).targets.map((t) => t.id);
		expect(Object.keys(facts).sort()).toEqual([...targetIds].sort());
	});

	// FT-50: the sentences a map ships are the ones its country file holds.
	// Translating a country is an edit to data/facts/ and then a rebuild -
	// `npm run refresh-facts-hooks` - and forgetting the rebuild would leave
	// the Italian written but never shown, with nothing else failing.
	it.each(mapIds)('%s: ships the sentences its country file holds', (id) => {
		const { country } = JSON.parse(
			readFileSync(path.join(DEFAULT_MAPS_DIR, id, 'map.json'), 'utf8')
		) as { country?: string };
		const authored = hooksForCountry(country);
		const facts = JSON.parse(
			readFileSync(path.join(DEFAULT_MAPS_DIR, id, 'facts.json'), 'utf8')
		) as Record<string, { kind?: 'region' | 'city'; hooks?: unknown }>;
		const stale = Object.entries(facts)
			.filter(
				([targetId, fact]) =>
					JSON.stringify(fact.hooks) !==
					JSON.stringify(storedHooksFor(authored[targetId], fact.kind))
			)
			.map(([targetId]) => targetId);
		expect(stale).toEqual([]);
	});

	// FT-36: an authored name-fact whose id matches no target is a sentence
	// nobody will ever read, and the mistake is invisible - the card simply
	// shows its derived line. Checked per country file, against every map of
	// that country, because the ids are shared across them.
	it('every authored name-fact belongs to a real place', () => {
		const factsDir = path.join(DEFAULT_MAPS_DIR, '..', 'facts');
		if (!existsSync(factsDir)) return;
		const knownIds = new Set(mapIds.flatMap((id) => loadMap(id).targets.map((t) => t.id)));
		const orphans: string[] = [];
		for (const file of readdirSync(factsDir).filter((f) => f.endsWith('.json'))) {
			const authored = JSON.parse(readFileSync(path.join(factsDir, file), 'utf8'));
			for (const key of Object.keys(authored)) {
				if (key.startsWith('_')) continue;
				if (!knownIds.has(key)) orphans.push(`${file}: ${key}`);
			}
		}
		expect(orphans).toEqual([]);
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
		colorIndex: 3, // an extra field (GC-032) must not be a problem
		crossesAntimeridian: undefined as boolean | undefined
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

	it('accepts a spine inside its bbox, flags a malformed or misplaced one', () => {
		const m = clean();
		const spine = (curve: number[][]) => ({ curve, aspect: 3 });
		m.targets[0].spine = spine([
			[9.2, 50],
			[10, 50.3],
			[10.8, 50]
		]);
		expect(mapProblems(m)).toEqual([]);
		m.targets[1].spine = spine([[9.2, 50]]);
		expect(mapProblems(m)).toContain('b: spine is not 3 finite points and a positive aspect');
		m.targets[1].spine = spine([
			[20, 50],
			[21, 50],
			[22, 50]
		]);
		expect(mapProblems(m)).toContain('b: spine ends outside its bbox');
	});

	it('flags a tourOrder that is not a permutation', () => {
		for (const tourOrder of [['a'], ['a', 'a'], ['a', 'zzz'], undefined]) {
			expect(mapProblems({ ...clean(), tourOrder })).toContain(
				'tourOrder is not a permutation of the target ids'
			);
		}
	});

	it('flags a wrapping bbox with no flag, and a flag on a non-wrapping bbox', () => {
		// FT-52: the bbox decides. A wrapping bbox (west > east) that lacks
		// the flag is the Chukotka case; a flag on an ordinary bbox is a lie.
		const unflagged = clean();
		unflagged.targets[0].bbox = [170, 10, -150, 20];
		expect(mapProblems(unflagged)).toContain(
			'a: crossesAntimeridian false disagrees with bbox west>east'
		);

		const agreeing = clean();
		agreeing.targets[0].bbox = [170, 10, -150, 20];
		agreeing.targets[0].crossesAntimeridian = true;
		expect(mapProblems(agreeing)).toEqual([]);

		const lying = clean();
		lying.targets[0].crossesAntimeridian = true;
		expect(mapProblems(lying)).toContain(
			'a: crossesAntimeridian true disagrees with bbox west<=east'
		);
	});

	it('flags catalog drift in both directions', () => {
		expect(catalogDrift(['x', 'y'], ['x'])).toMatchObject({ notInCatalog: ['y'] });
		expect(catalogDrift(['x'], ['x', 'ghost'])).toMatchObject({ noDirectory: ['ghost'] });
		expect(catalogDrift(['x'], ['x', 'x'])).toMatchObject({ duplicatedInCatalog: ['x'] });
	});
});
