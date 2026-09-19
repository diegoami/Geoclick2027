// The one rule behind the Known map (FT-39, docs/PLAN_V0.9.md): what is
// drawn, and what a tap records. Two inputs - what the player earned and
// what they chose - and the whole point is that it stays small enough to
// hold in your head.
import { describe, expect, it } from 'vitest';
import { earnedTier, isVisible, tapOverride, visibleTier } from './shownNames';
import { KNOWN_CLEAN_STREAK } from './difficulty';

describe('earnedTier', () => {
	it('is the three strengths FT-22 established', () => {
		expect(earnedTier(0)).toBeUndefined();
		expect(earnedTier(1)).toBe('seen');
		expect(earnedTier(2)).toBe('nearly');
		expect(earnedTier(KNOWN_CLEAN_STREAK)).toBe('known');
		expect(earnedTier(KNOWN_CLEAN_STREAK + 4)).toBe('known');
	});
});

describe('visibleTier', () => {
	it('draws what was earned when the player has said nothing', () => {
		expect(visibleTier(0, undefined)).toBeUndefined();
		expect(visibleTier(1, undefined)).toBe('seen');
		expect(visibleTier(3, undefined)).toBe('known');
	});

	it('draws a name the player asked for even if they have never placed it', () => {
		// 'asked' rather than 'seen': they asked for it, so it is drawn at
		// full strength, and the three earned strengths keep meaning what
		// they meant.
		expect(visibleTier(0, 'shown')).toBe('asked');
	});

	it('keeps the strength a name was earned at when it is also asked for', () => {
		// The map still reads as a record of progress underneath whatever
		// has been pinned on top of it.
		expect(visibleTier(1, 'shown')).toBe('seen');
		expect(visibleTier(3, 'shown')).toBe('known');
	});

	it('hides a name the player put away, however well they know it', () => {
		expect(visibleTier(0, 'hidden')).toBeUndefined();
		expect(visibleTier(3, 'hidden')).toBeUndefined();
	});
});

describe('tapOverride', () => {
	// Decision 3: one rule for everything on the map, whatever put the name
	// there. A tap always does the visible thing.
	it('hides a name that can be seen', () => {
		expect(tapOverride(3, undefined)).toBe('hidden');
		expect(tapOverride(1, undefined)).toBe('hidden');
		expect(tapOverride(0, 'shown')).toBe('hidden');
	});

	it('shows a name that cannot', () => {
		expect(tapOverride(0, undefined)).toBe('shown');
		expect(tapOverride(3, 'hidden')).toBe('shown');
	});

	it('always flips what is on the screen, so two taps return to the start', () => {
		for (const streak of [0, 1, 2, 3, 7]) {
			for (const start of [undefined, 'shown', 'hidden'] as const) {
				const once = tapOverride(streak, start);
				const twice = tapOverride(streak, once);
				expect(isVisible(streak, once)).toBe(!isVisible(streak, start));
				expect(isVisible(streak, twice)).toBe(isVisible(streak, start));
			}
		}
	});

	it('lets a name earned later appear on its own', () => {
		// Someone taps a blank region, then learns it in the quiz. The
		// override says 'shown' and the streak agrees - nothing to undo.
		expect(visibleTier(0, 'shown')).toBe('asked');
		expect(visibleTier(3, 'shown')).toBe('known');
	});
});
