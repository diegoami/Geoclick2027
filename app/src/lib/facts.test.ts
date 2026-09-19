// The fact box's sentence (FT-34, docs/PLAN_V0.8.md). The data is
// structured, not prose, so these tests are about which clauses get made,
// in which order, and that all three languages produce a real sentence
// rather than a template with a hole in it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { factClauses, formatCount, pickHook, placeFacts, type Fact } from './facts';
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

describe('factClauses (FT-45: only what the map does not already show)', () => {
	// This used to compose a whole sentence - position, coast, terrain, peak,
	// neighbours, population, growth since 1950. The product owner's verdict
	// after using it: the descriptions are "useless and distracting", and the
	// reason why is the rule these tests pin - "I can see myself if it is on
	// the north or on the south". The map shows you where a place is. What
	// is left is what it does not show.
	it('says nothing at all about a place it has no facts for', () => {
		expect(factClauses(undefined)).toEqual([]);
	});

	it('gives a region its biggest city, and nothing else', () => {
		const clauses = factClauses(piemonte);
		expect(clauses).toHaveLength(1);
		expect(clauses[0]).toMatch(/Turin/);
		expect(clauses[0]).toMatch(/1,652,000/);
	});

	it('gives a town its region and its rank, and nothing else', () => {
		const clauses = factClauses(seattle);
		expect(clauses).toEqual(['In Washington.', 'No. 14 by population on this map.']);
	});

	it('never says where a place is - the map is already showing that', () => {
		const said = [...factClauses(piemonte), ...factClauses(seattle)].join(' ');
		expect(said).not.toMatch(/north|south|east|west/i);
		expect(said).not.toMatch(/coast|landlocked/i);
	});

	it('drops the other clauses too: terrain, peak, neighbours, growth', () => {
		// The fields are still in the data and still parsed; they are simply
		// not shown. Bringing one back is a line in factClauses.
		const said = [...factClauses(piemonte), ...factClauses(seattle)].join(' ');
		expect(said).not.toMatch(/Monte Rosa|Liguria|Lombardia|795,000|3,074,000/);
	});

	it('says nothing where there is nothing left to say', () => {
		expect(factClauses({ kind: 'region', position: 'north-west', coastal: true })).toEqual([]);
		expect(factClauses({ kind: 'city', position: 'north-west' })).toEqual([]);
	});

	it('takes the city name in the reader’s own language', () => {
		setLanguage('it');
		expect(factClauses(piemonte)[0]).toMatch(/Torino/);
		setLanguage('en');
		expect(factClauses(piemonte)[0]).toMatch(/Turin/);
	});

	it('produces filled sentences in every language, never a leftover slot', () => {
		for (const language of LANGUAGES) {
			setLanguage(language);
			for (const fact of [piemonte, seattle]) {
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

describe('placeFacts (FT-47: the origin is pinned)', () => {
	// The bug this fixes: the card rotated through ALL of a place's facts,
	// and only the first is about the name - so two visits in three showed
	// no etymology at all. "Now I have lost the name origin."
	const three = (hooks: string[]): Fact => ({ kind: 'region', hooks });

	// This suite runs in the server project, which has no localStorage -
	// and without it readRotation() always reports 0, so the rotation would
	// never actually move and the test would pass for the wrong reason. A
	// minimal in-memory stub makes it exercise the real thing.
	beforeEach(() => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v),
			removeItem: (k: string) => void store.delete(k)
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('gives the same origin every single visit', () => {
		const fact = three(['from the Longobards', 'the bankers', 'the economy']);
		const seen = [];
		for (let i = 0; i < 6; i++) seen.push(placeFacts('m', 't', fact).origin);
		expect(new Set(seen)).toEqual(new Set(['from the Longobards']));
	});

	it('rotates the others, and never serves the origin among them', () => {
		const fact = three(['from the Longobards', 'the bankers', 'the economy']);
		const extras = [];
		for (let i = 0; i < 4; i++) extras.push(placeFacts('m', 't', fact).extra);
		expect(extras).toEqual(['the bankers', 'the economy', 'the bankers', 'the economy']);
		expect(extras).not.toContain('from the Longobards');
	});

	it('has no extra when the origin is all that was written', () => {
		const only = placeFacts('m', 't', three(['from the Longobards']));
		expect(only.origin).toBe('from the Longobards');
		expect(only.extra).toBeUndefined();
	});

	it('says nothing at all for a place nobody has written about', () => {
		expect(placeFacts('m', 't', undefined)).toEqual({});
		expect(placeFacts('m', 't', { kind: 'region' })).toEqual({});
		expect(placeFacts('m', 't', three([]))).toEqual({});
	});

	it('keeps each place\u2019s rotation to itself', () => {
		const fact = three(['origin', 'a', 'b']);
		expect(placeFacts('m', 'one', fact).extra).toBe('a');
		expect(placeFacts('m', 'two', fact).extra).toBe('a');
		expect(placeFacts('m', 'one', fact).extra).toBe('b');
	});
});

describe('pickHook (FT-36)', () => {
	const hooks = ['first', 'second', 'third'];

	it('has nothing to show when nobody has written one', () => {
		expect(pickHook(undefined, 0)).toBeUndefined();
		expect(pickHook([], 0)).toBeUndefined();
	});

	it('shows a different one each time you meet the place', () => {
		// The point of a list: seeing one, then another, then the first again
		// across sessions is what makes more than one of them stick.
		expect(pickHook(hooks, 0)!.hook).toBe('first');
		expect(pickHook(hooks, 1)!.hook).toBe('second');
		expect(pickHook(hooks, 2)!.hook).toBe('third');
	});

	it('comes back round rather than running out', () => {
		expect(pickHook(hooks, 3)!.hook).toBe('first');
		expect(pickHook(hooks, 7)!.hook).toBe('second');
	});

	it('survives a stored count that makes no sense', () => {
		// localStorage is editable by anyone with a console, and a crash here
		// would take the map down with it.
		expect(pickHook(hooks, -1)!.hook).toBe('third');
		expect(pickHook(hooks, Number.NaN)!.hook).toBe('first');
	});

	it('reports where the rotation should go next', () => {
		expect(pickHook(hooks, 0)!.next).toBe(1);
		expect(pickHook(hooks, 2)!.next).toBe(3);
	});

	it('is a no-op for a place with exactly one', () => {
		expect(pickHook(['only'], 0)!.hook).toBe('only');
		expect(pickHook(['only'], 5)!.hook).toBe('only');
	});
});
