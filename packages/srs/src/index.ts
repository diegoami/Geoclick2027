// Pure SM-2-derived scheduler: given a target's current card state (or
// none, if it's never been reviewed) and how a review went, produces the
// next card state - in particular, the date it's next due. No DOM,
// storage, or quiz-UI dependency - app/src/lib/progressRepository.ts owns
// persisting these, packages/quiz-engine owns turning "due" into a
// session; this just does the scheduling math.
//
// Dates are local-calendar-day strings (YYYY-MM-DD), not timestamps -
// matches the granularity actually needed ("due today" vs "due in N
// days") and avoids timezone edge cases entirely. Callers compute "today"
// themselves (see progressRepository.ts's todayLocalDate) and pass it in,
// so this stays pure/testable rather than reaching for `new Date()`
// internally.

export type Grade = 'again' | 'hard' | 'good';

export interface CardState {
	easeFactor: number;
	interval: number; // days
	repetitions: number;
	dueDate: string; // local calendar date, YYYY-MM-DD
	lastReviewedAt: string; // local calendar date, YYYY-MM-DD
}

export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
// A clean review raises ease back toward this, never past it - so a card that
// was once fumbled can recover, but a long clean streak cannot compound ease
// without bound. Equal to the default: new cards start at the ceiling.
export const MAX_EASE_FACTOR = 2.5;
// Uncapped, `interval * easeFactor` reached 1488 days by the 8th clean review
// and overflowed Date into a "NaN-NaN-NaN" dueDate by the 20th, retiring the
// card forever. A year means even a fully mastered region comes back once a
// year - see DECISIONS.md.
export const MAX_INTERVAL_DAYS = 365;

function addDaysLocal(date: string, days: number): string {
	const [y, m, d] = date.split('-').map(Number);
	const next = new Date(y, m - 1, d);
	next.setDate(next.getDate() + days);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

/** A target with no prior card state is treated as due - "never reviewed"
 * is one of the two buckets a session splits into, same as "due again". */
export function isDue(card: CardState | undefined, today: string): boolean {
	if (!card) return true;
	return card.dueDate <= today;
}

/** Whole days between two local-calendar-date strings (`dueDate - today`).
 * Positive when `dueDate` is in the future. Used for "come back in N days"
 * messaging once a due session finds nothing left to review - never
 * called on a due date, only a future one, so this doesn't need to handle
 * negative results meaningfully. */
export function daysUntil(dueDate: string, today: string): number {
	const [ty, tm, td] = today.split('-').map(Number);
	const [dy, dm, dd] = dueDate.split('-').map(Number);
	const todayMs = new Date(ty, tm - 1, td).getTime();
	const dueMs = new Date(dy, dm - 1, dd).getTime();
	// Round, not floor/truncate - avoids an off-by-one on the rare day a
	// DST transition makes the raw millisecond difference not an exact
	// multiple of 24h.
	return Math.round((dueMs - todayMs) / 86_400_000);
}

/** `previous` is undefined for a target's first-ever review. `today` drives
 * both `lastReviewedAt` and the new `dueDate` (via `interval`).
 *
 * Grades: 'good' (correct, no wrong attempts) advances normally, 1 day on
 * the first review, 6 on the second, then `round(interval * easeFactor)`,
 * and raises the ease factor by 0.1 up to MAX_EASE_FACTOR. That much is
 * SM-2; the rest is this project's own variant, not classic SM-2: three
 * grades instead of six, an ease ceiling, every interval capped at
 * MAX_INTERVAL_DAYS, and 'again' due the same day (below). 'hard'
 * (correct, but only after a wrong attempt) also
 * advances - eventually getting it right still counts as a pass - but
 * with a lower ease factor and a dampened interval, so it resurfaces
 * sooner than a clean win rather than literally the same day. 'again'
 * (revealed - never got it) is the one grade that forces a same-day
 * repeat: repetitions resets to 0, ease factor drops, and `dueDate` is
 * set to `today` itself so it's still due if the map is reopened later
 * today - not pushed to tomorrow by whatever the interval schedule would
 * otherwise say. See ROADMAP.md's Iteration 6 "Consistency review" for
 * why this distinction matters (it's the one place a naive port of SM-2
 * would silently regress already-shipped same-day behavior). */
export function rate(previous: CardState | undefined, grade: Grade, today: string): CardState {
	const prevEase = previous?.easeFactor ?? DEFAULT_EASE_FACTOR;

	if (grade === 'again') {
		return {
			easeFactor: Math.max(MIN_EASE_FACTOR, prevEase - 0.2),
			interval: 0,
			repetitions: 0,
			dueDate: today,
			lastReviewedAt: today
		};
	}

	const prevRepetitions = previous?.repetitions ?? 0;
	const prevInterval = previous?.interval ?? 0;
	const repetitions = prevRepetitions + 1;
	const easeFactor =
		grade === 'hard'
			? Math.max(MIN_EASE_FACTOR, prevEase - 0.15)
			: Math.min(MAX_EASE_FACTOR, prevEase + 0.1);

	let interval: number;
	if (repetitions === 1) interval = 1;
	else if (repetitions === 2) interval = 6;
	else interval = Math.round(prevInterval * easeFactor);

	if (grade === 'hard') interval = Math.max(1, Math.round(interval * 0.8));
	interval = Math.min(MAX_INTERVAL_DAYS, interval);

	return {
		easeFactor,
		interval,
		repetitions,
		dueDate: addDaysLocal(today, interval),
		lastReviewedAt: today
	};
}
