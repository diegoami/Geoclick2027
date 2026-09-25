// Which file a target's authored sentences come from (FT-69, #46): a country
// reads world.json, a town its own country's file, and a country two maps
// spell two ways reads one file. Imported from data/scripts the way
// admin2.test.ts does.
import { describe, expect, it } from 'vitest';
import type { AuthoredHooks } from '../../../data/scripts/authoredHooks';
import { WORLD, authoredResolver, factsFileFor } from '../../../data/scripts/factsHooks';

// A loader that says which file was asked for, in place of reading data/facts.
function resolverOn(mapCountry: string | undefined) {
	const asked: (string | undefined)[] = [];
	const load = (country: string | undefined): Record<string, AuthoredHooks> => {
		asked.push(country);
		const facts: Record<string, Record<string, AuthoredHooks>> = {
			World: { finland: { any: { en: ['Suomi, probably from a word for fen.'] } } },
			Finland: { helsinki: { any: { en: ['Helsingfors in Swedish.'] } } }
		};
		return (country && facts[country]) || {};
	};
	return { resolve: authoredResolver(mapCountry, load), asked };
}

describe('authoredResolver', () => {
	it('gives a country on a continent map its sentences from world.json', () => {
		const { resolve, asked } = resolverOn('Europe');
		expect(resolve({ id: 'finland', type: 'country' })?.any?.en).toEqual([
			'Suomi, probably from a word for fen.'
		]);
		expect(asked).toEqual([WORLD]);
	});

	it('still gives a town on the same map its own country’s file', () => {
		const { resolve, asked } = resolverOn('Europe');
		expect(resolve({ id: 'helsinki', type: 'city', country: 'Finland' })).toBeDefined();
		expect(asked).toEqual(['Finland']);
	});

	it('gives a country nobody has written for no sentences, as before', () => {
		const { resolve } = resolverOn('Europe');
		expect(resolve({ id: 'moldova', type: 'country' })).toBeUndefined();
	});

	it('leaves a map of one country reading that country’s file', () => {
		const { resolve, asked } = resolverOn('Finland');
		expect(resolve({ id: 'helsinki', type: 'city' })).toBeDefined();
		expect(asked).toEqual(['Finland']);
	});
});

describe('factsFileFor', () => {
	it('names the file for the country as map.json spells it', () => {
		expect(factsFileFor('United States of America')).toBe('united-states-of-america.json');
		expect(factsFileFor(WORLD)).toBe('world.json');
	});

	it('sends "Czech Republic" and "Czechia" to one file', () => {
		expect(factsFileFor('Czech Republic')).toBe('czechia.json');
		expect(factsFileFor('Czechia')).toBe('czechia.json');
	});
});
