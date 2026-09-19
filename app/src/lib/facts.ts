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
import { getLanguage, t, type TranslationKey } from './i18n.svelte';

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
	/** The authored sentence, where one has been written (FT-36). */
	hook?: string;
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

const POSITION_KEYS: Record<CompassPosition, TranslationKey> = {
	north: 'fact.position.north',
	south: 'fact.position.south',
	east: 'fact.position.east',
	west: 'fact.position.west',
	'north-east': 'fact.position.northEast',
	'north-west': 'fact.position.northWest',
	'south-east': 'fact.position.southEast',
	'south-west': 'fact.position.southWest',
	centre: 'fact.position.centre'
};

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
 * Joins names the way the language does: "a, b and c" / "a, b und c" /
 * "a, b e c". Only the final conjunction differs, so it is one key.
 */
function joinNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} ${t('fact.and')} ${names[names.length - 1]}`;
}

/**
 * The fact as an ordered list of short clauses, most useful first.
 *
 * The order is the argument of the whole feature: what fixes a place in the
 * mind is first where it is, then what it is against - the sea, a range -
 * and only then the numbers. The authored hook, when there is one, goes
 * first of all: it is the thing a person chose to say about this place.
 */
export function factClauses(fact: Fact | undefined): string[] {
	if (!fact) return [];
	const clauses: string[] = [];
	const add = (key: TranslationKey, params?: Record<string, string | number>) =>
		clauses.push(t(key, params));

	if (fact.hook) clauses.push(fact.hook);
	if (fact.capitalOf === 'country') add('fact.capital');
	if (fact.position) add(POSITION_KEYS[fact.position]);
	if (fact.region) add('fact.cityIn', { region: fact.region });

	if (fact.coastal === true) add('fact.coastal');
	else if (fact.coastal === false && fact.kind === 'region') add('fact.landlocked');

	if (fact.terrain?.length) add('fact.terrain', { name: fact.terrain[0] });
	if (fact.peak) {
		add('fact.peak', {
			name: fact.peak.name,
			elevation: formatCount(fact.peak.elevation)
		});
	}
	if (fact.largestCity) {
		add('fact.largestCity', {
			name: localName(fact.largestCity),
			population: formatCount(fact.largestCity.population)
		});
	}
	if (fact.populationRank) add('fact.cityRank', { rank: fact.populationRank });
	if (fact.population) {
		// Growth says more than a bare count, so it wins when both are known -
		// "300 000 in 1950, 3 million now" is a fact about a place, where
		// "3 million" is a fact about a number.
		if (fact.population1950 && fact.population1950 * 1.5 < fact.population) {
			add('fact.grew', {
				before: formatCount(fact.population1950),
				after: formatCount(fact.population)
			});
		} else {
			add('fact.population', { population: formatCount(fact.population) });
		}
	}
	if (fact.borders?.length) add('fact.borders', { names: joinNames(fact.borders) });

	return clauses;
}
