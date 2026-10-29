import { describe, expect, it } from 'vitest';
import { TAP_SLOP_PX, TOUCH_LIFT_PX, aimPoint, movedPastSlop } from './touchDrag';

describe('aimPoint (#261)', () => {
	it('aims where a mouse points', () => {
		expect(aimPoint(100, 300, false)).toEqual({ x: 100, y: 300 });
	});

	it('aims a fingertip above a finger', () => {
		expect(aimPoint(100, 300, true)).toEqual({ x: 100, y: 300 - TOUCH_LIFT_PX });
	});

	it('aims below the finger when there is no room above', () => {
		expect(aimPoint(100, 60, true, 40)).toEqual({ x: 100, y: 60 + TOUCH_LIFT_PX });
		expect(aimPoint(100, 40 + TOUCH_LIFT_PX, true, 40)).toEqual({ x: 100, y: 40 });
	});
});

describe('movedPastSlop (#260)', () => {
	it('keeps a small wobble a tap and a longer move a drag', () => {
		expect(movedPastSlop(0, 0, TAP_SLOP_PX, 0)).toBe(false);
		expect(movedPastSlop(0, 0, TAP_SLOP_PX, 1)).toBe(true);
	});
});
