import patternSvg from './assets/sea-chart-pattern.svg?raw';
import { tForLanguage, type Language } from './i18n.svelte';

const IMAGE_PREFIX = 'terrain-sea-chart-art';

/** The language-specific sprite id keeps the decorative inscription localized. */
export function seaChartPatternImageId(language: Language): string {
	return `${IMAGE_PREFIX}-${language}`;
}

/** Embed the localized SVG as a data URL: no runtime image or glyph request. */
export function seaChartPatternDataUrl(language: Language): string {
	const inscription = tForLanguage('mapArt.hereBeDragons', language).replace(
		/[&<>"']/g,
		(character) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!
	);
	const svg = patternSvg.replace('@@DRAGON_INSCRIPTION@@', inscription);
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Decodes the pattern and rasterises it to `ImageData`. Deliberately not
 * `Map.loadImage`: its loader (fetch + `createImageBitmap`) cannot decode an
 * SVG blob in Chromium - it throws "The source image could not be decoded",
 * which silently dropped the whole decoration layer from both the desktop and
 * Android builds. An `HTMLImageElement` decodes it, so the bytes go through a
 * canvas instead.
 */
export async function loadSeaChartPattern(language: Language): Promise<ImageData> {
	const image = new Image();
	image.src = seaChartPatternDataUrl(language);
	await image.decode();
	const canvas = document.createElement('canvas');
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('a 2D canvas is needed to rasterise the sea-chart art');
	context.drawImage(image, 0, 0);
	return context.getImageData(0, 0, canvas.width, canvas.height);
}
