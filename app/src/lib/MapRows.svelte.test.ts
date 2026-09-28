// FT-84 (#87's list): a country's row on the start screen reads in the
// player's language, from the picker's names, the same as the map. A country
// the picker has no name for - and English, whose names it does not carry -
// keeps the catalog's name.
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MapRows from './MapRows.svelte';
import { setLanguage } from './i18n.svelte';

const group = (country: string, pickerId?: string) => ({
	country,
	pickerId,
	maps: [
		{ id: `${pickerId ?? country.toLowerCase().replace(/\s+/g, '-')}-regions`, label: 'Regions' }
	]
});

const rows = [
	group('Europe', 'europe'),
	group('Germany'),
	group('Great Britain', 'united-kingdom'),
	group('Iran')
];

const names = () => [...document.querySelectorAll('.name')].map((n) => n.textContent?.trim());

describe('MapRows (FT-84)', () => {
	afterEach(() => setLanguage('en'));

	it("reads a country's row in the player's language, like the map", async () => {
		setLanguage('it');
		await render(MapRows, { groups: rows, masteries: {}, targetCount: () => 0 });
		expect(names()).toEqual(['Europa', 'Germania', 'Regno Unito', 'Iran']);
	});

	it('keeps the catalog name in English and where the picker has none', async () => {
		setLanguage('en');
		await render(MapRows, { groups: rows, masteries: {}, targetCount: () => 0 });
		expect(names()).toEqual(['Europe', 'Germany', 'Great Britain', 'Iran']);
	});

	it('omits the Choose map option for countries but retains it for continent rows', async () => {
		await render(MapRows, {
			groups: [group('Germany'), group('Europe', 'europe')],
			masteries: {},
			targetCount: () => 0
		});

		const germany = document.querySelector<HTMLSelectElement>('#maps-germany-regions')!;
		const europe = document.querySelector<HTMLSelectElement>('#maps-europe-regions')!;
		expect([...germany.options].map((option) => option.value)).toEqual(['germany-regions']);
		expect([...europe.options].map((option) => option.value)).toEqual(['', 'europe-regions']);
	});
});
