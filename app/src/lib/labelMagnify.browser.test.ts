// Runs in the browser project (real Chromium) - it needs a real DOM, real
// layout and real PointerEvents.
import { afterEach, describe, expect, it } from 'vitest';
import '../app.css';
import {
	HOVERED_CLASS,
	MAGNIFIED_CLASS,
	STRETCHED_CLASS,
	enableLabelMagnify,
	labelAt,
	registerHitShape,
	unregisterHitShape
} from './labelMagnify';
import { StretchedNames } from './stretchedNames';

// The DOM shape MapLibre renders: popups are children of the map container,
// alongside the canvas. Labels are placed at fixed spots so input can be
// aimed at them by position, the way the real map's input arrives.
function fixture() {
	const container = document.createElement('div');
	container.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px';
	container.innerHTML = `
		<div class="maplibregl-canvas-container"><canvas width="600" height="400"></canvas></div>
		<div class="maplibregl-popup geoclick-solved-popup" style="position:absolute;left:100px;top:100px"><div class="maplibregl-popup-content">Toscana</div></div>
		<div class="maplibregl-popup geoclick-solved-popup" style="position:absolute;left:300px;top:200px"><div class="maplibregl-popup-content">Lazio</div></div>`;
	document.body.append(container);
	const [toscana, lazio] = container.querySelectorAll<HTMLElement>('.maplibregl-popup-content');
	const canvas = container.querySelector('canvas')!;
	return { container, toscana, lazio, canvas };
}

const centre = (el: Element) => {
	const r = el.getBoundingClientRect();
	return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

// Input lands on the canvas, as in the app: labels take no pointer input.
function pointer(
	canvas: Element,
	type: string,
	{ x, y }: { x: number; y: number },
	pointerType = 'touch'
) {
	const event = new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		pointerType,
		pointerId: 1,
		clientX: x,
		clientY: y
	});
	canvas.dispatchEvent(event);
	return event;
}
const tap = (canvas: Element, at: { x: number; y: number }, pointerType = 'touch') => {
	pointer(canvas, 'pointerdown', at, pointerType);
	pointer(canvas, 'pointerup', at, pointerType);
};
const withClass = (container: HTMLElement, cls: string) =>
	[...container.querySelectorAll(`.${cls}`)].map((e) => e.textContent);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

describe('labels', () => {
	afterEach(() => document.body.replaceChildren());

	it('take no pointer input, so drags and taps on them reach the map', () => {
		const { toscana } = fixture();
		expect(getComputedStyle(toscana).pointerEvents).toBe('none');
	});

	it("the Terrain layer's names take none either", () => {
		const popup = document.createElement('div');
		popup.className = 'maplibregl-popup geoclick-terrain-label geoclick-terrain-regions';
		const content = document.createElement('div');
		content.className = 'maplibregl-popup-content';
		content.textContent = 'Balkan Pen.';
		popup.append(content);
		document.body.append(popup);
		expect(getComputedStyle(content).pointerEvents).toBe('none');
	});
});

