// Tour playback speed (GC-033). Every step dwells 3 s at 1x (build-map.ts's
// DEFAULT_DWELL_MS), which is fine for a 20-region map but makes
// italy-provinces a 5.5-minute tour nobody sits through. Rather than
// regenerating tour.json with shorter dwells, the tour just starts faster on a
// big map. The speed menu still lets the player pick anything.

/** Choices in TourView's speed menu. */
export const TOUR_SPEEDS = [0.5, 0.75, 1, 1.5, 2, 3] as const;

/** The longest a tour should run at its default speed. */
export const TOUR_TIME_BUDGET_MS = 3 * 60_000;

/**
 * The slowest speed a tour will start at on its own.
 *
 * 0.75x since v0.9.1 (product owner, 2026-09-19: "the tour a tad slower").
 * A step dwelt 3 s at 1x, which is long enough to see a region light up but
 * not to read its name, find it on the map and take it in. This stretches
 * that to 4 s without regenerating 63 tour.json files, and the camera
 * flight - which divides by the same speed - eases over 1.6 s instead of
 * 1.2 s, so the whole thing reads calmer rather than merely later.
 *
 * A big map still speeds up to fit the budget; this only sets the floor.
 */
export const TOUR_DEFAULT_FLOOR = 0.75;

/** Playback time at `speed`: a step lasts dwellMs / speed. The camera flight
 * runs in parallel with the dwell and is always shorter, so it adds nothing. */
export function tourDurationMs(steps: readonly { dwellMs: number }[], speed: number): number {
	return steps.reduce((sum, s) => sum + s.dwellMs, 0) / speed;
}

/** The slowest menu speed at or above the floor that fits the budget - so a
 * small map plays at 0.75x and a big one speeds up as far as it must (the
 * fastest, if none fits). Never slower than the floor. */
export function defaultTourSpeed(steps: readonly { dwellMs: number }[]): number {
	return (
		TOUR_SPEEDS.find(
			(s) => s >= TOUR_DEFAULT_FLOOR && tourDurationMs(steps, s) <= TOUR_TIME_BUDGET_MS
		) ?? TOUR_SPEEDS[TOUR_SPEEDS.length - 1]
	);
}
