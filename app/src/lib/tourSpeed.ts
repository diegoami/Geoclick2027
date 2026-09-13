// Tour playback speed (GC-033). Every step dwells 3 s at 1x (build-map.ts's
// DEFAULT_DWELL_MS), which is fine for a 20-region map but makes
// italy-provinces a 5.5-minute tour nobody sits through. Rather than
// regenerating tour.json with shorter dwells, the tour just starts faster on a
// big map. The speed menu still lets the player pick anything.

/** Choices in TourView's speed menu. */
export const TOUR_SPEEDS = [0.5, 1, 1.5, 2, 3] as const;

/** The longest a tour should run at its default speed. */
export const TOUR_TIME_BUDGET_MS = 3 * 60_000;

/** Playback time at `speed`: a step lasts dwellMs / speed. The camera flight
 * runs in parallel with the dwell and is always shorter, so it adds nothing. */
export function tourDurationMs(steps: readonly { dwellMs: number }[], speed: number): number {
	return steps.reduce((sum, s) => sum + s.dwellMs, 0) / speed;
}

/** 1x if the whole tour fits the budget, otherwise the slowest menu speed
 * that fits it (the fastest, if none does). Never slower than 1x. */
export function defaultTourSpeed(steps: readonly { dwellMs: number }[]): number {
	return (
		TOUR_SPEEDS.find((s) => s >= 1 && tourDurationMs(steps, s) <= TOUR_TIME_BUDGET_MS) ??
		TOUR_SPEEDS[TOUR_SPEEDS.length - 1]
	);
}
