import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPS_DIR, listMapIds } from '../../../data/scripts/build-map-index';
import { TOUR_TIME_BUDGET_MS, defaultTourSpeed, tourDurationMs } from './tourSpeed';

const steps = (n: number, dwellMs = 3000) => Array.from({ length: n }, () => ({ dwellMs }));
const loadSteps = (id: string): { dwellMs: number }[] =>
	JSON.parse(readFileSync(path.join(DEFAULT_MAPS_DIR, id, 'tour.json'), 'utf8')).steps;

describe('defaultTourSpeed', () => {
	it('leaves a tour that fits the budget at 1x', () => {
		expect(defaultTourSpeed(steps(20))).toBe(1);
		expect(defaultTourSpeed(steps(60))).toBe(1); // exactly 3:00
		expect(defaultTourSpeed([])).toBe(1);
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
		expect(defaultTourSpeed(steps(110, 1000))).toBe(1);
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

	it('only the four longest tours change speed; every other map stays at 1x', () => {
		const changed = listMapIds()
			.filter((id) => defaultTourSpeed(loadSteps(id)) !== 1)
			.map((id) => `${id}@${defaultTourSpeed(loadSteps(id))}x`)
			.sort();
		// usa-cities-east joined them at FT-28: 82 cities is 4:06 at 1x.
		expect(changed).toEqual([
			'italy-provinces@2x',
			'japan-towns-100k@1.5x',
			'russia-regions@1.5x',
			'usa-cities-east@1.5x'
		]);
	});
});
