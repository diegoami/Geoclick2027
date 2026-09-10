import { describe, expect, it } from 'vitest';
import {
	attemptMatch,
	createQuizSession,
	isSessionComplete,
	scoreSession,
	type QuizTarget
} from './index.js';

const targets: QuizTarget[] = [
	{ id: 'a', name: 'Alpha' },
	{ id: 'b', name: 'Beta' },
	{ id: 'c', name: 'Gamma' }
];

describe('createQuizSession', () => {
	it('creates one pending item per target, no errors yet', () => {
		const session = createQuizSession(targets);
		expect(session.items).toHaveLength(3);
		expect(session.items.every((i) => i.status === 'pending' && i.errors === 0)).toBe(true);
	});

	it('includes every target exactly once, in some order', () => {
		const session = createQuizSession(targets);
		const ids = session.items.map((i) => i.target.id).sort();
		expect(ids).toEqual(['a', 'b', 'c']);
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
});

describe('isSessionComplete', () => {
	it('is false until every item is correct', () => {
		let session = createQuizSession(targets);
		expect(isSessionComplete(session)).toBe(false);
		session = attemptMatch(session, 'a', 'a');
		session = attemptMatch(session, 'b', 'b');
		expect(isSessionComplete(session)).toBe(false);
		session = attemptMatch(session, 'c', 'c');
		expect(isSessionComplete(session)).toBe(true);
	});
});

describe('scoreSession', () => {
	it('counts perfect (no-error) placements and total errors', () => {
		let session = createQuizSession(targets);
		session = attemptMatch(session, 'a', 'a'); // perfect
		session = attemptMatch(session, 'b', 'c'); // wrong once
		session = attemptMatch(session, 'b', 'b'); // then correct
		session = attemptMatch(session, 'c', 'a'); // wrong, still pending
		const score = scoreSession(session);
		expect(score).toEqual({ total: 3, perfect: 1, totalErrors: 2 });
	});
});
