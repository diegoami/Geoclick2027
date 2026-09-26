// Maps that span several countries (#39): countries on a continent, and the
// towns of a part of Europe.
//
// The pure decisions live here, away from the builders' ogr2ogr/tippecanoe
// plumbing, so app/src/lib/multiCountry.test.ts can check them without a
// toolchain - the same split as placeSelection.ts.

type Position = [number, number];
type Ring = Position[];
interface PolygonLike {
	type: string;
	coordinates: unknown;
}

const EARTH_RADIUS_KM = 6371.0088;
const RAD = Math.PI / 180;

/**
 * A ring's area on the sphere, in km², unsigned. The spherical-excess
 * formula d3-geo and Turf use; for a country-sized shape its error against
 * the ellipsoid is well under one percent, far finer than the one decision
 * it feeds (is this country too small to drop a slip on).
 */
function ringAreaKm2(ring: Ring): number {
	let total = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const [lon1, lat1] = ring[i];
		const [lon2, lat2] = ring[i + 1];
		total += (lon2 - lon1) * RAD * (2 + Math.sin(lat1 * RAD) + Math.sin(lat2 * RAD));
	}
	return Math.abs((total * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
}

/** A Polygon's or MultiPolygon's area in km², holes subtracted. */
export function polygonAreaKm2(geometry: PolygonLike): number {
	const polygons =
		geometry.type === 'Polygon'
			? [geometry.coordinates as Ring[]]
			: geometry.type === 'MultiPolygon'
				? (geometry.coordinates as Ring[][])
				: [];
	let area = 0;
	for (const [outer, ...holes] of polygons) {
		area += ringAreaKm2(outer);
		for (const hole of holes) area -= ringAreaKm2(hole);
	}
	return area;
}

/**
 * The admin-0 TYPEs a Countries map draws (#39, Q4): sovereign states
 * ('Sovereignty' is how Natural Earth types Cuba and Kazakhstan, and nothing
 * else), the constituent countries it files separately (France, the
 * Netherlands, the United Kingdom...), and disputed or indeterminate
 * territories that it draws as a polygon of their own (Kosovo, Palestine,
 * Western Sahara). Dependencies and leases are left out; so, by name, are
 * the territories in NOT_COUNTRIES that its TYPE does not catch.
 */
export const COUNTRY_TYPES = [
	'Sovereign country',
	'Sovereignty',
	'Country',
	'Disputed',
	'Indeterminate'
];

/**
 * Not countries on a quiz, though Natural Earth's TYPE would let them in:
 * the Crown dependencies and the autonomous Åland and Greenland (typed
 * 'Country'), and three British overseas territories typed 'Disputed'
 * because another state claims them. A dependency is a dependency whoever
 * disputes it.
 */
export const NOT_COUNTRIES = [
	'Jersey',
	'Guernsey',
	'Isle of Man',
	'Aland',
	'Greenland',
	'Gibraltar',
	'Falkland Islands',
	'British Indian Ocean Territory'
];

/**
 * Where NAME_EN is not the name to ask for. The builder keeps the old name
 * as an alias.
 *
 * Four are the short name the country itself now asks for - the same
 * "current official name" rule as Kyiv and Odesa: Czechia (registered with
 * the UN in 2016), Côte d'Ivoire (which asks not to be translated), Cabo
 * Verde (2013), Timor-Leste (its constitutional name). Three are formal
 * names where every atlas uses the short one. Turkey stays Turkey, as on
 * its own map and in the catalog.
 */
export const COUNTRY_NAME_FIXUPS: Record<string, string> = {
	'Czech Republic': 'Czechia',
	'Ivory Coast': "Côte d'Ivoire",
	'Cape Verde': 'Cabo Verde',
	'East Timor': 'Timor-Leste',
	"People's Republic of China": 'China',
	'United States of America': 'United States',
	'Turkish Republic of Northern Cyprus': 'Northern Cyprus'
};

/** The languages a place's name is shown in (#71), as the app's own. */
export type NameLanguage = 'en' | 'it' | 'de';

/**
 * A country's name in Italian and German where Natural Earth's NAME_IT or
 * NAME_DE is not the one to show (#71), keyed by the English name the map
 * uses. The rule is English's (COUNTRY_NAME_FIXUPS): the short current name,
 * and the name a country asks for where it asks for one in every language,
 * as Côte d'Ivoire and Cabo Verde do.
 */
export const COUNTRY_NAME_FIXUPS_BY_LANGUAGE: Record<'it' | 'de', Record<string, string>> = {
	it: {
		Czechia: 'Cechia',
		"Côte d'Ivoire": "Côte d'Ivoire",
		'Cabo Verde': 'Cabo Verde',
		'Timor-Leste': 'Timor-Leste',
		'United States': 'Stati Uniti',
		Myanmar: 'Myanmar',
		Eswatini: 'Eswatini'
	},
	de: {
		"Côte d'Ivoire": "Côte d'Ivoire",
		'Cabo Verde': 'Cabo Verde',
		'Timor-Leste': 'Timor-Leste',
		China: 'China',
		Taiwan: 'Taiwan',
		Cyprus: 'Zypern',
		'Northern Cyprus': 'Nordzypern'
	}
};

/**
 * A target's names in other languages (#71): each language's name, where
 * there is one and it differs from `name`. Empty when there is nothing to
 * add, so the builders write no `names` at all for such a target.
 */
export function otherNames(
	name: string,
	candidates: Partial<Record<NameLanguage, string | null | undefined>>
): Partial<Record<NameLanguage, string>> {
	const names: Partial<Record<NameLanguage, string>> = {};
	for (const language of ['en', 'it', 'de'] as const) {
		const value = candidates[language]?.trim();
		if (value && value !== name) names[language] = value;
	}
	return names;
}

/**
 * A town's names in other languages that Natural Earth has but that are not
 * shown (#71), by the town's name: the town keeps its own name in those
 * languages instead. Found reading all 455 towns on the continent maps:
 * - an old or wrong name (Nur-Sultan for Astana, Melekeok for Ngerulmud);
 * - an English form the map's own rule turned away (Odessa for Odesa; the
 *   Russian forms of Belarusian towns, Vitebsk for Vitsyebsk);
 * - an Italian scholarly transliteration no one writes (Nižnij Novgorod,
 *   Donec'k), where the English form reads as well; German's own forms
 *   (Charkiw, Saporischschja) are the ones German uses, and stay;
 * - a spelling that differs only in punctuation or form (Port of Spain,
 *   Città di San Marino).
 */
export const TOWN_NAMES_NOT_SHOWN: Record<string, NameLanguage[]> = {
	Astana: ['en', 'it', 'de'],
	Ngerulmud: ['en', 'it', 'de'],
	Tarawa: ['en', 'it', 'de'],
	'Port-of-Spain': ['en', 'it', 'de'],
	Odesa: ['en'],
	'Washington, D.C.': ['en'],
	Panevėžys: ['en'],
	Hrodna: ['en'],
	Vitsyebsk: ['en', 'it'],
	Mahilyow: ['en', 'it'],
	Homyel: ['en', 'it'],
	Peja: ['en', 'it'],
	'San Sebastián': ['en', 'de'],
	"Saint George's": ['en', 'de'],
	"N'Djamena": ['it', 'de'],
	Hargeisa: ['it', 'de'],
	"Saint John's": ['de'],
	Timișoara: ['de'],
	Larissa: ['de'],
	'San Marino': ['it'],
	Monaco: ['it'],
	Sanaa: ['it'],
	Bishkek: ['it'],
	Dushanbe: ['it'],
	Ashgabat: ['it'],
	Perm: ['it'],
	'Nizhny Novgorod': ['it'],
	Kazan: ['it'],
	Orsha: ['it'],
	Barysaw: ['it'],
	Baranavichy: ['it'],
	Babruysk: ['it'],
	Brest: ['it'],
	Voronezh: ['it'],
	Kharkiv: ['it'],
	Khmelnytskyi: ['it'],
	Luhansk: ['it'],
	Donetsk: ['it'],
	'Kryvyi Rih': ['it'],
	Zaporizhzhia: ['it'],
	Mariupol: ['it'],
	Mykolaiv: ['it']
};

/** A town's names in English, Italian and German, less those not shown. */
export function townNames(
	name: string,
	candidates: Partial<Record<NameLanguage, string | null | undefined>>
): Partial<Record<NameLanguage, string>> {
	const notShown = TOWN_NAMES_NOT_SHOWN[name] ?? [];
	const kept = Object.fromEntries(
		Object.entries(candidates).filter(([language]) => !notShown.includes(language as NameLanguage))
	);
	return otherNames(name, kept);
}

/** A country's Italian and German names, with the fixups applied. */
export function countryNames(
	name: string,
	nameIt: string | null | undefined,
	nameDe: string | null | undefined
): Partial<Record<NameLanguage, string>> {
	return otherNames(name, {
		it: COUNTRY_NAME_FIXUPS_BY_LANGUAGE.it[name] ?? nameIt,
		de: COUNTRY_NAME_FIXUPS_BY_LANGUAGE.de[name] ?? nameDe
	});
}

/**
 * Which populated-places name field to read for each country on a map of
 * several, so a city is called the same thing it is on that country's own
 * Towns map (the --name-field MAPS.md records for each). Countries not
 * listed use NAME - Natural Earth's plain field, which is Latin-script
 * everywhere, so Cyrillic and Greek names come out transliterated.
 */
export const LOCAL_NAME_FIELD: Record<string, string> = {
	Italy: 'NAME_IT',
	Germany: 'NAME_DE',
	Austria: 'NAME_DE',
	// Not Belgium or Switzerland: one field would put Antwerpen in French or
	// Genève in German. Their NAME is each city's own.
	France: 'NAME_FR',
	Spain: 'NAME_ES',
	Portugal: 'NAME_PT',
	Poland: 'NAME_PL',
	Netherlands: 'NAME_NL',
	Hungary: 'NAME_HU',
	Sweden: 'NAME_SV',
	Turkey: 'NAME_TR',
	Vietnam: 'NAME_VI',
	Colombia: 'NAME_ES',
	'United Kingdom': 'NAME_EN',
	Ukraine: 'NAME_EN',
	Russia: 'NAME_EN'
};

/** Every field LOCAL_NAME_FIELD can pick, plus NAME, for ogr2ogr's -select. */
export const ALL_NAME_FIELDS = [...new Set(['NAME', ...Object.values(LOCAL_NAME_FIELD)])];

/** The populated-places fields that name a town in each language (#71). */
export const LANGUAGE_NAME_FIELDS = ['NAME_EN', 'NAME_IT', 'NAME_DE'];

/** The name field for one place on a multi-country map. */
export function localNameField(country: string): string {
	return LOCAL_NAME_FIELD[country] ?? 'NAME';
}

/**
 * Keeps at most `max` items per country, in the order given. Given places
 * sorted by population, this stops one large country filling a map of
 * several - European Russia alone has more cities over 100 000 than the
 * rest of Eastern Europe together.
 */
export function capPerCountry<T>(items: T[], countryOf: (item: T) => string, max: number): T[] {
	if (!Number.isFinite(max)) return items;
	const counts = new Map<string, number>();
	return items.filter((item) => {
		const country = countryOf(item);
		const seen = counts.get(country) ?? 0;
		if (seen >= max) return false;
		counts.set(country, seen + 1);
		return true;
	});
}

/** A comma-separated flag value as a list; empty for an absent flag. */
export function parseList(value: string | undefined): string[] {
	return value
		? value
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
		: [];
}

/** An OGR SQL string literal, with any quote in the value doubled. */
export function sqlString(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

/** `field IN ('a','b')`, quoted safely. */
export function sqlIn(field: string, values: string[]): string {
	return `${field} IN (${values.map(sqlString).join(',')})`;
}
