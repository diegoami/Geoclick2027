import { describe, expect, it } from 'vitest';
import { applyBoundaryRenames } from '../../../data/scripts/boundaryRenames';

describe('derived facts for renamed boundary unions', () => {
	it('groups a county-right city with its county without dropping geometry or properties', () => {
		const city = {
			geometry: { id: 'city' },
			properties: { admin: 'Hungary', name: 'Szeged', type_en: 'City' }
		};
		const county = {
			geometry: { id: 'county' },
			properties: { admin: 'Hungary', name: 'Csongrád', type_en: 'County' }
		};
		const result = applyBoundaryRenames([city, county], 'Hungary', {
			Szeged: 'Csongrád-Csanád',
			Csongrád: 'Csongrád-Csanád'
		});
		expect(result.map((row) => row.properties.name)).toEqual([
			'Csongrád-Csanád',
			'Csongrád-Csanád'
		]);
		expect(result.map((row) => row.geometry)).toEqual([city.geometry, county.geometry]);
		expect(result.map((row) => row.properties.type_en)).toEqual(['City', 'County']);
	});
	it('does not rename a same-named feature from a neighbouring country or an unspecified map country', () => {
		const foreign = { properties: { admin: 'Other country', name: 'Central' } };
		expect(applyBoundaryRenames([foreign], 'Hungary', { Central: 'Pest' })[0]).toBe(foreign);
		expect(applyBoundaryRenames([foreign], undefined, { Central: 'Pest' })[0]).toBe(foreign);
	});
	it('leaves frozen source features reusable for the next map', () => {
		const row = Object.freeze({
			properties: Object.freeze({ admin: 'Iceland', name: 'Reykjavík' })
		});
		const rows = Object.freeze([row]);
		const result = applyBoundaryRenames(rows, 'Iceland', { Reykjavík: 'Höfuðborgarsvæðið' });
		expect(result[0].properties.name).toBe('Höfuðborgarsvæðið');
		expect(row.properties.name).toBe('Reykjavík');
		expect(result[0]).not.toBe(row);
	});
});
