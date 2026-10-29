import { describe, expect, it } from 'vitest';
import { CHOICE_COUNTS, choiceCount, choicesFor, nearestOthers } from './nameIt';

const places = [
	{ id: 'centre', centroid: [10, 45] as [number, number] },
	{ id: 'near', centroid: [10.5, 45] as [number, number] },
	{ id: 'north', centroid: [10, 46] as [number, number] },
	{ id: 'far', centroid: [20, 50] as [number, number] },
	{ id: 'east', centroid: [11.2, 45] as [number, number] }
];

describe('Name-it choices (#264)', () => {
	it('offers more names as the map is known better', () => {
		expect(CHOICE_COUNTS.map((_, level) => choiceCount(level as 0 | 1 | 2 | 3))).toEqual([
			4, 4, 5, 6
		]);
	});

	it('picks the nearest places, scaling longitude by latitude', () => {
		// At 45°, a degree east is ~0.71 of a degree north: 1.2° east is nearer
		// than 1° north.
		expect(nearestOthers(places, 'centre', 3)).toEqual(['near', 'east', 'north']);
	});

	it('includes the right name once, among its neighbours, shuffled', () => {
		const choices = choicesFor(places, 'centre', 4, () => 0);
		expect([...choices].sort()).toEqual(['centre', 'east', 'near', 'north']);
		expect(choicesFor(places, 'centre', 4, () => 0.999)).not.toEqual(choices);
	});

	it('offers what there is on a map smaller than the count', () => {
		expect(choicesFor(places.slice(0, 2), 'centre', 6)).toHaveLength(2);
	});
});
