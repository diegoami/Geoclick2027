import { describe, expect, it } from 'vitest';
import {
	DEFAULT_EASE_FACTOR,
	KNOWN_CLEAN_STREAK,
	MIN_EASE_FACTOR,
	daysUntil,
	isDue,
	rate,
	type CardState
} from './index.js';

const TODAY = '2026-09-12';
const TOMORROW = '2026-09-13';
const YESTERDAY = '2026-09-11';

describe('isDue', () => {
	it('treats a target with no card state (never reviewed) as due', () => {
		expect(isDue(undefined, TODAY)).toBe(true);
	});

	it('is due when dueDate is today', () => {
		const card: CardState = {
			easeFactor: DEFAULT_EASE_FACTOR,
			interval: 1,
			repetitions: 1,
			cleanStreak: 0,
			dueDate: TODAY,
			lastReviewedAt: YESTERDAY
		};
		expect(isDue(card, TODAY)).toBe(true);
	});

	it('is due when dueDate is in the past', () => {
		const card: CardState = {
			easeFactor: DEFAULT_EASE_FACTOR,
			interval: 1,
			repetitions: 1,
			cleanStreak: 0,
			dueDate: YESTERDAY,
			lastReviewedAt: YESTERDAY
		};
		expect(isDue(card, TODAY)).toBe(true);
	});

	it('is not due when dueDate is in the future', () => {
		const card: CardState = {
			easeFactor: DEFAULT_EASE_FACTOR,
			interval: 1,
			repetitions: 1,
			cleanStreak: 0,
			dueDate: TOMORROW,
			lastReviewedAt: TODAY
		};
		expect(isDue(card, TODAY)).toBe(false);
	});
});

describe('daysUntil', () => {
	it('is 1 for tomorrow', () => {
		expect(daysUntil(TOMORROW, TODAY)).toBe(1);
	});

	it('is 0 for today', () => {
		expect(daysUntil(TODAY, TODAY)).toBe(0);
	});

	it('counts multi-day gaps correctly', () => {
		expect(daysUntil('2026-09-27', TODAY)).toBe(15);
	});

	it('is negative for a date in the past', () => {
		expect(daysUntil(YESTERDAY, TODAY)).toBe(-1);
	});
});

describe('rate - first review (no previous state)', () => {
	it('"good" schedules 1 day out and sets repetitions to 1', () => {
		const next = rate(undefined, 'good', TODAY);
		expect(next.repetitions).toBe(1);
		expect(next.interval).toBe(1);
		expect(next.dueDate).toBe('2026-09-13');
		expect(next.lastReviewedAt).toBe(TODAY);
		expect(next.easeFactor).toBe(DEFAULT_EASE_FACTOR);
	});

	it('"hard" also advances past the learning phase, but lowers the ease factor', () => {
		const next = rate(undefined, 'hard', TODAY);
		expect(next.repetitions).toBe(1);
		expect(next.easeFactor).toBeLessThan(DEFAULT_EASE_FACTOR);
		// A "hard" pass still counts as a pass - it does not force a
		// same-day repeat like "again" does.
		expect(next.dueDate > TODAY).toBe(true);
	});

	it('"again" (revealed) is due again the same day, not tomorrow', () => {
		const next = rate(undefined, 'again', TODAY);
		expect(next.repetitions).toBe(0);
		expect(next.dueDate).toBe(TODAY);
		expect(isDue(next, TODAY)).toBe(true);
	});

	it('"again" lowers the ease factor below the default', () => {
		const next = rate(undefined, 'again', TODAY);
		expect(next.easeFactor).toBeLessThan(DEFAULT_EASE_FACTOR);
	});
});

describe('rate - repeated reviews', () => {
	it('a run of "good" reviews grows the interval each time', () => {
		let card: CardState | undefined = undefined;
		let today = TODAY;
		const intervals: number[] = [];
		for (let i = 0; i < 4; i++) {
			card = rate(card, 'good', today);
			intervals.push(card.interval);
			today = card.dueDate; // jump forward to when it's actually due
		}
		// 1 day, then 6, then growing via ease factor (round(6 * 2.5) = 15, ...)
		expect(intervals[0]).toBe(1);
		expect(intervals[1]).toBe(6);
		expect(intervals[2]).toBeGreaterThan(intervals[1]);
		expect(intervals[3]).toBeGreaterThan(intervals[2]);
	});

	it('"hard" produces a shorter interval than "good" would at the same point', () => {
		const afterOneGood = rate(undefined, 'good', TODAY);
		const goodAgain = rate(afterOneGood, 'good', afterOneGood.dueDate);
		const hardInstead = rate(afterOneGood, 'hard', afterOneGood.dueDate);
		expect(hardInstead.interval).toBeLessThanOrEqual(goodAgain.interval);
		expect(hardInstead.easeFactor).toBeLessThan(goodAgain.easeFactor);
	});

	it('"again" resets repetitions to 0 even after a long streak of "good"', () => {
		let card: CardState | undefined = undefined;
		let today = TODAY;
		for (let i = 0; i < 3; i++) {
			card = rate(card, 'good', today);
			today = card.dueDate;
		}
		expect(card!.repetitions).toBe(3);
		const failed = rate(card, 'again', today);
		expect(failed.repetitions).toBe(0);
		expect(failed.dueDate).toBe(today);
	});

	it('ease factor never drops below MIN_EASE_FACTOR even after repeated failures', () => {
		let card: CardState | undefined = undefined;
		for (let i = 0; i < 20; i++) {
			card = rate(card, 'again', TODAY);
		}
		expect(card!.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR);
	});
});

describe('rate - clean streak (v0.6.0)', () => {
	const TODAY = '2026-09-18';

	it('counts consecutive clean reviews, and a name is known at three', () => {
		let card = rate(undefined, 'good', TODAY);
		expect(card.cleanStreak).toBe(1);
		card = rate(card, 'good', TODAY);
		expect(card.cleanStreak).toBe(2);
		card = rate(card, 'good', TODAY);
		expect(card.cleanStreak).toBe(KNOWN_CLEAN_STREAK);
	});

	it('starts over after a mistake, even though "hard" still passes', () => {
		let card = rate(rate(undefined, 'good', TODAY), 'good', TODAY);
		expect(card.cleanStreak).toBe(2);
		card = rate(card, 'hard', TODAY);
		expect(card.cleanStreak).toBe(0);
		// The pass itself still counts as a repetition, so only the streak resets.
		expect(card.repetitions).toBe(3);
		expect(rate(card, 'good', TODAY).cleanStreak).toBe(1);
	});

	it('starts over after a fail', () => {
		const known = rate(rate(rate(undefined, 'good', TODAY), 'good', TODAY), 'good', TODAY);
		expect(rate(known, 'again', TODAY).cleanStreak).toBe(0);
	});

	it('treats a card saved before v0.6.0 (no streak) as zero', () => {
		// Deliberately without cleanStreak: this is the shape v0.5.0 stored.
		const legacy = {
			easeFactor: 2.5,
			interval: 6,
			repetitions: 2,
			dueDate: '2026-09-24',
			lastReviewedAt: TODAY
		} as CardState;
		expect(rate(legacy, 'good', TODAY).cleanStreak).toBe(1);
	});
});
