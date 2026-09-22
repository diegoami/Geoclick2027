// Runs in the browser project (real Chromium): the labels are DOM popups and
// the language is module-scope state, so both the DOM and a real module
// instance are part of what is under test. FT-53, issue #3.
import { beforeEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render } from 'vitest-browser-svelte';
import type * as maplibregl from 'maplibre-gl';
import { getLanguage, setLanguage } from './i18n.svelte';
import { TerrainLayer } from './terrainLayer';
import TerrainLanguageFixture from './terrainLanguage.fixture.svelte';

// The popup MapLibre would create, without a map or a WebGL context - the
// same stand-in `registerLabel` already accepts (labelCollision.ts). It
// records its text so the test can read what the layer drew.
class FakePopup {
	text = '';
	removed = false;
	private element = document.createElement('div');
	setLngLat() {
		return this;
	}
	setText(text: string) {
		this.text = text;
		return this;
	}
	addTo() {
		return this;
	}
	addClassName() {}
	removeClassName() {}
	setOffset() {
		return this;
	}
	getElement() {
		return this.element;
	}
	remove() {
		this.removed = true;
	}
}

// A MapLibre map reduced to the calls the terrain layer makes. `features` is
// what the terrain archive's source layers would return.
function fakeMap(features: Record<string, unknown[]>) {
	const sources = new Set<string>();
	const layers = new Set<string>();
	return {
		isStyleLoaded: () => true,
		isSourceLoaded: () => true,
		getSource: (id: string) => (sources.has(id) ? {} : undefined),
		addSource: (id: string) => void sources.add(id),
		getLayer: (id: string) => (layers.has(id) ? {} : undefined),
		addLayer: (layer: { id: string }) => void layers.add(layer.id),
		getPaintProperty: () => 0.55,
		setPaintProperty: () => {},
		setLayoutProperty: () => {},
		querySourceFeatures: (_source: string, { sourceLayer }: { sourceLayer: string }) =>
			features[sourceLayer] ?? [],
		on: () => {},
		off: () => {}
	} as unknown as maplibregl.Map;
}

class TestTerrainLayer extends TerrainLayer {
	private fakePopups: FakePopup[] = [];
	protected override createPopup(): maplibregl.Popup {
		const popup = new FakePopup();
		this.fakePopups.push(popup);
		return popup as unknown as maplibregl.Popup;
	}
	/** The labels on the map now, in draw order. */
	labels(): string[] {
		return this.fakePopups.filter((p) => !p.removed).map((p) => p.text);
	}
}

const FEATURES = {
	physical_labels: [
		{
			properties: { name: 'Alps', name_it: 'Alpi', name_de: 'Alpen', rank: 1 },
			geometry: { type: 'Point', coordinates: [7, 46] }
		}
	],
	peaks: [
		{
			properties: { name: 'Mont Blanc', name_it: 'Monte Bianco', elevation: 4807 },
			geometry: { type: 'Point', coordinates: [6.8, 45.8] }
		}
	],
	lines: []
};

describe('terrain labels and the language', () => {
	beforeEach(() => setLanguage('en'));

	it('are drawn in the language the map opened in', async () => {
		const layer = new TestTerrainLayer(fakeMap(FEATURES), 'test-map');
		await layer.setVisible(true);
		expect(layer.labels()).toEqual(['Alps', 'Mont Blanc 4,807 m']);
	});

	it('follow a switch on a map that is already open', async () => {
		const layer = new TestTerrainLayer(fakeMap(FEATURES), 'test-map');
		await layer.setVisible(true);
		expect(layer.labels()).toEqual(['Alps', 'Mont Blanc 4,807 m']);

		// Exactly what the view's effect does: read the language, then refresh.
		setLanguage('it');
		layer.refreshLabels(getLanguage());

		// Italian does not group four-digit numbers (minimumGroupingDigits),
		// so the metres read "4807 m" here where English gives "4,807 m".
		expect(layer.labels()).toEqual(['Alpi', 'Monte Bianco 4807 m']);
	});

	it('do not come back when the terrain is switched off', async () => {
		const layer = new TestTerrainLayer(fakeMap(FEATURES), 'test-map');
		await layer.setVisible(true);
		await layer.setVisible(false);
		expect(layer.labels()).toEqual([]);

		layer.refreshLabels('it');
		expect(layer.labels()).toEqual([]);
	});

	it('are not drawn before the first load finishes', () => {
		const layer = new TestTerrainLayer(fakeMap(FEATURES), 'test-map');
		layer.refreshLabels('it');
		expect(layer.labels()).toEqual([]);
	});
});

// The regression FT-53 fixes lives in the view wiring, not in the layer: on
// a map's first open the draw happens after an await, so an effect that only
// follows the Terrain preference never subscribes to the language. This
// mounts the shared helper the four views call, with a real layer, and
// changes the language the way the player does.
describe('the view wiring that follows the language', () => {
	beforeEach(() => setLanguage('en'));

	it('redraws a first-opened map’s labels when the language changes', async () => {
		const layer = new TestTerrainLayer(fakeMap(FEATURES), 'test-map');
		await render(TerrainLanguageFixture, { terrain: () => layer });

		// What the views' Terrain effect does on mount.
		await layer.setVisible(true);
		expect(layer.labels()).toEqual(['Alps', 'Mont Blanc 4,807 m']);

		// The player switches language; nothing else calls into the layer.
		setLanguage('it');
		await tick();

		expect(layer.labels()).toEqual(['Alpi', 'Monte Bianco 4807 m']);
	});
});
