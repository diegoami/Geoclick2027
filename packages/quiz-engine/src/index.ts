// Pure matching-quiz logic: given a set of targets, track drag-to-match
// attempts (drag a name slip onto the region it names) and score the
// result. No UI or map dependency - MapView/QuizView in app/ owns the
// drag interaction and map hit-testing, this just tracks outcomes.

export interface QuizTarget {
	id: string;
	name: string;
}

export interface QuizItemState {
	target: QuizTarget;
	status: 'pending' | 'correct';
	errors: number;
}

export interface QuizSession {
	items: QuizItemState[];
}

function shuffled<T>(items: T[]): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function createQuizSession(targets: QuizTarget[]): QuizSession {
	return {
		items: shuffled(targets).map((target) => ({ target, status: 'pending' as const, errors: 0 }))
	};
}

/** Records one drag-and-drop attempt: `targetId` is the slip being dragged,
 * `droppedOnId` is the region it was dropped on (undefined/empty if
 * dropped outside any region). Correct on match; otherwise the item stays
 * pending with an incremented error count, ready to try again. */
export function attemptMatch(
	session: QuizSession,
	targetId: string,
	droppedOnId: string | undefined
): QuizSession {
	return {
		items: session.items.map((item) => {
			if (item.target.id !== targetId || item.status === 'correct') return item;
			if (droppedOnId === targetId) return { ...item, status: 'correct' as const };
			return { ...item, errors: item.errors + 1 };
		})
	};
}

export function isSessionComplete(session: QuizSession): boolean {
	return session.items.every((item) => item.status === 'correct');
}

export interface QuizScore {
	total: number;
	/** Placed correctly with no wrong attempts along the way. */
	perfect: number;
	totalErrors: number;
}

export function scoreSession(session: QuizSession): QuizScore {
	return {
		total: session.items.length,
		perfect: session.items.filter((item) => item.errors === 0).length,
		totalErrors: session.items.reduce((sum, item) => sum + item.errors, 0)
	};
}
