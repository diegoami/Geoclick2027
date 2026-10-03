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
import { isSeenDetailed, recordVisit, setDetailedMapsShown } from './mapPrefs.svelte';

describe('MapNav sibling map buttons', () => {
	afterEach(() => {
		gotoMock.mockClear();
		setLanguage('en');
		setDetailedMapsShown(false);
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
		// Wraps instead of scrolling, so a row that fits never has a scrollbar.
		expect(getComputedStyle(group!).overflowX).toBe('visible');
		expect(getComputedStyle(group!).flexWrap).toBe('wrap');
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

	it('shows the detailed maps once "Show detailed maps" is ticked', async () => {
		await render(MapNav, {
			mapId: 'germany-states',
			mapName: 'Germany — States',
			active: 'overview'
		});
		const ids = () =>
			[...document.querySelectorAll<HTMLButtonElement>('.map-type-btn')].map(
				(b) => b.dataset.mapId
			);
		expect(ids()).toEqual(['germany-states', 'germany-towns-100k']);

		const box = document.querySelector<HTMLInputElement>('.detailed-toggle input');
		expect(box).not.toBeNull();
		expect(box!.checked).toBe(false);
		box!.click();
		await vi.waitFor(() => expect(ids().length).toBeGreaterThan(2));
		expect(ids()).toContain('germany-districts-north');
		expect(ids()).toContain('germany-towns-center');

		box!.click();
		await vi.waitFor(() => expect(ids()).toEqual(['germany-states', 'germany-towns-100k']));
	});

	it('has no toggle for a country without detailed maps', async () => {
		await render(MapNav, {
			mapId: 'chile-regions',
			mapName: 'Chile — Regions',
			active: 'overview'
		});
		expect(document.querySelector('.detailed-toggle')).toBeNull();
	});

	it('keeps a detailed map in the row once the player has opened it', async () => {
		recordVisit('germany-districts-north');
		await render(MapNav, {
			mapId: 'germany-states',
			mapName: 'Germany — States',
			active: 'overview'
		});
		const ids = [...document.querySelectorAll<HTMLButtonElement>('.map-type-btn')].map(
			(b) => b.dataset.mapId
		);
		expect(ids).toEqual(['germany-states', 'germany-towns-100k', 'germany-districts-north']);
	});

	it('puts a detailed map away again with its X', async () => {
		recordVisit('germany-districts-west');
		await render(MapNav, {
			mapId: 'germany-states',
			mapName: 'Germany — States',
			active: 'overview'
		});
		const ids = () =>
			[...document.querySelectorAll<HTMLButtonElement>('.map-type-btn')].map(
				(b) => b.dataset.mapId
			);
		expect(ids()).toContain('germany-districts-west');
		// Only the maps that are there because they were opened carry an X.
		const x = document.querySelector<HTMLButtonElement>(
			'[data-forget-id="germany-districts-west"]'
		);
		expect(x).not.toBeNull();
		expect(document.querySelector('[data-forget-id="germany-states"]')).toBeNull();
		x!.click();
		await vi.waitFor(() => expect(ids()).not.toContain('germany-districts-west'));
		expect(isSeenDetailed('germany-districts-west')).toBe(false);
	});

	it('shows no X while the tick shows every detailed map', async () => {
		recordVisit('germany-districts-west');
		setDetailedMapsShown(true);
		await render(MapNav, {
			mapId: 'germany-states',
			mapName: 'Germany — States',
			active: 'overview'
		});
		expect(document.querySelector('.map-type-x')).toBeNull();
	});
});
