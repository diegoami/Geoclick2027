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

	it('lists the standard maps first, then the advanced ones, whole nation before parts', () => {
		expect(idsFor('Italy')).toEqual([
			'italy-regions',
			'italy-towns-100k',
			'italy-provinces',
			'italy-provinces-north',
			'italy-provinces-center',
			'italy-provinces-south'
		]);
		expect(idsFor('France')).toEqual([
			'france-regions',
			'france-towns-100k',
			'france-departments',
			'france-departments-north',
			'france-departments-south'
		]);
		expect(idsFor('Spain')).toEqual(['spain-regions', 'spain-towns-100k', 'spain-provinces']);
	});

	it('puts Germany’s whole-nation maps first, then the district and towns parts', () => {
		expect(idsFor('Germany')).toEqual([
			'germany-states',
			'germany-towns-100k',
			'germany-districts-center',
			'germany-districts-east',
			'germany-districts-north',
			'germany-districts-southeast',
			'germany-districts-southwest',
			'germany-districts-west',
			'germany-towns-center',
			'germany-towns-east',
			'germany-towns-north',
			'germany-towns-southeast',
			'germany-towns-southwest',
			'germany-towns-west'
		]);
	});

	it('puts the municipal and county parts after the standard maps', () => {
		expect(idsFor('Netherlands')).toEqual([
			'netherlands-regions',
			'netherlands-towns-100k',
			'netherlands-municipalities-east',
			'netherlands-municipalities-north',
			'netherlands-municipalities-south',
			'netherlands-municipalities-southwest',
			'netherlands-municipalities-west'
		]);
		expect(idsFor('Poland')).toEqual([
			'poland-regions',
			'poland-towns-100k',
			'poland-counties-north',
			'poland-counties-west',
			'poland-counties-east',
			'poland-counties-southeast',
			'poland-counties-south'
		]);
		expect(idsFor('USA')).toEqual([
			'usa-states',
			'usa-cities',
			'usa-cities-east',
			'usa-cities-center',
			'usa-cities-west'
		]);
	});

	it("orders a continent's maps broad to specific: countries, capitals, then city splits", () => {
		for (const [continent, prefix] of [
			['Africa', 'africa'],
			['Asia', 'asia'],
			['North America', 'north-america'],
			['Oceania', 'oceania'],
			['South America', 'south-america']
		] as const) {
			expect(idsFor(continent)).toEqual([`${prefix}-countries`, `${prefix}-capitals`]);
		}
		const europe = idsFor('Europe');
		expect(europe[0]).toBe('europe-countries');
		expect(europe[1]).toBe('europe-capitals');
		expect(europe.slice(2).every((id) => id.startsWith('europe-cities-'))).toBe(true);
	});
});
