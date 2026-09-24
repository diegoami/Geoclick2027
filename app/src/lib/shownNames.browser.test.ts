// Runs in the browser project (real Chromium): the chosen names must stay
// out of real localStorage, and the key FT-39 used to write must go.
// FT-39, docs/PLAN_V0.9.md; session-only since #11.
import { afterEach, describe, expect, it } from 'vitest';
import {
	clearNameOverrides,
	hasNameOverrides,
	nameOverride,
	setNameOverride
} from './mapPrefs.svelte';
import { tapOverride, visibleTier } from './shownNames';

const LEGACY_KEY = 'geoclick:shown-names:v1';
const MAPS = ['italy-regions', 'italy-provinces', 'china-regions'];

// The overrides are module state that lives for the session, which here
// means the whole test file - so each test cleans up after itself.
afterEach(() => {
	for (const map of MAPS) clearNameOverrides(map);
	localStorage.removeItem(LEGACY_KEY);
});

describe('the names a player has chosen', () => {
	it('starts with nothing chosen', () => {
		expect(nameOverride('italy-regions', 'piemonte')).toBeUndefined();
		expect(hasNameOverrides('italy-regions')).toBe(false);
	});

	it('remembers a choice for the session, and writes nothing to storage', () => {
		setNameOverride('italy-regions', 'piemonte', 'shown');
		expect(nameOverride('italy-regions', 'piemonte')).toBe('shown');
		// #11: reopening the app shows what is known and nothing else.
		expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
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

	it('ignores, and removes, a choice stored under the old rule', async () => {
		// What an FT-39 build left behind. A fresh load of the module is a
		// reopened app.
		localStorage.setItem(LEGACY_KEY, '{"italy-regions/piemonte":"shown"}');
		// A query string makes Vite evaluate the module again.
		const fresh: typeof import('./mapPrefs.svelte') = await import(
			// @ts-expect-error - the query is for Vite; TypeScript cannot resolve it
			'./mapPrefs.svelte?reopened'
		);
		expect(fresh.nameOverride('italy-regions', 'piemonte')).toBeUndefined();
		expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
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

	it('hides a name the player already knows, and brings it back as Chosen', () => {
		// Decision 3: one rule for everything on the map. #11: what a tap
		// brings back is the player's choice, so it is drawn as Chosen.
		const known = 3;
		expect(visibleTier(known, nameOverride('italy-regions', 'toscana'))).toBe('known');
		setNameOverride('italy-regions', 'toscana', tapOverride(known, undefined));
		expect(visibleTier(known, nameOverride('italy-regions', 'toscana'))).toBeUndefined();
		setNameOverride('italy-regions', 'toscana', tapOverride(known, 'hidden'));
		expect(visibleTier(known, nameOverride('italy-regions', 'toscana'))).toBe('asked');
	});
});
