import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { gotoMock } = vi.hoisted(() => ({ gotoMock: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: gotoMock }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		Object.entries(params).reduce((path, [key, value]) => path.replace(`[${key}]`, value), route)
}));

import MapNav from './MapNav.svelte';
import { setLanguage } from './i18n.svelte';
import { isContinentGroup } from './catalogSections';
import { mapGroups } from './mapCatalog';

describe('MapNav sibling map buttons', () => {
	afterEach(() => {
		gotoMock.mockClear();
		setLanguage('en');
	});

	it('offers only maps from the current country and opens another map on Known', async () => {
		await render(MapNav, {
			mapId: 'italy-provinces',
			mapName: 'Italy — Provinces',
			active: 'overview'
		});

		const group = document.querySelector<HTMLDivElement>('.map-type-scroll[role="group"]');
		expect(group).not.toBeNull();
		expect(group).toHaveAttribute('aria-label', 'Map type for Italy');
		expect(getComputedStyle(group!).overflowX).toBe('auto');
		const buttons = [...group!.querySelectorAll<HTMLButtonElement>('.map-type-btn')];
		// The open map is an advanced one, so it is listed with the standard maps;
		// the other provinces maps are not (v0.17).
		expect(buttons.map((button) => button.dataset.mapId)).toEqual([
			'italy-regions',
			'italy-towns-100k',
			'italy-provinces'
		]);
		expect(buttons.map((button) => button.textContent?.trim())).toEqual([
			'Regions',
			'Towns',
			'Provinces'
		]);
		expect(
			buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent
		).toBe('Provinces');
		expect(document.querySelector('.map-type-row .star')).not.toBeNull();

		buttons[0].click();
		expect(gotoMock).toHaveBeenCalledWith('/map/italy-regions');
	});

	it('leaves the advanced maps out of the row while a standard map is open', async () => {
		await render(MapNav, {
			mapId: 'germany-states',
			mapName: 'Germany — States',
			active: 'overview'
		});

		const buttons = [...document.querySelectorAll<HTMLButtonElement>('.map-type-btn')];
		expect(buttons.map((button) => button.dataset.mapId)).toEqual([
			'germany-states',
			'germany-towns-100k'
		]);
	});

	it('offers the continent maps as map-type buttons', async () => {
		await render(MapNav, {
			mapId: 'europe-countries',
			mapName: 'Europe — Countries',
			active: 'overview'
		});

		const group = document.querySelector<HTMLDivElement>('.map-type-scroll[role="group"]');
		expect(group).not.toBeNull();
		expect(group).toHaveAttribute('aria-label', 'Map type for Europe');
		const buttons = [...group!.querySelectorAll<HTMLButtonElement>('.map-type-btn')];
		expect(buttons.map((button) => button.dataset.mapId)).toEqual([
			'europe-countries',
			'europe-capitals',
			'europe-cities-central',
			'europe-cities-east',
			'europe-cities-north',
			'europe-cities-south',
			'europe-cities-west'
		]);
		expect(
			buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent
		).toBe('Countries');
		expect(document.querySelector('.map-label')).toBeNull();

		buttons[1].click();
		expect(gotoMock).toHaveBeenCalledWith('/map/europe-capitals');
	});

	it('keeps the map title for a country with only one map', async () => {
		const group = mapGroups.find(
			(candidate) => !isContinentGroup(candidate) && candidate.maps.length === 1
		);
		expect(group).toBeDefined();
		const onlyMap = group!.maps[0];
		await render(MapNav, {
			mapId: onlyMap.id,
			mapName: `${group!.country} — ${onlyMap.labelKey}`,
			active: 'explore'
		});

		expect(document.querySelector('.map-type-scroll')).toBeNull();
		expect(document.querySelector('.map-label')).not.toBeNull();
	});
});
