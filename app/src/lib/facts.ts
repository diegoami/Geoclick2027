// The fact box's data and its sentence (FT-34, docs/PLAN_V0.8.md).
//
// data/scripts/build-facts.ts writes STRUCTURED FIELDS per target - a
// population, a list of neighbours, a compass position - and this module
// turns them into short clauses at run time, through the i18n dictionary.
// That is what makes the derived half of the fact box trilingual without a
// word of it being translated by hand: the numbers and the proper nouns are
// the same in every language, and only the words around them change.
//
// The clauses come back as an ordered list, best first, and the caller
// decides how many it has room for - FT-35's card shows the first few. A
// fact that could not be computed is simply absent from the data, so
// nothing here guesses.

import { asset } from '$app/paths';
import { getLanguage, t, type Language, type TranslationKey } from './i18n.svelte';

export type CompassPosition =
	| 'north'
	| 'south'
	| 'east'
	| 'west'
	| 'north-east'
	| 'north-west'
	| 'south-east'
	| 'south-west'
	| 'centre';

/** A place's name-facts per language (FT-49); mirrors LangHooks in
 *  data/scripts/build-facts.ts. A plain array still means English, which is
 *  what every country not yet translated stores. */
export type LangHooks = Partial<Record<Language, string[]>>;

/** Mirrors DerivedFact in data/scripts/build-facts.ts. */
export interface Fact {
	kind?: 'region' | 'city';
	type?: string;
	localName?: string;
	borders?: string[];
	coastal?: boolean;
	terrain?: string[];
	peak?: { name: string; elevation: number };
	position?: CompassPosition;
	largestCity?: { name: string; nameDe?: string; nameIt?: string; population: number };
	population?: number;
	populationRank?: number;
	region?: string;
	capitalOf?: 'country' | 'region';
	population1950?: number;
	/**
	 * The authored name-facts, where any have been written (FT-36).
	 *
	 * A list, not one sentence, and the card shows a different one each time
	 * you meet the place. The first is always about the NAME - where the word
	 * comes from, who it is named after - because the name is what is being
	 * learned, and the derived line above already says where the place is.
	 */
	hooks?: string[] | LangHooks;
}

export type Facts = Record<string, Fact>;

/**
 * A map's facts, or an empty set if it has none. Deliberately never throws:
 * the fact box is an extra, and a map whose facts.json is missing or
 * unreadable must still be playable.
 */
export async function fetchFacts(mapId: string): Promise<Facts> {
	try {
		const res = await fetch(asset(`/maps/${mapId}/facts.json`));
		if (!res.ok) return {};
		return (await res.json()) as Facts;
	} catch {
		return {};
	}
}

// The position table and the name-joiner that used to live here went with
// the clauses they served (FT-45): nothing says where a place is, or lists
// its neighbours, any more. Their i18n keys are still in the dictionary, so
// bringing a clause back is a small edit rather than a retranslation.

/** A number the way the player's own language writes it. */
export function formatCount(value: number, language = getLanguage()): string {
	return value.toLocaleString(language);
}

/** The name of a place in the player's language, where the data has one. */
function localName(
	place: { name: string; nameDe?: string; nameIt?: string },
	language = getLanguage()
): string {
	if (language === 'de' && place.nameDe) return place.nameDe;
	if (language === 'it' && place.nameIt) return place.nameIt;
	return place.name;
}

/**
 * The little that is left of the derived line (FT-45).
 *
 * This used to compose a whole sentence from everything build-facts.ts
 * knows - where the place is, whether it has a coast, what range crosses
 * it, its highest point, its neighbours, its population and its growth
 * since 1950 - in that order, on the argument that position fixes a place
 * in the mind before numbers do.
 *
 * The product owner's verdict after using it (2026-09-19): "the descriptions
 * like 'in the south of the country, no coast' are useless and distracting.
 * They should be dropped... we can just keep the info about the Biggest
 * City", and for a town, "you can keep the mention about the region and 3
 * biggest town, but come on, I can see myself if it is on the north or on
 * the south."
 *
 * That last clause is the principle for the whole cut: the map already
 * shows you where a place is. A sentence that says it again is words in
 * front of the thing they describe. What survives is what the map does
 * NOT show - which region a town belongs to, how big it is against the
 * others, which city is a region's largest:
 *
 *   region -> its biggest city
 *   town   -> the region it is in, and its rank by population
 *
 * The rest of the pipeline is untouched: build-facts.ts still writes every
 * field and facts.json still carries them. Bringing a clause back is one
 * line here and nothing has to be rebuilt. What the unused fields cost in
 * shipped bytes is recorded in MAPS.md.
 */
