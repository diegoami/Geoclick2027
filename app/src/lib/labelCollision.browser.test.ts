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
import { StretchedNames } from './stretchedNames';

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
		stopped: () => listeners.get('moveend')?.forEach((fn) => fn()),
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

	it("moves a town name off a neighbour's dot, to where there is room (FT-63)", async () => {
		// Duisburg, with Essen's dot 40 px to its east and no name of its own
		// yet - the quiz hasn't reached it.
		const container = placedFixture([
			{ name: 'Duisburg', x: 300, y: 200, beside: DOT_CLEARANCE_PX }
		]);
		// Off the page's corner, so the dots (container-relative, like
		// map.project) and the labels (page-relative) only meet if the pass
		// converts one to the other.
		container.style.left = '100px';
		container.style.top = '50px';
		enableLabelCollision(fakeMap(), container, {
			dots: () => [
				{ x: 300, y: 200 },
				{ x: 340, y: 200 }
			]
		});
		await nextFrame();
		expect(drawn(container)).toEqual(['Duisburg']);
		// West of its dot, the way the first free side never put it.
		expect(boxOf(container, 'Duisburg').right).toBeLessThanOrEqual(
			100 + 300 - DOT_CLEARANCE_PX + 0.5
		);
	});

	it('keeps a name where it is while the map moves, and places it afresh once it stops (FT-63)', async () => {
		const container = placedFixture([
			{ name: 'Caserta', x: 360, y: 200, priority: 5 },
			{ name: 'Napoli', x: 300, y: 200, priority: 1, beside: DOT_CLEARANCE_PX }
		]);
		const map = fakeMap();
		enableLabelCollision(map, container);
		await nextFrame();
		const napoliIsLeft = () => boxOf(container, 'Napoli').right <= 300 - DOT_CLEARANCE_PX + 0.5;
		expect(napoliIsLeft()).toBe(true);

		// Caserta moves away mid-gesture, freeing the right-hand side: while the
		// map is still moving, Napoli stays put rather than flicker across.
		const caserta = container.querySelector<HTMLElement>('.maplibregl-popup')!;
		caserta.style.left = '560px';
		map.moved();
		await nextFrame();
		expect(napoliIsLeft()).toBe(true);

		// Once the map stops, it takes its favourite spot again.
		map.stopped();
		await nextFrame();
		expect(boxOf(container, 'Napoli').left).toBeGreaterThanOrEqual(300 + DOT_CLEARANCE_PX - 0.5);
	});

	it('puts a name back once the neighbour that pushed it aside shrinks again (FT-63)', async () => {
		const container = placedFixture([
			{ name: 'Napoli', x: 300, y: 200, priority: 1, beside: DOT_CLEARANCE_PX },
			{ name: 'Caserta', x: 0, y: 200, priority: 0 }
		]);
		// Caserta 13 px clear of Napoli's right-hand spot: more than the room
		// that counts, so Napoli has no reason to leave its favourite side...
		const [, caserta] = container.querySelectorAll<HTMLElement>('.maplibregl-popup');
		const width = caserta.getBoundingClientRect().width;
		const napoliRight = 300 + DOT_CLEARANCE_PX + boxOf(container, 'Napoli').width;
		caserta.style.left = `${napoliRight + 13 + width / 2}px`;
		enableLabelCollision(fakeMap(), container);
		await nextFrame();
		const napoliIsRight = () => boxOf(container, 'Napoli').left >= 300 + DOT_CLEARANCE_PX - 0.5;
		expect(napoliIsRight()).toBe(true);

		// ...until Caserta is magnified and grows into it (FT-02/FT-03).
		const content = caserta.querySelector('.maplibregl-popup-content')!;
		content.classList.add(HOVERED_CLASS);
		await new Promise((r) => setTimeout(r, 400));
		expect(napoliIsRight()).toBe(false);

		// The hover ends: Napoli goes back, with no map move to prompt it.
		content.classList.remove(HOVERED_CLASS);
		await new Promise((r) => setTimeout(r, 400));
		expect(napoliIsRight()).toBe(true);
	});
});

// FT-68: a stretched name is an obstacle in container px (map.project), and
// the pass compares it with popups in client px. Every other case keeps the
// container at the page's corner, where a missing or reversed conversion
// changes nothing; here it sits in from the edge and the page is scrolled.
describe('stretched names as obstacles, off the page corner (FT-68)', () => {
	afterEach(() => {
		document.body.replaceChildren();
		window.scrollTo(0, 0);
	});

	function offsetMap() {
		const container = document.createElement('div');
		container.style.cssText = 'position:relative;margin:420px 0 0 170px;width:600px;height:400px';
		container.innerHTML = '<div class="maplibregl-canvas-container"></div>';
		const spacer = document.createElement('div');
		spacer.style.height = '3000px';
		document.body.append(container, spacer);
		window.scrollTo(0, 150);
		// Identity projection: a spine's [lon, lat] is its container px.
		const map = {
			...fakeMap(),
			getContainer: () => container,
			getCanvasContainer: () => container.firstElementChild as HTMLElement,
			project: ([x, y]: [number, number]) => ({ x, y })
		};
		const names = new StretchedNames(
			map as unknown as ConstructorParameters<typeof StretchedNames>[0]
		);
		// Toscana along y = 200, x 100 to 500, in container px.
		names.set('toscana', {
			name: 'Toscana',
			spine: {
				curve: [
					[100, 200],
					[300, 200],
					[500, 200]
				],
				aspect: 10
			},
			tier: 'known',
			popup: { getElement: () => undefined }
		});
		return { container, map, names };
	}

	const pill = (container: HTMLElement, name: string, left: number, top: number) => {
		const popup = document.createElement('div');
		popup.className = 'maplibregl-popup geoclick-solved-popup';
		popup.style.cssText = `position:absolute;left:${left}px;top:${top}px`;
		popup.innerHTML = `<div class="maplibregl-popup-content">${name}</div>`;
		container.append(popup);
	};

	it('a pill label where a stretched name sits yields to it', async () => {
		const { container, map, names } = offsetMap();
		expect(container.getBoundingClientRect()).toMatchObject({ left: 170, top: 420 - 150 });
		pill(container, 'Firenze', 280, 190);
		pill(container, 'Roma', 280, 320);
		enableLabelCollision(map, container);
		await nextFrame();
		// Firenze sits on the name and is hidden; Roma, clear of it, is drawn.
		expect(drawn(container)).toEqual(['Roma']);
		names.destroy();
	});
});
