// Regressions for the v1.0 content backlog (#236/#244).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../../../data/scripts/factGeometry';
import { authoredResolver, storedHooksFor } from '../../../data/scripts/factsHooks';
interface MapData {
	country: string;
	regionsMap?: string;
	placesSource?: string;
	attribution?: string;
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
		expect(Object.values(facts).some((f) => f.largestCity)).toBe(false);
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
	it('retains Denmark’s leading coastal towns using a detailed coastline', () => {
		const towns = read<MapData>('maps/denmark-towns-50k/map.json');
		expect(towns.targets.map((t) => t.id)).toEqual(
			expect.arrayContaining(['fredericia', 'hiller-d'])
		);
		const regions = read<{
			features: {
				properties: { name: string };
				geometry: import('../../../data/scripts/factGeometry').AnyGeometry;
			}[];
		}>('boundaries/denmark-regions-gb-9469f09.geojson');
		for (const point of [
			[9.75257, 55.56568],
			[9.78917, 54.90896],
			[10.60677, 55.05982]
		] as [number, number][])
			expect(
				regions.features
					.filter((f) => pointInPolygon(point, f.geometry))
					.map((f) => f.properties.name)
			).toEqual(['Syddanmark']);
	});
	it('uses settlement census counts and includes the previously missing Serbian cities', () => {
		const facts = read<Record<string, Fact & { population?: number }>>(
			'maps/serbia-towns-50k/facts.json'
		);
		expect(facts.prijepolje.population).toBe(11928);
		expect(facts.valjevo.population).toBe(56059);
		expect(facts['novi-pazar'].population).toBe(71462);
		expect(facts.belgrade.population).toBe(1197714);
		const towns = read<MapData>('maps/serbia-towns-50k/map.json');
		expect(towns.attribution).toContain('Statistical Office of the Republic of Serbia');
		expect(towns.attribution).not.toContain('Wikidata');
		expect(towns.targets.map((t) => t.id)).toEqual(
			expect.arrayContaining([
				'sabac',
				'smederevo',
				'sombor',
				'pozarevac',
				'pirot',
				'zajecar',
				'sremska-mitrovica'
			])
		);
		const regions = read<Record<string, Fact>>('maps/serbia-districts/facts.json');
		expect(regions.raska.largestCity?.name).toBe('Novi Pazar');
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
