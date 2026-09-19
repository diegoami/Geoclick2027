// The geometry behind the derived fact (FT-34, docs/PLAN_V0.8.md). Imported
// from data/scripts the same way placeSelection.test.ts and
// terrainBuild.test.ts do - the build script needs ogr2ogr, these parts
// don't.
import { describe, expect, it } from 'vitest';
import {
	bboxOf,
	coastIndex,
	compassPosition,
	coverageOf,
	interiorPoint,
	nearCoast,
	pointInPolygon,
	touchesCoast,
	type Position
} from '../../../data/scripts/factGeometry';

const line = (...positions: Position[]) => ({ coordinates: positions });
const ring = (...positions: Position[]) => ({ coordinates: [positions] });

describe('coastIndex / touchesCoast', () => {
	// Natural Earth's admin-1 polygons and its coastline are generalised from
	// the same land, so a coastal region's boundary shares vertices with the
	// coastline rather than merely running near it. Checked against Italy,
	// where this returns exactly the five landlocked regions.
	const coast = coastIndex([line([10.0, 44.0], [10.01, 44.01], [10.02, 44.02])]);

	it('finds a region whose boundary runs along the coast', () => {
		expect(touchesCoast(ring([9.5, 43.5], [10.01, 44.01], [9.5, 44.5]), coast)).toBe(true);
	});

	it('leaves a landlocked one alone', () => {
		expect(touchesCoast(ring([12.0, 43.0], [12.5, 43.0], [12.5, 43.5]), coast)).toBe(false);
	});

	it('matches a vertex that is only close, not identical', () => {
		// The grid is a hundredth of a degree, about a kilometre - enough to
		// absorb the rounding between two exports of the same geometry.
		expect(touchesCoast(ring([10.001, 44.002], [11, 45], [11, 44]), coast)).toBe(true);
	});
});

describe('nearCoast', () => {
	const coast = coastIndex([line([10.0, 44.0])]);

	it('calls a town by the sea coastal', () => {
		expect(nearCoast([10.05, 44.05], coast)).toBe(true);
	});

	it('does not call an inland town coastal', () => {
		expect(nearCoast([11.0, 45.0], coast)).toBe(false);
	});

	it('takes the search distance as an argument', () => {
		expect(nearCoast([10.3, 44.0], coast, 5)).toBe(false);
		expect(nearCoast([10.3, 44.0], coast, 40)).toBe(true);
	});
});

describe('pointInPolygon', () => {
	const square = ring([0, 0], [10, 0], [10, 10], [0, 10], [0, 0]);

	it('is true inside and false outside', () => {
		expect(pointInPolygon([5, 5], square)).toBe(true);
		expect(pointInPolygon([15, 5], square)).toBe(false);
		expect(pointInPolygon([5, 15], square)).toBe(false);
	});

	it('handles a polygon with a hole', () => {
		// The outer ring and the hole's ring both get crossed, so a point in
		// the hole comes out even - which is the right answer.
		const withHole = {
			coordinates: [
				[
					[0, 0],
					[10, 0],
					[10, 10],
					[0, 10],
					[0, 0]
				],
				[
					[4, 4],
					[6, 4],
					[6, 6],
					[4, 6],
					[4, 4]
				]
			]
		};
		expect(pointInPolygon([5, 5], withHole)).toBe(false);
		expect(pointInPolygon([2, 2], withHole)).toBe(true);
	});

	it('handles a multipolygon', () => {
		const two = {
			coordinates: [
				[
					[
						[0, 0],
						[2, 0],
						[2, 2],
						[0, 2],
						[0, 0]
					]
				],
				[
					[
						[10, 10],
						[12, 10],
						[12, 12],
						[10, 12],
						[10, 10]
					]
				]
			]
		};
		expect(pointInPolygon([1, 1], two)).toBe(true);
		expect(pointInPolygon([11, 11], two)).toBe(true);
		expect(pointInPolygon([5, 5], two)).toBe(false);
	});
});

