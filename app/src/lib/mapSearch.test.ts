import { describe, expect, it } from 'vitest';
import { countMaps, filterGroups, fold, matches } from './mapSearch';

// The real shape of the list, trimmed to the cases that matter.
const groups = [
	{
		country: 'Germany',
		countryAliases: ['Germania', 'Deutschland'],
		maps: [
			{ id: 'germany-states', label: 'States' },
			{ id: 'germany-towns-100k', label: 'Towns' }
		]
	},
	{
		country: 'South Korea',
		maps: [
			{ id: 'south-korea-regions', label: 'Regions' },
			{ id: 'south-korea-towns-100k', label: 'Towns' }
		]
	},
	{
		country: 'Spain',
		countryAliases: ['Spagna', 'Spanien'],
		maps: [
			{ id: 'spain-regions', label: 'Regions' },
			{ id: 'spain-towns-100k', label: 'Towns' }
		]
	},
	{
		country: 'USA',
		maps: [
			{ id: 'usa-states', label: 'States' },
			{ id: 'usa-cities', label: 'Cities' },
			{ id: 'usa-cities-east', label: 'Cities — East' },
			{ id: 'usa-cities-west', label: 'Cities — West' }
		]
	}
];

describe('fold', () => {
	it('ignores case, accents and stray spaces', () => {
		expect(fold('  España ')).toBe('espana');
		expect(fold('Côte')).toBe('cote');
		expect(fold('Cities — East')).toBe('cities — east');
	});
});

describe('matches', () => {
	it('matches nothing in particular when the query is empty', () => {
		expect(matches('', 'Germany', 'States')).toBe(true);
		expect(matches('   ', 'Germany', 'States')).toBe(true);
	});

	it('finds a country by any part of its name', () => {
		expect(matches('korea', 'South Korea', 'Towns')).toBe(true);
		expect(matches('sou', 'South Korea', 'Towns')).toBe(true);
		expect(matches('korea', 'Germany', 'Towns')).toBe(false);
	});

	it('finds a map by its label, in whatever language it is shown', () => {
		expect(matches('städte', 'Germany', 'Städte')).toBe(true);
		expect(matches('citta', 'Italy', 'Città')).toBe(true);
	});

	it('narrows on every word, rather than widening', () => {
		expect(matches('usa cities', 'USA', 'Cities — East')).toBe(true);
		expect(matches('usa regions', 'USA', 'Cities — East')).toBe(false);
	});
});

describe('filterGroups', () => {
	it('gives back the whole list for an empty query', () => {
		expect(filterGroups(groups, '')).toBe(groups);
		expect(countMaps(filterGroups(groups, ''))).toBe(10);
	});

	it('keeps every map of a country whose name matches', () => {
		const found = filterGroups(groups, 'korea');
		expect(found).toHaveLength(1);
		expect(found[0].maps).toHaveLength(2);
	});

	it('finds translated country names while keeping the English catalog name searchable', () => {
		expect(filterGroups(groups, 'germania').map((g) => g.country)).toEqual(['Germany']);
		expect(filterGroups(groups, 'germany').map((g) => g.country)).toEqual(['Germany']);
		expect(filterGroups(groups, 'spagna').map((g) => g.country)).toEqual(['Spain']);
	});

	it('keeps only the matching maps of a country whose name does not', () => {
		const found = filterGroups(groups, 'towns');
		expect(found.map((g) => g.country)).toEqual(['Germany', 'South Korea', 'Spain']);
		expect(countMaps(found)).toBe(3);
	});

	it('finds a slice by the half of its label that names the region', () => {
		const found = filterGroups(groups, 'east');
		expect(countMaps(found)).toBe(1);
		expect(found[0].maps[0].id).toBe('usa-cities-east');
	});

	it('drops a country with nothing to show, rather than leaving an empty heading', () => {
		expect(filterGroups(groups, 'cities').map((g) => g.country)).toEqual(['USA']);
	});

	it('finds nothing when nothing matches, without throwing', () => {
		expect(filterGroups(groups, 'atlantis')).toEqual([]);
		expect(countMaps(filterGroups(groups, 'atlantis'))).toBe(0);
	});

	it('ignores the accents a player will not type', () => {
		expect(
			filterGroups([{ country: 'Spain', maps: [{ id: 'x', label: 'Región' }] }], 'region')
		).toHaveLength(1);
	});
});
