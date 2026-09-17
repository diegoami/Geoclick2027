import { describe, expect, it } from 'vitest';
import { HAND_SIZES, handSize, knownCount, mapLevel, refillHand } from './difficulty';

// A map of `total` names, `known` of them at a clean streak of 3 or more.
const streaks = (known: number, total: number) =>
	Array.from({ length: total }, (_, i) => (i < known ? 3 : 0));

describe('mapLevel', () => {
	it('is 0 for a map never played, and for one barely started', () => {
		expect(mapLevel(streaks(0, 20))).toBe(0);
		expect(mapLevel(streaks(4, 20))).toBe(0); // 20 %
	});

	it('rises at 25, 60 and 85 per cent of the names known', () => {
		expect(mapLevel(streaks(5, 20))).toBe(1); // 25 %
		expect(mapLevel(streaks(11, 20))).toBe(1); // 55 %
		expect(mapLevel(streaks(12, 20))).toBe(2); // 60 %
		expect(mapLevel(streaks(16, 20))).toBe(2); // 80 %
		expect(mapLevel(streaks(17, 20))).toBe(3); // 85 %
		expect(mapLevel(streaks(20, 20))).toBe(3);
	});

	it('counts only names at three clean placements or more', () => {
		expect(knownCount([0, 1, 2, 3, 4])).toBe(2);
		expect(mapLevel([2, 2, 2, 2])).toBe(0);
	});

	it('treats a map with no targets as level 0 rather than dividing by zero', () => {
		expect(mapLevel([])).toBe(0);
	});
});

describe('handSize', () => {
	it('offers every name at level 0 and one at level 3', () => {
		expect(handSize(0)).toBe(Infinity);
		expect(handSize(1)).toBe(6);
		expect(handSize(2)).toBe(3);
		expect(handSize(3)).toBe(1);
		expect(HAND_SIZES).toHaveLength(4);
	});
});

describe('refillHand', () => {
	const pending = ['a', 'b', 'c', 'd', 'e'];
	// Deterministic "random": always picks the first remaining item.
	const first = () => 0;

	it('fills an empty hand up to the size', () => {
		expect(refillHand(pending, [], 3, first)).toHaveLength(3);
	});

	it('keeps the names still on offer and tops up only what was placed', () => {
		const hand = refillHand(pending, [], 3, first);
		const placed = hand[0];
		const left = pending.filter((id) => id !== placed);
		const next = refillHand(left, hand, 3, first);
		expect(next).toHaveLength(3);
		expect(next).not.toContain(placed);
		// The two names the player was still looking at are untouched.
		expect(next.slice(0, 2)).toEqual(hand.slice(1));
	});

	it('never offers a name twice, and only offers pending ones', () => {
		const hand = refillHand(pending, ['a', 'a'], 4, first);
		expect(new Set(hand).size).toBe(hand.length);
		expect(hand.every((id) => pending.includes(id))).toBe(true);
	});

	it('gives every pending name at level 0 (hand size Infinity)', () => {
		expect(refillHand(pending, [], Infinity, first).sort()).toEqual([...pending].sort());
	});

	it('shrinks the hand when the size drops below what is held', () => {
		expect(refillHand(pending, ['a', 'b', 'c'], 1, first)).toEqual(['a']);
	});

	it('runs out gracefully when fewer names are left than the hand holds', () => {
		expect(refillHand(['a'], [], 6, first)).toEqual(['a']);
		expect(refillHand([], ['a'], 6, first)).toEqual([]);
	});

	it('draws at random: over many deals every name comes up', () => {
		const seen = new Set<string>();
		for (let i = 0; i < 200; i++) for (const id of refillHand(pending, [], 1)) seen.add(id);
		expect(seen.size).toBe(pending.length);
	});
});
