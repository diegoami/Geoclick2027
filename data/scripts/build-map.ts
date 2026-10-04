// Builds one demo map package from the Natural Earth admin-1 dataset:
// filters by country, simplifies geometry, builds a PMTiles tileset, and
// derives a draft map.json (Target[] + a default north-to-south tour
// order) for manual curation afterward.
//
// Usage:
//   npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-regions --type=region --name="Italy — Regions"
//
// With --level=country the targets are whole countries from the admin-0
// layer instead (#39), chosen by --continent, --subregion or --countries,
// and --country names the map's group ("Europe"):
//   npx tsx data/scripts/build-map.ts --level=country --country="Europe" --continent=Europe --clip=-25,34,60,72 --min-area=2500 --out=data/maps/europe-countries --name="Europe — Countries"

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
	REPO_ROOT,
	ADMIN0_SHP,
	LAKES_SHP,
	PHYSICAL_SHPS,
	missingSources,
	parseArgs,
	slugify,
	overallBboxOf,
	selectNearbyLakes,
	selectPhysical,
	physicalPaths,
	buildTerrainTileset,
	cleanupPhysical,
	padBbox,
	pmtilesConvert,
	crossesAntimeridian,
	selectAdmin0Context,
	boundsOf,
	reassignAdmin1,
	COUNTRY_FIELDS
} from './mapBuildUtils.js';
import { colorizeMapDir } from './mapColors.js';
import { spineMapDir } from './mapSpines.js';
import { isUnbounded, parseBounds, withinBounds } from './placeSelection.js';
import { NAME_CLEANERS, polishCountyLabel } from './admin2.js';
import { interiorPoint, pointInPolygon, type AnyGeometry } from './factGeometry.js';
import {
	COUNTRY_TYPES,
	COUNTRY_NAME_FIXUPS,
	NOT_COUNTRIES,
	countryNames,
	type NameLanguage,
	parseList,
	polygonAreaKm2,
	sqlIn,
	sqlString
} from './multiCountry.js';

const SOURCE_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_admin_1_states_provinces/ne_10m_admin_1_states_provinces.shp'
);
// ...plus `alias`, which the builder adds for a renamed country.
const BASE_FIELDS = [
	'name',
	'name_alt',
	'name_local',
	'iso_3166_2',
	'type',
	'type_en',
	'admin',
	'region',
	'geonunit'
];

