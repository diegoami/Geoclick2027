// Runs in the browser project (real Chromium): the padding is measured from
// real elements laid out by the browser.
import { afterEach, describe, expect, it } from 'vitest';
import { mapFitPadding } from './mapFit';

// The shape map views have after the chart-art shell was added: overlays are
// in the marked view root, while the actual MapLibre viewport is nested.
function view({
	top = 0,
	bottom = 0,
	width = 390,
	height = 844
}: { top?: number; bottom?: number; width?: number; height?: number } = {}) {
	const root = document.createElement('div');
	root.dataset.mapFitRoot = '';
	root.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px`;
	root.innerHTML = `
		${top ? `<div data-map-overlay="top" style="position:absolute;left:12px;top:12px;width:200px;height:${top}px"></div>` : ''}
		${bottom ? `<div data-map-overlay="bottom" style="position:absolute;left:0;bottom:0;width:100%;height:${bottom}px"></div>` : ''}
		<div class="chart-map-shell" style="position:absolute;inset:0">
			<div class="container" style="position:absolute;inset:8px"></div>
		</div>`;
	document.body.append(root);
	return root.querySelector<HTMLElement>('.container')!;
}

describe('mapFitPadding', () => {
	afterEach(() => document.body.replaceChildren());

	it('leaves a plain margin when nothing covers the map', () => {
		expect(mapFitPadding(view())).toEqual({ top: 40, right: 40, bottom: 40, left: 40 });
	});

	it('clears the map bar at the top, margin included', () => {
		// The bar starts 12px down and is 100px tall, so it ends at 112, and
		// the map keeps a small gap below it.
		expect(mapFitPadding(view({ top: 100 })).top).toBe(116);
	});

	it('clears the quiz tray at the bottom', () => {
		expect(mapFitPadding(view({ top: 100, bottom: 250 }))).toMatchObject({
			top: 116,
			bottom: 254
		});
	});

	it('takes a height that is not on screen yet, for a tray about to grow', () => {
		// What the quiz does: it knows the tray's new height before the DOM does.
		expect(mapFitPadding(view({ top: 100 }), { bottom: 250 }).bottom).toBe(262);
	});

	it('keeps the larger of the measured and the given height', () => {
		expect(mapFitPadding(view({ bottom: 250 }), { bottom: 60 }).bottom).toBe(254);
	});

	it('scales back padding the map has no room for, keeping the ratio', () => {
		// A short map with a tray taking almost all of it: MapLibre would refuse
		// to fit at all, so the furniture gives a little back.
		const padding = mapFitPadding(view({ top: 60, bottom: 380, height: 500 }));
		expect(padding.top + padding.bottom).toBeCloseTo(484 * 0.85, 5);
		expect(padding.bottom).toBeGreaterThan(padding.top);
	});

	it('ignores an overlay that isn\u2019t showing', () => {
		const container = view({ top: 100 });
		container
			.closest('[data-map-fit-root]')!
			.querySelector<HTMLElement>('[data-map-overlay]')!.style.display = 'none';
		expect(mapFitPadding(container).top).toBe(40);
	});
});
