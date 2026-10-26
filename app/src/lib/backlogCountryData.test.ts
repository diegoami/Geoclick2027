// Regressions for the v1.0 content backlog (#236/#244).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authoredResolver, storedHooksFor } from '../../../data/scripts/factsHooks';
interface MapData {
	country: string;
	regionsMap?: string;
	placesSource?: string;
	targets: { id: string; name: string; type: string; centroid: number[] }[];
}
interface Fact {
	region?: string;
	capitalOf?: string;
	largestCity?: { name: string };
	hooks?: unknown;
}
const read = <T>(file: string): T =>
	JSON.parse(readFileSync(new URL('../../../data/' + file, import.meta.url), 'utf8'));
const cases = [
	{
		country: 'Denmark',
		regions: 'denmark-regions',
		towns: 'denmark-towns-50k',
		capital: 'copenhagen',
		retained: ['aalborg', 'aarhus', 'vejle', 'copenhagen', 'esbjerg', 'odense']
	},
	{
		country: 'Norway',
		regions: 'norway-counties',
		towns: 'norway-towns-50k',
		capital: 'oslo',
		retained: [
			'troms',
			'trondheim',
			'bergen',
			'oslo',
			'drammen',
			'skien',
			'stavanger',
			'kristiansand'
		]
	},
	{
		country: 'Serbia',
		regions: 'serbia-districts',
		towns: 'serbia-towns-50k',
		capital: 'belgrade',
		retained: ['subotica', 'zrenjanin', 'novi-sad', 'belgrade', 'kragujevac', 'cacak', 'nis']
	}
];
describe('completed legacy town maps', () => {
	it.each(cases)('$country retains existing target IDs and has 20–60 distinct towns', (spec) => {
		const map = read<MapData>('maps/' + spec.towns + '/map.json');
		expect(map.country).toBe(spec.country);
		expect(map.regionsMap).toBe(spec.regions);
		expect(map.targets.length).toBeGreaterThanOrEqual(20);
		expect(map.targets.length).toBeLessThanOrEqual(60);
		expect(new Set(map.targets.map((t) => t.id)).size).toBe(map.targets.length);
		expect(map.targets.every((t) => t.name.trim() && t.id && t.type === 'city')).toBe(true);
		expect(map.targets.map((t) => t.id)).toEqual(expect.arrayContaining(spec.retained));
		const facts = read<Record<string, Fact>>('maps/' + spec.towns + '/facts.json');
		expect(facts[spec.capital]?.capitalOf).toBe('country');
	});
	it.each(cases)('$country teaches canonical regions and complete trilingual facts', (spec) => {
		const regionMap = read<MapData>('maps/' + spec.regions + '/map.json');
		const regionNames = regionMap.targets.map((t) => t.name);
		expect(regionNames.every((name) => name.trim())).toBe(true);
		expect(new Set(regionMap.targets.map((t) => t.id)).size).toBe(regionMap.targets.length);
		const townMap = read<MapData>('maps/' + spec.towns + '/map.json');
		const facts = read<Record<string, Fact>>('maps/' + spec.towns + '/facts.json');
		for (const target of townMap.targets)
			expect(regionNames, spec.country + '/' + target.id).toContain(
				facts[target.id]?.region ?? target.name
			);
		for (const map of [regionMap, townMap]) {
			const resolve = authoredResolver(spec.country);
			for (const target of map.targets) {
				const hooks = storedHooksFor(resolve(target), target.type === 'city' ? 'city' : 'region');
				for (const lang of ['en', 'it', 'de'] as const)
					expect(
						hooks && !Array.isArray(hooks) ? (hooks[lang]?.length ?? 0) : 0,
						target.id + '/' + lang
					).toBeGreaterThanOrEqual(3);
			}
		}
	});
	it('uses the fifteen Norwegian counties effective from 2024', () => {
		const map = read<MapData>('maps/norway-counties/map.json');
		expect(map.targets.map((t) => t.name).sort()).toEqual(
			[
				'Akershus',
				'Oslo',
				'Vestland',
				'Rogaland',
				'Trøndelag',
				'Innlandet',
				'Agder',
				'Østfold',
				'Møre og Romsdal',
				'Buskerud',
				'Vestfold',
				'Nordland',
				'Telemark',
				'Troms',
				'Finnmark'
			].sort()
		);
		const facts = read<Record<string, Fact>>('maps/norway-counties/facts.json');
		expect(Object.values(facts).some((f) => f.largestCity?.name === 'Bærum')).toBe(false);
	});
	it('excludes Belgrade’s overlapping administrative entity and Zemun borough', () => {
		const map = read<MapData>('maps/serbia-towns-50k/map.json');
		expect(map.targets.map((t) => t.id)).not.toContain('city-of-belgrade');
		expect(map.targets.map((t) => t.id)).not.toContain('zemun');
		expect(map.targets.map((t) => t.id)).toContain('bor');
		expect(map.targets.map((t) => t.id)).toContain('vrsac');
		const facts = read<Record<string, Fact>>('maps/serbia-districts/facts.json');
		expect(facts.belgrade.largestCity?.name).toBe('Belgrade');
	});
	it('keeps Copenhagen at the established representative centre with provenance', () => {
		const map = read<MapData>('maps/denmark-towns-50k/map.json');
		expect(map.targets.find((t) => t.id === 'copenhagen')?.centroid).toEqual([
			12.5615399, 55.68051
		]);
		const snapshot = read<{
			features: { properties: { NAME: string; coordinateSource?: string } }[];
		}>('places/denmark.geojson');
		expect(
			snapshot.features.find((f) => f.properties.NAME === 'Copenhagen')?.properties.coordinateSource
		).toContain('Natural Earth');
	});
});
