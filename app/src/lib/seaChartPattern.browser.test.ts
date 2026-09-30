import { describe, expect, it } from 'vitest';
import { seaChartPatternDataUrl } from './seaChartPattern';

describe('the bundled sea-chart pattern', () => {
	it('is an offline background with an inscription in each player language', () => {
		for (const [language, inscription] of [
			['en', 'Here be dragons'],
			['de', 'Hier sind Drachen'],
			['it', 'Qui ci sono i draghi']
		] as const) {
			const dataUrl = seaChartPatternDataUrl(language);
			expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
			expect(decodeURIComponent(dataUrl.split(',')[1]!)).toContain(inscription);
		}
	});

	it('decodes as an SVG tile at its authored dimensions', async () => {
		const image = new Image();
		image.src = seaChartPatternDataUrl('en');
		await image.decode();
		expect(image.naturalWidth).toBe(512);
		expect(image.naturalHeight).toBe(512);
	});
});
