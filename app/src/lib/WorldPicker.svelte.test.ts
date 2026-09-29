// FT-83 (#87): the start screen's Back waits for the map. `pickerShown` is
// set in MapLibre's `load` callback, not when the picker JSON arrives, so a
// Back during a slow - or failed - load exits the app instead of being
// swallowed and needing a second press.
//
// MapLibre is replaced by a small fake: the Map records its `load` handler
// and the test fires it by hand, which is the one ordering the bug was in.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WorldPicker from './WorldPicker.svelte';
import { pickerGoUp, setPickerShown, setPickerView } from './mapPrefs.svelte';

const fake = vi.hoisted(() => {
	const state = {
		load: undefined as (() => void) | undefined,
		countryClick: undefined as ((event: unknown) => void) | undefined,
		mapOptions: undefined as { doubleClickZoom?: boolean } | undefined
	};
	const picker = {
		attribution: '',
		continents: [{ id: 'europe', view: [-10, 35, 30, 60] as [number, number, number, number] }],
		countries: [
			{
				id: 'italy',
				name: 'Italy',
				continent: 'europe',
				centroid: [12, 42] as [number, number],
				bbox: [6, 36, 18, 47] as [number, number, number, number]
			},
			{
				id: 'belarus',
				name: 'Belarus',
				continent: 'europe',
				centroid: [28, 53] as [number, number],
				bbox: [23, 51, 33, 57] as [number, number, number, number]
			}
		]
	};
	function createMap() {
		const map = {
			on: (
				type: string,
				layerOrCallback: string | ((event: unknown) => void),
				callback?: (event: unknown) => void
			) => {
				if (type === 'load' && typeof layerOrCallback === 'function')
					state.load = () => layerOrCallback(undefined);
				if (type === 'click' && callback) state.countryClick = callback;
				return map;
			},
			addControl: () => map,
			setFeatureState: () => {},
			setPaintProperty: () => {},
			fitBounds: () => map,
			getCanvas: () => ({ style: {} }),
			remove: () => {}
		};
		return map;
	}
	class Marker {
		setLngLat() {
			return this;
		}
		addTo() {
			return this;
		}
		remove() {}
	}
	class Popup {
		setLngLat() {
			return this;
		}
		setText() {
			return this;
		}
		addTo() {
			return this;
		}
		remove() {}
	}
	return { state, picker, createMap, Marker, Popup };
});

const { gotoMock } = vi.hoisted(() => ({ gotoMock: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: gotoMock }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params: { mapId: string }) => route.replace('[mapId]', params.mapId)
}));

vi.mock('maplibre-gl', () => ({
	Map: class {
		constructor(options: { doubleClickZoom?: boolean }) {
			fake.state.mapOptions = options;
			Object.assign(this, fake.createMap());
		}
	},
	Marker: fake.Marker,
	Popup: fake.Popup,
	NavigationControl: class {}
}));
vi.mock('./geoclickMap', () => ({ foldCreditOnNarrowScreens: () => {} }));
vi.mock('./labelCollision', () => ({
	enableLabelCollision: () => () => {},
	registerLabel: () => {}
}));
vi.mock('./worldPicker', () => ({
	WORLD_VIEW: [-180, -60, 180, 75] as [number, number, number, number],
	fetchPicker: async () => ({ picker: fake.picker, tilesUrl: 'test' }),
	hasMaps: (id: string) => id === 'italy',
	validView: (p: typeof fake.picker, v: string) =>
		v === 'world' || p.continents.some((c) => c.id === v) ? v : 'world'
}));

describe('WorldPicker (FT-83, FT-86, #87)', () => {
	beforeEach(() => {
		fake.state.load = undefined;
		fake.state.countryClick = undefined;
		fake.state.mapOptions = undefined;
		gotoMock.mockClear();
		setPickerShown(false);
		setPickerView('europe');
	});
	afterEach(() => {
		setPickerShown(false);
		setPickerView('world');
	});

	it('is shown only once the map has loaded, so Back exits during a slow load', async () => {
		await render(WorldPicker, { groups: [], masteries: {}, targetCount: () => 0 });
		// The picker has arrived and the map is built, but `load` has not fired:
		// there is no continent on screen, so Back must not be swallowed.
		await expect.poll(() => fake.state.load !== undefined).toBe(true);
		expect(pickerGoUp()).toBe(false);
		// The map loads: Back goes up from the continent again.
		fake.state.load!();
		expect(pickerGoUp()).toBe(true);
	});

	it('opens the configured country map on the first world-map tap', async () => {
		setPickerView('world');
		await render(WorldPicker, {
			groups: [
				{
					country: 'Italy',
					pickerDefaultMapId: 'italy-regions',
					maps: [
						{ id: 'italy-provinces', label: 'Provinces' },
						{ id: 'italy-regions', label: 'Regions' }
					]
				}
			],
			masteries: {},
			targetCount: () => 0
		});
		await expect.poll(() => fake.state.load !== undefined).toBe(true);
		expect(fake.state.mapOptions?.doubleClickZoom).toBe(false);
		fake.state.load!();
		await expect.poll(() => fake.state.countryClick !== undefined).toBe(true);

		const tapItaly = () =>
			fake.state.countryClick!({
				features: [{ properties: { id: 'italy', continent: 'europe' } }],
				originalEvent: { target: { closest: () => null } }
			});
		tapItaly();
		expect(gotoMock).toHaveBeenCalledWith('/map/italy-regions');
		expect(document.querySelector('.where')).toBeNull();

		gotoMock.mockClear();
		setPickerView('europe');
		await expect.poll(() => document.querySelector('.continent')?.textContent).toBe('Europe');
		tapItaly();
		expect(gotoMock).toHaveBeenCalledWith('/map/italy-regions');
	});

	it('keeps the no-maps notice for a country with no playable maps', async () => {
		setPickerView('world');
		await render(WorldPicker, { groups: [], masteries: {}, targetCount: () => 0 });
		await expect.poll(() => fake.state.load !== undefined).toBe(true);
		fake.state.load!();
		await expect.poll(() => fake.state.countryClick !== undefined).toBe(true);

		fake.state.countryClick!({
			features: [{ properties: { id: 'belarus', continent: 'europe' } }],
			originalEvent: { target: { closest: () => null } }
		});
		await expect.poll(() => document.querySelector('.note')?.textContent).toContain('Belarus');
		expect(gotoMock).not.toHaveBeenCalled();
	});
});
