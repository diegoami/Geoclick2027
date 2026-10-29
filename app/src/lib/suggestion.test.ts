import { describe, expect, it } from 'vitest';
import { suggestNext } from './suggestion';

const siblings: Record<string, string[]> = {
	'italy-regions': ['italy-towns'],
	'italy-towns': ['italy-regions'],
	'spain-regions': ['spain-towns']
};
const siblingsOf = (id: string) => siblings[id] ?? [];

describe('suggestNext (#263)', () => {
	it('continues the most recent map that is not complete', () => {
		expect(
			suggestNext({
				recent: ['spain-regions', 'italy-regions'],
				masteries: {
					'spain-regions': { known: 17, total: 17, level: 3 },
					'italy-regions': { known: 14, total: 20, level: 2 }
				},
				slipped: {},
				siblingsOf
			})
		).toEqual({ kind: 'continue', mapId: 'italy-regions', known: 14, total: 20 });
	});

	it('says when that map slipped last time', () => {
		expect(
			suggestNext({
				recent: ['italy-regions'],
				masteries: { 'italy-regions': { known: 14, total: 20, level: 2 } },
				slipped: { 'italy-regions': 3 },
				siblingsOf
			})
		).toEqual({ kind: 'slipped', mapId: 'italy-regions', slipped: 3 });
	});

	it("suggests a complete map's next sibling when nothing is unfinished", () => {
		expect(
			suggestNext({
				recent: ['italy-regions'],
				masteries: { 'italy-regions': { known: 20, total: 20, level: 3 } },
				slipped: {},
				siblingsOf
			})
		).toEqual({ kind: 'next', mapId: 'italy-towns', from: 'italy-regions' });
	});

	it('suggests nothing when every recent map and its siblings are complete, or nothing was played', () => {
		const full = { known: 1, total: 1, level: 3 as const };
		expect(
			suggestNext({
				recent: ['italy-regions'],
				masteries: { 'italy-regions': full, 'italy-towns': full },
				slipped: {},
				siblingsOf
			})
		).toBeUndefined();
		expect(suggestNext({ recent: [], masteries: {}, slipped: {}, siblingsOf })).toBeUndefined();
		expect(
			suggestNext({ recent: ['italy-regions'], masteries: {}, slipped: {}, siblingsOf })
		).toBeUndefined();
	});
});
