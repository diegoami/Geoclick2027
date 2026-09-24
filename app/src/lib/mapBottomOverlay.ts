// A panel that covers the bottom of the map - the Quiz's tray of names, the
// Tour's controls - publishes how much of the bottom it takes, as two CSS
// variables on the page root. app.css lifts the map's credit line and the
// version badge by that much, so neither is drawn over the names
// (tablet play, 2026-09-24). The tray's height changes as the player drags it
// or the hand shrinks, hence a ResizeObserver rather than one measurement.

/** How much of the map's own bottom edge is covered: for its controls. */
export const MAP_BOTTOM_VAR = '--map-bottom-overlay';
/** How much of the window's bottom edge is covered: for the fixed version badge. */
export const WINDOW_BOTTOM_VAR = '--window-bottom-overlay';

/**
 * Publishes the distance from `el`'s top edge down to the bottom of the view
 * it floats in, and down to the bottom of the window - its height for the
 * tray, which sits on the edge; more for the Tour's controls, which float
 * above it - until the returned cleanup runs (an $effect's teardown).
 */
export function publishBottomOverlay(el: HTMLElement): () => void {
	const root = document.documentElement;
	const publish = () => {
		const top = el.getBoundingClientRect().top;
		const viewBottom = (el.offsetParent ?? root).getBoundingClientRect().bottom;
		root.style.setProperty(MAP_BOTTOM_VAR, `${Math.round(Math.max(0, viewBottom - top))}px`);
		root.style.setProperty(
			WINDOW_BOTTOM_VAR,
			`${Math.round(Math.max(0, window.innerHeight - top))}px`
		);
	};
	publish();
	const observer = new ResizeObserver(publish);
	observer.observe(el);
	window.addEventListener('resize', publish);
	return () => {
		observer.disconnect();
		window.removeEventListener('resize', publish);
		root.style.removeProperty(MAP_BOTTOM_VAR);
		root.style.removeProperty(WINDOW_BOTTOM_VAR);
	};
}
