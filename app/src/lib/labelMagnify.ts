// Tap to magnify a map label on touch screens (FT-03). Mouse users get the
// same effect from :hover (app.css, FT-02). Touch has no real hover, and mobile
// browsers' emulated "sticky" hover behaves inconsistently, so on touch a tap
// toggles an explicit class instead. app.css styles both the same way.
//
// One delegated listener on the map container also covers labels MapLibre adds
// later (every solved quiz label is a new popup).

const LABEL = '.maplibregl-popup-content';
export const MAGNIFIED_CLASS = 'is-magnified';

/**
 * A touch or pen tap on a label magnifies it; tapping it again, or tapping
 * anywhere else in the container, shrinks it back. At most one label is
 * magnified at a time. Mouse events are ignored, since hover already does this.
 * Never calls preventDefault, so region taps and quiz drags behave as before.
 * Returns a function that removes the listener.
 */
export function enableTapToMagnify(container: HTMLElement): () => void {
	const onPointerDown = (e: PointerEvent) => {
		if (e.pointerType === 'mouse') return;
		const target = e.target instanceof Element ? e.target : null;
		const label = target?.closest(LABEL) ?? null;
		const current = container.querySelector(`${LABEL}.${MAGNIFIED_CLASS}`);
		if (current && current !== label) current.classList.remove(MAGNIFIED_CLASS);
		if (label && container.contains(label)) label.classList.toggle(MAGNIFIED_CLASS);
	};
	// Capture phase: sees the tap even if something inside stops propagation.
	container.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
	return () => container.removeEventListener('pointerdown', onPointerDown, { capture: true });
}
