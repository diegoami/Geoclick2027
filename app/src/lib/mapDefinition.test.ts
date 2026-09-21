import { describe, expect, it } from 'vitest';
import { overallExtent, overallBounds, type MapDefinition, type Target } from './mapDefinition';

const target = (id: string, bbox: [number, number, number, number]): Target => ({
	id,
	name: id,
	type: 'region',
	tier: 1,
	aliases: [],
	centroid: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
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
		// Its centroid (10, 15) sits inside the plain target's box, so the
		// result is exactly that box.
		const wrapBbox: [number, number, number, number] = [170, 10, -150, 20];
		const plain = target('a', [0, 0, 40, 40]);
		const unflagged = overallExtent(mapOf(plain, target('chukotka', wrapBbox)));
		const flagged = overallExtent(
			mapOf(plain, { ...target('chukotka', wrapBbox), crossesAntimeridian: true })
		);
		expect(unflagged).toEqual([0, 0, 40, 40]);
		expect(flagged).toEqual(unflagged);
	});

	it('still frames a map whose only target wraps', () => {
		// Falls back to centroid bounds when every target wraps, rather than
		// collapsing to an empty-initialised box.
		const only = mapOf(target('chukotka', [170, 10, -150, 20]));
		expect(overallExtent(only)).toEqual(overallBounds(only));
		expect(overallExtent(only)).toEqual([10, 15, 10, 15]);
	});
});
