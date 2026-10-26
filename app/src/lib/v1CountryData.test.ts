// Regressions from PR #243 review: generated facts must use the committed
// dated snapshots, and playable targets must retain their multilingual hooks.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authoredResolver, storedHooksFor } from '../../../data/scripts/factsHooks';

interface MapData {
	country: string;
	placesSource?: string;
	attribution: string;
	targets: { id: string; name: string; type: string }[];
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
describe('the first v1.0 country batch data', () => {
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
	it.each(cases)('$towns retains its towns’ region associations', ({ country, towns }) => {
		const map = read<MapData>('maps/' + towns + '/map.json');
		const facts = read<Record<string, Fact>>('maps/' + towns + '/facts.json');
		const snapshot = read<Snapshot>('places/' + country + '.geojson');
		for (const target of map.targets) {
			const source = snapshot.features.find((f) => f.properties.NAME === target.name);
			expect(source, target.name).toBeDefined();
			expect(source?.properties.ADM1NAME, target.name).toBeTruthy();
			expect(facts[target.id]?.region).toBe(
				source?.properties.ADM1NAME === target.name ? undefined : source?.properties.ADM1NAME
			);
		}
	});
	const maps = [
		...cases.flatMap((c) => [c.region, c.towns]),
		'iceland-regions',
		'iceland-towns-1k',
		'costa-rica-provinces',
		'costa-rica-towns-1k'
	];
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
