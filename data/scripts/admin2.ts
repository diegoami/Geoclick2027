// Admin-2 maps from outside Natural Earth (#39, batch D): the pure parts.
//
// Natural Earth stops at admin-1 for Germany, Poland and the Netherlands, so
// their districts and municipalities come from geoBoundaries, which
// republishes each country's official boundaries under that country's
// licence (DECISIONS.md, "Admin-2 from geoBoundaries"). Its names are the
// national source's, formatted for a register rather than a map. Tested
// from app/src/lib/admin2.test.ts.

/**
 * A German district as a player would name it. geoBoundaries carries the
 * BKG register form: "Stuttgart, Stadtkreis", "Heilbronn, Landkreis",
 * "München, Kreisfreie Stadt". A city that is its own district is the
 * city; a Landkreis that shares a city's name is "Landkreis Heilbronn",
 * the form Germans use and the one that keeps it apart from the city.
 * Every other Landkreis keeps its own name (Rems-Murr-Kreis, Ostalbkreis).
 */
export function germanDistrictName(raw: string): string {
	const trimmed = raw.trim();
	const spelled = (name: string) => SPELLED_OUT[name] ?? name;
	const city = /^(.+), (?:Stadtkreis|Kreisfreie Stadt|Stadt)$/.exec(trimmed);
	if (city) return spelled(city[1]);
	const district = /^(.+), Landkreis$/.exec(trimmed);
	if (district) return `Landkreis ${spelled(district[1])}`;
	// "Friesland (DE)" is disambiguated against the Dutch province in the
	// register; on a map of Germany it needs no qualifier.
	const qualified = /^(.+) \(DE\)$/.exec(trimmed);
	if (qualified) return qualified[1];
	return spelled(trimmed);
}

/**
 * The register's abbreviations, spelled out as the towns maps spell the
 * towns (Wikidata's labels): a player knows Neumarkt in der Oberpfalz, not
 * Neumarkt i.d. OPf.
 */
const SPELLED_OUT: Record<string, string> = {
	'Mühldorf a. Inn': 'Mühldorf am Inn',
	'Pfaffenhofen a.d. Ilm': 'Pfaffenhofen an der Ilm',
	'Neumarkt i.d. OPf.': 'Neumarkt in der Oberpfalz',
	'Neustadt a.d. Waldnaab': 'Neustadt an der Waldnaab',
	'Wunsiedel i. Fichtelgebirge': 'Wunsiedel im Fichtelgebirge',
	'Neustadt a.d. Aisch-Bad Windsheim': 'Neustadt an der Aisch-Bad Windsheim',
	'Dillingen a.d. Donau': 'Dillingen an der Donau',
	'Weiden i.d. Opf': 'Weiden in der Oberpfalz'
};

/** The name cleaners a --clean-names flag can pick. */
export const NAME_CLEANERS: Record<string, (raw: string) => string> = {
	'german-districts': germanDistrictName
};
