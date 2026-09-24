// Runs in the browser project (real Chromium): the labels are DOM popups and
// the language is module-scope state, so both the DOM and a real module
// instance are part of what is under test. FT-53 (issue #3) and FT-54
// (issue #2).
import { beforeEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render } from 'vitest-browser-svelte';
import type * as maplibregl from 'maplibre-gl';
import { getLanguage, setLanguage } from './i18n.svelte';
import { TERRAIN_SOURCE, TerrainLayer } from './terrainLayer';
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

// A map whose style is not ready yet, so `setVisible(true)` parks inside
// `add()` waiting for it - the window FT-54 is about. `resolveStyle()` lets
// the load land, and the harness records what the layer then did.
function loadingMap() {
	const sources = new Set<string>();
	let addSourceCalls = 0;
	const added: string[] = [];
	const visibility = new Map<string, string>();
	const dims: Array<{ layer: string; value: unknown }> = [];
	const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	let styleLoaded = false;
	let styleWaitStarted: (() => void) | undefined;
	const waiting = new Promise<void>((r) => {
		styleWaitStarted = r;
	});
	const map = {
		isStyleLoaded: () => styleLoaded,
		isSourceLoaded: () => true,
		getSource: (id: string) => (sources.has(id) ? {} : undefined),
		addSource: (id: string) => {
			addSourceCalls++;
			sources.add(id);
		},
		// targets-fill is a real style layer the dimming touches; the terrain
		// layers only exist once `add()` has run.
		getLayer: (id: string) => (id === 'targets-fill' || added.includes(id) ? {} : undefined),
		addLayer: (layer: { id: string }) => void added.push(layer.id),
		getPaintProperty: () => 0.55,
		setPaintProperty: (layer: string, _property: string, value: unknown) =>
			void dims.push({ layer, value }),
		setLayoutProperty: (id: string, _property: string, value: string) =>
			void visibility.set(id, value),
		querySourceFeatures: (_source: string, { sourceLayer }: { sourceLayer: string }) =>
			(FEATURES as Record<string, unknown[]>)[sourceLayer] ?? [],
		on: (type: string, handler: (...args: unknown[]) => void) => {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)!.add(handler);
			if (type === 'styledata') styleWaitStarted?.();
		},
		off: (type: string, handler: (...args: unknown[]) => void) =>
			void listeners.get(type)?.delete(handler)
	};
	return {
		map: map as unknown as maplibregl.Map,
		sources,
		addSourceCalls: () => addSourceCalls,
		added,
		visibility,
		dims,
		waiting,
		resolveStyle: () => {
			styleLoaded = true;
			for (const handler of listeners.get('styledata') ?? []) handler({});
		}
	};
}

// A map whose style is ready but whose tiles have not arrived, so `add()` adds
// the layers and then parks waiting for the source. `emitSourceReady()`
// delivers the tiles - after the player may have switched Terrain off.
function sourceLoadingMap() {
	const added: string[] = [];
	const visibility = new Map<string, string>();
	const dims: Array<{ layer: string; value: unknown }> = [];
	const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	const map = {
		isStyleLoaded: () => true,
		isSourceLoaded: () => false,
		getSource: () => undefined,
		addSource: () => {},
		getLayer: (id: string) => (id === 'targets-fill' || added.includes(id) ? {} : undefined),
		addLayer: (layer: { id: string }) => void added.push(layer.id),
		getPaintProperty: () => 0.55,
		setPaintProperty: (layer: string, _property: string, value: unknown) =>
			void dims.push({ layer, value }),
		setLayoutProperty: (id: string, _property: string, value: string) =>
			void visibility.set(id, value),
		querySourceFeatures: (_source: string, { sourceLayer }: { sourceLayer: string }) =>
			(FEATURES as Record<string, unknown[]>)[sourceLayer] ?? [],
		on: (type: string, handler: (...args: unknown[]) => void) => {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)!.add(handler);
		},
		off: (type: string, handler: (...args: unknown[]) => void) =>
			void listeners.get(type)?.delete(handler)
	};
	return {
		map: map as unknown as maplibregl.Map,
		visibility,
		dims,
		/** How many tiles-arrived handlers are waiting. */
		sourceHandlers: () => listeners.get('sourcedata')?.size ?? 0,
		emitSourceReady: () => {
			for (const handler of [...(listeners.get('sourcedata') ?? [])])
				handler({ sourceId: TERRAIN_SOURCE, isSourceLoaded: true });
		}
	};
}

