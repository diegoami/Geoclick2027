// The fact box's sentence (FT-34, docs/PLAN_V0.8.md). The data is
// structured, not prose, so these tests are about which clauses get made,
// in which order, and that all three languages produce a real sentence
// rather than a template with a hole in it.
import { describe, expect, it } from 'vitest';
import { factClauses, formatCount, type Fact } from './facts';
import { LANGUAGES, setLanguage } from './i18n.svelte';

const piemonte: Fact = {
	kind: 'region',
	borders: ['Liguria', 'Lombardia', "Valle d'Aosta"],
	coastal: false,
	position: 'north-west',
	largestCity: { name: 'Turin', nameDe: 'Turin', nameIt: 'Torino', population: 1652000 },
	peak: { name: 'Monte Rosa', elevation: 4634 }
};

const seattle: Fact = {
	kind: 'city',
	population: 3074000,
	population1950: 795000,
	populationRank: 14,
	region: 'Washington',
	coastal: true,
	position: 'north-west'
};

describe('factClauses', () => {
	it('says nothing at all about a place it has no facts for', () => {
		expect(factClauses(undefined)).toEqual([]);
		expect(factClauses({})).toEqual([]);
	});

	it('puts where it is before what is in it', () => {
		// The order is the argument of the feature: what fixes a place in the
		// mind is first where it is, then what it is against, then numbers.
		setLanguage('en');
		expect(factClauses(piemonte)).toEqual([
			'In the north-west of the country.',
			'No coast of its own.',
			'Highest point: Monte Rosa, 4,634 m.',
			'Biggest city: Turin (1,652,000).',
			"Borders Liguria, Lombardia and Valle d'Aosta."
		]);
	});

	it('leads with the authored hook when there is one', () => {
		setLanguage('en');
		const [first] = factClauses({ ...piemonte, hook: 'The first capital of united Italy.' });
		expect(first).toBe('The first capital of united Italy.');
	});

	it('prefers how a city grew over what it merely is', () => {
		setLanguage('en');
		expect(factClauses(seattle)).toContain('795,000 people in 1950, 3,074,000 today.');
		expect(factClauses(seattle).join(' ')).not.toContain('About 3,074,000 people.');
	});

	it('gives the bare count when the city did not really grow', () => {
		setLanguage('en');
		const steady: Fact = { kind: 'city', population: 900000, population1950: 800000 };
		expect(factClauses(steady)).toEqual(['About 900,000 people.']);
	});

	it('only calls a region landlocked, never a city', () => {
		// "No coast of its own" is a fact about a region's border. An inland
		// town is just a town.
		setLanguage('en');
		expect(factClauses({ kind: 'region', coastal: false })).toEqual(['No coast of its own.']);
		expect(factClauses({ kind: 'city', coastal: false })).toEqual([]);
	});

	it('joins neighbours with the language’s own conjunction', () => {
		setLanguage('de');
		expect(factClauses({ borders: ['Bayern', 'Hessen', 'Sachsen'] })).toEqual([
			'Grenzt an Bayern, Hessen und Sachsen.'
		]);
		setLanguage('it');
		expect(factClauses({ borders: ['Lazio', 'Marche'] })).toEqual(['Confina con Lazio e Marche.']);
		setLanguage('en');
	});

	it('takes the city name in the reader’s own language', () => {
		setLanguage('it');
		expect(factClauses(piemonte)).toContain('Città più grande: Torino (1.652.000).');
		setLanguage('en');
	});

	it('produces a filled sentence in every language, never a leftover slot', () => {
		// A missing translation would leave {name} or {population} visible.
		for (const language of LANGUAGES) {
			setLanguage(language);
			for (const fact of [piemonte, seattle, { ...piemonte, terrain: ['ALPS'] }]) {
				const clauses = factClauses(fact);
				expect(clauses.length).toBeGreaterThan(0);
				expect(clauses.join(' ')).not.toMatch(/[{}]/);
			}
		}
		setLanguage('en');
	});
});

describe('formatCount', () => {
	it('writes a number the way the language does', () => {
		expect(formatCount(1652000, 'en')).toBe('1,652,000');
		expect(formatCount(1652000, 'de')).toBe('1.652.000');
		expect(formatCount(1652000, 'it')).toBe('1.652.000');
	});
});
