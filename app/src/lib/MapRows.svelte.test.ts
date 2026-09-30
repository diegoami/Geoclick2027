// FT-84 (#87's list): a country's row on the start screen reads in the
// player's language, from the picker's names, the same as the map. A country
// the picker has no name for - and English, whose names it does not carry -
// keeps the catalog's name.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { gotoMock } = vi.hoisted(() => ({ gotoMock: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: gotoMock }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		Object.entries(params).reduce((path, [key, value]) => path.replace(`[${key}]`, value), route)
}));

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
const MAP_TYPE_SELECTIONS_KEY = 'geoclick:map-type-selections:v1';

describe('MapRows (FT-84)', () => {
	beforeEach(() => localStorage.removeItem(MAP_TYPE_SELECTIONS_KEY));
	afterEach(() => {
		gotoMock.mockClear();
		localStorage.removeItem(MAP_TYPE_SELECTIONS_KEY);
		setLanguage('en');
	});

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

	it('shows the first listed map selected for country and continent rows', async () => {
		await render(MapRows, {
			groups: [
				{
					country: 'Germany',
					maps: [
						{ id: 'germany-states', label: 'States' },
						{ id: 'germany-districts', label: 'Districts' }
					]
				},
				{
					country: 'Europe',
					pickerId: 'europe',
					maps: [
						{ id: 'europe-countries', label: 'Countries' },
						{ id: 'europe-capitals', label: 'Capitals' }
					]
				}
			],
			masteries: {},
			targetCount: () => 0
		});

		const germany = document.querySelector<HTMLSelectElement>('#maps-germany-states')!;
		const europe = document.querySelector<HTMLSelectElement>('#maps-europe-countries')!;
		expect([...germany.options].map((option) => option.value)).toEqual([
			'germany-states',
			'germany-districts'
		]);
		expect([...europe.options].map((option) => option.value)).toEqual([
			'europe-countries',
			'europe-capitals'
		]);
		expect(germany.value).toBe('germany-states');
		expect(europe.value).toBe('europe-countries');
	});

	it('opens the selected first map when the country or continent button is pressed', async () => {
		await render(MapRows, {
			groups: [
				{
					country: 'Italy',
					pickerId: 'italy',
					maps: [
						{ id: 'italy-regions', label: 'Regions' },
						{ id: 'italy-provinces', label: 'Provinces' }
					]
				}
			],
			masteries: {},
			targetCount: () => 0
		});

		const italy = document.querySelector<HTMLSelectElement>('#maps-italy-regions')!;
		expect(italy.value).toBe('italy-regions');
		document.querySelector<HTMLButtonElement>('.name')!.click();
		expect(gotoMock).toHaveBeenCalledWith('/map/italy-regions');
	});

	it('changing the combobox remembers and opens that map; the row button keeps opening it', async () => {
		await render(MapRows, {
			groups: [
				{
					country: 'Italy',
					pickerId: 'italy',
					maps: [
						{ id: 'italy-regions', label: 'Regions' },
						{ id: 'italy-provinces', label: 'Provinces' }
					]
				}
			],
			masteries: {},
			targetCount: () => 0
		});

		const italy = document.querySelector<HTMLSelectElement>('#maps-italy-regions')!;
		italy.value = 'italy-provinces';
		italy.dispatchEvent(new Event('change', { bubbles: true }));
		expect(italy.value).toBe('italy-provinces');
		expect(gotoMock).toHaveBeenCalledWith('/map/italy-provinces');
		expect(JSON.parse(localStorage.getItem(MAP_TYPE_SELECTIONS_KEY)!)).toEqual({
			italy: 'italy-provinces'
		});

		gotoMock.mockClear();
		document.querySelector<HTMLButtonElement>('.name')!.click();
		expect(gotoMock).toHaveBeenCalledWith('/map/italy-provinces');
	});

	it('restores a manual choice from local storage', async () => {
		localStorage.setItem(MAP_TYPE_SELECTIONS_KEY, JSON.stringify({ italy: 'italy-provinces' }));
		await render(MapRows, {
			groups: [
				{
					country: 'Italy',
					pickerId: 'italy',
					maps: [
						{ id: 'italy-regions', label: 'Regions' },
						{ id: 'italy-provinces', label: 'Provinces' }
					]
				}
			],
			masteries: {},
			targetCount: () => 0
		});
		expect(document.querySelector<HTMLSelectElement>('#maps-italy-regions')!.value).toBe(
			'italy-provinces'
		);
	});
});