// Natural Earth sometimes gives an English/French/German name where the
// country's own language is expected (regions: Apulia/Sicily; provinces:
// Aoste/Bozen/Turin), and sometimes just has a typo (Crotene/Oristrano
// aren't real Italian province names) - both fixed here so map.json, the
// polygon layer, and the label layer all agree. Audited against every one
// of the 110 raw province records directly, not spot-checked, when the
// italy-provinces map was added (see MAPS.md).
const NAME_FIXUPS: Record<string, Record<string, string>> = {
	// Three Vietnamese provinces carry the name of the macro-region they sit
	// in instead of their own (FT-30). Each was identified from the polygon
	// itself, not guessed: "Vùng Đông Bắc" (105.5-106.3 E, 21.8-22.7 N)
	// contains the town of Bắc Kạn, which the populated-places file also files
	// under ADM1NAME "Đông Bắc"; "Đông Nam Bộ" contains Biên Hòa, the capital
	// of Đồng Nai; and "Đồng Bằng Sông Hồng" is the small polygon between
	// them at 106.0 E, 20.8 N, which is Hưng Yên - the one province of the
	// three with no city over 100 000, matching its absence from the towns
	// map.
	Vietnam: {
		'Vùng Đông Bắc': 'Bắc Kạn',
		'Đông Nam Bộ': 'Đồng Nai',
		'Đồng Bằng Sông Hồng': 'Hưng Yên'
	},
	// Nigeria's state is spelled Nasarawa; the source doubles the s.
	Nigeria: { Nassarawa: 'Nasarawa' },
	// name_tr writes the circumflex that Turkish dropped from this one:
	// the province is Elazığ (its own governorate spells it that way), while
	// Hakkâri, also in this list, does keep its circumflex.
	Turkey: { Elâzığ: 'Elazığ' },
	// Every other Colombian department comes through with its accents; only
	// the capital district loses one.
	Colombia: { Bogota: 'Bogotá' },
	Italy: {
		Apulia: 'Puglia',
		Sicily: 'Sicilia',
		Aoste: 'Aosta',
		Bozen: 'Bolzano',
		Turin: 'Torino',
		Crotene: 'Crotone',
		Oristrano: 'Oristano'
	},
	// Spain's post-dissolve `region` values are mostly clean Spanish already
	// (Cataluña, Andalucía, ...) except two names missing the noun their
	// adjective describes (Canary Is./Ceuta/Melilla are excluded outright,
	// not fixed up - see --exclude in MAPS.md).
	Spain: {
		'Foral de Navarra': 'Navarra',
		// Kept as the full "Comunidad Valenciana", not just "Valencia" -
		// unlike Navarra (a single-province region, no ambiguity), the
		// Valencian Community contains a same-named Valencia *province*, so
		// dropping the qualifier would collide with a possible future
		// finer-level map the way it wouldn't for Navarra.
		Valenciana: 'Comunidad Valenciana',
		// The provinces (#39, batch D): the source has the Castilian exonyms
		// where each province's only official name has been its own
		// language's since the 1980s-90s - the rule Ourense already follows
		// on spain-towns-100k. Castellón, Alicante and Valencia are
		// co-official in both languages and keep the Castilian.
		Lérida: 'Lleida',
		Gerona: 'Girona',
		Orense: 'Ourense',
		'La Coruña': 'A Coruña',
		Baleares: 'Illes Balears'
	},
	// Two typos among the 101 departments (#39, batch D).
	France: { 'Haute-Rhin': 'Haut-Rhin', 'Seien-et-Marne': 'Seine-et-Marne' },
	// Romania's counties come without their diacritics, in every name field
	// the source has; restored from each county's own official name.
	Romania: {
		Timis: 'Timiș',
		Mehedinti: 'Mehedinți',
		Calarasi: 'Călărași',
		Constanta: 'Constanța',
		'Caras-Severin': 'Caraș-Severin',
		Botosani: 'Botoșani',
		Iasi: 'Iași',
		Galati: 'Galați',
		Maramures: 'Maramureș',
		'Bistrita-Nasaud': 'Bistrița-Năsăud',
		Salaj: 'Sălaj',
		Dâmbovita: 'Dâmbovița',
		Arges: 'Argeș',
		Buzau: 'Buzău',
		Brasov: 'Brașov',
		Mures: 'Mureș',
		Neamt: 'Neamț',
		Bacau: 'Bacău',
		Braila: 'Brăila',
		Ialomita: 'Ialomița'
	},
	// Two cantons in English or in full, where every other one has the name
	// it uses itself (Genève, Graubünden, Ticino).
	Switzerland: { Lucerne: 'Luzern', 'Sankt Gallen': 'St. Gallen' },
	// Belgium's provinces in their own language, Dutch or French; Brussels,
	// officially both, keeps the English name every player knows it by.
	Belgium: {
		'West Flanders': 'West-Vlaanderen',
		'East Flanders': 'Oost-Vlaanderen',
		Antwerp: 'Antwerpen',
		'Flemish Brabant': 'Vlaams-Brabant',
		'Walloon Brabant': 'Brabant wallon',
		Liege: 'Liège'
	},
	// The other thirteen Czech regions already come in Czech, as the
	// adjective alone ("Jihomoravský"), the way Poland's voivodeships are.
	'Czech Republic': { Prague: 'Praha' },
	// Croatia's `name` field drops most diacritics and calls Požega-Slavonia
	// "Brodsko-Posavska", its neighbour's name; `name_en` is right but gives
	// the city of Zagreb and Zagreb County the same name. So the map builds
	// with --name-field=adm1_code and every county is named here, in
	// Croatian, as the adjective the way the Czech regions are.
	Croatia: {
		'HRV-1609': 'Međimurska',
		'HRV-1606': 'Virovitičko-podravska',
		'HRV-1608': 'Koprivničko-križevačka',
		'HRV-1603': 'Osječko-baranjska',
		'HRV-1592': 'Istarska',
		'HRV-1490': 'Dubrovačko-neretvanska',
		'HRV-1587': 'Sisačko-moslavačka',
		'HRV-1602': 'Brodsko-posavska',
		'HRV-1604': 'Požeško-slavonska',
		'HRV-1583': 'Karlovačka',
		'HRV-1493': 'Zadarska',
		'HRV-1605': 'Vukovarsko-srijemska',
		'HRV-1492': 'Splitsko-dalmatinska',
		'HRV-1610': 'Varaždinska',
		'HRV-1582': 'Krapinsko-zagorska',
		'HRV-1588': 'Zagrebačka',
		'HRV-1589': 'Grad Zagreb',
		'HRV-1586': 'Primorsko-goranska',
		'HRV-1491': 'Šibensko-kninska',
		'HRV-1584': 'Ličko-senjska',
		'HRV-1607': 'Bjelovarsko-bilogorska'
	},
	// A Greek or Bulgarian name is written in English, as Russia's and
	// Ukraine's are: `name` has Greek transliterated three different ways.
	// Mount Athos, self-governing and in no region, stays a target.
	Greece: {
		'Dytiki Makedonia': 'Western Macedonia',
		Ipeiros: 'Epirus',
		'Kentriki Makedonia': 'Central Macedonia',
		'Anatoliki Makedonia kai Thraki': 'Eastern Macedonia and Thrace',
		'Ayion Oros': 'Mount Athos',
		Thessalia: 'Thessaly',
		'Stereá Elláda': 'Central Greece',
		Attiki: 'Attica',
		Peloponnisos: 'Peloponnese',
		'Dytiki Ellada': 'Western Greece',
		Kriti: 'Crete',
		'Notio Aigaio': 'South Aegean',
		'Voreio Aigaio': 'North Aegean',
		'Ionioi Nisoi': 'Ionian Islands'
	},
	// Sofia is two provinces: the capital's own and the one around it.
	Bulgaria: { 'Grad Sofiya': 'Sofia City', Sofia: 'Sofia Province' },
	// The maps of #163 (v0.17). Kazakhstan, Serbia and the Philippines come
	// from geoBoundaries, whose names carry the register's noun ("Pavlodar
	// Region", "Bor District"): redundant on a map of nothing else, so dropped
	// (#182), except where the bare name is another target's ("Almaty Region"
	// beside the city of Almaty). Serbia's lose their diacritics in the
	// source; New Zealand's four unitary authorities and Venezuela's Vargas,
	// renamed La Guaira in 2019, are the names people use.
	Kazakhstan: {
		'Pavlodar Region': 'Pavlodar',
		'Jambyl Region': 'Jambyl',
		'Kostanay Region': 'Kostanay',
		'Mangystau Region': 'Mangystau',
		'Karaganda Region': 'Karaganda',
		'Kyzylorda Region': 'Kyzylorda',
		'East Kazakhstan Region': 'East Kazakhstan',
		'Aktobe Region': 'Aktobe',
		'Atyrau Region': 'Atyrau',
		'South Kazakhstan Region': 'South Kazakhstan',
		'Akmola Region': 'Akmola',
		'North Kazakhstan Region': 'North Kazakhstan',
		'West Kazakhstan Region': 'West Kazakhstan'
	},
	// Bangladesh's divisions come from geoBoundaries (Natural Earth predates
	// Mymensingh, 2015), which misspells Rajshahi and has the old Chittagong and
	// Barisal for the 2018 spellings Natural Earth's towns use. Malaysia's Penang and Malacca
	// are the English names for Pulau Pinang and Melaka; the official names stay
	// answers the quiz accepts (the alias).
	Bangladesh: { Rajshani: 'Rajshahi', Chittagong: 'Chattogram', Barisal: 'Barishal' },
	Malaysia: { 'Pulau Pinang': 'Penang', Melaka: 'Malacca' },
	Serbia: {
		'Syrmia District': 'Syrmia',
		'South Banat District': 'South Banat',
		'North Banat District': 'North Banat',
		'Central Banat District': 'Central Banat',
		'North Backa District': 'North Bačka',
		'West Backa District': 'West Bačka',
		'South Backa District': 'South Bačka',
		'Bor District': 'Bor',
		'Macva District': 'Mačva',
		'Pcinja District': 'Pčinja',
		'Kolubara District': 'Kolubara',
		'Podunavlje District': 'Podunavlje',
		'Branicevo District': 'Braničevo',
		'Sumadija District': 'Šumadija',
		'Pomoravlje District': 'Pomoravlje',
		'Moravica District': 'Moravica',
		'Zajecar District': 'Zaječar',
		'Zlatibor District': 'Zlatibor',
		'Raska District': 'Raška',
		'Pirot District': 'Pirot',
		'Jablanica District': 'Jablanica',
		'Toplica District': 'Toplica',
		'Nisava District': 'Nišava',
		'Rasina District': 'Rasina'
	},
	Philippines: {
		ARMM: 'BARMM',
		CAR: 'Cordillera',
		NCR: 'Metro Manila',
		Calabarzon: 'CALABARZON',
		Mimaropa: 'MIMAROPA',
		Soccsksargen: 'SOCCSKSARGEN'
	},
	'New Zealand': {
		'Gisborne District': 'Gisborne',
		'Marlborough District': 'Marlborough',
		'Nelson City': 'Nelson',
		'Tasman District': 'Tasman',
		'Manawatu-Wanganui': 'Manawatū-Whanganui'
	},
	Venezuela: { Vargas: 'La Guaira' },
	Denmark: { Sjaælland: 'Sjælland' },
	// Chile's regions by the short names Chileans use; Biobío is the
	// official spelling since 2018.
	Chile: {
		'Región Metropolitana de Santiago': 'Metropolitana de Santiago',
		"Libertador General Bernardo O'Higgins": "O'Higgins",
		'Aisén del General Carlos Ibáñez del Campo': 'Aysén',
		'Magallanes y Antártica Chilena': 'Magallanes',
		'Bío-Bío': 'Biobío'
	},
	// Lima is two: the capital's province and the region around it, which
	// Peruvians call Lima Provincias.
	Peru: { 'Lima Province': 'Lima Metropolitana', Lima: 'Lima Provincias' },
	// Iran's provinces as English writes them.
	Iran: {
		'West Azarbaijan': 'West Azerbaijan',
		'East Azarbaijan': 'East Azerbaijan',
		Ardebil: 'Ardabil',
		Kordestan: 'Kurdistan',
		Esfahan: 'Isfahan',
		'Chahar Mahall and Bakhtiari': 'Chaharmahal and Bakhtiari',
		'Kohgiluyeh and Buyer Ahmad': 'Kohgiluyeh and Boyer-Ahmad'
	},
	Thailand: { 'Bangkok Metropolis': 'Bangkok', Phangnga: 'Phang Nga' },
	// Saudi Arabia's regions as English writes them, not transliterated.
	'Saudi Arabia': {
		'Ash Sharqiyah': 'Eastern Province',
		'Al Hudud ash Shamaliyah': 'Northern Borders',
		'Al Jawf': 'Al-Jawf',
		'`Asir': 'Asir',
		Jizan: 'Jazan',
		'Al Madinah': 'Medina',
		Makkah: 'Mecca',
		'Ar Riyad': 'Riyadh',
		'Al Quassim': 'Qassim',
		'Al Bahah': 'Al-Bahah'
	},
	// Poland's plain `name` field is English-translated ("Silesian", "Lesser
	// Poland" - see --name-field=name_pl below), and `name_pl` itself is the
	// full official form ("województwo śląskie"). Trimmed to the adjective
	// alone, capitalized - how voivodeships are actually referred to in
	// Polish outside formal/legal text (same convention Italy's regions
	// already use: "Toscana", not "Regione Toscana").
	Poland: {
		'województwo śląskie': 'Śląskie',
		'województwo małopolskie': 'Małopolskie',
		'województwo podkarpackie': 'Podkarpackie',
		'województwo dolnośląskie': 'Dolnośląskie',
		'województwo opolskie': 'Opolskie',
		'województwo podlaskie': 'Podlaskie',
		'województwo warmińsko-mazurskie': 'Warmińsko-Mazurskie',
		'województwo lubuskie': 'Lubuskie',
		'województwo zachodniopomorskie': 'Zachodniopomorskie',
		'województwo lubelskie': 'Lubelskie',
		'województwo pomorskie': 'Pomorskie',
		'województwo mazowieckie': 'Mazowieckie',
		'województwo łódzkie': 'Łódzkie',
		'województwo kujawsko-pomorskie': 'Kujawsko-Pomorskie',
		'województwo wielkopolskie': 'Wielkopolskie',
		'województwo świętokrzyskie': 'Świętokrzyskie'
	},
	// Ukraine's plain `name` field mixes real transliterations with dated or
	// English-descriptive forms - fixed to the modern standard Ukrainian-
	// derived transliteration (the same "KyivNotKiev" convention interna-
	// tional style guides adopted after 2018/19), and the soft-sign
	// apostrophes (Donets'k, L'viv, ...) dropped for the common English
	// spelling. Crimea/Sevastopol (merged in via --extra-where, see above)
	// need no fixup - their plain names are already correct.
	Ukraine: {
		Kiev: 'Kyiv Oblast',
		'Kiev City': 'Kyiv',
		"L'viv": 'Lviv',
		"Luhans'k": 'Luhansk',
		"Donets'k": 'Donetsk',
		"Khmel'nyts'kyy": 'Khmelnytskyi',
		"Ternopil'": 'Ternopil',
		"Dnipropetrovs'k": 'Dnipropetrovsk',
		"Ivano-Frankivs'k": 'Ivano-Frankivsk',
		Odessa: 'Odesa',
		Transcarpathia: 'Zakarpattia'
	},
	// Sweden's `name` field is already correct Swedish (Norrbotten,
	// Västerbotten, ...) except one row missing its diacritic entirely -
	// confirmed against `name_sv` ("Örebro län"), not guessed.
	Sweden: {
		Orebro: 'Örebro'
	},
	// Finland's `name` field is inconsistent, not uniformly English or
	// uniformly Finnish - 6 of 18 rows (Kainuu, Kymenlaakso, Uusimaa,
	// Satakunta, Pirkanmaa, Päijät-Häme) are already the correct native
	// Finnish name, the other 12 are English translations. Fixed up to
	// native Finnish throughout (matching every other country's
	// local-name convention, e.g. Sweden/Poland/Ukraine above), using the
	// Finnish segment of `name_alt` (a pipe-separated Finnish|Swedish
	// list, Finland being officially bilingual) rather than a guess - and
	// the modern short form where `name_alt` lists an older formal one
	// first (Lapland's alt list starts "Lapin lääni" but also lists the
	// actual modern name "Lappi").
	Finland: {
		Lapland: 'Lappi',
		'Northern Ostrobothnia': 'Pohjois-Pohjanmaa',
		'North Karelia': 'Pohjois-Karjala',
		'South Karelia': 'Etelä-Karjala',
		'Finland Proper': 'Varsinais-Suomi',
		Ostrobothnia: 'Pohjanmaa',
		'Central Ostrobothnia': 'Keski-Pohjanmaa',
		'Northern Savonia': 'Pohjois-Savo',
		'Southern Savonia': 'Etelä-Savo',
		'Central Finland': 'Keski-Suomi',
		'Southern Ostrobothnia': 'Etelä-Pohjanmaa',
		'Tavastia Proper': 'Kanta-Häme'
	},
	// Russia's raw `name` field mixes three unrelated issues, found by
	// auditing all 86 rows (not spot-checked): one real data corruption
	// ("Maga Buryatdan" - confirmed via iso_3166_2 RU-MAG and name_local
	// "Магаданская область" that this is actually Magadan), one long
	// official title where every other similarly-sized region already
	// uses its short common name (Chukotka, not "Chukchi Autonomous
	// Okrug"), and the same soft-sign-apostrophe transliteration already
	// dropped for Ukraine's fixups above, applied here for the same
	// reason (Astrakhan/Ryazan/Yaroslavl/Tver/Perm/Primorye/Tyumen/
	// Ulyanovsk/Stavropol, not the apostrophed forms). Deliberately not a
	// full pass renaming every republic to its "-ia"-suffixed common
	// form (Chuvashia, Udmurtia, Kalmykia, ...) - those shorter adjectival
	// forms in the source aren't wrong, just less common, a different
	// class of issue from an actual data error or a stray apostrophe.
	Russia: {
		'Maga Buryatdan': 'Magadan',
		'Chukchi Autonomous Okrug': 'Chukotka',
		"Arkhangel'sk": 'Arkhangelsk',
		"Astrakhan'": 'Astrakhan',
		"Ryazan'": 'Ryazan',
		"Yaroslavl'": 'Yaroslavl',
		"Tver'": 'Tver',
		"Perm'": 'Perm',
		"Primor'ye": 'Primorye',
		"Tyumen'": 'Tyumen',
		"Ul'yanovsk": 'Ulyanovsk',
		"Stavropol'": 'Stavropol'
	}
};

