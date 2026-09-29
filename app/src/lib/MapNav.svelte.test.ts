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

describe('MapNav sibling map selector', () => {
	afterEach(() => {
		gotoMock.mockClear();
		setLanguage('en');
	});

	it('offers only maps from the current country and opens the selected map on Known', async () => {
		await render(MapNav, {
			mapId: 'italy-provinces',
			mapName: 'Italy — Provinces',
			active: 'overview'
		});

		const selector = document.querySelector<HTMLSelectElement>('.map-switch');
		expect(selector).not.toBeNull();
		expect([...selector!.options].map((option) => option.value)).toEqual([
			'italy-regions',
			'italy-provinces',
			'italy-provinces-north',
			'italy-provinces-center',
			'italy-provinces-south',
			'italy-towns-100k'
		]);
		expect(selector!.value).toBe('italy-provinces');

		selector!.value = 'italy-regions';
		selector!.dispatchEvent(new Event('change', { bubbles: true }));
		expect(gotoMock).toHaveBeenCalledWith('/map/italy-regions');
	});

	it('does not show a sibling selector for a continent map', async () => {
		await render(MapNav, {
			mapId: 'europe-countries',
			mapName: 'Europe — Countries',
			active: 'overview'
		});

		expect(document.querySelector('.map-switch')).toBeNull();
	});
});
