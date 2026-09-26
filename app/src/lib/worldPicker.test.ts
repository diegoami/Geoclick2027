// The world picker (FT-76, docs/PLAN_V0.13.md): the map the home screen
// opens on, built by data/scripts/build-picker.ts. It must hold exactly the
// countries of the six continents' Countries maps, each on the continent
// whose map lists it, so a tap on the picker always leads to real maps.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPS_DIR, listMapIds } from '../../../data/scripts/build-map-index';

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
