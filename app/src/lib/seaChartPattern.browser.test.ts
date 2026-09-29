import { describe, expect, it } from 'vitest';
import {
	loadSeaChartPattern,
	seaChartPatternDataUrl,
	seaChartPatternImageId
} from './seaChartPattern';

describe('the bundled sea-chart pattern', () => {
	it('is an offline image with an inscription in each player language', async () => {
		for (const [language, inscription] of [
			['en', 'Here be dragons'],
			['de', 'Hier sind Drachen'],
			['it', 'Qui ci sono i draghi']
		] as const) {
			const dataUrl = seaChartPatternDataUrl(language);
			expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
			expect(seaChartPatternImageId(language)).toBe(`terrain-sea-chart-art-${language}`);
			expect(decodeURIComponent(dataUrl.split(',')[1]!)).toContain(inscription);

			const image = new Image();
			image.src = dataUrl;
			await image.decode();
			expect(image.naturalWidth).toBe(512);
			expect(image.naturalHeight).toBe(512);
		}
	});

	// The art silently vanished from the packaged app because MapLibre's
	// `loadImage` cannot decode an SVG blob (createImageBitmap throws). The
	// layer must get rasterised pixels it can add, so exercise the path the
	// terrain actually uses - not just `new Image()`.
	it('loads as rasterised ImageData the map can add', async () => {
		const image = await loadSeaChartPattern('en');
		expect(image.width).toBe(512);
		expect(image.height).toBe(512);
		// The hatching, compass, dragon and ship are drawn, not a blank tile.
		const opaque = image.data.filter(
			(_, index) => index % 4 === 3 && image.data[index]! > 0
		).length;
		expect(opaque).toBeGreaterThan(100);
	});
});
