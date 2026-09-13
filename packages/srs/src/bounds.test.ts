import { describe, expect, it } from 'vitest';
import {
	DEFAULT_EASE_FACTOR,
	MAX_EASE_FACTOR,
	MAX_INTERVAL_DAYS,
	daysUntil,
	isDue,
	rate,
	type CardState,
	type Grade
} from './index.js';

const TODAY = '2026-09-12';

// A real calendar date that survives a round trip through Date - not just
// something shaped like one ("NaN-NaN-NaN" and "163913-04-19" both fail).
function isRealLocalDate(s: string): boolean {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (!m) return false;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const date = new Date(y, mo - 1, d);
	return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Review a card with `grades` in order, each time on the day it falls due. */
function review(grades: Grade[], start?: CardState): { card: CardState; history: CardState[] } {
	let card = start;
	let today = start?.dueDate ?? TODAY;
	const history: CardState[] = [];
	for (const grade of grades) {
		card = rate(card, grade, today);
		history.push(card);
		today = card.dueDate;
	}
	return { card: card!, history };
}

describe('interval cap (GC-010)', () => {
	it('30 consecutive "good" reviews still produce a real, parseable due date', () => {
		const { card, history } = review(Array(30).fill('good'));
		expect(isRealLocalDate(card.dueDate)).toBe(true);
		for (const c of history) expect(isRealLocalDate(c.dueDate)).toBe(true);
		// ...and the card is still in the review pool: it comes due on that date.
		expect(isDue(card, card.dueDate)).toBe(true);
	});

	it('never schedules further out than MAX_INTERVAL_DAYS', () => {
		const { history } = review(Array(30).fill('good'));
		for (const c of history) {
			expect(c.interval).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
			expect(daysUntil(c.dueDate, c.lastReviewedAt)).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
		}
		// Long enough to actually hit the cap, not just stay under it.
		expect(history.at(-1)!.interval).toBe(MAX_INTERVAL_DAYS);
	});

	it('caps an interval that is already far past the limit (e.g. stored before the cap)', () => {
		const stale: CardState = {
			easeFactor: DEFAULT_EASE_FACTOR,
			interval: 88_692_188,
			repetitions: 20,
			dueDate: TODAY,
			lastReviewedAt: '2026-01-01'
		};
		for (const grade of ['good', 'hard'] as const) {
			const next = rate(stale, grade, TODAY);
			expect(next.interval).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
			expect(isRealLocalDate(next.dueDate)).toBe(true);
		}
	});
});

describe('ease factor recovery and ceiling (GC-010)', () => {
	it('recovers after a "hard" review once followed by clean ones', () => {
		const { history } = review(['good', 'good', 'hard', 'good', 'good', 'good']);
		const afterHard = history[2].easeFactor;
		expect(afterHard).toBeLessThan(DEFAULT_EASE_FACTOR);
		expect(history[3].easeFactor).toBeGreaterThan(afterHard);
		expect(history.at(-1)!.easeFactor).toBe(MAX_EASE_FACTOR);
	});

	it('recovers from the floor after repeated failures', () => {
		const { card: floored } = review(Array(10).fill('again'));
		const { history } = review(Array(15).fill('good'), floored);
		for (let i = 1; i < history.length; i++) {
			expect(history[i].easeFactor).toBeGreaterThanOrEqual(history[i - 1].easeFactor);
		}
		expect(history.at(-1)!.easeFactor).toBe(MAX_EASE_FACTOR);
	});

	it('never exceeds MAX_EASE_FACTOR, whatever the sequence', () => {
		const sequences: Grade[][] = [
			Array(40).fill('good'),
			['hard', ...Array(30).fill('good')],
			Array(12).fill(['hard', 'good']).flat(),
			['again', 'good', 'good', 'again', ...Array(20).fill('good')]
		];
		for (const grades of sequences) {
			for (const c of review(grades).history) {
				expect(c.easeFactor).toBeLessThanOrEqual(MAX_EASE_FACTOR);
			}
		}
	});

	it('alternating hard/good still drifts down, but a third as fast as before', () => {
		// A card fumbled every other time SHOULD lose ease - that is what ease
		// is for - just not at the full -0.15 per fumble with no way back.
		// Measured before GC-010: 12 grades of hard/good ended at 1.60. Now each
		// pair nets -0.15 + 0.1 = -0.05, so 6 pairs land at 2.5 - 0.3 = 2.2.
		const { card } = review(Array(6).fill(['hard', 'good']).flat());
		expect(card.easeFactor).toBeGreaterThan(1.6);
		expect(card.easeFactor).toBeCloseTo(2.2, 10);
	});
});
