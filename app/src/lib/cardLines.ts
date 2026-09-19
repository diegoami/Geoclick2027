// How many lines the fact card shows, and in what order (FT-42,
// docs/PLAN_V0.9.md).
//
// The card carries two lines: the derived one (where the place is, its
// coast, its biggest city) and the name-fact (where its NAME comes from).
// On a phone those two lines are a real share of the screen, and the map is
// the thing being learned - so on a small screen the card shows ONE line at
// a time and rotates between them.
//
// This module is the whole rule, kept pure so it can be tested without a
// browser. The component does the timing and the drawing; it decides
// nothing.

/**
 * A viewport edge at or below this many CSS pixels counts as small.
 *
 * The product owner's call (2026-09-19) was "either dimension": a phone held
 * sideways is wide but short, and short is the case that hurts, because the
 * card eats height. Checking only width would miss it.
 */
export const SMALL_EDGE = 700;

/** Does this viewport get one line at a time? */
export function isSmallViewport(width: number, height: number): boolean {
	// Guard against the zeroes a headless or not-yet-laid-out window reports:
	// a 0x0 viewport is not evidence of a phone, so do not shrink the card.
	if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
	if (width <= 0 || height <= 0) return false;
	return width <= SMALL_EDGE || height <= SMALL_EDGE;
}

/** The media query that says the same thing, for matchMedia. */
export const SMALL_VIEWPORT_QUERY = `(max-width: ${SMALL_EDGE}px), (max-height: ${SMALL_EDGE}px)`;

/** How long each line holds before the card moves to the next one. */
export const ROTATE_MS = 5000;

export type CardLine = { kind: 'hook' | 'derived'; text: string };

/**
 * The lines this card has, in the order a small screen shows them.
 *
 * The name-fact leads (the product owner's call, 2026-09-19): it is the
 * half he called the differentiator, and if a player only ever reads one
 * line it should be the one that makes the name stick. On a large screen
 * the card shows both at once and the derived line is physically on top,
 * which is FT-35's layout and unchanged - this order is only about which
 * comes FIRST when they are shown one at a time.
 */
export function cardLines(derived: string, hook: string | undefined): CardLine[] {
	const lines: CardLine[] = [];
	if (hook) lines.push({ kind: 'hook', text: hook });
	if (derived) lines.push({ kind: 'derived', text: derived });
	return lines;
}

/**
 * Which line to show after `index`, wrapping. Tolerates a count of 0 or an
 * index that has drifted out of range rather than returning NaN or -1.
 */
export function nextLine(index: number, count: number): number {
	if (count <= 0) return 0;
	const current = Number.isFinite(index) ? Math.trunc(index) : 0;
	return (((current + 1) % count) + count) % count;
}