type Geometry = { type: string; coordinates: unknown };

// The slice of an ogr2ogr/mapshaper GeoJSON export this script reads. Natural
// Earth's property bag is wide, and which fields it carries depends on the run
// (--name-field, --exclude-field), so fields are looked up by name. Every field
// selected (BASE_FIELDS plus those two) is a string or missing, and `name`
// is always present.
interface AdminFeature {
	type: 'Feature';
	properties: { name: string; [field: string]: string | null | undefined };
	geometry: Geometry;
}
interface AdminCollection {
	type: 'FeatureCollection';
	features: AdminFeature[];
}

/** Every vertex of a geometry, flattened. */
function verticesOf(geometry: Geometry): [number, number][] {
	const out: [number, number][] = [];
	const walk = (coords: unknown): void => {
		if (typeof (coords as number[])[0] === 'number') out.push(coords as [number, number]);
		else for (const c of coords as unknown[]) walk(c);
	};
	walk(geometry.coordinates);
	return out;
}

/** A powiat's label in every language: the same, without "powiat " (#182). */
function polishCountyNames(name: string): Partial<Record<NameLanguage, string>> {
	const label = polishCountyLabel(name);
	return { en: label, it: label, de: label };
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const country = args.country;
	const outDir = args.out;
	// --level=country: whole countries from the admin-0 layer (#39), rather
	// than one country's admin-1 regions. --country is then the map's group,
	// e.g. "Europe", and the countries come from --continent, --subregion or
	// --countries (Natural Earth's ADMIN names).
	const countryLevel = args.level === 'country';
	const continent = args.continent;
	const subregion = args.subregion;
	const countryList = parseList(args.countries);
	// --clip keeps only the part of each shape inside a box
	// ("lonMin,latMin,lonMax,latMax") or a WKT polygon: France without
	// French Guiana, Russia west of the Urals; for admin-1 maps, Chile's
	// Valparaíso without Easter Island. Unlike the --lon/--lat slice,
	// which keeps or drops a whole target by its middle, this cuts shapes.
	const clip = args.clip;
	// --min-area drops a country smaller than this many km² after the clip -
	// Monaco or Malta at a continent's zoom is too small to drop a slip on
	// (#39, Q2). Their capitals stay on the Capitals maps.
	const minArea = Number(args['min-area'] ?? 0);
	// --assign-admin1="Crimea,Sevastopol:Ukraine" moves admin-1 areas from
	// whichever country Natural Earth's admin-0 layer draws them in to the
	// named one. Natural Earth draws Crimea in Russia (de facto control);
	// this project gives it to Ukraine, as ukraine-regions already does
	// (--extra-where above) and as the UN does.
	const assignAdmin1 = args['assign-admin1'];
	// --rename="Fingal=Dublin,Laoighis=Laois" renames features BEFORE the
	// dissolve, so --dissolve=name can then merge pieces into one target:
	// Ireland's 34 councils into its 26 counties (#39, batch D).
	// --source=<geojson> builds from boundaries outside Natural Earth (#39,
	// batch D): geoBoundaries' copy of a national register, for the admin-2
	// levels Natural Earth does not have. Every feature in the file is a
	// candidate; --source-name-field names the field to read (shapeName),
	// --clean-names picks a cleaner from admin2.ts, and --attribution is the
	// credit the source's licence requires, shown in the app's map
	// attribution.
	const source = args.source;
	const sourceNameField = args['source-name-field'] ?? 'shapeName';
	const cleanName = args['clean-names'] ? NAME_CLEANERS[args['clean-names']] : undefined;
	if (args['clean-names'] && !cleanName) {
		console.error(`Unknown --clean-names "${args['clean-names']}".`);
		process.exit(1);
	}
	const attribution = args.attribution
		? `${args.attribution}; Natural Earth (public domain), https://www.naturalearthdata.com`
		: 'Natural Earth (public domain), https://www.naturalearthdata.com';
	// --within=Bayern,Hessen keeps the targets whose interior point lies
	// inside those admin-1 areas of --country, from Natural Earth - a
	// register's districts carry no state, and a slice by state is how
	// they are split into playable maps.
	const within = parseList(args.within);
	// --disambiguate-by=<field> tells apart the targets a source names twice
	// by the admin-1 area each is in: Poland has a powiat brzeski in Opolskie
	// and another in Małopolskie. The field, through the country's
	// NAME_FIXUPS, names the area as the regions map does ("powiat brzeski
	// (Opolskie)" from name_pl, not "(Opole)" from name).
	const areaNameField = args['disambiguate-by'];
	const disambiguate = areaNameField !== undefined;
	const renames = new Map(
		parseList(args.rename).map((pair) => pair.split('=').map((s) => s.trim()) as [string, string])
	);
	const type = args.type ?? (countryLevel ? 'country' : 'region');
	const mapName = args.name ?? `${country} — ${type === 'state' ? 'States' : 'Regions'}`;
	// Some countries' admin-1 features in Natural Earth are finer than the
	// level we want (e.g. Italy's admin-1 is provinces, with regions only
	// available as an attribute). --dissolve=<field> merges same-attribute
	// features into one shape per value before deriving targets.
	const dissolveField = args.dissolve;
	// --exclude=Alaska,Hawaii drops named features by their `name` field
	// (pre-dissolve) — e.g. USA's far-flung Alaska/Hawaii, which are more
	// trouble (antimeridian wraparound, huge dead map space) than they're
	// worth for a demo map. --exclude-field picks a different field to match
	// against (e.g. `geonunit`, to drop every Northern Ireland district by
	// country-within-the-UK rather than needing each district's own name).
	const exclude = args.exclude ? args.exclude.split(',').map((s) => s.trim()) : [];
	const excludeField = args['exclude-field'] ?? 'name';
	// Which field holds the display name (default the plain `name` field,
	// correct as-is for every map built so far). Poland's `name` field is
	// English-translated ("Silesian", "Lesser Poland") - `name_pl` gives the
	// correct Polish, same reasoning as build-points-map.ts's --name-field.
	const nameField = args['name-field'] ?? 'name';
	// An independent extra ogr2ogr filter (no country constraint), merged in
	// alongside the main country filter before dissolve - for features a
	// plain `admin='<country>'` filter can't reach. Added for Ukraine:
	// Natural Earth tags Crimea/Sevastopol under admin='Russia' (reflecting
	// de facto control, not international recognition - most of the world,
	// including the UN, considers them Ukrainian territory under occupation)
	// so they'd otherwise be silently missing from the map. See MAPS.md.
	const extraWhere = args['extra-where'];
	// The same slice flags the city builder has (FT-27), for a country with
	// more regions than one map should ask for: --lon-min/--lon-max and
	// --lat-min/--lat-max keep the targets whose middle is inside the box.
	// Unbounded by default, so every map built before these existed rebuilds
	// identically.
	const bounds = parseBounds(args);

	if (countryLevel && !continent && !subregion && countryList.length === 0) {
		console.error('--level=country needs --continent, --subregion or --countries.');
		process.exit(1);
	}
	if (!country || !outDir) {
		console.error(
			'Usage: build-map.ts --country="Italy" --out=data/maps/italy-regions [--type=region|state] [--name="Italy — Regions"] [--dissolve=region] [--exclude=Alaska,Hawaii] [--exclude-field=name] [--name-field=name] [--extra-where="name IN (\'Crimea\')"] [--lat-min=43.8] [--lon-min=-104 --lon-max=-87]'
		);
		process.exit(1);
	}
	const sourceShp = countryLevel
		? ADMIN0_SHP
		: source
			? path.resolve(REPO_ROOT, source)
			: SOURCE_SHP;
	const missing = missingSources([sourceShp, ADMIN0_SHP, LAKES_SHP, ...PHYSICAL_SHPS]);
	if (missing.length > 0) {
		console.error(
			`Source shapefile(s) not found:\n  ${missing.join('\n  ')}\n` +
				'Run data/scripts/fetch-natural-earth.sh first.'
		);
		process.exit(1);
	}

	const absOutDir = path.resolve(REPO_ROOT, outDir);
	mkdirSync(absOutDir, { recursive: true });

	const filteredPath = path.join(absOutDir, '.tmp-filtered.geojson');
	const simplifiedPath = path.join(absOutDir, '.tmp-simplified.geojson');
	const labelsPath = path.join(absOutDir, '.tmp-labels.geojson');
	const lakesPath = path.join(absOutDir, '.tmp-lakes.geojson');
	const contextPath = path.join(absOutDir, '.tmp-context.geojson');
	const landPath = path.join(absOutDir, '.tmp-land.geojson');
	const physical = physicalPaths(absOutDir);
	const mbtilesPath = path.join(absOutDir, '.tmp-tiles.mbtiles');
	const pmtilesPath = path.join(absOutDir, 'tiles.pmtiles');
	const mapJsonPath = path.join(absOutDir, 'map.json');
	const tourJsonPath = path.join(absOutDir, 'tour.json');

	// Select every base field plus whichever extra ones this run actually
	// needs (name-field/exclude-field default to 'name', already included).
	const fields = Array.from(new Set([...BASE_FIELDS, nameField, excludeField]));
	const clipArgs = clip ? ['-clipsrc', ...(clip.includes('(') ? [clip] : clip.split(','))] : [];

	// A country's names in the other languages, by its name (#71).
	const otherNamesOf = new Map<string, Partial<Record<NameLanguage, string>>>();
	if (countryLevel) {
		console.log(`[1/6] Filtering the countries of "${country}" from Natural Earth admin-0...`);
		const where = [
			sqlIn('TYPE', COUNTRY_TYPES),
			`NOT (${sqlIn('ADMIN', [...NOT_COUNTRIES, ...exclude])})`,
			...(continent ? [`CONTINENT = ${sqlString(continent)}`] : []),
			...(subregion ? [`SUBREGION = ${sqlString(subregion)}`] : []),
			...(countryList.length > 0 ? [sqlIn('ADMIN', countryList)] : [])
		].join(' AND ');
		execFileSync('ogr2ogr', [
			'-f',
			'GeoJSON',
			'-where',
			where,
			...clipArgs,
			'-nlt',
			'MULTIPOLYGON',
			'-select',
			COUNTRY_FIELDS.join(','),
			filteredPath,
			sourceShp
		]);
		// Every later step reads `name`. NAME_EN is the short English name
		// ("Czechia", "Democratic Republic of the Congo"); ADMIN is the
		// fallback for the few rows without one.
		if (assignAdmin1) reassignAdmin1(filteredPath, assignAdmin1, absOutDir);
		const fc: AdminCollection = JSON.parse(readFileSync(filteredPath, 'utf-8'));
		const kept: AdminFeature[] = [];
		for (const feature of fc.features) {
			const p = feature.properties;
			const englishName = (p.NAME_EN || p.ADMIN) as string;
			p.name = COUNTRY_NAME_FIXUPS[englishName] ?? englishName;
			// The name it was renamed from stays a name the quiz accepts.
			if (p.name !== englishName) p.alias = englishName;
			// Its names in Italian and German go to map.json, not the tiles (#71).
			const names = countryNames(p.name, p.NAME_IT, p.NAME_DE);
			if (Object.keys(names).length > 0) otherNamesOf.set(p.name, names);
			delete p.NAME_IT;
			delete p.NAME_DE;
			const area = polygonAreaKm2(feature.geometry);
			if (area < minArea) {
				console.log(`      dropped ${p.name} (${Math.round(area)} km² < ${minArea})`);
				continue;
			}
			kept.push(feature);
		}
		fc.features = kept;
		writeFileSync(filteredPath, JSON.stringify(fc));
	} else if (source) {
		console.log(`[1/6] Reading ${source}...`);
		const fc: AdminCollection = JSON.parse(readFileSync(sourceShp, 'utf-8'));
		fc.features = fc.features
			.map((feature) => {
				const raw = String(feature.properties[sourceNameField] ?? '');
				// Only the name travels on; the register's own ids and codes
				// would only bloat the tiles.
				feature.properties = { name: cleanName ? cleanName(raw) : raw };
				return feature;
			})
			.filter((feature) => !exclude.includes(feature.properties.name));
		writeFileSync(filteredPath, JSON.stringify(fc));
	} else {
		console.log(`[1/6] Filtering "${country}" from Natural Earth admin-1 dataset...`);
		const whereClause =
			`admin='${country}'` +
			(exclude.length
				? ` AND ${excludeField} NOT IN (${exclude.map((n) => `'${n}'`).join(',')})`
				: '');
		execFileSync('ogr2ogr', [
			'-f',
			'GeoJSON',
			'-where',
			whereClause,
			...clipArgs,
			'-select',
			fields.join(','),
			filteredPath,
			SOURCE_SHP
		]);
	}

	if (extraWhere) {
		console.log(`[1b/6] Merging in extra features ("${extraWhere}")...`);
		const extraPath = path.join(absOutDir, '.tmp-extra.geojson');
		execFileSync('ogr2ogr', [
			'-f',
			'GeoJSON',
			'-where',
			extraWhere,
			'-select',
			fields.join(','),
			extraPath,
			SOURCE_SHP
		]);
		const primaryFC: AdminCollection = JSON.parse(readFileSync(filteredPath, 'utf-8'));
		const extraFC: AdminCollection = JSON.parse(readFileSync(extraPath, 'utf-8'));
		primaryFC.features.push(...extraFC.features);
		writeFileSync(filteredPath, JSON.stringify(primaryFC));
		rmSync(extraPath);
	}

	if (renames.size > 0) {
		const fc: AdminCollection = JSON.parse(readFileSync(filteredPath, 'utf-8'));
		for (const feature of fc.features) {
			const renamed = renames.get(feature.properties.name);
			if (renamed) feature.properties.name = renamed;
		}
		writeFileSync(filteredPath, JSON.stringify(fc));
	}

	const mapshaperArgs = [filteredPath];
	if (dissolveField) {
		console.log(`[2/6] Dissolving by "${dissolveField}" and simplifying geometry (mapshaper)...`);
		// Dissolving on name itself (after --rename) needs no rename, and
		// mapshaper would read a bare 'name' as its own name= option.
		if (dissolveField === 'name') mapshaperArgs.push('-dissolve', 'fields=name');
		else mapshaperArgs.push('-dissolve', dissolveField, '-rename-fields', `name=${dissolveField}`);
	} else {
		console.log('[2/6] Simplifying geometry (mapshaper)...');
	}
	mapshaperArgs.push(
		'-simplify',
		'10%',
		'keep-shapes',
		'-clean',
		'-o',
		simplifiedPath,
		'format=geojson',
		'precision=0.0001'
	);
	execFileSync('npx', ['mapshaper', ...mapshaperArgs], { stdio: 'inherit' });

	console.log('[3/6] Fixing up names and deriving draft map.json...');
	const geojson: AdminCollection = JSON.parse(readFileSync(simplifiedPath, 'utf-8'));
	const fixups = NAME_FIXUPS[country] ?? {};
	for (const feature of geojson.features) {
		// --name-field only matters pre-dissolve: dissolving already renames
		// the grouping field to `name` (see mapshaperArgs above), so by this
		// point `name` is already correct for a dissolved map.
		if (nameField !== 'name' && !dissolveField) {
			feature.properties.name = feature.properties[nameField] || feature.properties.name;
		}
		const fixed = fixups[feature.properties.name];
		if (fixed) feature.properties.name = fixed;
	}
	// A slice keeps the regions whose middle is inside the box (FT-29). Done
	// here, before the tiles are written, so the tileset, the lakes and the
	// country context that follow all describe the slice rather than the
	// whole country.
	if (within.length > 0 || disambiguate) {
		// Every admin-1 area of the country, so each target is given exactly
		// one: the area its interior point is in, or - for an island or a
		// stretch of coast that Natural Earth's coarser outline leaves out
		// (the Wadden Islands) - the area with the nearest vertex. Then only
		// the targets given one of --within's areas are kept.
		const areasPath = path.join(absOutDir, '.tmp-within.geojson');
		execFileSync('ogr2ogr', [
			'-f',
			'GeoJSON',
			'-where',
			`admin=${sqlString(country)}`,
			'-select',
			Array.from(new Set(['name', areaNameField ?? 'name'])).join(','),
			areasPath,
			SOURCE_SHP
		]);
		const areas: AdminCollection = JSON.parse(readFileSync(areasPath, 'utf-8'));
		rmSync(areasPath);
		const missing = within.filter(
			(name) => !areas.features.some((a) => a.properties.name === name)
		);
		if (missing.length > 0) {
			console.error(`--within: no admin-1 area "${missing.join('", "')}" in ${country}.`);
			process.exit(1);
		}
		const areaOf = (feature: AdminFeature): string => {
			const point = interiorPoint(feature.geometry as AnyGeometry);
			const inside = areas.features.find((area) =>
				pointInPolygon(point, area.geometry as AnyGeometry)
			);
			if (inside) return inside.properties.name;
			let best = { name: '', distance: Infinity };
			// On the ground, not in degrees: a degree of longitude shrinks with
			// cos(latitude), and counting it as a degree of latitude could pick
			// the next area over for a target far from every outline (#45).
			const lonScale = Math.cos((point[1] * Math.PI) / 180);
			for (const area of areas.features) {
				for (const [lon, lat] of verticesOf(area.geometry)) {
					const distance = ((lon - point[0]) * lonScale) ** 2 + (lat - point[1]) ** 2;
					if (distance < best.distance) best = { name: area.properties.name, distance };
				}
			}
			return best.name;
		};
		const areaOfFeature = new Map(geojson.features.map((f) => [f, areaOf(f)]));
		if (disambiguate) {
			// Across the whole country, before any --within, so a name gets
			// the same suffix on every map it appears on.
			const count = new Map<string, number>();
			for (const f of geojson.features) {
				count.set(f.properties.name, (count.get(f.properties.name) ?? 0) + 1);
			}
			for (const f of geojson.features) {
				if ((count.get(f.properties.name) ?? 0) < 2) continue;
				const area = areas.features.find((a) => a.properties.name === areaOfFeature.get(f))!;
				const label = String(area.properties[areaNameField!] ?? area.properties.name);
				f.properties.name = `${f.properties.name} (${fixups[label] ?? label})`;
			}
			const names = geojson.features.map((f) => f.properties.name);
			const twice = names.filter((n, i) => names.indexOf(n) !== i);
			if (twice.length > 0) {
				console.error(`--disambiguate-by: still named twice in one area: ${twice.join(', ')}`);
				process.exit(1);
			}
		}
		if (within.length > 0) {
			const all = geojson.features.length;
			geojson.features = geojson.features.filter((f) => within.includes(areaOfFeature.get(f)!));
			console.log(`      within ${within.join(', ')} keeps ${geojson.features.length} of ${all}`);
		}
	}
	if (!isUnbounded(bounds)) {
		const all = geojson.features.length;
		geojson.features = geojson.features.filter((feature) => {
			const { center } = boundsOf(feature.geometry);
			return withinBounds([{ lon: center[0], lat: center[1] }], bounds).length === 1;
		});
		console.log(`      slice keeps ${geojson.features.length} of ${all} regions`);
		if (geojson.features.length === 0) {
			console.error('The slice is empty - check --lon-min/--lon-max/--lat-min/--lat-max.');
			process.exit(1);
		}
	}
	writeFileSync(simplifiedPath, JSON.stringify(geojson));

	const targets = geojson.features.map((feature) => {
		const p = feature.properties;
		const { bbox, center } = boundsOf(feature.geometry);
		// Only emitted when true, so maps with no such target come out
		// byte-identical to before this flag existed.
		const wraps = crossesAntimeridian(bbox);
		if (wraps) {
			console.warn(
				`  WARNING: "${p.name}" crosses the antimeridian - bbox west > east ${JSON.stringify(bbox)}; flagged crossesAntimeridian (see MAPS.md)`
			);
		}
		return {
			id: slugify(p.name),
			name: p.name as string,
			type,
			tier: 1,
			aliases: (p.alias ? [p.alias] : []) as string[],
			...(otherNamesOf.has(p.name) ? { names: otherNamesOf.get(p.name) } : {}),
			...(args['clean-names'] === 'polish-counties' && p.name.startsWith('powiat ')
				? { names: polishCountyNames(p.name) }
				: {}),
			centroid: center,
			bbox,
			...(wraps ? { crossesAntimeridian: true } : {})
		};
	});
	targets.sort((a, b) => b.centroid[1] - a.centroid[1]); // north to south, default

	const mapDefinition = {
		id: path.basename(outDir),
		name: mapName,
		country,
		attribution,
		// Boundaries from outside Natural Earth: build-facts.ts then does not
		// match targets to Natural Earth's admin-1 rows, which would describe
		// a district as its whole state.
		...(source ? { boundarySource: source } : {}),
		tiles: 'tiles.pmtiles',
		targets,
		tourOrder: targets.map((t) => t.id)
	};
	writeFileSync(mapJsonPath, JSON.stringify(mapDefinition, null, '\t') + '\n');

	// Draft guided-tour script: default dwell per step, in map.json's
	// already-curated tourOrder (a north-to-south sweep, see Iteration 1).
	// Narration text is left for manual curation later, same as aliases/tiers.
	const DEFAULT_DWELL_MS = 3000;
	const tour = {
		mapId: mapDefinition.id,
		steps: mapDefinition.tourOrder.map((targetId: string) => ({
			targetId,
			dwellMs: DEFAULT_DWELL_MS
		}))
	};
	writeFileSync(tourJsonPath, JSON.stringify(tour, null, '\t') + '\n');

	// A separate point layer, one feature per target at its precomputed
	// centroid, so labels render once per feature. Relying on MapLibre's
	// default polygon-label placement instead causes a duplicate label
	// wherever a region's polygon is split across tile boundaries.
	const labelsGeojson = {
		type: 'FeatureCollection',
		features: targets.map((t) => ({
			type: 'Feature',
			properties: { name: t.name, id: t.id },
			geometry: { type: 'Point', coordinates: t.centroid }
		}))
	};
	writeFileSync(labelsPath, JSON.stringify(labelsGeojson));

	console.log('[4/6] Selecting nearby lakes and terrain for context...');
	selectNearbyLakes(overallBboxOf(targets), lakesPath);
	// Sea, rivers and named terrain (FT-33) - off by default in the app,
	// behind the map bar's Terrain button.
	selectPhysical(padBbox(overallBboxOf(targets)), physical, padBbox(overallBboxOf(targets), 0.05));
	// Countries around a Countries map are non-target context (#39). An
	// admin-1 map instead needs nearby land outside its own country: without
	// that geometry the sea background reads as water around landlocked maps.
	if (countryLevel) {
		const targetAdmins = geojson.features.map((f) => f.properties.ADMIN as string);
		selectAdmin0Context(padBbox(overallBboxOf(targets)), contextPath, targetAdmins);
	} else {
		selectAdmin0Context(padBbox(overallBboxOf(targets)), landPath, [country]);
	}

	console.log('[5/6] Building vector tiles (tippecanoe + pmtiles convert)...');
	execFileSync('tippecanoe', [
		'--output',
		mbtilesPath,
		'--force',
		'--minimum-zoom=0',
		'--maximum-zoom=8',
		`--name=${mapName}`,
		`--attribution=${args.attribution ? `${args.attribution}; ` : ''}Natural Earth (public domain)`,
		'--generate-ids',
		'-L',
		`targets:${simplifiedPath}`,
		'-L',
		`labels:${labelsPath}`,
		'-L',
		`lakes:${lakesPath}`,
		...(countryLevel ? ['-L', `context:${contextPath}`] : ['-L', `land:${landPath}`])
	]);
	pmtilesConvert(mbtilesPath, pmtilesPath);
	// Its own archive, fetched only when the player switches Terrain on.
	buildTerrainTileset(physical, {
		absOutDir,
		mapName,
		bbox: padBbox(overallBboxOf(targets))
	});

	console.log('[6/6] Cleaning up...');
	rmSync(filteredPath);
	rmSync(simplifiedPath);
	rmSync(labelsPath);
	rmSync(lakesPath);
	if (countryLevel) rmSync(contextPath);
	else rmSync(landPath);
	cleanupPhysical(physical);
	rmSync(mbtilesPath);

	console.log(`Done: ${targets.length} targets -> ${mapJsonPath}`);
	console.log(`Tour -> ${tourJsonPath}`);
	console.log(`Tiles -> ${pmtilesPath}`);

	// Adjacency-aware colour slots (GC-032), computed from the tiles just built -
	// rerun `npm run build-map-colors -- --map=<id>` after hand-editing map.json.
	const { colours } = await colorizeMapDir(absOutDir);
	console.log(`Colours -> ${colours} colorIndex slots in map.json`);
	// The curve each name is drawn along (FT-66), from the same tiles.
	const { spines } = await spineMapDir(absOutDir);
	console.log(`Spines -> ${spines}/${targets.length} targets in map.json`);
}

await main();