describe('bboxOf', () => {
	it('is the extent of every point in the geometry', () => {
		expect(bboxOf(ring([3, 40], [9, 44], [5, 47]))).toEqual([3, 40, 9, 47]);
	});
});

describe('compassPosition', () => {
	// Italy's extent, roughly.
	const italy: [number, number, number, number] = [6.6, 36.6, 18.5, 47.1];

	it('puts the Alps in the north', () => {
		expect(compassPosition([11.4, 46.4], italy)).toBe('north');
	});

	it('puts Sicily in the south', () => {
		expect(compassPosition([14.1, 37.6], italy)).toBe('south');
	});

	it('puts Calabria in the south-east', () => {
		expect(compassPosition([16.5, 39.0], italy)).toBe('south-east');
	});

	it('puts Puglia simply on the east side', () => {
		// Its centre sits in the middle third of Italy's latitude, so it gets
		// one word rather than two. That is the point of the middle band:
		// "on the east side" is true of Puglia, "in the south-east" is not.
		expect(compassPosition([16.6, 40.9], italy)).toBe('east');
	});

	it('puts Piemonte in the north-west', () => {
		expect(compassPosition([7.9, 45.1], italy)).toBe('north-west');
	});

	it('calls the middle the middle', () => {
		// The middle third of each axis is neither side: without this, every
		// region of a small country would be described as being in a corner.
		expect(compassPosition([12.5, 42.0], italy)).toBe('centre');
	});

	it('does not divide by zero on a degenerate extent', () => {
		expect(compassPosition([5, 5], [5, 5, 5, 5])).toBe('centre');
	});
});

describe('interiorPoint (FT-33 fix)', () => {
	// The middle of a shape's box is not in the shape when the shape is long,
	// curved, or bent round a coast - which put two real labels in the sea on
	// the Italy map before this existed.
	it('is the middle of the box when the middle is inside', () => {
		expect(interiorPoint(ring([0, 0], [10, 0], [10, 10], [0, 10], [0, 0]))).toEqual([5, 5]);
	});

	it('finds a point inside a crescent, whose box centre is outside it', () => {
		// A C-shape opening east: its box centre falls in the gap.
		const crescent = ring(
			[0, 0],
			[10, 0],
			[10, 3],
			[3, 3],
			[3, 7],
			[10, 7],
			[10, 10],
			[0, 10],
			[0, 0]
		);
		expect(pointInPolygon([5, 5], crescent)).toBe(false);
		expect(pointInPolygon(interiorPoint(crescent), crescent)).toBe(true);
	});

	it('finds a point inside a long diagonal band, like a mountain chain', () => {
		// The Apennines follow the peninsula; the centre of their box is off
		// to one side of the ridge, in the sea.
		const band = ring([0, 0], [2, 0], [12, 10], [10, 10], [0, 0]);
		expect(pointInPolygon(interiorPoint(band), band)).toBe(true);
	});
});

describe('coverageOf', () => {
	// Answers "is this name about this map?" for a feature whose own middle
	// lies elsewhere: the Sahara belongs on a map of Egypt, the Balkan
	// Peninsula does not belong on a map of Italy.
	const big = ring([-10, -10], [30, -10], [30, 30], [-10, 30], [-10, -10]);

	it('is 1 for a shape that covers the whole box', () => {
		expect(coverageOf(big, [0, 0, 10, 10])).toBe(1);
	});

	it('is 0 for a shape that misses the box entirely', () => {
		expect(coverageOf(ring([50, 50], [60, 50], [60, 60], [50, 60]), [0, 0, 10, 10])).toBe(0);
	});

	it('is about a quarter for a shape over one corner', () => {
		const corner = ring([0, 0], [5, 0], [5, 5], [0, 5], [0, 0]);
		expect(coverageOf(corner, [0, 0, 10, 10])).toBeCloseTo(0.25, 1);
	});
});
