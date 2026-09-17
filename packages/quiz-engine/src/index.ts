// Pure matching-quiz logic: given a set of targets, track drag-to-match
// attempts (drag a name slip onto the region it names) and score the
// result. No UI or map dependency - MapView/QuizView in app/ owns the
// drag interaction and map hit-testing, this just tracks outcomes.

export interface QuizTarget {
	id: string;
	name: string;
}

export type QuizItemStatus = 'pending' | 'correct' | 'revealed';

export interface QuizItemState {
	target: QuizTarget;
	status: QuizItemStatus;
	errors: number;
}

export interface QuizSession {
	items: QuizItemState[];
}

/** Wrong drops on one slip before it auto-resolves as 'revealed' (name
 * shown, but not counted as solved). One: a mistake ends that name's turn
 * and the answer is shown at once, so the miss teaches something instead of
 * inviting two more guesses (product owner, 2026-09-18, docs/PLAN_V0.6.md).
 * It was 3 until v0.6.0. */
export const MISSES_BEFORE_REVEAL = 1;

/** `alreadySolvedIds` seeds a session with targets pre-resolved as
 * 'correct' (0 errors) rather than 'pending' - used to carry forward
 * same-day progress (Iteration 5) so reopening a map you were partway
 * through doesn't make you re-solve what you already got right. */
export function createQuizSession(
	targets: QuizTarget[],
	alreadySolvedIds: ReadonlySet<string> = new Set()
): QuizSession {
	const sorted = [...targets].sort((a, b) => a.name.localeCompare(b.name));
	return {
		items: sorted.map((target) => ({
			target,
			status: alreadySolvedIds.has(target.id) ? ('correct' as const) : ('pending' as const),
			errors: 0
		}))
	};
}

/** Records one drag-and-drop attempt: `targetId` is the slip being dragged,
 * `droppedOnId` is the region it was dropped on (undefined/empty if
 * dropped outside any region, or if it missed the correct one). Correct on
 * match; otherwise the error count goes up, and once it reaches
 * MISSES_BEFORE_REVEAL (one, since v0.6.0) the item resolves as 'revealed'
 * instead of staying pending. */
export function attemptMatch(
	session: QuizSession,
	targetId: string,
	droppedOnId: string | undefined
): QuizSession {
	return {
		items: session.items.map((item) => {
			if (item.target.id !== targetId || item.status !== 'pending') return item;
			if (droppedOnId === targetId) return { ...item, status: 'correct' as const };
			const errors = item.errors + 1;
			if (errors >= MISSES_BEFORE_REVEAL) {
				return { ...item, status: 'revealed' as const, errors };
			}
			return { ...item, errors };
		})
	};
}

export function isSessionComplete(session: QuizSession): boolean {
	return session.items.every((item) => item.status !== 'pending');
}

export interface QuizScore {
	total: number;
	/** Placed correctly with no wrong attempts along the way - excludes
	 * 'revealed' items, which always have errors > 0 by construction. */
	perfect: number;
	totalErrors: number;
}

export function scoreSession(session: QuizSession): QuizScore {
	return {
		total: session.items.length,
		perfect: session.items.filter((item) => item.status === 'correct' && item.errors === 0)
			.length,
		totalErrors: session.items.reduce((sum, item) => sum + item.errors, 0)
	};
}
