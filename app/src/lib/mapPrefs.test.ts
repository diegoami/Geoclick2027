import { describe, expect, it } from 'vitest';
import {
	chosenMapType,
	parseIdList,
	parseMapTypeSelections,
	withToggled,
	withVisit
} from './mapPrefs.svelte';

describe('withVisit (Recent maps)', () => {
	it('puts the visited map first', () => {
		expect(withVisit(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
	});

	it('moves a map already in the list to the front instead of repeating it', () => {
		expect(withVisit(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
		expect(withVisit(['a'], 'a')).toEqual(['a']);
	});

	it('keeps only the newest entries', () => {
		expect(withVisit(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
	});
});

describe('parseIdList (stored value)', () => {
	it('reads a stored list of ids', () => {
		expect(parseIdList('["italy-regions","usa-states"]')).toEqual(['italy-regions', 'usa-states']);
	});

	it('treats a missing, malformed or wrongly shaped value as empty', () => {
		expect(parseIdList(null)).toEqual([]);
		expect(parseIdList('not json')).toEqual([]);
		expect(parseIdList('{"a":1}')).toEqual([]);
	});

	it('drops anything that is not an id', () => {
		expect(parseIdList('["italy-regions", 3, null, "usa-states"]')).toEqual([
			'italy-regions',
			'usa-states'
		]);
	});
});

describe('map type selections', () => {
	it('reads valid per-row choices and ignores malformed entries', () => {
		expect(parseMapTypeSelections('{"italy":"italy-provinces","germany":4}')).toEqual({
			italy: 'italy-provinces'
		});
		expect(parseMapTypeSelections('not json')).toEqual({});
		expect(parseMapTypeSelections('[]')).toEqual({});
	});

	it('uses a valid manual choice or falls back to the first listed map', () => {
		const maps = ['italy-regions', 'italy-provinces', 'italy-towns-100k'];
		expect(chosenMapType({ italy: 'italy-provinces' }, 'italy', maps)).toBe('italy-provinces');
		expect(chosenMapType({ italy: 'removed-map' }, 'italy', maps)).toBe('italy-regions');
		expect(chosenMapType({}, 'italy', maps)).toBe('italy-regions');
		expect(chosenMapType({}, 'italy', [])).toBeUndefined();
	});
});

describe('withToggled (favourites)', () => {
	it('adds a map at the end, keeping the starred order', () => {
		expect(withToggled(['a'], 'b')).toEqual(['a', 'b']);
	});

	it('removes a map that is already a favourite', () => {
		expect(withToggled(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
	});

	it('toggling twice gives back the original list', () => {
		expect(withToggled(withToggled(['a'], 'b'), 'b')).toEqual(['a']);
	});
});
