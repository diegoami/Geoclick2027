// The spine a region's name is drawn along (FT-66). Imported from data/scripts
// the way mapColors.test.ts imports its build helpers.
import { describe, expect, it } from 'vitest';
import { computeSpine, type Ring } from '../../../data/scripts/spine';

const project = ([lon, lat]: [number, number]): [number, number] => {
	const s = Math.sin((lat * Math.PI) / 180);
	return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
};

/** A lon/lat rectangle as one piece, in normalised Web Mercator. */
const box = (w: number, s: number, e: number, n: number): Ring[] => [
	(
		[
			[w, s],
			[e, s],
			[e, n],
			[w, n],
			[w, s]
		] as [number, number][]
	).map(project)
];

/** An arch: the band between two concentric half-circles. */
const arch = (): Ring[] => {
	const ring: [number, number][] = [];
	for (let i = 0; i <= 24; i++) {
		ring.push([10 * Math.cos((Math.PI * i) / 24), 10 * Math.sin((Math.PI * i) / 24)]);
	}
	for (let i = 24; i >= 0; i--) {
		ring.push([7 * Math.cos((Math.PI * i) / 24), 7 * Math.sin((Math.PI * i) / 24)]);
	}
	return [ring.map(project)];
};

describe('computeSpine', () => {
	it('lays a long east-west region level, along its middle', () => {
		const spine = computeSpine([box(0, 0, 10, 2)])!;
		const [s, c, e] = spine.curve;
		for (const p of [s, c, e]) expect(p[1]).toBeCloseTo(1, 1);
		expect(s[0]).toBeLessThan(1.5);
		expect(e[0]).toBeGreaterThan(8.5);
		expect(spine.aspect).toBeGreaterThan(3.5);
	});

	it('lays a rectangle level even when a slice spans it exactly', () => {
		// Every slice of a rectangle runs edge to edge; a scan that stopped on
		// the last cell's edge once left all of them empty (Colorado, Utah).
		expect(computeSpine([box(-109, 37, -102, 41)])).not.toBeNull();
	});

	it('runs a tall region upright', () => {
		const [s, , e] = computeSpine([box(0, 0, 1, 8)])!.curve;
		expect(Math.abs(e[0] - s[0])).toBeLessThan(0.05);
		expect(Math.abs(e[1] - s[1])).toBeGreaterThan(5);
	});

	it('bows along a crescent instead of cutting across it', () => {
		const [s, c, e] = computeSpine([arch()])!.curve;
		// The control point sits well above the chord between the ends.
		expect(c[1]).toBeGreaterThan((s[1] + e[1]) / 2 + 2);
	});

	it('stitches a region cut by a tile edge back together', () => {
		// Two overlapping pieces, as the tiles deliver a region on a tile edge.
		const whole = computeSpine([box(0, 0, 10, 2)])!;
		const cut = computeSpine([box(0, 0, 5.2, 2), box(4.8, 0, 10, 2)])!;
		expect(cut.curve[0][0]).toBeCloseTo(whole.curve[0][0], 1);
		expect(cut.curve[2][0]).toBeCloseTo(whole.curve[2][0], 1);
	});

	it('names the mainland, not an island', () => {
		const [s, , e] = computeSpine([box(0, 0, 10, 2), box(0, 5, 1, 5.5)])!.curve;
		expect(s[1]).toBeLessThan(2);
		expect(e[1]).toBeLessThan(2);
	});

	it('gives up on nothing at all', () => {
		expect(computeSpine([])).toBeNull();
	});
});
