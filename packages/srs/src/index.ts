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

/** `previous` is undefined for a target's first-ever review. `today` drives
 * both `lastReviewedAt` and the new `dueDate` (via `interval`).
 *
 * Grades: 'good' (correct, no wrong attempts) advances normally, 1 day on
 * the first review, 6 on the second, then `round(interval * easeFactor)`
 * - classic SM-2. 'hard' (correct, but only after a wrong attempt) also
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
	const easeFactor = Math.max(MIN_EASE_FACTOR, prevEase - (grade === 'hard' ? 0.15 : 0));

	let interval: number;
	if (repetitions === 1) interval = 1;
	else if (repetitions === 2) interval = 6;
	else interval = Math.round(prevInterval * easeFactor);

	if (grade === 'hard') interval = Math.max(1, Math.round(interval * 0.8));

	return {
		easeFactor,
		interval,
		repetitions,
		dueDate: addDaysLocal(today, interval),
		lastReviewedAt: today
	};
}
