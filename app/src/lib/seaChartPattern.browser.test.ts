import { describe, expect, it } from 'vitest';
import { seaChartPatternDataUrl, seaChartPatternImageId } from './seaChartPattern';

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
});