// A map whose source drops its tiles while the terrain is hidden, as
// MapLibre's does: switched back on, the source reports loaded but holds no
// features until `emitTilesBack()` delivers them again.
function tilesDroppedWhenHiddenMap() {
	const added: string[] = [];
	const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	let hasTiles = true;
	const map = {
		isStyleLoaded: () => true,
		isSourceLoaded: () => true,
		getSource: () => undefined,
		addSource: () => {},
		getLayer: (id: string) => (id === 'targets-fill' || added.includes(id) ? {} : undefined),
		addLayer: (layer: { id: string }) => void added.push(layer.id),
		getPaintProperty: () => 0.55,
		setPaintProperty: () => {},
		setLayoutProperty: (_id: string, _property: string, value: string) => {
			if (value === 'none') hasTiles = false;
		},
		querySourceFeatures: (_source: string, { sourceLayer }: { sourceLayer: string }) =>
			hasTiles ? ((FEATURES as Record<string, unknown[]>)[sourceLayer] ?? []) : [],
		on: (type: string, handler: (...args: unknown[]) => void) => {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)!.add(handler);
		},
		off: (type: string, handler: (...args: unknown[]) => void) =>
			void listeners.get(type)?.delete(handler)
	};
	const emit = () => {
		for (const handler of [...(listeners.get('sourcedata') ?? [])])
			handler({ sourceId: TERRAIN_SOURCE, isSourceLoaded: true });
	};
	return {
		map: map as unknown as maplibregl.Map,
		sourceHandlers: () => listeners.get('sourcedata')?.size ?? 0,
		/** A "loaded" event that arrives before the tiles do. */
		emitLoadedWithoutTiles: emit,
		emitTilesBack: () => {
			hasTiles = true;
			emit();
		}
	};
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

// FT-54, issue #2: terrain is on by default and its first load waits for the
// style. A switch-off inside that window must win, not be undone when the
// load lands.
describe('a toggle during the first load', () => {
	beforeEach(() => setLanguage('en'));

	it('stays off when the player switches it off while it is loading', async () => {
		const harness = loadingMap();
		const layer = new TestTerrainLayer(harness.map, 'test-map');

		const showing = layer.setVisible(true);
		await harness.waiting; // the style wait is registered
		await layer.setVisible(false); // switched off mid-load

		harness.resolveStyle();
		await showing;

		expect(harness.addSourceCalls()).toBe(1); // one addSource, not two
		expect(harness.added).toHaveLength(5);
		expect([...harness.visibility.values()]).toEqual(['none', 'none', 'none', 'none', 'none']);
		expect(harness.dims).toEqual([]); // nothing left dimmed
		expect(layer.labels()).toEqual([]); // and no names on the map
	});

	it('shows when the last press is on', async () => {
		const harness = loadingMap();
		const layer = new TestTerrainLayer(harness.map, 'test-map');

		const showing = layer.setVisible(true);
		await harness.waiting;
		await layer.setVisible(false);
		await layer.setVisible(true);

		harness.resolveStyle();
		await showing;

		// Never hidden, dimmed and labelled: the button reads on.
		expect(harness.visibility.size).toBe(0);
		expect(harness.dims.length).toBeGreaterThan(0);
		expect(layer.labels()).toEqual(['Alps', 'Mont Blanc 4,807 m']);
	});
});

// The tiles can land after the player has already switched Terrain off. The
// pending "source ready" wait must not draw labels then, and must not stack.
describe('the tiles arriving late', () => {
	beforeEach(() => setLanguage('en'));

	it('does not draw labels when it was switched off before they arrived', async () => {
		const harness = sourceLoadingMap();
		const layer = new TestTerrainLayer(harness.map, 'test-map');

		await layer.setVisible(true); // layers added, waiting for the tiles
		expect(harness.sourceHandlers()).toBe(1);
		await layer.setVisible(false); // switched off before they land
		expect(harness.sourceHandlers()).toBe(0);

		harness.emitSourceReady();
		expect(layer.labels()).toEqual([]);
	});

	it('keeps one wait when toggled off and on before they arrive', async () => {
		const harness = sourceLoadingMap();
		const layer = new TestTerrainLayer(harness.map, 'test-map');

		await layer.setVisible(true);
		await layer.setVisible(false);
		await layer.setVisible(true);
		expect(harness.sourceHandlers()).toBe(1); // not stacked

		harness.emitSourceReady();
		expect(layer.labels()).toEqual(['Alps', 'Mont Blanc 4,807 m']);
	});
});

describe('switching it off and on again', () => {
	beforeEach(() => setLanguage('en'));

	it('brings the names back once the dropped tiles return', async () => {
		const harness = tilesDroppedWhenHiddenMap();
		const layer = new TestTerrainLayer(harness.map, 'test-map');

		await layer.setVisible(true);
		expect(layer.labels()).toEqual(['Alps', 'Mont Blanc 4,807 m']);
		await layer.setVisible(false);
		expect(layer.labels()).toEqual([]);

		await layer.setVisible(true); // loaded, but the tiles are gone
		expect(layer.labels()).toEqual([]);
		expect(harness.sourceHandlers()).toBe(1); // waiting, not given up

		harness.emitLoadedWithoutTiles(); // a "loaded" before the tiles
		expect(harness.sourceHandlers()).toBe(1);

		harness.emitTilesBack();
		expect(layer.labels()).toEqual(['Alps', 'Mont Blanc 4,807 m']);
		expect(harness.sourceHandlers()).toBe(0);
	});

	it('stops waiting when switched off again before the tiles return', async () => {
		const harness = tilesDroppedWhenHiddenMap();
		const layer = new TestTerrainLayer(harness.map, 'test-map');

		await layer.setVisible(true);
		await layer.setVisible(false);
		await layer.setVisible(true);
		await layer.setVisible(false);
		expect(harness.sourceHandlers()).toBe(0);

		harness.emitTilesBack();
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
