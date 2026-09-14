import { describe, expect, it } from 'vitest';
import { parseIdList, withVisit } from './mapPrefs.svelte';

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
