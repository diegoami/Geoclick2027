import { describe, expect, it } from 'vitest';
import {
	LIST_LIMIT,
	capped,
	formatDuration,
	isNewBest,
	isTimedRound,
	roundChange
} from './roundReport';

const ids = ['a', 'b', 'c', 'd'];

describe('roundChange (#259)', () => {
	it('lists names that became known and names that slipped a level', () => {
		const before = new Map([
			['a', 2],
			['b', 3],
			['c', 1]
		]);
		const after = new Map([
			['a', 3],
			['b', 2],
			['c', 1],
			['d', 1]
		]);
		expect(roundChange(ids, before, after)).toEqual({ newlyKnown: ['a'], slipped: ['b'] });
	});

	it('reports nothing on a first round where nothing reached known', () => {
		expect(roundChange(ids, new Map(), new Map([['a', 1]]))).toEqual({
			newlyKnown: [],
			slipped: []
		});
	});

	it('does not count an old streak above three going to three as a slip', () => {
		expect(roundChange(['a'], new Map([['a', 7]]), new Map([['a', 3]]))).toEqual({
			newlyKnown: [],
			slipped: []
		});
	});
});

describe('capped', () => {
	it('shows the first few and counts the rest', () => {
		const many = Array.from({ length: LIST_LIMIT + 3 }, (_, i) => i);
		expect(capped(many)).toEqual({ shown: many.slice(0, LIST_LIMIT), more: 3 });
		expect(capped([1, 2])).toEqual({ shown: [1, 2], more: 0 });
	});
});

describe('best time (#267)', () => {
	it('times a round only when every name was known at the start', () => {
		const known = new Map(ids.map((id) => [id, 3]));
		expect(isTimedRound(ids, known)).toBe(true);
		expect(isTimedRound(ids, new Map([...known, ['d', 2]]))).toBe(false);
		expect(isTimedRound([], known)).toBe(false);
	});

	it('sets a best only for a faster round with no mistakes', () => {
		expect(isNewBest(60_000, 0, undefined)).toBe(true);
		expect(isNewBest(60_000, 0, 70_000)).toBe(true);
		expect(isNewBest(80_000, 0, 70_000)).toBe(false);
		expect(isNewBest(10_000, 1, 70_000)).toBe(false);
	});

	it('formats minutes and seconds', () => {
		expect(formatDuration(0)).toBe('0:00');
		expect(formatDuration(102_900)).toBe('1:42');
		expect(formatDuration(725_000)).toBe('12:05');
	});
});
