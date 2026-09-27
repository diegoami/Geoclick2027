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
	const state = { load: undefined as (() => void) | undefined };
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
			}
		]
	};
	function createMap() {
		const map = {
			on: (type: string, cb: () => void) => {
				if (type === 'load') state.load = cb;
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

vi.mock('maplibre-gl', () => ({
	Map: class {
		constructor() {
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
	hasMaps: () => true,
	validView: (p: typeof fake.picker, v: string) =>
		v === 'world' || p.continents.some((c) => c.id === v) ? v : 'world'
}));

describe('WorldPicker (FT-83, #87)', () => {
	beforeEach(() => {
		fake.state.load = undefined;
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
});
