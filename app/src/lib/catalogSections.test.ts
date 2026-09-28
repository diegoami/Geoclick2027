import { afterEach, describe, expect, it } from 'vitest';
import { filterGroups } from './mapSearch';
import { mapGroups, mapTypeLabel } from './mapCatalog';
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
