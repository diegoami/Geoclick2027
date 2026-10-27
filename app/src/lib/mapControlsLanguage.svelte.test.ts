import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import type { Map } from 'maplibre-gl';
import { followMapControlLanguage, mapControlLocale } from './mapControlsLanguage.svelte';
import { setLanguage } from './i18n.svelte';

function controls() {
	const host = document.createElement('div');
	host.innerHTML =
		'<canvas class="maplibregl-canvas"></canvas><button class="maplibregl-ctrl-zoom-in"></button><button class="maplibregl-ctrl-zoom-out"></button><button class="maplibregl-ctrl-compass"></button><button class="unrelated" title="Keep this"></button>';
	let remove = () => {};
	followMapControlLanguage({
		getContainer: () => host,
		once: (_event: string, fn: () => void) => {
			remove = fn;
		}
	} as unknown as Map);
	return { host, remove: () => remove() };
}

afterEach(() => setLanguage('en'));
describe('live MapLibre control language (#251)', () => {
	it('updates tooltips and accessible names in place across EN/DE/IT', () => {
		setLanguage('en');
		const { host, remove } = controls();
		try {
			const zoom = host.querySelector<HTMLButtonElement>('.maplibregl-ctrl-zoom-in')!;
			expect(zoom.title).toBe('Zoom in');
			setLanguage('de');
			flushSync();
			expect(zoom.title).toBe('Vergrößern');
			expect(zoom.getAttribute('aria-label')).toBe('Vergrößern');
			expect(host.querySelector('canvas')).toHaveAttribute('aria-label', 'Karte');
			setLanguage('it');
			flushSync();
			expect(zoom.title).toBe('Ingrandisci');
			expect(host.querySelector('.maplibregl-ctrl-compass')).toHaveAttribute(
				'aria-label',
				'Trascina per ruotare, fai clic per orientare a nord'
			);
			expect(host.querySelector('.unrelated')).toHaveAttribute('title', 'Keep this');
			expect(mapControlLocale('de')['NavigationControl.ZoomOut']).toBe('Verkleinern');
		} finally {
			remove();
		}
	});
	it('localizes newly added popup controls and stops when the map is removed', async () => {
		setLanguage('it');
		const { host, remove } = controls();
		const close = document.createElement('button');
		close.className = 'maplibregl-popup-close-button';
		host.append(close);
		await expect.poll(() => close.title).toBe('Chiudi popup');
		remove();
		setLanguage('de');
		flushSync();
		expect(close.title).toBe('Chiudi popup');
		close.title = 'After removal';
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(close.title).toBe('After removal');
	});
});
