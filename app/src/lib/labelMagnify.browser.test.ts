// Runs in the browser project (real Chromium) - it needs a real DOM and real
// PointerEvents.
import { afterEach, describe, expect, it } from 'vitest';
import { MAGNIFIED_CLASS, enableTapToMagnify } from './labelMagnify';

// The DOM shape MapLibre renders: popups are children of the map container,
// alongside the canvas.
function fixture() {
	const container = document.createElement('div');
	container.innerHTML = `
		<div class="maplibregl-canvas-container"><canvas></canvas></div>
		<div class="maplibregl-popup geoclick-solved-popup"><div class="maplibregl-popup-content">Toscana</div></div>
		<div class="maplibregl-popup geoclick-solved-popup"><div class="maplibregl-popup-content">Lazio</div></div>`;
	document.body.append(container);
	const [toscana, lazio] = container.querySelectorAll<HTMLElement>('.maplibregl-popup-content');
	const canvas = container.querySelector('canvas')!;
	return { container, toscana, lazio, canvas };
}

const tap = (el: Element, pointerType = 'touch') =>
	el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType }));
const magnified = (container: HTMLElement) =>
	[...container.querySelectorAll(`.${MAGNIFIED_CLASS}`)].map((e) => e.textContent);

describe('enableTapToMagnify', () => {
	afterEach(() => document.body.replaceChildren());

	it('a tap magnifies a label, and tapping it again shrinks it back', () => {
		const { container, toscana } = fixture();
		enableTapToMagnify(container);
		tap(toscana);
		expect(magnified(container)).toEqual(['Toscana']);
		tap(toscana);
		expect(magnified(container)).toEqual([]);
	});

	it('only one label is magnified at a time', () => {
		const { container, toscana, lazio } = fixture();
		enableTapToMagnify(container);
		tap(toscana);
		tap(lazio);
		expect(magnified(container)).toEqual(['Lazio']);
	});

	it('a tap anywhere else on the map shrinks it back', () => {
		const { container, toscana, canvas } = fixture();
		enableTapToMagnify(container);
		tap(toscana);
		tap(canvas);
		expect(magnified(container)).toEqual([]);
	});

	it('works for pen as well as touch, and ignores the mouse (hover handles it)', () => {
		const { container, toscana, lazio } = fixture();
		enableTapToMagnify(container);
		tap(toscana, 'mouse');
		expect(magnified(container)).toEqual([]);
		tap(lazio, 'pen');
		expect(magnified(container)).toEqual(['Lazio']);
	});

	it('never cancels the tap, so region taps and quiz drags are unaffected', () => {
		const { container, toscana } = fixture();
		enableTapToMagnify(container);
		const event = new PointerEvent('pointerdown', {
			bubbles: true,
			cancelable: true,
			pointerType: 'touch'
		});
		toscana.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});

	it('the returned function removes the listener', () => {
		const { container, toscana } = fixture();
		const disable = enableTapToMagnify(container);
		disable();
		tap(toscana);
		expect(magnified(container)).toEqual([]);
	});
});
