// The button under the zoom control that hides the map bar (tablet play,
// 2026-09-24): during a round the view tabs, the map's name and the pills
// take a strip of the map, and on a tablet that strip is where the northern
// names go. A MapLibre control, so it sits in the zoom control's column and
// stays on screen while everything else is hidden - the way back is always
// where the player last pressed.

import type * as maplibregl from 'maplibre-gl';
import { t } from './i18n.svelte';
import { mapNavHidden, setMapNavHidden } from './mapPrefs.svelte';

// An eye while the buttons show (press to hide them), a struck-through eye
// while they are hidden (press to bring them back).
const EYE =
	'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
const EYE_OFF = `${EYE}<path d="M4 4l16 16"/>`;

export class HideButtonsControl implements maplibregl.IControl {
	private container: HTMLDivElement | undefined;
	private stop: (() => void) | undefined;

	onAdd(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'maplibregl-ctrl maplibregl-ctrl-group geoclick-hide-buttons';
		const button = document.createElement('button');
		button.type = 'button';
		button.addEventListener('click', () => setMapNavHidden(!mapNavHidden()));
		container.append(button);
		// Follows the state and the language: the label is what the press does.
		this.stop = $effect.root(() => {
			$effect(() => {
				const hidden = mapNavHidden();
				const label = t(hidden ? 'nav.showButtons' : 'nav.hideButtons');
				button.setAttribute('aria-pressed', String(hidden));
				button.setAttribute('aria-label', label);
				button.title = label;
				button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${hidden ? EYE_OFF : EYE}</svg>`;
			});
		});
		this.container = container;
		return container;
	}

	onRemove(): void {
		this.stop?.();
		this.container?.remove();
		this.container = undefined;
	}
}
