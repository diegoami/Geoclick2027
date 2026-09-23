import { describe, expect, it } from 'vitest';
import { hitsLayout, layoutStretched, obstacleRects, type Point } from './stretchedNames';

const sizes = { minSize: 13, maxSize: 28 };
const level = (x0: number, x1: number, y = 100): [Point, Point, Point] => [
	[x0, y],
	[(x0 + x1) / 2, y],
	[x1, y]
];

describe('layoutStretched (FT-66)', () => {
	it('spreads a short name along a long region', () => {
		const layout = layoutStretched(level(0, 400), 5, 3, 6, sizes)!;
		expect(layout.size).toBeGreaterThanOrEqual(13);
		expect(layout.spacing).toBeGreaterThan(0);
		// The letters stay off the ends of the spine.
		const first = layout.along[0];
		const last = layout.along[layout.along.length - 1];
		expect(first[0]).toBeGreaterThan(0);
		expect(last[0]).toBeLessThan(400);
	});

	it('gives up when the name would be smaller than the floor', () => {
		// 60 px of spine for a 10-letter name 6 px wide per px of font.
		expect(layoutStretched(level(0, 60), 3, 6, 10, sizes)).toBeNull();
	});

	it('caps the size, and the spacing before a name falls apart', () => {
		const layout = layoutStretched(level(0, 2000), 1, 3, 4, sizes)!;
		expect(layout.size).toBe(28);
		expect(layout.spacing).toBeLessThanOrEqual(1.2 * 28);
	});

	it('reads left to right whichever way the spine was stored', () => {
		const back: [Point, Point, Point] = [
			[400, 100],
			[200, 100],
			[0, 100]
		];
		expect(layoutStretched(back, 5, 3, 6, sizes)!.d.startsWith('M 0 100')).toBe(true);
	});

	it('reads a near-upright name bottom to top', () => {
		const up: [Point, Point, Point] = [
			[100, 0],
			[101, 200],
			[102, 400]
		];
		expect(layoutStretched(up, 5, 3, 6, sizes)!.d.startsWith('M 102 400')).toBe(true);
	});

	it('is hit on its letters and not beside them', () => {
		const layout = layoutStretched(level(0, 400), 5, 3, 6, sizes)!;
		expect(hitsLayout(layout, 200, 100)).toBe(true);
		expect(hitsLayout(layout, 200, 100 + layout.size * 2)).toBe(false);
		expect(obstacleRects(layout)).toHaveLength(layout.along.length);
	});
});
