import { afterEach, describe, expect, it } from 'vitest';
import { filterGroups } from './mapSearch';
import { mapGroups, mapTypeLabel, pickerDefaultMapIdOf } from './mapCatalog';
import {
	countryGroupsOf,
	countryNameOf,
	rowNameOf,
	withRowNameSearchAliases
} from './catalogSections';
import { setLanguage } from './i18n.svelte';

describe('countryGroupsOf', () => {
	afterEach(() => setLanguage('en'));

	it('sorts translated country rows by their Italian names', () => {
		setLanguage('it');
		const names = countryGroupsOf('europe', mapGroups).map(countryNameOf);

		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'it')));
		expect(names.indexOf('Regno Unito')).toBeGreaterThan(names.indexOf('Germania'));
	});

	it('sorts translated country rows by their German names', () => {
		setLanguage('de');
		const names = countryGroupsOf('europe', mapGroups).map(countryNameOf);

		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'de')));
		expect(names.indexOf('Deutschland')).toBeLessThan(names.indexOf('Frankreich'));
	});

	it('uses each displayed row name as a searchable alias, including continents', () => {
		for (const language of ['it', 'de'] as const) {
			setLanguage(language);
			const groups = withRowNameSearchAliases(mapGroups).map((group) => ({
				...group,
				maps: group.maps.map((map) => ({ ...map, label: mapTypeLabel(map) }))
			}));

			for (const group of groups) {
				expect(group.countryAliases).toEqual([rowNameOf(group)]);
				expect(filterGroups(groups, rowNameOf(group)).map((match) => match.country)).toContain(
					group.country
				);
			}
		}
	});
});

describe('pickerDefaultMapIdOf', () => {
	it('uses the configured administrative map even when it is not first alphabetically', () => {
		const italy = mapGroups.find((group) => group.country === 'Italy')!;

		expect(pickerDefaultMapIdOf(italy)).toBe('italy-regions');
	});

	it('falls back to the first available map, and returns undefined for an empty group', () => {
		expect(pickerDefaultMapIdOf({ maps: [{ id: 'fallback-map' }] })).toBe('fallback-map');
		expect(pickerDefaultMapIdOf({ maps: [] })).toBeUndefined();
	});

	it('ignores a stale configured id and keeps the available-map fallback', () => {
		expect(
			pickerDefaultMapIdOf({ pickerDefaultMapId: 'removed-map', maps: [{ id: 'fallback-map' }] })
		).toBe('fallback-map');
	});
});

describe('country map order', () => {
	const idsFor = (country: string) =>
		mapGroups.find((group) => group.country === country)!.maps.map((m) => m.id);

	it('orders administrative scope before cities and groups focused maps with their scale', () => {
		expect(idsFor('Italy')).toEqual([
			'italy-regions',
			'italy-provinces',
			'italy-provinces-north',
			'italy-provinces-center',
			'italy-provinces-south',
			'italy-towns-100k'
		]);
		expect(idsFor('France')).toEqual([
			'france-regions',
			'france-departments',
			'france-departments-north',
			'france-departments-south',
			'france-towns-100k'
		]);
		expect(idsFor('Spain')).toEqual(['spain-regions', 'spain-provinces', 'spain-towns-100k']);
	});

	it('puts Germany district maps before full-country and focused town maps', () => {
		const ids = idsFor('Germany');
		const townsIndex = ids.indexOf('germany-towns-100k');
		expect(ids[0]).toBe('germany-states');
		expect(ids.slice(1, townsIndex).every((id) => id.startsWith('germany-districts-'))).toBe(true);
		expect(ids.slice(townsIndex)).toEqual([
			'germany-towns-100k',
			'germany-towns-center',
			'germany-towns-east',
			'germany-towns-north',
			'germany-towns-southeast',
			'germany-towns-southwest',
			'germany-towns-west'
		]);
	});

	it('places municipal and county divisions before towns and keeps city subsets last', () => {
		expect(idsFor('Netherlands')).toEqual([
			'netherlands-regions',
			'netherlands-municipalities-east',
			'netherlands-municipalities-north',
			'netherlands-municipalities-south',
			'netherlands-municipalities-southwest',
			'netherlands-municipalities-west',
			'netherlands-towns-100k'
		]);
		expect(idsFor('Poland')).toEqual([
			'poland-regions',
			'poland-counties-north',
			'poland-counties-west',
			'poland-counties-east',
			'poland-counties-southeast',
			'poland-counties-south',
			'poland-towns-100k'
		]);
		expect(idsFor('USA')).toEqual([
			'usa-states',
			'usa-cities',
			'usa-cities-east',
			'usa-cities-center',
			'usa-cities-west'
		]);
	});
});
