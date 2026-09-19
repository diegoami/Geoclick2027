// Runs in the browser project (real Chromium): the chosen names have to
// survive a reload, and that means real localStorage rather than a mock.
// FT-39, docs/PLAN_V0.9.md.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	clearNameOverrides,
	hasNameOverrides,
	nameOverride,
	setNameOverride
} from './mapPrefs.svelte';
import { tapOverride, visibleTier } from './shownNames';

const KEY = 'geoclick:shown-names:v1';

beforeEach(() => localStorage.removeItem(KEY));
afterEach(() => localStorage.removeItem(KEY));

describe('the names a player has chosen', () => {
	it('starts with nothing chosen', () => {
		expect(nameOverride('italy-regions', 'piemonte')).toBeUndefined();
		expect(hasNameOverrides('italy-regions')).toBe(false);
	});

	it('remembers a choice, and writes it where a reload will find it', () => {
		setNameOverride('italy-regions', 'piemonte', 'shown');
		expect(nameOverride('italy-regions', 'piemonte')).toBe('shown');
		// The point of the whole feature: still there tomorrow.
		expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
			'italy-regions/piemonte': 'shown'
		});
	});

	it('keeps maps apart', () => {
		setNameOverride('italy-regions', 'piemonte', 'shown');
		expect(nameOverride('italy-provinces', 'piemonte')).toBeUndefined();
		expect(hasNameOverrides('italy-provinces')).toBe(false);
	});

	it('clears one map without touching another', () => {
		setNameOverride('italy-regions', 'piemonte', 'shown');
		setNameOverride('china-regions', 'yunnan', 'shown');
		clearNameOverrides('italy-regions');
		expect(nameOverride('italy-regions', 'piemonte')).toBeUndefined();
		expect(nameOverride('china-regions', 'yunnan')).toBe('shown');
	});

	it('ignores a stored value that makes no sense', () => {
		// localStorage is editable by anyone with a console, and a bad value
		// must not put an unreadable name on the map.
		localStorage.setItem(KEY, '{"italy-regions/piemonte":"nonsense","a/b":42}');
		expect(nameOverride('italy-regions', 'piemonte')).toBeUndefined();
	});

	it('survives a corrupt store entirely', () => {
		localStorage.setItem(KEY, 'not json at all');
		expect(() => nameOverride('italy-regions', 'piemonte')).not.toThrow();
	});
});

describe('a tap, end to end', () => {
	// The behaviour the product owner asked for: tap a second region and the
	// first one's name stays; tap it again to take it away.
	it('leaves earlier names alone', () => {
		const streaks: Record<string, number> = {};
		const tap = (id: string) => {
			const next = tapOverride(streaks[id] ?? 0, nameOverride('italy-regions', id));
			setNameOverride('italy-regions', id, next);
		};
		const visible = (id: string) =>
			visibleTier(streaks[id] ?? 0, nameOverride('italy-regions', id)) !== undefined;

		tap('piemonte');
		tap('lombardia');
		expect([visible('piemonte'), visible('lombardia')]).toEqual([true, true]);

		tap('lombardia');
		expect([visible('piemonte'), visible('lombardia')]).toEqual([true, false]);
	});

	it('hides a name the player already knows, and brings it back', () => {
		// Decision 3: one rule for everything on the map.
		const known = 3;
		expect(visibleTier(known, nameOverride('italy-regions', 'toscana'))).toBe('known');
		setNameOverride('italy-regions', 'toscana', tapOverride(known, undefined));
		expect(visibleTier(known, nameOverride('italy-regions', 'toscana'))).toBeUndefined();
		setNameOverride('italy-regions', 'toscana', tapOverride(known, 'hidden'));
		expect(visibleTier(known, nameOverride('italy-regions', 'toscana'))).toBe('known');
	});
});