describe('enableLabelMagnify', () => {
	afterEach(() => document.body.replaceChildren());

	it('a tap magnifies the label under it, and tapping it again shrinks it back', () => {
		const { container, toscana, canvas } = fixture();
		enableLabelMagnify(container);
		tap(canvas, centre(toscana));
		expect(withClass(container, MAGNIFIED_CLASS)).toEqual(['Toscana']);
		tap(canvas, centre(toscana));
		expect(withClass(container, MAGNIFIED_CLASS)).toEqual([]);
	});

	it("a drag that starts on a label leaves it alone: the drag is the map's", () => {
		const { container, toscana, canvas } = fixture();
		enableLabelMagnify(container);
		const from = centre(toscana);
		pointer(canvas, 'pointerdown', from);
		pointer(canvas, 'pointermove', { x: from.x + 20, y: from.y + 30 });
		pointer(canvas, 'pointerup', { x: from.x + 40, y: from.y + 60 });
		expect(withClass(container, MAGNIFIED_CLASS)).toEqual([]);
	});

	it('only one label is magnified at a time', () => {
		const { container, toscana, lazio, canvas } = fixture();
		enableLabelMagnify(container);
		tap(canvas, centre(toscana));
		tap(canvas, centre(lazio));
		expect(withClass(container, MAGNIFIED_CLASS)).toEqual(['Lazio']);
	});

	it('a tap anywhere else on the map shrinks it back', () => {
		const { container, toscana, canvas } = fixture();
		enableLabelMagnify(container);
		tap(canvas, centre(toscana));
		tap(canvas, { x: 550, y: 350 });
		expect(withClass(container, MAGNIFIED_CLASS)).toEqual([]);
	});

	it('works for pen as well as touch; a mouse click toggles nothing', () => {
		const { container, toscana, lazio, canvas } = fixture();
		enableLabelMagnify(container);
		tap(canvas, centre(toscana), 'mouse');
		expect(withClass(container, MAGNIFIED_CLASS)).toEqual([]);
		tap(canvas, centre(lazio), 'pen');
		expect(withClass(container, MAGNIFIED_CLASS)).toEqual(['Lazio']);
	});

	it('the mouse magnifies the label it is over, and lets go when it leaves', async () => {
		const { container, toscana, canvas } = fixture();
		enableLabelMagnify(container);
		pointer(canvas, 'pointermove', centre(toscana), 'mouse');
		await nextFrame();
		expect(withClass(container, HOVERED_CLASS)).toEqual(['Toscana']);
		// Grows over a 120ms transition (app.css).
		await expect.poll(() => getComputedStyle(toscana).fontSize).toBe('20px');

		pointer(canvas, 'pointermove', { x: 550, y: 350 }, 'mouse');
		await nextFrame();
		expect(withClass(container, HOVERED_CLASS)).toEqual([]);
	});

	it('never cancels the input, so region clicks and map gestures are unaffected', () => {
		const { container, toscana, canvas } = fixture();
		enableLabelMagnify(container);
		expect(pointer(canvas, 'pointerdown', centre(toscana)).defaultPrevented).toBe(false);
		expect(pointer(canvas, 'pointerup', centre(toscana)).defaultPrevented).toBe(false);
	});

	it('the returned function removes the listeners', () => {
		const { container, toscana, canvas } = fixture();
		const disable = enableLabelMagnify(container);
		disable();
		tap(canvas, centre(toscana));
		expect(withClass(container, MAGNIFIED_CLASS)).toEqual([]);
	});
});

describe('stretched names (FT-66)', () => {
	it('finds a stretched name by its own shape, and skips the popup it stands in for', () => {
		const { container, toscana, canvas } = fixture();
		toscana.classList.add(STRETCHED_CLASS);
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		svg.appendChild(text);
		container.appendChild(svg);
		// On the name: a band along y = 50, x 20 to 220.
		registerHitShape(text, (x, y) => x >= 20 && x <= 220 && Math.abs(y - 50) <= 8);
		try {
			expect(labelAt(container, 100, 52)).toBe(text);
			expect(labelAt(container, 100, 80)).toBeUndefined();
			// The hidden popup is not a target, even where it would have been.
			const at = centre(toscana);
			expect(labelAt(container, at.x, at.y)).toBeUndefined();

			const stop = enableLabelMagnify(container);
			pointer(canvas, 'pointerdown', { x: 100, y: 50 });
			pointer(canvas, 'pointerup', { x: 100, y: 50 });
			expect(text.classList.contains(MAGNIFIED_CLASS)).toBe(true);
			stop();
		} finally {
			unregisterHitShape(text);
			container.remove();
		}
	});
});

// FT-68: a stretched name's hit shape is laid out in container px and asked
// about client px, so it converts. Off the page's corner, with the page
// scrolled, a missing or reversed conversion misses the name entirely.
describe('stretched names off the page corner (FT-68)', () => {
	afterEach(() => {
		document.body.replaceChildren();
		window.scrollTo(0, 0);
	});

	it('finds a stretched name at its client point, and not one pixel past its edge', () => {
		const container = document.createElement('div');
		container.style.cssText = 'position:relative;margin:420px 0 0 170px;width:600px;height:400px';
		container.innerHTML = '<div class="maplibregl-canvas-container"></div>';
		const spacer = document.createElement('div');
		spacer.style.height = '3000px';
		document.body.append(container, spacer);
		window.scrollTo(0, 150);
		// Identity projection: a spine's [lon, lat] is its container px.
		const map = {
			on: () => {},
			off: () => {},
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
		try {
			const text = container.querySelector('svg text')!;
			const { left, top } = container.getBoundingClientRect();
			expect({ left, top }).toEqual({ left: 170, top: 420 - 150 });
			// The name's middle, in client px.
			expect(labelAt(container, left + 300, top + 200)).toBe(text);
			// The hit band reaches 0.6 font sizes from the line (hitsLayout).
			const reach = 0.6 * parseFloat((text as SVGTextElement).style.fontSize);
			expect(labelAt(container, left + 300, top + 200 + reach - 1)).toBe(text);
			expect(labelAt(container, left + 300, top + 200 + reach + 1)).toBeUndefined();
		} finally {
			names.destroy();
		}
	});
});
