import { describe, expect, it } from 'vitest';
import { areaShares, chooseVisible } from './labelCollision';
import type { Target } from './mapDefinition';

const rect = (left: number, top: number, width = 60, height = 18) => ({
	left,
	top,
	right: left + width,
	bottom: top + height
});

const target = (id: string, bbox: [number, number, number, number]): Target => ({
	id,
	name: id,
	type: 'region',
	tier: 1,
	aliases: [],
	centroid: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
	bbox
});

describe('chooseVisible', () => {
	it('keeps every label that has room', () => {
		const visible = chooseVisible([
			{ priority: 0, rect: rect(0, 0) },
			{ priority: 0, rect: rect(0, 100) },
			{ priority: 0, rect: rect(200, 0) }
		]);
		expect(visible).toEqual([true, true, true]);
	});

	it('drops the lower priority of two labels in the same place', () => {
		const visible = chooseVisible([
			{ priority: 0, rect: rect(10, 10) },
			{ priority: 1, rect: rect(20, 12) }
		]);
		expect(visible).toEqual([false, true]);
	});

	it('keeps the first of two equally important labels, so they never swap', () => {
		const labels = [
			{ priority: 1, rect: rect(10, 10) },
			{ priority: 1, rect: rect(20, 12) }
		];
		expect(chooseVisible(labels)).toEqual([true, false]);
		expect(chooseVisible(labels)).toEqual([true, false]);
	});

	it('counts labels that only just touch as overlapping', () => {
		// Two names a pixel apart read as one word; the gap keeps them apart.
		const visible = chooseVisible([
			{ priority: 1, rect: rect(0, 0) },
			{ priority: 0, rect: rect(61, 0) }
		]);
		expect(visible).toEqual([true, false]);
		expect(
			chooseVisible([
				{ priority: 1, rect: rect(0, 0) },
				{ priority: 0, rect: rect(64, 0) }
			])
		).toEqual([true, true]);
	});

	it('lets a dropped label make room for a smaller one behind it', () => {
		const visible = chooseVisible([
			{ priority: 2, rect: rect(0, 0, 200) },
			{ priority: 1, rect: rect(100, 0) },
			{ priority: 0, rect: rect(210, 0) }
		]);
		expect(visible).toEqual([true, false, true]);
	});

	it('keeps a label that has no size yet', () => {
		const visible = chooseVisible([
			{ priority: 1, rect: rect(0, 0) },
			{ priority: 0, rect: rect(0, 0, 0, 0) }
		]);
		expect(visible).toEqual([true, true]);
	});

	it('handles an empty map', () => {
		expect(chooseVisible([])).toEqual([]);
	});
});

describe('areaShares', () => {
	it('scores the biggest target 1 and the rest below it', () => {
		const shares = areaShares([
			target('big', [0, 0, 10, 10]),
			target('small', [20, 0, 21, 1]),
			target('middling', [30, 0, 35, 5])
		]);
		expect(shares.get('big')).toBe(1);
		expect(shares.get('middling')).toBeCloseTo(0.25, 2);
		expect(shares.get('small')).toBeCloseTo(0.01, 3);
	});

	it('does not let latitude inflate a northern target', () => {
		// The same degrees across, far enough north to cover half the ground.
		const shares = areaShares([target('south', [0, 0, 10, 10]), target('north', [0, 59, 10, 61])]);
		expect(shares.get('south')).toBe(1);
		expect(shares.get('north')!).toBeLessThan(0.11);
	});

	it('measures a target that wraps the antimeridian', () => {
		const wrapping: Target = {
			...target('chukotka', [170, 60, -150, 70]),
			crossesAntimeridian: true
		};
		const shares = areaShares([wrapping, target('plain', [0, 60, 20, 70])]);
		expect(shares.get('chukotka')).toBe(1);
		expect(shares.get('plain')).toBeCloseTo(0.5, 2);
	});

	it('gives point targets, which have no extent, the same score', () => {
		const shares = areaShares([target('a', [9, 45, 9, 45]), target('b', [12, 41, 12, 41])]);
		expect([...shares.values()]).toEqual([0, 0]);
	});
});
