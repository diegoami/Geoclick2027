import { describe, expect, it } from 'vitest';
import { CONFUSION_LIMIT, forgetLearned, partnersOf, recordConfusion } from './confusions';

describe('recordConfusion (#266)', () => {
	it('adds a new pair and counts a repeated one', () => {
		let list = recordConfusion([], 'molise', 'abruzzo');
		expect(list).toEqual([{ targetId: 'molise', chosenId: 'abruzzo', count: 1 }]);
		list = recordConfusion(list, 'lazio', 'umbria');
		list = recordConfusion(list, 'lazio', 'umbria');
		expect(list).toEqual([
			{ targetId: 'lazio', chosenId: 'umbria', count: 2 },
			{ targetId: 'molise', chosenId: 'abruzzo', count: 1 }
		]);
	});

	it('keeps only the most frequent pairs', () => {
		let list = recordConfusion([], 'often', 'other');
		list = recordConfusion(list, 'often', 'other');
		for (let i = 0; i < CONFUSION_LIMIT + 5; i++) list = recordConfusion(list, `t${i}`, 'x');
		expect(list).toHaveLength(CONFUSION_LIMIT);
		expect(list[0]).toEqual({ targetId: 'often', chosenId: 'other', count: 2 });
	});

	it('ignores a drop on the name itself', () => {
		expect(recordConfusion([], 'a', 'a')).toEqual([]);
	});
});

describe('forgetLearned', () => {
	it('drops a pair once both names are known', () => {
		const list = [
			{ targetId: 'a', chosenId: 'b', count: 3 },
			{ targetId: 'c', chosenId: 'd', count: 1 }
		];
		const levels = new Map([
			['a', 3],
			['b', 3],
			['c', 3],
			['d', 2]
		]);
		expect(forgetLearned(list, levels)).toEqual([list[1]]);
	});
});

describe('partnersOf', () => {
	it('finds partners either way round, most frequent first, without repeats', () => {
		const list = [
			{ targetId: 'a', chosenId: 'b', count: 3 },
			{ targetId: 'c', chosenId: 'a', count: 2 },
			{ targetId: 'b', chosenId: 'a', count: 1 },
			{ targetId: 'x', chosenId: 'y', count: 1 }
		];
		expect(partnersOf(list, ['a'])).toEqual(['b', 'c']);
		expect(partnersOf(list, ['a', 'b'])).toEqual(['c']);
		expect(partnersOf(list, ['z'])).toEqual([]);
	});
});
