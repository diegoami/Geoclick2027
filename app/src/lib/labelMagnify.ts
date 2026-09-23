// Magnify a map label on demand: under the mouse pointer (FT-02), or with a
// tap on a touch screen (FT-03). app.css styles both the same way.
//
// Labels don't take pointer input themselves (app.css, FT-18): a drag or
// pinch that starts on a name has to move the map, and MapLibre ignores
// gestures that begin on a popup. So one delegated listener on the map
// container finds the label under the pointer by position instead. It also
// covers labels MapLibre adds later (every solved quiz label is a new popup).

const LABEL = '.maplibregl-popup-content';
/** A label grown by a tap (touch, pen); stays until tapped again or elsewhere. */
export const MAGNIFIED_CLASS = 'is-magnified';
/** A label grown because the mouse is over it; follows the pointer. */
export const HOVERED_CLASS = 'is-hovered';
/**
 * A label the collision pass (labelCollision.ts) decided not to draw, because
 * a more important name is in its place (FT-23). Set on the popup element,
 * not on the content. It keeps its position and size - that is how the next
 * pass knows where it wants to go - so hit-testing has to skip it explicitly.
 * Lives here, with the other label classes, to keep the dependency one-way:
 * labelCollision.ts knows about magnifying, magnifying doesn't import it.
 */
export const CROWDED_CLASS = 'is-crowded';
/**
 * A region's name drawn along the region instead (FT-66, stretchedNames.ts).
 * Set on the popup's content, which app.css then hides: the popup stays, so
 * the name can fall back to it the moment the stretched one stops fitting.
 */
export const STRETCHED_CLASS = 'is-stretched';

/**
 * A stretched name is SVG text along a curve, so its rectangle says little
 * about where it is. Each registers how to tell whether a point (client
 * coordinates) is on it, and labelAt asks. Keyed by the element, so a name
 * removed with its element is forgotten.
 */
const hitShapes = new Map<Element, (x: number, y: number) => boolean>();
export function registerHitShape(element: Element, hit: (x: number, y: number) => boolean) {
	hitShapes.set(element, hit);
}
export function unregisterHitShape(element: Element) {
	hitShapes.delete(element);
}
// How far a finger may move between down and up and still count as a tap,
// not a drag. About the size of a finger's own wobble.
const TAP_SLOP_PX = 10;

/** The label at a point, topmost first: a grown label covers its neighbours.
 * Names hidden as crowded (FT-23) are skipped - nothing is drawn there. */
export function labelAt(container: HTMLElement, x: number, y: number): Element | undefined {
	const labels: Element[] = [...container.querySelectorAll<HTMLElement>(LABEL)].filter(
		(l) => !l.closest(`.${CROWDED_CLASS}`) && !l.classList.contains(STRETCHED_CLASS)
	);
	// Stretched names (FT-66) are drawn under the popups, so they come last.
	const stretched = [...hitShapes.keys()].filter((l) => container.contains(l));
	const grown = [...labels, ...stretched].filter(
		(l) => l.classList.contains(MAGNIFIED_CLASS) || l.classList.contains(HOVERED_CLASS)
	);
	const hits = (label: Element) => {
		const shape = hitShapes.get(label);
		if (shape) return shape(x, y);
		const r = label.getBoundingClientRect();
		return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
	};
	// Later popups are drawn over earlier ones.
	return [...grown, ...labels.reverse(), ...stretched].find(hits);
}

/**
 * Hover (mouse) and tap (touch, pen) to magnify, for every label in the map
 * container. A tap toggles the label under it and shrinks any other; a drag
 * does nothing here, since it belongs to the map. Never calls preventDefault,
 * so region clicks, map gestures and quiz drags behave as before. Returns a
 * function that removes the listeners.
 */
export function enableLabelMagnify(container: HTMLElement): () => void {
	let hovered: Element | undefined;
	let down: { id: number; x: number; y: number } | undefined;
	let frame = 0;

	const setHovered = (label: Element | undefined) => {
		if (label === hovered) return;
		hovered?.classList.remove(HOVERED_CLASS);
		label?.classList.add(HOVERED_CLASS);
		hovered = label;
	};

	const onPointerMove = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse') return;
		const { clientX, clientY } = e;
		// At most one hit test per frame: pointermove can fire far more often.
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => setHovered(labelAt(container, clientX, clientY)));
	};
	const onPointerLeave = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse') return;
		cancelAnimationFrame(frame);
		setHovered(undefined);
	};
	const onPointerDown = (e: PointerEvent) => {
		if (e.pointerType === 'mouse') return;
		down = { id: e.pointerId, x: e.clientX, y: e.clientY };
	};
	const onPointerUp = (e: PointerEvent) => {
		if (e.pointerType === 'mouse' || !down || down.id !== e.pointerId) return;
		const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
		const at = down;
		down = undefined;
		if (moved > TAP_SLOP_PX) return;
		const label = labelAt(container, at.x, at.y);
		const current = container.querySelector(`.${MAGNIFIED_CLASS}`);
		if (current && current !== label) current.classList.remove(MAGNIFIED_CLASS);
		label?.classList.toggle(MAGNIFIED_CLASS);
	};
	const onPointerCancel = () => (down = undefined);

	// Capture phase: sees the input even if something inside stops propagation.
	const options = { capture: true, passive: true };
	container.addEventListener('pointermove', onPointerMove, options);
	container.addEventListener('pointerleave', onPointerLeave, options);
	container.addEventListener('pointerdown', onPointerDown, options);
	container.addEventListener('pointerup', onPointerUp, options);
	container.addEventListener('pointercancel', onPointerCancel, options);
	return () => {
		cancelAnimationFrame(frame);
		container.removeEventListener('pointermove', onPointerMove, { capture: true });
		container.removeEventListener('pointerleave', onPointerLeave, { capture: true });
		container.removeEventListener('pointerdown', onPointerDown, { capture: true });
		container.removeEventListener('pointerup', onPointerUp, { capture: true });
		container.removeEventListener('pointercancel', onPointerCancel, { capture: true });
	};
}