export function factClauses(fact: Fact | undefined): string[] {
	if (!fact) return [];
	const clauses: string[] = [];
	const add = (key: TranslationKey, params?: Record<string, string | number>) =>
		clauses.push(t(key, params));

	if (fact.kind === 'city') {
		if (fact.region) add('fact.cityIn', { region: fact.region });
		if (fact.populationRank) add('fact.cityRank', { rank: fact.populationRank });
		return clauses;
	}

	if (fact.largestCity) {
		add('fact.largestCity', {
			name: localName(fact.largestCity),
			population: formatCount(fact.largestCity.population)
		});
	}
	return clauses;
}

// --- The rotating name-fact (FT-36) ----------------------------------------
//
// A place with several name-facts shows a different one each time you meet
// it, rather than the same one forever: seeing one, then another, then the
// first again across sessions is what makes more than one of them stick.
//
// Which one you are due is kept per device in localStorage, like the
// language and the favourites (mapPrefs.svelte.ts) - it is a convenience of
// this device, not progress, so it is not in the ProgressRepository. Every
// access is guarded: a private window can throw, and a fact box that throws
// would take the map down with it.

const ROTATION_KEY = 'geoclick:fact-rotation:v1';

function readRotation(): Record<string, number> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(ROTATION_KEY);
		const value: unknown = raw ? JSON.parse(raw) : {};
		return value && typeof value === 'object' ? (value as Record<string, number>) : {};
	} catch {
		return {};
	}
}

/** Which of `hooks` to show now, and the index to remember for next time. */
export function pickHook(
	hooks: string[] | undefined,
	seen: number
): { hook: string; next: number } | undefined {
	if (!hooks || hooks.length === 0) return undefined;
	// localStorage is editable by anyone with a console, and NaN % n is NaN -
	// which would index past the end and blank the line rather than throw.
	const count = Number.isFinite(seen) ? Math.trunc(seen) : 0;
	const index = ((count % hooks.length) + hooks.length) % hooks.length;
	return { hook: hooks[index], next: index + 1 };
}

/**
 * The name-facts to show in `language` (FT-49).
 *
 * A plain array is English, which is what every country not yet translated
 * stores. For a per-language object the languages fall back PER SENTENCE: a
 * place with two Italian sentences and three English ones shows the two
 * Italian ones and the English third, so a half-finished country is partly
 * English, never broken (docs/PLAN_V0.10.md).
 */
export function hooksInLanguage(
	hooks: Fact['hooks'],
	language: Language = getLanguage()
): string[] {
	if (!hooks) return [];
	if (Array.isArray(hooks)) return hooks;
	const english = hooks.en ?? [];
	const translated = hooks[language] ?? [];
	const length = Math.max(english.length, translated.length);
	const sentences: string[] = [];
	for (let i = 0; i < length; i++) {
		const sentence = translated[i] ?? english[i];
		if (sentence) sentences.push(sentence);
	}
	return sentences;
}

/** What the card shows for a place: a pinned origin and a rotating extra. */
export interface PlaceFacts {
	/** Where the name comes from. Always the same sentence, never rotates. */
	origin?: string;
	/** One of the others, a different one each time. Undefined if there is
	 *  only the origin. */
	extra?: string;
}

/**
 * The name-facts for a place: the origin pinned, one of the rest rotating.
 *
 * The FIRST entry in an authored list is always about the NAME - that is the
 * rule every file in data/facts/ is written to - and it is the half that
 * does the work, so it is shown every time. Rotating it away, which is what
 * this used to do, meant two visits in three had no etymology on the card
 * at all (FT-47).
 *
 * Returns nothing at all when nobody has written a fact for the place.
 */
export function placeFacts(mapId: string, targetId: string, fact: Fact | undefined): PlaceFacts {
	const hooks = hooksInLanguage(fact?.hooks);
	if (hooks.length === 0) return {};
	const origin = hooks[0];
	// Only the ones after the origin rotate, so the rotation counter is over
	// a shorter list than it used to be. An old stored count is harmless -
	// pickHook wraps it.
	const rest = hooks.slice(1);
	if (rest.length === 0) return { origin };
	return { origin, extra: rotateHook(mapId, targetId, rest) };
}

/**
 * The next fact from a place's list, advancing its rotation. Returns
 * undefined when the list is empty.
 */
export function rotateHook(mapId: string, targetId: string, hooks: string[]) {
	const key = `${mapId}/${targetId}`;
	const rotation = readRotation();
	const picked = pickHook(hooks, rotation[key] ?? 0);
	if (!picked) return undefined;
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem(ROTATION_KEY, JSON.stringify({ ...rotation, [key]: picked.next }));
		} catch {
			// Full or blocked storage: the rotation restarts next time, which
			// is a worse experience than intended and not a broken one.
		}
	}
	return picked.hook;
}
