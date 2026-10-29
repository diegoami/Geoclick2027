// Where a dragged name aims (#261), and when a press is a tap (#260).
//
// A finger hides what is under it, and a drop counts where it lands, so on a
// touch screen the drop point - drawn as a small pin - sits a fingertip above
// the finger, with the name just above the pin. Near the top of the screen
// there is no room above, so the pin goes below the finger instead. A mouse
// pointer hides nothing and aims where it points, as it always has.
//
// Pure: QuizView owns the pointer events and the hit-testing.

/** How far above the finger the pin sits, in CSS px: about a fingertip. */
export const TOUCH_LIFT_PX = 48;

/** How far a press may wander and still count as a tap rather than a drag. */
export const TAP_SLOP_PX = 8;

/** The drop point for a pointer at (x, y), in the same viewport coordinates.
 * `topPx` is where the usable screen starts (the top of the map). */
export function aimPoint(
	x: number,
	y: number,
	touch: boolean,
	topPx = 0
): { x: number; y: number } {
	if (!touch) return { x, y };
	const above = y - TOUCH_LIFT_PX;
	return { x, y: above >= topPx ? above : y + TOUCH_LIFT_PX };
}

/** Whether a press that started at (x0, y0) and is now at (x, y) has become a
 * drag. */
export function movedPastSlop(x0: number, y0: number, x: number, y: number): boolean {
	return Math.hypot(x - x0, y - y0) > TAP_SLOP_PX;
}
