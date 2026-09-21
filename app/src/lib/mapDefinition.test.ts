import { describe, expect, it } from 'vitest';
import { overallExtent, overallBounds, type MapDefinition, type Target } from './mapDefinition';

// A wrapped target's real centroid is not the arithmetic middle of its bbox
// (Chukotka's is ~173.99, not -6), so it can be passed explicitly.
const target = (
	id: string,
	bbox: [number, number, number, number],
	centroid?: [number, number]
): Target => ({
	id,
	name: id,
	type: 'region',
	tier: 1,
	aliases: [],
	centroid: centroid ?? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
	bbox
});

const mapOf = (...targets: Target[]): MapDefinition => ({
	id: 'test',
	name: 'Test',
	country: 'Test',
	attribution: 'test',
	tiles: 'tiles.pmtiles',
	targets,
	tourOrder: targets.map((t) => t.id)
});

describe('overallExtent', () => {
	it('covers every non-wrapping target', () => {
		expect(overallExtent(mapOf(target('a', [0, 0, 10, 10]), target('b', [20, 5, 30, 15])))).toEqual(
			[0, 0, 30, 15]
		);
	});

	it('lets a wrapping bbox contribute its centroid only, flag or no flag', () => {
		// FT-52: a bbox that wraps has west > east. Merging it with the others
		// would pull the camera out to the whole hemisphere, so it is skipped.
		// The bbox itself decides; the optional flag must not be required.
		// Real Chukotka data: if the wrapped bbox were merged (the old
		// unflagged behaviour) the north edge would climb to 71.6 instead of
		// the centroid's 66.7074, so this distinguishes the fix from the bug.
		const plain = target('a', [0, 0, 40, 40]);
		const chukotka = target('chukotka', [157.692, 61.8148, -169.7009, 71.6], [173.99555, 66.7074]);
		const unflagged = overallExtent(mapOf(plain, chukotka));
		const flagged = overallExtent(mapOf(plain, { ...chukotka, crossesAntimeridian: true }));
		expect(unflagged).toEqual([0, 0, 173.99555, 66.7074]);
		expect(flagged).toEqual(unflagged);
	});

	it('does not treat a bbox that reaches ±180, or is degenerate, as wrapping', () => {
		// west === east is a point, and reaching 180 from -180 is not a
		// crossing - only a strict west > east is.
		const world = mapOf(target('a', [-180, 0, 180, 10]));
		expect(overallExtent(world)).toEqual([-180, 0, 180, 10]);
		const point = mapOf(target('p', [9, 45, 9, 45]));
		expect(overallExtent(point)).toEqual([9, 45, 9, 45]);
	});

	it('still frames a map whose only target wraps', () => {
		// Falls back to centroid bounds when every target wraps, rather than
		// collapsing to an empty-initialised box.
		const only = mapOf(
			target('chukotka', [157.692, 61.8148, -169.7009, 71.6], [173.99555, 66.7074])
		);
		expect(overallExtent(only)).toEqual(overallBounds(only));
		expect(overallExtent(only)).toEqual([173.99555, 66.7074, 173.99555, 66.7074]);
	});
});
