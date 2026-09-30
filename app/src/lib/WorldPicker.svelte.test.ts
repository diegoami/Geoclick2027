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
		mapClick: undefined as ((event: unknown) => void) | undefined,
		countryFeatures: [] as { properties: Record<string, string> }[],
		nearbyCountryFeatures: [] as { properties: Record<string, string> }[],
		landFeatures: [] as object[],
		mapOptions: undefined as { doubleClickZoom?: boolean } | undefined,
		countryLabel: undefined as HTMLElement | undefined
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
			on: (type: string, layerOrCallback: string | ((event: unknown) => void)) => {
				if (type === 'load' && typeof layerOrCallback === 'function')
					state.load = () => layerOrCallback(undefined);
				if (type === 'click' && typeof layerOrCallback === 'function')
					state.mapClick = layerOrCallback;
				return map;
			},
			addControl: () => map,
			setFeatureState: () => {},
			queryRenderedFeatures: (query: unknown, options: { layers?: string[] }) => {
				if (options.layers?.[0] === 'land') return state.landFeatures;
				return Array.isArray(query) ? state.nearbyCountryFeatures : state.countryFeatures;
			},
			setPaintProperty: () => {},
			fitBounds: () => map,
			getCanvas: () => ({ style: {} }),
			resize: () => map,
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
		element = document.createElement('div');
		content = document.createElement('div');
		constructor() {
			this.content.className = 'maplibregl-popup-content';
			this.element.append(this.content);
		}
		setLngLat() {
			return this;
		}
		setText(text: string) {
			this.content.textContent = text;
			return this;
		}
		addTo() {
			fake.state.countryLabel = this.element;
			return this;
		}
		getElement() {
			return this.element;
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
		fake.state.mapClick = undefined;
		fake.state.countryFeatures = [];
		fake.state.nearbyCountryFeatures = [];
		fake.state.landFeatures = [];
		fake.state.mapOptions = undefined;
		fake.state.countryLabel = undefined;
		localStorage.removeItem('geoclick:map-type-selections:v1');
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

	it('reveals a hidden country label on the first tap and opens it on the next', async () => {
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
		await expect.poll(() => fake.state.mapClick !== undefined).toBe(true);

		const tap = (point = { x: 10, y: 10 }) =>
			fake.state.mapClick!({
				point,
				lngLat: { lng: 12, lat: 42 },
				originalEvent: { target: { closest: () => null } }
			});
		setPickerView('europe');
		await expect.poll(() => document.querySelector('.continent')?.textContent).toBe('Europe');
		fake.state.countryFeatures = [{ properties: { id: 'italy', continent: 'europe' } }];
		fake.state.countryLabel?.classList.add('is-crowded');
		tap();
		expect(gotoMock).not.toHaveBeenCalled();
		expect(fake.state.countryLabel?.classList.contains('is-crowded')).toBe(false);
		expect(
			fake.state.countryLabel
				?.querySelector('.maplibregl-popup-content')
				?.classList.contains('is-magnified')
		).toBe(true);

		const mapBounds = document.querySelector('.map')!.getBoundingClientRect();
		fake.state.countryLabel!.getBoundingClientRect = () =>
			new DOMRect(mapBounds.left, mapBounds.top, mapBounds.width, mapBounds.height);
		fake.state.countryLabel?.classList.remove('is-crowded');
		fake.state.countryFeatures = [];
		fake.state.mapClick!({
			point: { x: 10, y: 10 },
			lngLat: { lng: 12, lat: 42 },
			originalEvent: { target: { closest: () => null } }
		});
		expect(gotoMock).toHaveBeenCalledWith('/map/italy-regions');
	});

	it('keeps the no-maps notice for a country with no playable maps', async () => {
		setPickerView('europe');
		await render(WorldPicker, { groups: [], masteries: {}, targetCount: () => 0 });
		await expect.poll(() => fake.state.load !== undefined).toBe(true);
		fake.state.load!();
		await expect.poll(() => fake.state.mapClick !== undefined).toBe(true);

		fake.state.countryFeatures = [{ properties: { id: 'belarus', continent: 'europe' } }];
		fake.state.mapClick!({
			point: { x: 10, y: 10 },
			lngLat: { lng: 28, lat: 53 },
			originalEvent: { target: { closest: () => null } }
		});
		await expect.poll(() => document.querySelector('.note')?.textContent).toContain('Belarus');
		expect(gotoMock).not.toHaveBeenCalled();
	});

	it('opens the nearest continent map when uncovered land is tapped', async () => {
		setPickerView('world');
		await render(WorldPicker, {
			groups: [
				{
					country: 'Europe',
					pickerId: 'europe',
					maps: [{ id: 'europe-countries', label: 'Countries' }]
				}
			],
			masteries: {},
			targetCount: () => 0
		});
		await expect.poll(() => fake.state.load !== undefined).toBe(true);
		fake.state.load!();
		await expect.poll(() => fake.state.mapClick !== undefined).toBe(true);

		fake.state.landFeatures = [{}];
		fake.state.mapClick!({
			point: { x: 10, y: 10 },
			lngLat: { lng: 0, lat: 50 },
			originalEvent: { target: { closest: () => null } }
		});
		await expect.poll(() => document.querySelector('.continent')?.textContent).toBe('Europe');
		expect(document.querySelector('select')?.value).toBe('europe-countries');
		expect(gotoMock).not.toHaveBeenCalled();

		setPickerView('world');
		await expect.poll(() => document.querySelector('.continent')).toBeNull();
		fake.state.nearbyCountryFeatures = [{ properties: { id: 'italy', continent: 'europe' } }];
		fake.state.mapClick!({
			point: { x: 10, y: 10 },
			lngLat: { lng: 0, lat: 50 },
			originalEvent: { target: { closest: () => null } }
		});
		expect(document.querySelector('.continent')).toBeNull();
	});
});
