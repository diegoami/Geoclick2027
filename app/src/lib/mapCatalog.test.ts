// The catalog's order and its "advanced" maps (v0.17, #162): the small
// divisions and slices come after a country's standard maps, whole-nation
// maps before maps of a part of the country.
import { describe, expect, it } from 'vitest';
import { mapGroups, mapTypeLabel } from './mapCatalog';

describe('the catalog order', () => {
	it('starts every country with a standard map', () => {
		for (const group of mapGroups) {
			expect(group.maps[0].advanced ?? false, group.country).toBe(false);
		}
	});

	it('lists standard maps before advanced ones', () => {
		for (const group of mapGroups) {
			const flags = group.maps.map((map) => map.advanced === true);
			expect(flags, group.country).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
		}
	});

	it('lists whole-nation maps before maps of a part, within each of the two', () => {
		for (const group of mapGroups) {
			for (const advanced of [false, true]) {
				const maps = group.maps.filter((map) => (map.advanced === true) === advanced);
				const firstPart = maps.findIndex((map) => map.partKey);
				if (firstPart === -1) continue;
				expect(
					maps.slice(firstPart).every((map) => map.partKey),
					`${group.country}: a whole-nation map follows a part`
				).toBe(true);
			}
		}
	});

	it('flags exactly the small divisions and the towns slices', () => {
		const advanced = mapGroups.flatMap((group) =>
			group.maps.filter((map) => map.advanced).map((map) => map.id)
		);
		expect(advanced.sort()).toEqual(
			[
				'france-departments',
				'france-departments-north',
				'france-departments-south',
				'germany-districts-center',
				'germany-districts-east',
				'germany-districts-north',
				'germany-districts-southeast',
				'germany-districts-southwest',
				'germany-districts-west',
				'germany-towns-50k',
				'germany-towns-50k-center',
				'germany-towns-50k-north',
				'germany-towns-50k-south',
				'germany-towns-center',
				'germany-towns-east',
				'germany-towns-north',
				'germany-towns-southeast',
				'germany-towns-southwest',
				'germany-towns-west',
				'italy-provinces',
				'italy-provinces-center',
				'italy-provinces-north',
				'italy-provinces-south',
				'netherlands-municipalities-east',
				'netherlands-municipalities-north',
				'netherlands-municipalities-south',
				'netherlands-municipalities-southwest',
				'netherlands-municipalities-west',
				'poland-counties-east',
				'poland-counties-north',
				'poland-counties-south',
				'poland-counties-southeast',
				'poland-counties-west',
				'italy-towns-50k',
				'italy-towns-50k-center',
				'italy-towns-50k-north',
				'italy-towns-50k-south',
				'philippines-provinces',
				'spain-provinces',
				'usa-cities-center',
				'usa-cities-east',
				'usa-cities-west'
			].sort()
		);
	});

	it('keeps the labels the old keys gave Italy’s provinces and the USA’s cities', () => {
		const label = (id: string) => {
			const entry = mapGroups.flatMap((g) => g.maps).find((m) => m.id === id);
			return entry ? mapTypeLabel(entry) : undefined;
		};
		expect(label('italy-provinces-north')).toBe('Provinces — North');
		expect(label('italy-provinces-center')).toBe('Provinces — Center');
		expect(label('usa-cities-west')).toBe('Cities — West');
	});
});
