import { describe, expect, it } from 'vitest';
import { correctPlaces } from '../../../data/scripts/placeCorrections';
const row = (country: string, name: string, population: number) => ({
	properties: { ADM0NAME: country, NAME: name, POP_MAX: population },
	geometry: { type: 'Point', coordinates: [39.47, 13.5] }
});
describe('reviewed population corrections', () => {
	it('corrects the stale Mekele count without modifying the raw source feature', () => {
		const raw = row('Ethiopia', 'Mekele', 95856);
		expect(correctPlaces([raw])[0].properties.POP_MAX).toBe(215546);
		expect(raw.properties.POP_MAX).toBe(95856);
	});
	it('preserves a newer source count and unrelated places with the same name', () => {
		expect(correctPlaces([row('Ethiopia', 'Mekele', 340000)])[0].properties.POP_MAX).toBe(340000);
		expect(correctPlaces([row('Other', 'Mekele', 95856)])[0].properties.POP_MAX).toBe(95856);
	});
});
