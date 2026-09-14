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
// How far a finger may move between down and up and still count as a tap,
// not a drag. About the size of a finger's own wobble.
const TAP_SLOP_PX = 10;

/** The label at a point, topmost first: a grown label covers its neighbours. */
export function labelAt(container: HTMLElement, x: number, y: number): HTMLElement | undefined {
	const labels = [...container.querySelectorAll<HTMLElement>(LABEL)];
	const grown = labels.filter(
		(l) => l.classList.contains(MAGNIFIED_CLASS) || l.classList.contains(HOVERED_CLASS)
	);
	// Later popups are drawn over earlier ones.
	for (const label of [...grown, ...labels.reverse()]) {
		const r = label.getBoundingClientRect();
		if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return label;
	}
	return undefined;
}

/**
 * Hover (mouse) and tap (touch, pen) to magnify, for every label in the map
 * container. A tap toggles the label under it and shrinks any other; a drag
 * does nothing here, since it belongs to the map. Never calls preventDefault,
 * so region clicks, map gestures and quiz drags behave as before. Returns a
 * function that removes the listeners.
 */
export function enableLabelMagnify(container: HTMLElement): () => void {
	let hovered: HTMLElement | undefined;
	let down: { id: number; x: number; y: number } | undefined;
	let frame = 0;

	const setHovered = (label: HTMLElement | undefined) => {
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
		const current = container.querySelector(`${LABEL}.${MAGNIFIED_CLASS}`);
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
