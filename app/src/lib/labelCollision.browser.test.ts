// Runs in the browser project (real Chromium): the collision pass measures
// real labels laid out by the real CSS.
import { afterEach, describe, expect, it } from 'vitest';
import '../app.css';
import { enableLabelCollision, setLabelPriority } from './labelCollision';
import { CROWDED_CLASS, HOVERED_CLASS, labelAt } from './labelMagnify';

// The DOM shape MapLibre renders: one .maplibregl-popup per name, positioned
// by the map, each wrapping a .maplibregl-popup-content with the name in it.
function fixture(labels: { name: string; left: number; top: number; priority?: number }[]) {
	const container = document.createElement('div');
	container.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px';
	document.body.append(container);
	for (const { name, left, top, priority } of labels) {
		const popup = document.createElement('div');
		popup.className = 'maplibregl-popup geoclick-solved-popup';
		popup.style.cssText = `position:absolute;left:${left}px;top:${top}px`;
		popup.innerHTML = `<div class="maplibregl-popup-content">${name}</div>`;
		container.append(popup);
		if (priority !== undefined) setLabelPriority({ getElement: () => popup }, priority);
	}
	return container;
}

// A stand-in for the map: the pass only ever listens for its move events.
function fakeMap() {
	const listeners = new Map<string, Set<() => void>>();
	return {
		on: (type: string, fn: () => void) => {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)!.add(fn);
		},
		off: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
		moved: () => listeners.get('move')?.forEach((fn) => fn()),
		listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0)
	};
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
const drawn = (container: HTMLElement) =>
	[...container.querySelectorAll('.maplibregl-popup')]
		.filter((popup) => !popup.classList.contains(CROWDED_CLASS))
		.map((popup) => popup.textContent);

describe('enableLabelCollision', () => {
	afterEach(() => document.body.replaceChildren());

	it('draws names that have room to themselves', async () => {
		const container = fixture([
			{ name: 'Toscana', left: 20, top: 20 },
			{ name: 'Lazio', left: 300, top: 200 }
		]);
		enableLabelCollision(fakeMap(), container);
		await nextFrame();
		expect(drawn(container)).toEqual(['Toscana', 'Lazio']);
	});

	it('hides the less important of two names in the same place', async () => {
		const container = fixture([
			{ name: 'Prato', left: 40, top: 40, priority: 0 },
			{ name: 'Toscana', left: 50, top: 44, priority: 1 }
		]);
		enableLabelCollision(fakeMap(), container);
		await nextFrame();
		expect(drawn(container)).toEqual(['Toscana']);
	});

	it('draws a hidden name again once the map moves it clear', async () => {
		const container = fixture([
			{ name: 'Prato', left: 40, top: 40, priority: 0 },
			{ name: 'Toscana', left: 50, top: 44, priority: 1 }
		]);
		const map = fakeMap();
		enableLabelCollision(map, container);
		await nextFrame();
		expect(drawn(container)).toEqual(['Toscana']);

		// What zooming in does: the two names end up further apart.
		container.querySelectorAll<HTMLElement>('.maplibregl-popup')[0].style.left = '400px';
		map.moved();
		await nextFrame();
		expect(drawn(container)).toEqual(['Prato', 'Toscana']);
	});

	it('keeps a name the player is pointing at, whatever else wants the spot', async () => {
		const container = fixture([
			{ name: 'Prato', left: 40, top: 40, priority: 0 },
			{ name: 'Toscana', left: 50, top: 44, priority: 1 }
		]);
		const map = fakeMap();
		enableLabelCollision(map, container);
		await nextFrame();
		container.querySelector('.maplibregl-popup-content')!.classList.add(HOVERED_CLASS);
		map.moved();
		await nextFrame();
		expect(drawn(container)).toEqual(['Prato']);
	});

	it('makes room for a magnified name, without being asked', async () => {
		// Two names with room to spare - until one of them is magnified and
		// grows over its neighbour (FT-02/FT-03).
		const container = fixture([
			{ name: 'Prato', left: 40, top: 40, priority: 0 },
			{ name: 'Pistoia', left: 95, top: 40, priority: 1 }
		]);
		enableLabelCollision(fakeMap(), container);
		await nextFrame();
		expect(drawn(container)).toEqual(['Prato', 'Pistoia']);

		container.querySelector('.maplibregl-popup-content')!.classList.add(HOVERED_CLASS);
		// The name grows into its full size over 120ms (app.css).
		await new Promise((r) => setTimeout(r, 400));
		expect(drawn(container)).toEqual(['Prato']);
	});

	it('places a name added later, without the view having to ask', async () => {
		const container = fixture([{ name: 'Toscana', left: 50, top: 44, priority: 1 }]);
		enableLabelCollision(fakeMap(), container);
		await nextFrame();

		const popup = document.createElement('div');
		popup.className = 'maplibregl-popup geoclick-solved-popup';
		popup.style.cssText = 'position:absolute;left:40px;top:40px';
		popup.innerHTML = '<div class="maplibregl-popup-content">Prato</div>';
		container.append(popup);
		// The MutationObserver runs before the frame the pass is queued in.
		await nextFrame();
		await nextFrame();
		expect(drawn(container)).toEqual(['Toscana']);
	});

	it('hides a crowded name from the pointer too: nothing is drawn there', async () => {
		const container = fixture([
			{ name: 'Prato', left: 40, top: 40, priority: 0 },
			{ name: 'Toscana', left: 50, top: 44, priority: 1 }
		]);
		enableLabelCollision(fakeMap(), container);
		await nextFrame();
		const hidden = container.querySelectorAll<HTMLElement>('.maplibregl-popup')[0];
		const rect = hidden.getBoundingClientRect();
		expect(hidden.classList.contains(CROWDED_CLASS)).toBe(true);
		// A point inside the hidden name, but clear of the one drawn over it.
		expect(labelAt(container, rect.left + 2, rect.top + 2)?.textContent).not.toBe('Prato');
	});

	it('stops listening when the map goes away', async () => {
		const container = fixture([{ name: 'Toscana', left: 50, top: 44 }]);
		const map = fakeMap();
		const stop = enableLabelCollision(map, container);
		await nextFrame();
		stop();
		expect(map.listenerCount()).toBe(0);
	});
});
