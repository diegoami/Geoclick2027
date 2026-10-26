// Regressions from PR #243 review: generated facts must use the committed
// dated snapshots, and playable targets must retain their multilingual hooks.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authoredResolver, storedHooksFor } from '../../../data/scripts/factsHooks';
import { V1_COUNTRIES, v1MapIds } from '../../../data/scripts/v1CountrySpecs';

interface MapData {
	country: string;
	placesSource?: string;
	regionsMap?: string;
	attribution: string;
	targets: { id: string; name: string; type: string; centroid: number[] }[];
}
interface Snapshot {
	features: { properties: { NAME: string; POP_MAX: number; ADM1NAME: string } }[];
}
interface Fact {
	largestCity?: { name: string; population: number };
	region?: string;
}
const read = <T>(file: string): T =>
	JSON.parse(readFileSync(new URL('../../../data/' + file, import.meta.url), 'utf8')) as T;
const cases = [
	{ country: 'hungary', region: 'hungary-counties', towns: 'hungary-towns-10k' },
	{ country: 'slovakia', region: 'slovakia-regions', towns: 'slovakia-towns-10k' },
	{ country: 'estonia', region: 'estonia-counties', towns: 'estonia-towns-5k' },
	{ country: 'lithuania', region: 'lithuania-counties', towns: 'lithuania-towns-10k' }
];
describe('v1.0 country expansion data', () => {
	it.each(V1_COUNTRIES)(
		'$id has both agreed maps and the complete administrative division',
		(spec) => {
			const [regionId, secondId] = v1MapIds(spec);
			const region = read<MapData>('maps/' + regionId + '/map.json');
			const second = read<MapData>('maps/' + secondId + '/map.json');
			expect(region.country).toBe(spec.country);
			expect(region.targets).toHaveLength(spec.expectedRegions);
			const regionFacts = read<Record<string, Fact>>('maps/' + regionId + '/facts.json');
			for (const [target, expected] of Object.entries(spec.expectedLargest ?? {})) {
				expect(regionFacts[target]?.largestCity?.name, regionId + '/' + target).toBe(expected);
			}
			expect(second.country).toBe(spec.country);
			if (spec.secondAdministrative) {
				expect(second.targets).toHaveLength(spec.secondAdministrative.expectedRegions);
				expect(second.targets.every((t) => t.type !== 'city')).toBe(true);
			} else {
				expect(second.targets.length).toBeGreaterThan(0);
				expect(second.targets.every((t) => t.type === 'city')).toBe(true);
				expect(second.regionsMap).toBe(regionId);
				const facts = read<Record<string, Fact>>('maps/' + secondId + '/facts.json');
				const canonical = region.targets.map((target) => target.name);
				for (const target of second.targets) {
					const association = facts[target.id]?.region;
					expect(canonical, secondId + '/' + target.id).toContain(association ?? target.name);
				}
			}
		}
	);

	it.each(cases)(
		'$region derives each biggest city from its dated snapshot',
		({ country, region }) => {
			const map = read<MapData>('maps/' + region + '/map.json');
			const facts = read<Record<string, Fact>>('maps/' + region + '/facts.json');
			const snapshot = read<Snapshot>('places/' + country + '.geojson');
			expect(map.placesSource).toBe('data/places/' + country + '.geojson');
			expect(map.attribution).toContain('Wikidata');
			for (const target of map.targets) {
				const largest = facts[target.id]?.largestCity;
				expect(largest, region + '/' + target.id).toBeDefined();
				const source = snapshot.features.find((f) => f.properties.NAME === largest?.name);
				expect(source, largest?.name).toBeDefined();
				expect(largest?.population).toBe(source?.properties.POP_MAX);
			}
		}
	);
	it.each(cases)('$towns retains its towns’ region associations', ({ country, region, towns }) => {
		const map = read<MapData>('maps/' + towns + '/map.json');
		const facts = read<Record<string, Fact>>('maps/' + towns + '/facts.json');
		const snapshot = read<Snapshot>('places/' + country + '.geojson');
		const regionNames = read<MapData>('maps/' + region + '/map.json').targets.map((t) => t.name);
		expect(map.regionsMap).toBe(region);
		for (const target of map.targets) {
			const source = snapshot.features.find((f) => f.properties.NAME === target.name);
			expect(source, target.name).toBeDefined();
			expect(source?.properties.ADM1NAME, target.name).toBeTruthy();
			const association = facts[target.id]?.region;
			if (association === undefined) expect(regionNames).toContain(target.name);
			else expect(regionNames).toContain(association);
		}
	});
	it.each([
		['ghana-towns-10k', 'dome', 'Greater Accra'],
		['ghana-towns-10k', 'cape-coast', 'Central'],
		['latvia-towns-5k', 'jurmala', 'Rīga'],
		['congo-kinshasa-towns-10k', 'kalemie', 'Tanganyika'],
		['tanzania-towns-10k', 'musoma', 'Mara']
	])('%s/%s keeps its reviewed region association', (map, town, expected) => {
		expect(read<Record<string, Fact>>('maps/' + map + '/facts.json')[town]?.region).toBe(expected);
	});
	it('places Dome by Accra and never calls it Western North’s largest city', () => {
		const towns = read<MapData>('maps/ghana-towns-10k/map.json');
		const dome = towns.targets.find((target) => target.id === 'dome');
		expect(dome?.centroid[0]).toBeGreaterThan(-0.3);
		expect(dome?.centroid[0]).toBeLessThan(-0.2);
		expect(dome?.centroid[1]).toBeGreaterThan(5.6);
		expect(dome?.centroid[1]).toBeLessThan(5.7);
		const facts = read<Record<string, Fact>>('maps/ghana-regions/facts.json');
		expect(facts['western-north']?.largestCity?.name).not.toBe('Dome');
	});
	it('excludes the four Taoyuan boroughs from Taiwan towns and regional largest-city facts', () => {
		const excluded = ['Zhongli', 'Bade', 'Pingzhen', 'Yangmei'];
		const towns = read<MapData>('maps/taiwan-towns-10k/map.json');
		for (const name of excluded)
			expect(towns.targets.map((target) => target.name)).not.toContain(name);
		const facts = read<Record<string, Fact>>('maps/taiwan-counties-and-cities/facts.json');
		for (const fact of Object.values(facts)) expect(excluded).not.toContain(fact.largestCity?.name);
	});

	it.each([
		['ethiopia-towns-10k', ['Adama', 'Woliso', 'Hawassa'], ['Nazret', 'Giyon', 'Awasa']],
		['iraq-towns-10k', ['Erbil', 'Az Zubayr'], ['Irbil', 'Az Aubayr']]
	])('%s uses current town names instead of legacy source labels', (id, current, legacy) => {
		const names = read<MapData>('maps/' + id + '/map.json').targets.map((t) => t.name);
		for (const name of current) expect(names).toContain(name);
		for (const name of legacy) expect(names).not.toContain(name);
	});
	const maps = V1_COUNTRIES.flatMap(v1MapIds);
	it.each(maps)('%s has three authored facts per target and language', (id) => {
		const map = read<MapData>('maps/' + id + '/map.json');
		const resolve = authoredResolver(map.country);
		for (const target of map.targets) {
			const hooks = storedHooksFor(resolve(target), target.type === 'city' ? 'city' : 'region');
			for (const lang of ['en', 'it', 'de'] as const) {
				expect(
					hooks && !Array.isArray(hooks) ? hooks[lang]?.length : 0,
					target.id + '/' + lang
				).toBeGreaterThanOrEqual(3);
			}
		}
	});
});
