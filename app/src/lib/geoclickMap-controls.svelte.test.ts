import { afterEach, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { setLanguage } from './i18n.svelte';
import { createMap } from './geoclickMap';
import type { MapDefinition } from './mapDefinition';

const fake = vi.hoisted(() => ({
	options: undefined as { container: HTMLElement; locale?: Record<string, string> } | undefined
}));
vi.mock('maplibre-gl', () => ({
	Map: class {
		removed: (() => void)[] = [];
		constructor(options: { container: HTMLElement; locale?: Record<string, string> }) {
			fake.options = options;
		}
		getContainer() {
			return fake.options!.container;
		}
		on() {
			return this;
		}
		once(event: string, fn: () => void) {
			if (event === 'remove') this.removed.push(fn);
			return this;
		}
		isStyleLoaded() {
			return false;
		}
		addControl(control: { onAdd?: () => HTMLElement }) {
			const el = control.onAdd?.();
			if (el) this.getContainer().append(el);
			return this;
		}
		remove() {
			for (const fn of this.removed) fn();
			this.removed = [];
		}
	},
	NavigationControl: class {
		onAdd() {
			const host = document.createElement('div');
			const zoom = document.createElement('button');
			zoom.className = 'maplibregl-ctrl-zoom-in';
			zoom.title = fake.options?.locale?.['NavigationControl.ZoomIn'] ?? 'Zoom in';
			host.append(zoom);
			return host;
		}
	}
}));
vi.mock('./terrainLayer', () => ({
	TerrainLayer: class {
		destroy() {}
	}
}));
vi.mock('./labelCollision', () => ({ enableLabelCollision: () => () => {} }));
vi.mock('./labelMagnify', () => ({ enableLabelMagnify: () => () => {} }));
vi.mock('./pmtilesSource', () => ({
	ensurePmtilesProtocol: () => {},
	registerTilesArchive: () => {}
}));
vi.mock('./hideButtonsControl.svelte', () => ({ HideButtonsControl: class {} }));

afterEach(() => {
	setLanguage('en');
	delete (window as unknown as { __map?: unknown }).__map;
});
it('ordinary map creation installs the initial and live control locale (#251)', () => {
	setLanguage('de');
	const host = document.createElement('div');
	document.body.append(host);
	const definition = {
		id: 'control-integration',
		name: 'Test',
		country: 'Test',
		attribution: '',
		tiles: '',
		targets: [
			{
				id: 'a',
				name: 'A',
				type: 'region',
				tier: 0,
				aliases: [],
				centroid: [0.5, 0.5],
				bbox: [0, 0, 1, 1]
			}
		],
		tourOrder: ['a']
	} as MapDefinition;
	const { map } = createMap(host, definition, { version: 8, sources: {}, layers: [] });
	try {
		expect(fake.options?.locale?.['NavigationControl.ZoomIn']).toBe('Vergrößern');
		const zoom = host.querySelector<HTMLButtonElement>('.maplibregl-ctrl-zoom-in')!;
		expect(zoom.title).toBe('Vergrößern');
		setLanguage('it');
		flushSync();
		expect(zoom.title).toBe('Ingrandisci');
		expect(zoom.getAttribute('aria-label')).toBe('Ingrandisci');
		map.remove();
		setLanguage('en');
		flushSync();
		expect(zoom.title).toBe('Ingrandisci');
	} finally {
		map.remove();
		host.remove();
	}
});
