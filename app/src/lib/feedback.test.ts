import { describe, expect, it } from 'vitest';
import { shouldVibrate, tone } from './feedback';

describe('answer feedback (#268)', () => {
	it('sounds different for right and wrong', () => {
		expect(tone(true).length).toBe(2);
		expect(tone(true)[1].hz).toBeGreaterThan(tone(true)[0].hz);
		expect(tone(false)).toHaveLength(1);
		expect(tone(false)[0].hz).toBeLessThan(tone(true)[0].hz);
	});

	it('vibrates only in the native app, and never when motion is reduced', () => {
		expect(shouldVibrate(true, false)).toBe(true);
		expect(shouldVibrate(true, true)).toBe(false);
		expect(shouldVibrate(false, false)).toBe(false);
	});
});
