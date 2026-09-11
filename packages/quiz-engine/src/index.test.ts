import { describe, expect, it } from 'vitest';
import {
	attemptMatch,
	createQuizSession,
	isSessionComplete,
	MAX_ATTEMPTS_BEFORE_REVEAL,
	scoreSession,
	type QuizTarget
} from './index.js';

const targets: QuizTarget[] = [
	{ id: 'c', name: 'Gamma' },
	{ id: 'a', name: 'Alpha' },
	{ id: 'b', name: 'Beta' }
];

describe('createQuizSession', () => {
	it('creates one pending item per target, no errors yet', () => {
		const session = createQuizSession(targets);
		expect(session.items).toHaveLength(3);
		expect(session.items.every((i) => i.status === 'pending' && i.errors === 0)).toBe(true);
	});

	it('includes every target exactly once, in alphabetical order by name', () => {
		const session = createQuizSession(targets);
		expect(session.items.map((i) => i.target.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
	});

	it('pre-resolves targets in alreadySolvedIds as correct with no errors', () => {
		const session = createQuizSession(targets, new Set(['a', 'c']));
		const byId = (id: string) => session.items.find((i) => i.target.id === id)!;
		expect(byId('a').status).toBe('correct');
		expect(byId('a').errors).toBe(0);
		expect(byId('c').status).toBe('correct');
		expect(byId('b').status).toBe('pending');
	});
});

describe('attemptMatch', () => {
	it('marks the item correct on a matching drop', () => {
		const session = createQuizSession(targets);
		const next = attemptMatch(session, 'a', 'a');
		const item = next.items.find((i) => i.target.id === 'a')!;
		expect(item.status).toBe('correct');
		expect(item.errors).toBe(0);
	});

	it('records an error and leaves the item pending on a wrong drop', () => {
		const session = createQuizSession(targets);
		const next = attemptMatch(session, 'a', 'b');
		const item = next.items.find((i) => i.target.id === 'a')!;
		expect(item.status).toBe('pending');
		expect(item.errors).toBe(1);
	});

	it('records an error when dropped outside any region', () => {
		const session = createQuizSession(targets);
		const next = attemptMatch(session, 'a', undefined);
		const item = next.items.find((i) => i.target.id === 'a')!;
		expect(item.status).toBe('pending');
		expect(item.errors).toBe(1);
	});

	it('can be retried and succeed after a prior wrong attempt', () => {
		let session = createQuizSession(targets);
		session = attemptMatch(session, 'a', 'c');
		session = attemptMatch(session, 'a', 'a');
		const item = session.items.find((i) => i.target.id === 'a')!;
		expect(item.status).toBe('correct');
		expect(item.errors).toBe(1);
	});

	it('does not affect other items', () => {
		const session = createQuizSession(targets);
		const next = attemptMatch(session, 'a', 'b');
		const other = next.items.find((i) => i.target.id === 'b')!;
		expect(other.status).toBe('pending');
		expect(other.errors).toBe(0);
	});

	it('is a no-op once an item is already correct', () => {
		let session = createQuizSession(targets);
		session = attemptMatch(session, 'a', 'a');
		session = attemptMatch(session, 'a', 'b');
		const item = session.items.find((i) => i.target.id === 'a')!;
		expect(item.status).toBe('correct');
		expect(item.errors).toBe(0);
	});

	it('auto-resolves as revealed after MAX_ATTEMPTS_BEFORE_REVEAL wrong drops', () => {
		let session = createQuizSession(targets);
		for (let i = 0; i < MAX_ATTEMPTS_BEFORE_REVEAL; i++) {
			session = attemptMatch(session, 'a', 'b');
		}
		const item = session.items.find((i) => i.target.id === 'a')!;
		expect(item.status).toBe('revealed');
		expect(item.errors).toBe(MAX_ATTEMPTS_BEFORE_REVEAL);
	});

	it('is a no-op once an item is revealed - does not overflow past the threshold', () => {
		let session = createQuizSession(targets);
		for (let i = 0; i < MAX_ATTEMPTS_BEFORE_REVEAL + 2; i++) {
			session = attemptMatch(session, 'a', 'b');
		}
		const item = session.items.find((i) => i.target.id === 'a')!;
		expect(item.status).toBe('revealed');
		expect(item.errors).toBe(MAX_ATTEMPTS_BEFORE_REVEAL);
	});
});

describe('isSessionComplete', () => {
	it('is false until every item is correct or revealed', () => {
		let session = createQuizSession(targets);
		expect(isSessionComplete(session)).toBe(false);
		session = attemptMatch(session, 'a', 'a');
		session = attemptMatch(session, 'b', 'b');
		expect(isSessionComplete(session)).toBe(false);
		session = attemptMatch(session, 'c', 'c');
		expect(isSessionComplete(session)).toBe(true);
	});

	it('counts a revealed item as complete, not just correct ones', () => {
		let session = createQuizSession(targets);
		session = attemptMatch(session, 'a', 'a');
		session = attemptMatch(session, 'b', 'b');
		for (let i = 0; i < MAX_ATTEMPTS_BEFORE_REVEAL; i++) {
			session = attemptMatch(session, 'c', 'a');
		}
		expect(session.items.find((i) => i.target.id === 'c')!.status).toBe('revealed');
		expect(isSessionComplete(session)).toBe(true);
	});
});

describe('scoreSession', () => {
	it('counts perfect (no-error, correct) placements and total errors', () => {
		let session = createQuizSession(targets);
		session = attemptMatch(session, 'a', 'a'); // perfect
		session = attemptMatch(session, 'b', 'c'); // wrong once
		session = attemptMatch(session, 'b', 'b'); // then correct
		session = attemptMatch(session, 'c', 'a'); // wrong, still pending
		const score = scoreSession(session);
		expect(score).toEqual({ total: 3, perfect: 1, totalErrors: 2 });
	});

	it('excludes revealed items from perfect, still counts their errors', () => {
		let session = createQuizSession(targets);
		session = attemptMatch(session, 'a', 'a'); // perfect
		for (let i = 0; i < MAX_ATTEMPTS_BEFORE_REVEAL; i++) {
			session = attemptMatch(session, 'b', 'a'); // wrong x3 -> revealed
		}
		const score = scoreSession(session);
		expect(score).toEqual({ total: 3, perfect: 1, totalErrors: MAX_ATTEMPTS_BEFORE_REVEAL });
	});
});
