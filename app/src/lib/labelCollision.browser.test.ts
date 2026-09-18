// Runs in the browser project (real Chromium): the collision pass measures
// real labels laid out by the real CSS.
import { afterEach, describe, expect, it } from 'vitest';
import '../app.css';
import {
	DOT_CLEARANCE_PX,
	PRIORITY_ATTR,
	enableLabelCollision,
	registerLabel
} from './labelCollision';
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
		if (priority !== undefined) popup.setAttribute(PRIORITY_ATTR, String(priority));
	}
	return container;
}

// Labels the pass may move (FT-24): MapLibre centres a popup with
// anchor 'center' on its place and shifts it by setOffset, which is what this
// reproduces - left/top is the place itself, the transform does the rest.
function placedFixture(
	labels: { name: string; x: number; y: number; priority?: number; beside?: number }[]
) {
	const container = document.createElement('div');
	container.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px';
	document.body.append(container);
	for (const { name, x, y, priority, beside } of labels) {
		const popup = document.createElement('div');
		popup.className = 'maplibregl-popup geoclick-solved-popup';
		popup.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%)`;
		popup.innerHTML = `<div class="maplibregl-popup-content">${name}</div>`;
		container.append(popup);
		registerLabel(
			{
				getElement: () => popup,
				setOffset: ([dx, dy]) => {
					popup.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
				}
			},
			{ priority, beside }
		);
	}
	return container;
}

const boxOf = (container: HTMLElement, name: string) => {
	const popup = [...container.querySelectorAll('.maplibregl-popup')].find(
		(p) => p.textContent === name
	)!;
	return popup.getBoundingClientRect();
};

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

describe('where a label goes (FT-24)', () => {
	afterEach(() => document.body.replaceChildren());

	it('puts a town name beside its dot, never on it', async () => {
		const container = placedFixture([{ name: 'Napoli', x: 300, y: 200, beside: DOT_CLEARANCE_PX }]);
		enableLabelCollision(fakeMap(), container);
		await nextFrame();
		const box = boxOf(container, 'Napoli');
		expect(drawn(container)).toEqual(['Napoli']);
		// Clear of the dot, and still level with it.
		expect(box.left).toBeGreaterThanOrEqual(300 + DOT_CLEARANCE_PX - 0.5);
		expect((box.top + box.bottom) / 2).toBeCloseTo(200, 0);
	});

	it('takes the other side of the dot when the first one is taken', async () => {
		const container = placedFixture([
			// A name already sitting where Napoli's would go, and outranking it.
			{ name: 'Caserta', x: 360, y: 200, priority: 5 },
			{ name: 'Napoli', x: 300, y: 200, priority: 1, beside: DOT_CLEARANCE_PX }
		]);
		enableLabelCollision(fakeMap(), container);
		await nextFrame();
		expect(drawn(container)).toEqual(['Caserta', 'Napoli']);
		// Napoli went to the left of its dot instead of being dropped.
		expect(boxOf(container, 'Napoli').right).toBeLessThanOrEqual(300 - DOT_CLEARANCE_PX + 0.5);
	});

	it('steps a region name one line off its middle rather than dropping it', async () => {
		const container = placedFixture([
			{ name: 'Piemonte', x: 300, y: 200, priority: 5 },
			{ name: 'Lombardia', x: 330, y: 204, priority: 1 }
		]);
		enableLabelCollision(fakeMap(), container);
		await nextFrame();
		expect(drawn(container)).toEqual(['Piemonte', 'Lombardia']);
		// One line below its middle: a step up would still have touched
		// Piemonte, a step down was free.
		expect(boxOf(container, 'Lombardia').top).toBeGreaterThanOrEqual(
			boxOf(container, 'Piemonte').bottom
		);
	});

	it('still drops a name when every spot it has is taken', async () => {
		const container = placedFixture([
			{ name: 'Torino', x: 300, y: 172, priority: 5 },
			{ name: 'Piemonte', x: 300, y: 200, priority: 4 },
			{ name: 'Asti', x: 300, y: 228, priority: 3 },
			{ name: 'Alessandria', x: 305, y: 200, priority: 1 }
		]);
		enableLabelCollision(fakeMap(), container);
		await nextFrame();
		expect(drawn(container)).not.toContain('Alessandria');
	});
});
