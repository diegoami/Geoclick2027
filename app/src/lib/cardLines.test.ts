// FT-42: the small-screen rule is pure, so it is tested without a browser.
import { describe, expect, it } from 'vitest';
import { cardLines, isSmallViewport, nextLine, SMALL_EDGE } from './cardLines';

describe('isSmallViewport', () => {
	it('is small when either edge is small, not only the width', () => {
		// The case that motivated "either dimension": a phone held sideways
		// is wide but short, and short is what costs the map its space.
		expect(isSmallViewport(400, 850)).toBe(true); // phone upright
		expect(isSmallViewport(850, 400)).toBe(true); // phone sideways
	});

	it('leaves tablets and desktops with both lines', () => {
		expect(isSmallViewport(820, 1180)).toBe(false); // tablet upright
		expect(isSmallViewport(1180, 820)).toBe(false); // tablet sideways
		expect(isSmallViewport(1440, 900)).toBe(false); // desktop
	});

	it('treats the threshold itself as small', () => {
		expect(isSmallViewport(SMALL_EDGE, 1200)).toBe(true);
		expect(isSmallViewport(SMALL_EDGE + 1, 1200)).toBe(false);
	});

	it('does not call a viewport it cannot measure small', () => {
		// A window that has not laid out yet reports zeroes, and a headless
		// one can report NaN. Neither is evidence of a phone, and guessing
		// "small" there would shrink the card on a desktop for a frame.
		expect(isSmallViewport(0, 0)).toBe(false);
		expect(isSmallViewport(Number.NaN, 800)).toBe(false);
		expect(isSmallViewport(-100, 800)).toBe(false);
	});
});

describe('cardLines', () => {
	it('puts the name-fact first', () => {
		const lines = cardLines('In the north-west.', 'Named for the Longobards.');
		expect(lines.map((l) => l.kind)).toEqual(['hook', 'derived']);
	});

	it('drops whichever half is missing', () => {
		expect(cardLines('In the north-west.', undefined)).toEqual([
			{ kind: 'derived', text: 'In the north-west.' }
		]);
		expect(cardLines('', 'Named for the Longobards.')).toEqual([
			{ kind: 'hook', text: 'Named for the Longobards.' }
		]);
		expect(cardLines('', undefined)).toEqual([]);
	});
});

describe('nextLine', () => {
	it('wraps', () => {
		expect(nextLine(0, 2)).toBe(1);
		expect(nextLine(1, 2)).toBe(0);
	});

	it('survives a count of zero and an index out of range', () => {
		expect(nextLine(0, 0)).toBe(0);
		expect(nextLine(7, 2)).toBe(0);
		expect(nextLine(Number.NaN, 2)).toBe(1);
	});
});
