import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateTownBindingsCache } from '../../../data/scripts/townBindings';
import { combineAttributions } from '../../../data/scripts/placeSourceAttribution';
import { canonicalRegionAtPoint, type NamedRegion } from '../../../data/scripts/boundaryRegions';
const read = (file: string) =>
	JSON.parse(readFileSync(new URL('../../../data/' + file, import.meta.url), 'utf8'));
const query = 'SELECT * WHERE {}';
const cache = () => ({
	countryId: 'denmark',
	fetchedAt: '2020-01-01T00:00:00.000Z',
	query,
	querySha256: createHash('sha256').update(query).digest('hex'),
	results: { bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q1748' } }] }
});
describe('saved town source provenance', () => {
	it('keeps the original fetch time when validating a saved response', () => {
		expect(validateTownBindingsCache(cache(), 'denmark', query).fetchedAt).toBe(
			'2020-01-01T00:00:00.000Z'
		);
	});
	it('rejects cross-country input, unrecorded fetch time, future dates and changed queries', () => {
		expect(() => validateTownBindingsCache(cache(), 'hungary', query)).toThrow('country');
		expect(() =>
			validateTownBindingsCache({ ...cache(), fetchedAt: undefined }, 'denmark', query)
		).toThrow('original fetchedAt');
		expect(() =>
			validateTownBindingsCache(
				{ ...cache(), fetchedAt: '2099-01-01T00:00:00.000Z' },
				'denmark',
				query
			)
		).toThrow('original fetchedAt');
		expect(() =>
			validateTownBindingsCache({ ...cache(), query: 'different' }, 'denmark', query)
		).toThrow('query/digest');
		expect(() => validateTownBindingsCache(cache(), 'denmark', 'different')).toThrow(
			'current country profile'
		);
	});
	it('rejects empty or query-limited responses', () => {
		expect(() =>
			validateTownBindingsCache({ ...cache(), results: { bindings: [] } }, 'denmark', query)
		).toThrow('empty');
		expect(() =>
			validateTownBindingsCache(
				{ ...cache(), results: { bindings: Array(10000).fill({}) } },
				'denmark',
				query
			)
		).toThrow('query limit');
	});
	it('requires one country before attempting to read saved bindings', () => {
		const script = fileURLToPath(
			new URL('../../../data/scripts/fetch-v1-towns.ts', import.meta.url)
		);
		const result = spawnSync(
			process.execPath,
			['--import', 'tsx', script, '--bindings=not-read.json'],
			{ encoding: 'utf8' }
		);
		expect(result.status).not.toBe(0);
		expect(result.stdout + result.stderr).toContain('--bindings requires one explicit --country');
	});
});
describe('Serbian census settlement identity', () => {
	it('matches every gazetteer coordinate to the district recorded in the census', () => {
		const source = read('places/serbia.geojson');
		const boundary = read('boundaries/serbia-districts-gb.geojson') as { features: NamedRegion[] };
		const names = new Set(boundary.features.map((f) => String(f.properties.name)));
		expect(source.features).toHaveLength(155);
		for (const f of source.features) {
			expect(f.properties.censusDistrict, f.properties.NAME).toBeTruthy();
			expect(f.properties.ADM1NAME, f.properties.NAME).toBe(f.properties.censusDistrict);
			expect(
				canonicalRegionAtPoint(f.geometry.coordinates, boundary.features, 'Serbia', names),
				f.properties.NAME
			).toBe(f.properties.censusDistrict);
		}
	});
	it('uses the towns rather than their homonymous villages', () => {
		const source = read('places/serbia.geojson');
		for (const [name, district, id] of [
			['Kula', 'West Bačka', '3196973'],
			['Odžaci', 'West Bačka', '3194209'],
			['Aleksandrovac', 'Rasina', '793142'],
			['Medveđa', 'Jablanica', '788057']
		]) {
			const f = source.features.find(
				(f: { properties: { NAME: string } }) => f.properties.NAME === name
			);
			expect(f.properties.censusDistrict, name).toBe(district);
			expect(f.properties.geonames, name).toBe('https://www.geonames.org/' + id);
		}
	});
});
describe('map source credits', () => {
	it('retains each compound credit once without losing its licence or URL', () => {
		const a = 'RZS census, https://popis2022.stat.gov.rs; GeoNames, CC BY 4.0';
		const b = 'Natural Earth, public domain';
		expect(combineAttributions(a, b, a + '; ' + b)).toBe(a + '; ' + b);
	});
	it('does not repeat credits in the rebuilt map metadata', () => {
		for (const id of ['serbia-towns-50k', 'denmark-towns-50k']) {
			const attribution = read('maps/' + id + '/map.json').attribution as string;
			const segments = attribution.split(';').map((x) => x.trim());
			expect(new Set(segments).size, id).toBe(segments.length);
		}
	});
});
