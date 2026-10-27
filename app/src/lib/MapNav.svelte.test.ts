import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { gotoMock } = vi.hoisted(() => ({ gotoMock: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: gotoMock, afterNavigate: vi.fn() }));
vi.mock('$app/paths', () => ({
	asset: (file: string) => file,
	resolve: (route: string, params: Record<string, string> = {}) =>
		Object.entries(params).reduce((path, [key, value]) => path.replace(`[${key}]`, value), route)
}));

import MapNav from './MapNav.svelte';
import VersionBadge from './VersionBadge.svelte';
import { setLanguage } from './i18n.svelte';
import {
	forgetDetailed,
	isSeenDetailed,
	recordVisit,
	setDetailedMapsShown
} from './mapPrefs.svelte';

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

	it('keeps the map title when the country has no map switcher', async () => {
		// After v0.20 every catalog country has 2+ maps, so the no-switcher
		// branch in MapNav.svelte is reached when the rendered mapId does not
		// match any group (mapGroups.find returns undefined). Guard the
		// {:else} path the same way the previous one-map fixture did.
		await render(MapNav, {
			mapId: 'synthetic-no-switcher',
			mapName: 'Atlantis — Regions',
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

	it('keeps Singapore detail discovery available before a visit and after hiding it (#249)', async () => {
		setLanguage('en');
		setDetailedMapsShown(false);
		forgetDetailed('singapore-planning-areas');
		await render(MapNav, {
			mapId: 'singapore-regions',
			mapName: 'Singapore — Regions',
			active: 'explore'
		});
		const ids = () =>
			[...document.querySelectorAll<HTMLElement>('[data-map-id]')].map((el) => el.dataset.mapId);
		expect(ids()).toEqual(['singapore-regions']);
		const box = document.querySelector<HTMLInputElement>('.detailed-toggle input')!;
		expect(box).not.toBeNull();
		box.click();
		await vi.waitFor(() => expect(ids()).toContain('singapore-planning-areas'));
		recordVisit('singapore-planning-areas');
		box.click();
		await vi.waitFor(() =>
			expect(document.querySelector('[data-forget-id="singapore-planning-areas"]')).not.toBeNull()
		);
		(
			document.querySelector('[data-forget-id="singapore-planning-areas"]') as HTMLButtonElement
		).click();
		await vi.waitFor(() => expect(ids()).toEqual(['singapore-regions']));
		expect(document.querySelector('.detailed-toggle input')).not.toBeNull();
		box.click();
		await vi.waitFor(() => expect(ids()).toContain('singapore-planning-areas'));
		forgetDetailed('singapore-planning-areas');
	});

	it('gives each map mode a title that follows language changes (#250)', async () => {
		setLanguage('en');
		await render(MapNav, {
			mapId: 'singapore-regions',
			mapName: 'Singapore — Regions',
			active: 'overview'
		});
		await vi.waitFor(() =>
			expect(document.title).toBe('Singapore — Regions · Overview · Geoclick')
		);
		setLanguage('de');
		await vi.waitFor(() =>
			expect(document.title).toBe('Singapore — Regions · Übersicht · Geoclick')
		);
		setLanguage('it');
		await vi.waitFor(() =>
			expect(document.title).toBe('Singapore — Regions · Panoramica · Geoclick')
		);
	});

	it('paints the language menu above the build badge (#252)', async () => {
		setLanguage('en');
		const chrome = document.createElement('div');
		chrome.className = 'maplibregl-ctrl-top-right';
		chrome.style.cssText = 'position:fixed;top:20px;right:20px;width:30px;height:165px';
		document.body.append(chrome);
		await render(MapNav, {
			mapId: 'singapore-regions',
			mapName: 'Singapore — Regions',
			active: 'overview'
		});
		const badgeView = await render(VersionBadge);
		try {
			(document.querySelector('.lang-button') as HTMLButtonElement).click();
			const badge = document.querySelector<HTMLElement>('.version-badge')!;
			await vi.waitFor(() => expect(Number.parseFloat(getComputedStyle(badge).top)).toBe(193));
			const b = badge.getBoundingClientRect();
			const option = [...document.querySelectorAll<HTMLElement>('.lang-option')].find((el) => {
				const r = el.getBoundingClientRect();
				return (
					Math.max(b.left, r.left) < Math.min(b.right, r.right) &&
					Math.max(b.top, r.top) < Math.min(b.bottom, r.bottom)
				);
			});
			expect(option).toBeDefined();
			const r = option!.getBoundingClientRect();
			// Include the decorative badge in hit testing without altering paint order.
			badge.style.pointerEvents = 'auto';
			const top = document.elementFromPoint(
				(Math.max(b.left, r.left) + Math.min(b.right, r.right)) / 2,
				(Math.max(b.top, r.top) + Math.min(b.bottom, r.bottom)) / 2
			);
			expect(option!.contains(top)).toBe(true);
		} finally {
			badgeView.unmount();
			chrome.remove();
		}
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
