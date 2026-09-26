// The world picker (FT-76, docs/PLAN_V0.13.md): the map the home screen
// opens on, built by data/scripts/build-picker.ts. It must hold exactly the
// countries of the six continents' Countries maps, each on the continent
// whose map lists it, so a tap on the picker always leads to real maps.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPS_DIR, listMapIds } from '../../../data/scripts/build-map-index';
import { mapGroups, pickerIdOf } from './mapCatalog';

interface Picker {
	id: string;
	tiles: string;
	continents: { id: string; name: string; view: [number, number, number, number] }[];
	countries: {
		id: string;
		name: string;
		continent: string;
		bbox: [number, number, number, number];
		centroid: [number, number];
	}[];
}

const pickerDir = path.join(DEFAULT_MAPS_DIR, 'world-picker');
const picker: Picker = JSON.parse(readFileSync(path.join(pickerDir, 'picker.json'), 'utf-8'));
const continentIds = picker.continents.map((c) => c.id);

/** Every Countries map's targets, keyed by id, with the continents listing each. */
function countriesMapTargets(): Map<string, string[]> {
	const byId = new Map<string, string[]>();
	for (const continent of continentIds) {
		const map = JSON.parse(
			readFileSync(path.join(DEFAULT_MAPS_DIR, `${continent}-countries`, 'map.json'), 'utf-8')
		) as { targets: { id: string }[] };
		for (const target of map.targets)
			byId.set(target.id, [...(byId.get(target.id) ?? []), continent]);
	}
	return byId;
}

describe('the world picker', () => {
	it('ships its tiles, and is not listed as a map', () => {
		expect(existsSync(path.join(pickerDir, picker.tiles))).toBe(true);
		expect(listMapIds()).not.toContain('world-picker');
	});

	it('has the six continents, each with a Countries map and a view box', () => {
		expect(continentIds).toEqual([
			'europe',
			'africa',
			'asia',
			'north-america',
			'south-america',
			'oceania'
		]);
		for (const { view } of picker.continents) {
			const [west, south, east, north] = view;
			expect(west).toBeLessThan(east);
			expect(south).toBeLessThan(north);
		}
	});

	it("holds exactly the Countries maps' countries, each on its own continent", () => {
		const targets = countriesMapTargets();
		const ids = picker.countries.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect([...ids].sort()).toEqual([...targets.keys()].sort());
		for (const country of picker.countries) {
			expect(targets.get(country.id), country.id).toEqual([country.continent]);
		}
	});

	it('gives every country a finite box and a point inside its box', () => {
		for (const { id, bbox, centroid } of picker.countries) {
			expect([...bbox, ...centroid].every(Number.isFinite), id).toBe(true);
			const [lon, lat] = centroid;
			expect(lat >= bbox[1] && lat <= bbox[3], id).toBe(true);
			expect(lon >= bbox[0] && lon <= bbox[2], id).toBe(true);
		}
	});
});

describe("the start screen's choices (FT-77)", () => {
	it('links every catalog group to a country or continent on the picker', () => {
		const ids = new Set([...picker.countries.map((c) => c.id), ...continentIds]);
		for (const group of mapGroups) expect(ids, group.country).toContain(pickerIdOf(group));
		expect(pickerIdOf({ country: 'Great Britain', pickerId: 'united-kingdom' })).toBe(
			'united-kingdom'
		);
	});

	it('knows which countries have maps of their own', async () => {
		const { hasMaps, groupsOf } = await import('./worldPicker');
		expect(hasMaps('italy')).toBe(true);
		expect(hasMaps('united-kingdom')).toBe(true);
		expect(hasMaps('belarus')).toBe(false);
		expect(groupsOf('europe').map((g) => g.country)).toEqual(['Europe']);
	});

	it('falls back to the world for a view the picker does not have', async () => {
		const { validView } = await import('./worldPicker');
		const loaded = picker as unknown as Parameters<typeof validView>[0];
		expect(validView(loaded, 'asia')).toBe('asia');
		expect(validView(loaded, 'lemuria')).toBe('world');
	});
});

describe('the start screen in sections (#58, amended)', () => {
	it('puts every catalog group on a continent', async () => {
		const { continentOf } = await import('./catalogSections');
		for (const group of mapGroups)
			expect(continentIds, group.country).toContain(continentOf(group));
	});

	it("lists the six continents first, then each continent's countries by name", async () => {
		const { continentGroups, countryGroupsOf, CONTINENT_IDS } = await import('./catalogSections');
		expect(CONTINENT_IDS).toEqual(continentIds);
		expect(continentGroups(mapGroups).map((g) => g.country)).toEqual([
			'Europe',
			'Africa',
			'Asia',
			'North America',
			'South America',
			'Oceania'
		]);
		const europe = countryGroupsOf('europe', mapGroups).map((g) => g.country);
		expect(europe).toContain('Russia');
		expect(europe).toContain('Great Britain');
		expect(europe).not.toContain('Europe');
		expect(europe).toEqual([...europe].sort((a, b) => a.localeCompare(b)));
		// Every group lands in exactly one place: a continent's own, or one
		// continent's countries.
		const placed = [
			...continentGroups(mapGroups),
			...CONTINENT_IDS.flatMap((id) => countryGroupsOf(id, mapGroups))
		];
		expect(placed.length).toBe(mapGroups.length);
	});
});
