import { describe, it, expect } from 'vitest';
import {
	longitudeNear,
	wrappedPointBounds,
	splitLongitudeBox,
	longitudeInBox
} from '@geoclick/quiz-engine';
import { overallExtent, type MapDefinition } from './mapDefinition';
import { padBbox } from '../../../data/scripts/mapBuildUtils';
describe('explicit Pacific point-map windows', () => {
	const points: [[number, number], [number, number], [number, number], [number, number]] = [
		[134, 8],
		[178, -18],
		[-175, -21],
		[-171, -13]
	];
	it('frames independent Pacific countries together without changing their coordinates', () => {
		const before = structuredClone(points);
		expect(wrappedPointBounds(points)).toEqual([134, -21, 189, 8]);
		expect(points).toEqual(before);
	});
	it('uses the same unwrapped frame in the real map definition while preserving default/world behavior', () => {
		const map = {
			id: 'pacific',
			name: 'Pacific',
			country: 'Oceania',
			attribution: 'test',
			tiles: 'tiles.pmtiles',
			wrapLongitude: true,
			targets: points.map((centroid, i) => ({
				id: String(i),
				name: String(i),
				type: 'city',
				tier: 1,
				aliases: [],
				centroid,
				bbox: [...centroid, ...centroid]
			})),
			tourOrder: []
		} as MapDefinition;
		expect(overallExtent(map)).toEqual([134, -21, 189, 8]);
		expect(overallExtent({ ...map, wrapLongitude: false })).toEqual([-175, -21, 178, 8]);
	});
	it('splits padded OGR queries/clips across both canonical hemispheres', () => {
		const padded = padBbox([130, -25, 190, 10], 0.1);
		expect(padded).toEqual([124, -28.5, 196, 13.5]);
		expect(splitLongitudeBox(padded)).toEqual([
			[124, -28.5, 180, 13.5],
			[-180, -28.5, -164, 13.5]
		]);
		expect(splitLongitudeBox([-190, -10, -130, 10])).toEqual([
			[170, -10, 180, 10],
			[-180, -10, -130, 10]
		]);
	});
	it('projects Samoa/Tonga onto the visible Pacific copy and retains labels on both sides', () => {
		expect(longitudeNear(-171, 170)).toBe(189);
		expect(longitudeNear(178, -175)).toBe(-182);
		expect(longitudeInBox(-171, [134, -25, 195, 10])).toBe(true);
		expect(longitudeInBox(166, [134, -25, 195, 10])).toBe(true);
		expect(longitudeInBox(0, [134, -25, 195, 10])).toBe(false);
	});
	it('preserves ordinary western/northern windows and rejects malformed inputs', () => {
		expect(
			wrappedPointBounds([
				[-123, 49],
				[-52, 47]
			])
		).toEqual([-123, 47, -52, 49]);
		expect(splitLongitudeBox([-10, 30, 40, 60])).toEqual([[-10, 30, 40, 60]]);
		expect(() => splitLongitudeBox([20, 0, 10, 10])).toThrow();
		expect(() => wrappedPointBounds([])).toThrow();
	});
});
