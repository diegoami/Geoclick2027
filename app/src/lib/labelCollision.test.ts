import { describe, expect, it } from 'vitest';
import { areaShares, chooseVisible, choosePlacements } from './labelCollision';
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

	it('measures a target that wraps the antimeridian, flag or no flag', () => {
		// The bbox is authoritative (FT-52). A wrapping bbox with no
		// `crossesAntimeridian` flag must measure the same as one with it -
		// otherwise Chukotka, which shipped without the flag, gets a negative
		// area and loses every collision first.
		const wrapBbox: [number, number, number, number] = [170, 60, -150, 70];
		const flagged: Target = { ...target('flagged', wrapBbox), crossesAntimeridian: true };
		const unflagged: Target = target('unflagged', wrapBbox);
		const shares = areaShares([flagged, unflagged, target('plain', [0, 60, 20, 70])]);
		expect(shares.get('flagged')).toBe(1);
		expect(shares.get('unflagged')).toBe(1);
		expect(shares.get('plain')).toBeCloseTo(0.5, 2);
	});

	it('gives point targets, which have no extent, the same score', () => {
		const shares = areaShares([target('a', [9, 45, 9, 45]), target('b', [12, 41, 12, 41])]);
		expect([...shares.values()]).toEqual([0, 0]);
	});
});

describe('choosePlacements', () => {
	const at = (x: number, y: number, width = 60, height = 18) => ({
		offset: [x, y] as [number, number],
		rect: { left: x, top: y, right: x + width, bottom: y + height }
	});

	it('gives each label its first free spot', () => {
		const placements = choosePlacements([
			{ priority: 1, candidates: [at(0, 0), at(100, 0)] },
			{ priority: 0, candidates: [at(10, 4), at(200, 0)] }
		]);
		expect(placements[0]).toEqual({ visible: true, offset: [0, 0], index: 0 });
		// Its first spot was taken, so it took the next one instead of going.
		expect(placements[1]).toEqual({ visible: true, offset: [200, 0], index: 1 });
	});

	it('drops a label only once every spot it has is taken', () => {
		const placements = choosePlacements([
			{ priority: 2, candidates: [at(0, 0)] },
			{ priority: 1, candidates: [at(100, 0)] },
			{ priority: 0, candidates: [at(5, 2), at(105, 2)] }
		]);
		expect(placements[2].visible).toBe(false);
		// Kept its first choice, so it lands sensibly when the map makes room.
		expect(placements[2].offset).toEqual([5, 2]);
	});

	it('leaves the spot a dropped label wanted free for someone else', () => {
		const placements = choosePlacements([
			{ priority: 2, candidates: [at(0, 0, 200)] },
			{ priority: 1, candidates: [at(100, 0)] },
			{ priority: 0, candidates: [at(210, 0)] }
		]);
		expect(placements.map((p) => p.visible)).toEqual([true, false, true]);
	});

	it('keeps a label that has no size yet, wherever it wanted to be', () => {
		const placements = choosePlacements([
			{ priority: 1, candidates: [at(0, 0)] },
			{ priority: 0, candidates: [at(0, 0, 0, 0)] }
		]);
		expect(placements.map((p) => p.visible)).toEqual([true, true]);
	});
});

describe('choosePlacements, best fit (FT-63)', () => {
	// A town at (100, 100), its name 60 x 18 and 14 px off the dot: the
	// spots candidatesFor gives it on the right and on the left.
	const spot = (dx: number, dy = 0, x = 100, y = 100) => ({
		offset: [dx, dy] as [number, number],
		rect: { left: x + dx - 30, right: x + dx + 30, top: y + dy - 9, bottom: y + dy + 9 }
	});
	const right = spot(44);
	const left = spot(-44);
	// A name already placed, `distance` px to the right of the right-hand spot.
	const neighbour = (distance: number) => ({
		priority: 9,
		candidates: [{ offset: [0, 0] as [number, number], rect: rect(174 + distance, 91) }]
	});
	const town = { x: 100, y: 100 };

	it('takes the spot with more room, not the first one free', () => {
		const placements = choosePlacements([neighbour(4), { priority: 1, candidates: [right, left] }]);
		// The right-hand spot was free, but 4 px from the next name.
		expect(placements[1]).toMatchObject({ visible: true, index: 1 });
	});

	it("keeps a name off another town's dot", () => {
		const placements = choosePlacements([{ priority: 1, candidates: [right, left] }], {
			dots: [town, { x: 150, y: 100 }]
		});
		// Its own dot doesn't count; Essen's, to the right, does.
		expect(placements[0]).toMatchObject({ visible: true, index: 1 });
	});

	it('still draws a name when every spot it has covers a dot', () => {
		const placements = choosePlacements([{ priority: 1, candidates: [right, left] }], {
			dots: [town, { x: 150, y: 100 }, { x: 50, y: 100 }]
		});
		expect(placements[0]).toMatchObject({ visible: true, index: 0 });
	});

	it('keeps a name on the map rather than off its edge', () => {
		const placements = choosePlacements([{ priority: 1, candidates: [right, left] }], {
			bounds: { left: 0, top: 0, right: 160, bottom: 300 }
		});
		expect(placements[0].index).toBe(1);
	});

	it('keeps a name where it is against a spot only a little better', () => {
		const label = { priority: 1, candidates: [right, left] };
		// 10 px of room on the right, 12 on the left: the left wins from
		// scratch, but not from a name that already sits on the right.
		expect(choosePlacements([neighbour(10), label])[1].index).toBe(1);
		expect(choosePlacements([neighbour(10), { ...label, current: 0 }])[1].index).toBe(0);
	});

	it('moves nothing when the whole map pans', () => {
		const layout = (dx: number, dy: number) => {
			const shift = (c: { offset: [number, number]; rect: ReturnType<typeof rect> }) => ({
				offset: c.offset,
				rect: {
					left: c.rect.left + dx,
					right: c.rect.right + dx,
					top: c.rect.top + dy,
					bottom: c.rect.bottom + dy
				}
			});
			const labels = [
				neighbour(6),
				{ priority: 2, candidates: [right, left, spot(0, -23), spot(0, 23)] },
				{ priority: 1, candidates: [spot(44, 0, 160, 120), spot(-44, 0, 160, 120)] }
			];
			const dots = [town, { x: 160, y: 120 }, { x: 60, y: 140 }];
			return choosePlacements(
				labels.map((label, i) => ({
					...label,
					candidates: label.candidates.map(shift),
					// Where each sat before the pan: a pan must not unseat them.
					current: [0, 1, 0][i]
				})),
				{
					dots: dots.map((d) => ({ x: d.x + dx, y: d.y + dy })),
					// Far enough out that the pan brings no name near an edge.
					bounds: { left: -1000, top: -1000, right: 2000, bottom: 2000 }
				}
			).map((p) => p.index);
		};
		const still = layout(0, 0);
		expect(layout(1, 0)).toEqual(still);
		expect(layout(0.4, -1)).toEqual(still);
		expect(layout(-37, 12)).toEqual(still);
	});
});
