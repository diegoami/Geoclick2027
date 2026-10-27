// MapLibre exposes an initial locale but no public live-locale setter.
// Keep its rendered controls localized without replacing the map or using private fields.
import type { Map } from 'maplibre-gl';
import { getLanguage, t, tForLanguage, type Language, type TranslationKey } from './i18n.svelte';

const controls = [
	['.maplibregl-ctrl-zoom-in', 'NavigationControl.ZoomIn', 'mapControl.zoomIn'],
	['.maplibregl-ctrl-zoom-out', 'NavigationControl.ZoomOut', 'mapControl.zoomOut'],
	['.maplibregl-ctrl-compass', 'NavigationControl.ResetBearing', 'mapControl.resetBearing'],
	[
		'.maplibregl-ctrl-attrib-button',
		'AttributionControl.ToggleAttribution',
		'mapControl.attribution'
	],
	['.maplibregl-canvas', 'Map.Title', 'mapControl.map']
] as const satisfies readonly (readonly [string, string, TranslationKey])[];

export function mapControlLocale(language: Language = getLanguage()): Record<string, string> {
	return Object.fromEntries(controls.map(([, id, key]) => [id, tForLanguage(key, language)]));
}

export function followMapControlLanguage(map: Map): void {
	const container = map.getContainer();
	const update = () => {
		for (const [selector, , key] of controls) {
			const label = t(key);
			for (const element of container.querySelectorAll<HTMLElement>(selector)) {
				if (element.getAttribute('aria-label') !== label) element.setAttribute('aria-label', label);
				if (selector !== '.maplibregl-canvas' && element.title !== label) element.title = label;
			}
		}
	};
	const stop = $effect.root(() => {
		$effect(update);
	});
	// Controls can be added later; MapLibre may also refresh labels.
	// Write only changed values, so our own attribute notifications settle immediately.
	const observer = new MutationObserver(update);
	observer.observe(container, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['title', 'aria-label']
	});
	update();
	map.once('remove', () => {
		stop();
		observer.disconnect();
	});
}
