// A panel that covers the bottom of the map - the Quiz's tray of names, the
// Tour's controls - publishes how much of the bottom it takes as a CSS
// variable on the page root. app.css lifts the map's credit line by that much,
// so it is not drawn over the names
// (tablet play, 2026-09-24). The tray's height changes as the player drags it
// or the hand shrinks, hence a ResizeObserver rather than one measurement.

/** How much of the map's own bottom edge is covered: for its controls. */
export const MAP_BOTTOM_VAR = '--map-bottom-overlay';

/**
 * Publishes the distance from `el`'s top edge down to the bottom of the view
 * it floats in, and down to the bottom of the window - its height for the
 * tray, which sits on the edge; more for the Tour's controls, which float
 * above it - until the returned cleanup runs (an $effect's teardown).
 */
export function publishBottomOverlay(el: HTMLElement): () => void {
	publishers.add(el);
	if (!observer) {
		observer = new ResizeObserver(publishAll);
		window.addEventListener('resize', publishAll);
	}
	observer.observe(el);
	publishAll();
	return () => {
		if (!publishers.delete(el)) return;
		observer?.unobserve(el);
		if (publishers.size === 0) {
			observer?.disconnect();
			observer = undefined;
			window.removeEventListener('resize', publishAll);
		}
		publishAll();
	};
}

// Several panels may publish at once (#68): the largest of them wins, and
// one going away leaves the others' values rather than clearing them.
const publishers = new Set<HTMLElement>();
let observer: ResizeObserver | undefined;

function publishAll(): void {
	const root = document.documentElement;
	if (publishers.size === 0) {
		root.style.removeProperty(MAP_BOTTOM_VAR);
		return;
	}
	let mapBottom = 0;
	for (const el of publishers) {
		const top = el.getBoundingClientRect().top;
		const viewBottom = (el.offsetParent ?? root).getBoundingClientRect().bottom;
		mapBottom = Math.max(mapBottom, viewBottom - top);
	}
	root.style.setProperty(MAP_BOTTOM_VAR, `${Math.round(mapBottom)}px`);
}
