import patternSvg from './assets/sea-chart-pattern.svg?raw';
import { tForLanguage, type Language } from './i18n.svelte';

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
