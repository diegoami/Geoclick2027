import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPS_DIR, listMapIds } from '../../../data/scripts/build-map-index';
import {
	TOUR_DEFAULT_FLOOR,
	TOUR_TIME_BUDGET_MS,
	defaultTourSpeed,
	tourDurationMs
} from './tourSpeed';

const steps = (n: number, dwellMs = 3000) => Array.from({ length: n }, () => ({ dwellMs }));
const loadSteps = (id: string): { dwellMs: number }[] =>
	JSON.parse(readFileSync(path.join(DEFAULT_MAPS_DIR, id, 'tour.json'), 'utf8')).steps;

describe('defaultTourSpeed', () => {
	it('starts a tour that fits the budget at the floor, 0.75x', () => {
		// The floor moved from 1x to 0.75x in v0.9.1, so a 20-region tour now
		// runs 80 s rather than 60 s - long enough to take a region in, not
		// just to watch it light up.
		expect(defaultTourSpeed(steps(20))).toBe(TOUR_DEFAULT_FLOOR);
		expect(defaultTourSpeed([])).toBe(TOUR_DEFAULT_FLOOR);
	});

	it('gives up the floor before it gives up the budget', () => {
		// 60 steps is 3:00 at 1x, which is 4:00 at the floor - over budget, so
		// this one starts at 1x. The budget outranks the floor.
		expect(defaultTourSpeed(steps(60))).toBe(1);
		// The boundary: 45 steps is exactly 3:00 at the floor, so it still
		// fits; 46 does not, and gives the floor up rather than the budget.
		expect(defaultTourSpeed(steps(45))).toBe(TOUR_DEFAULT_FLOOR);
		expect(defaultTourSpeed(steps(46))).toBe(1);
	});

	it('picks the slowest speed that brings a long tour under the budget', () => {
		expect(defaultTourSpeed(steps(61))).toBe(1.5);
		expect(defaultTourSpeed(steps(110))).toBe(2);
		expect(defaultTourSpeed(steps(121))).toBe(3);
	});

	it('falls back to the fastest speed when nothing fits', () => {
		expect(defaultTourSpeed(steps(500))).toBe(3);
	});

	it('uses the real dwell times, not a step count', () => {
		// 110 steps but only 1 s each: 1:50 at 1x, 2:27 at the floor, so it
		// gets the floor like any short tour.
		expect(defaultTourSpeed(steps(110, 1000))).toBe(TOUR_DEFAULT_FLOOR);
	});
});

describe('committed tours at their default speed', () => {
	it.each(listMapIds())('%s finishes within the budget (or at 3x)', (id) => {
		const s = loadSteps(id);
		const speed = defaultTourSpeed(s);
		expect(speed === 3 || tourDurationMs(s, speed) <= TOUR_TIME_BUDGET_MS).toBe(true);
	});

	it('the 110-target italy-provinces tour takes 2:45 instead of 5:30', () => {
		const s = loadSteps('italy-provinces');
		expect(s).toHaveLength(110);
		expect(tourDurationMs(s, 1)).toBe(330_000);
		expect(defaultTourSpeed(s)).toBe(2);
		expect(tourDurationMs(s, defaultTourSpeed(s))).toBe(165_000);
	});

	it('no committed tour is left over the budget by the slower floor', () => {
		// The floor makes every tour 33% longer, so this is the check that
		// matters after the change: nothing may exceed 3:00 at its default.
		const over = listMapIds()
			.map((id) => ({ id, s: loadSteps(id) }))
			.map(({ id, s }) => ({
				id,
				speed: defaultTourSpeed(s),
				ms: tourDurationMs(s, defaultTourSpeed(s))
			}))
			.filter(({ speed, ms }) => speed !== 3 && ms > TOUR_TIME_BUDGET_MS);
		expect(over).toEqual([]);
	});
});
