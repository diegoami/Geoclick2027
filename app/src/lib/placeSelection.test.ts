// The city builder's two pure decisions (FT-27): which places a slice keeps,
// and what to call two places that share a name. Imported from data/scripts
// the same way mapColors.test.ts does - the build script itself needs a
// toolchain, these parts don't.
import { describe, expect, it } from 'vitest';
import {
	disambiguate,
	isUnbounded,
	parseBounds,
	withinBounds,
	UNBOUNDED,
	distanceKm,
	spacedOut
} from '../../../data/scripts/placeSelection';

const place = (name: string, lon: number, lat: number, region?: string) => ({
	name,
	lon,
	lat,
	region
});

// Real coordinates, so the numbers in the plan can be checked against the
// thing that implements them.
const CITIES = [
	place('New York', -73.98, 40.75, 'New York'),
	place('Chicago', -87.75, 41.83, 'Illinois'),
	place('Kansas City', -94.55, 39.12, 'Missouri'),
	place('Kansas City', -94.63, 39.11, 'Kansas'),
	place('Denver', -104.87, 39.76, 'Colorado'),
	place('Los Angeles', -118.18, 33.99, 'California')
];

describe('parseBounds', () => {
	it('is unbounded when no slice is asked for', () => {
		expect(parseBounds({})).toEqual(UNBOUNDED);
		expect(isUnbounded(parseBounds({}))).toBe(true);
	});

	it('reads the sides that are given and leaves the rest open', () => {
		const bounds = parseBounds({ 'lon-min': '-104', 'lon-max': '-87' });
		expect(bounds.lonMin).toBe(-104);
		expect(bounds.lonMax).toBe(-87);
		expect(bounds.latMin).toBe(-Infinity);
		expect(bounds.latMax).toBe(Infinity);
		expect(isUnbounded(bounds)).toBe(false);
	});

	it('refuses a value that is not a number', () => {
		expect(() => parseBounds({ 'lon-min': 'west' })).toThrow(/must be a number/);
	});

	it('refuses a slice that could never contain anything', () => {
		expect(() => parseBounds({ 'lat-min': '50', 'lat-max': '40' })).toThrow(/empty/);
	});
});

describe('withinBounds', () => {
	it('keeps everything when nothing is bounded', () => {
		expect(withinBounds(CITIES, UNBOUNDED)).toHaveLength(CITIES.length);
	});

	it('cuts the United States into the three slices the plan describes', () => {
		const east = withinBounds(CITIES, parseBounds({ 'lon-min': '-87' }));
		const center = withinBounds(CITIES, parseBounds({ 'lon-min': '-104', 'lon-max': '-87' }));
		const west = withinBounds(CITIES, parseBounds({ 'lon-max': '-104' }));
		expect(east.map((c) => c.name)).toEqual(['New York']);
		expect(center.map((c) => c.name)).toEqual(['Chicago', 'Kansas City', 'Kansas City']);
		expect(west.map((c) => c.name)).toEqual(['Denver', 'Los Angeles']);
	});

	it('includes a place exactly on the edge, so no city falls between two slices', () => {
		const onEdge = [place('Edge', -87, 40)];
		expect(withinBounds(onEdge, parseBounds({ 'lon-min': '-87' }))).toHaveLength(1);
		expect(withinBounds(onEdge, parseBounds({ 'lon-max': '-87' }))).toHaveLength(1);
	});

	it('takes a latitude box too, for a country split north to south', () => {
		const kept = withinBounds(CITIES, parseBounds({ 'lat-min': '40' }));
		expect(kept.map((c) => c.name)).toEqual(['New York', 'Chicago']);
	});
});

describe('disambiguate', () => {
	it('leaves names that are already unique exactly as they were', () => {
		const result = disambiguate([place('Chicago', -87.75, 41.83, 'Illinois')]);
		expect(result[0].name).toBe('Chicago');
		expect(result[0].aliases).toEqual([]);
	});

	it('tells two Kansas Cities apart by their state, keeping both', () => {
		const result = disambiguate(CITIES.filter((c) => c.name === 'Kansas City'));
		expect(result.map((c) => c.name)).toEqual(['Kansas City, Missouri', 'Kansas City, Kansas']);
	});

	it('keeps the plain name as an alias, so the quiz still accepts it', () => {
		const result = disambiguate(CITIES.filter((c) => c.name === 'Kansas City'));
		expect(result.every((c) => c.aliases.includes('Kansas City'))).toBe(true);
	});

	it('produces names that are unique, which is what the map needs', () => {
		const names = disambiguate(CITIES).map((c) => c.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it('leaves two rows for the same place alone, so the builder can collapse them', () => {
		// Natural Earth has both 'Sakarya' and 'Adapazarı' for one Turkish city,
		// 3km apart and both called Adapazarı in Turkish. Renaming them would
		// hide the duplicate behind two names instead of dropping one.
		const result = disambiguate([
			place('Adapazarı', 30.4, 40.77, 'Sakarya'),
			place('Adapazarı', 30.42, 40.8, 'Sakarya')
		]);
		expect(result.map((c) => c.name)).toEqual(['Adapazarı', 'Adapazarı']);
	});

	it('leaves a shared name alone when there is no region to add', () => {
		// Better a duplicate the map test will catch than a name invented here.
		const result = disambiguate([
			place('Springfield', -89.6, 39.8),
			place('Springfield', -72.5, 42.1)
		]);
		expect(result.map((c) => c.name)).toEqual(['Springfield', 'Springfield']);
	});
});

describe('spacedOut (#39, batch C)', () => {
	// Real coordinates, biggest first, as the builder passes them.
	const frankfurt = { name: 'Frankfurt', lon: 8.6821, lat: 50.1109 };
	const offenbach = { name: 'Offenbach am Main', lon: 8.7619, lat: 50.1006 };
	const maintal = { name: 'Maintal', lon: 8.8375, lat: 50.1481 };
	const muehlheim = { name: 'Mühlheim am Main', lon: 8.8325, lat: 50.1195 };
	const darmstadt = { name: 'Darmstadt', lon: 8.6512, lat: 49.8728 };

	it('measures a known distance', () => {
		// Frankfurt to Darmstadt is about 26.6 km.
		expect(distanceKm(frankfurt, darmstadt)).toBeGreaterThan(26);
		expect(distanceKm(frankfurt, darmstadt)).toBeLessThan(27.5);
	});

	it('lets a suburb give way to the bigger town next to it', () => {
		const kept = spacedOut([frankfurt, offenbach, maintal, muehlheim, darmstadt], 5);
		// Offenbach is 5.8 km from Frankfurt and stays; Mühlheim is 3.2 km
		// from Maintal, which came first, and goes.
		expect(kept.map((p) => p.name)).toEqual([
			'Frankfurt',
			'Offenbach am Main',
			'Maintal',
			'Darmstadt'
		]);
	});

	it('is a no-op at zero', () => {
		const all = [frankfurt, offenbach, maintal, muehlheim];
		expect(spacedOut(all, 0)).toBe(all);
	});
});
