import { describe, expect, it } from 'vitest';
import { canonicalRegionAtPoint } from '../../../data/scripts/boundaryRegions';
const polygon = (name: string, admin: string, coords: number[][]) => ({
	properties: { name, admin },
	geometry: { type: 'Polygon', coordinates: [coords] }
});
const square = [
	[0, 0],
	[4, 0],
	[4, 4],
	[0, 4],
	[0, 0]
];
describe('canonical town region names', () => {
	it('matches polygon geometry, not its overlapping bounding box or another country', () => {
		const triangle = polygon('Wrong', 'Test', [
			[0, 0],
			[4, 0],
			[0, 4],
			[0, 0]
		]);
		const right = polygon('Right', 'Test', square);
		const neighbour = polygon('Foreign', 'Other', square);
		expect(
			canonicalRegionAtPoint(
				[3, 3],
				[triangle, right, neighbour],
				'Test',
				new Set(['Wrong', 'Right', 'Foreign'])
			)
		).toBe('Right');
	});
	it('accepts multiple parts of one region but rejects conflicting names and unknown targets', () => {
		const a = polygon('Pest', 'Test', square);
		expect(canonicalRegionAtPoint([1, 1], [a, { ...a }], 'Test', new Set(['Pest']))).toBe('Pest');
		expect(
			canonicalRegionAtPoint(
				[1, 1],
				[a, polygon('Other', 'Test', square)],
				'Test',
				new Set(['Pest', 'Other'])
			)
		).toBeUndefined();
		expect(canonicalRegionAtPoint([1, 1], [a], 'Test', new Set(['Missing']))).toBeUndefined();
	});
});

it('uses stated coastal precision only when it identifies one unambiguous region', () => {
	const region = polygon('Coast', 'Test', [
		[0, 0],
		[2, 0],
		[2, 2],
		[0, 2],
		[0, 0]
	]);
	expect(canonicalRegionAtPoint([-0.001, 1], [region], 'Test', new Set(['Coast']))).toBeUndefined();
	expect(canonicalRegionAtPoint([-0.001, 1], [region], 'Test', new Set(['Coast']), 0.01)).toBe(
		'Coast'
	);
	expect(
		canonicalRegionAtPoint([-0.1, 1], [region], 'Test', new Set(['Coast']), 2)
	).toBeUndefined();
	const other = polygon('Other', 'Test', [
		[0, 1],
		[2, 1],
		[2, 2],
		[0, 2],
		[0, 1]
	]);
	expect(
		canonicalRegionAtPoint([-0.001, 1], [region, other], 'Test', new Set(['Coast', 'Other']), 0.01)
	).toBeUndefined();
});
