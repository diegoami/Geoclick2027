import { afterEach, describe, expect, it } from 'vitest';
import { mapGroups } from './mapCatalog';
import { countryGroupsOf, countryNameOf } from './catalogSections';
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
});
