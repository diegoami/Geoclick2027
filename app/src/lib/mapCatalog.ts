// Single source of truth for "which country and map-type does this map id
// belong to" - used by the home page (to build the grouped/alphabetized
// list) and by every map-scoped view (to build a translated breadcrumb,
// e.g. "Sweden — Towns") instead of reading the untranslatable English
// `name` baked into each map's own map.json at build time. See
// DECISIONS.md's i18n entry: country names stay in English everywhere
// (real proper nouns, out of scope, same as region/target names), only
// the map-type word (Regions/Towns/...) is translated.

import { t, type TranslationKey } from './i18n.svelte';

// Only the map-type keys belong here, not the full TranslationKey union -
// keeps this file from being able to accidentally reference an unrelated
// key like 'nav.maps' as a map's labelKey.
type MapTypeKey = Extract<TranslationKey, `mapType.${string}`>;

interface MapEntry {
	id: string;
	labelKey: MapTypeKey;
}

interface CountryGroup {
	country: string;
	maps: MapEntry[];
}

// Alphabetical by country name, each country's own maps alphabetical by
// their (untranslated) English label - matches DECISIONS.md's "Home page
// map list" entry. Country order/grouping lives here now instead of
// +page.svelte so this module can also answer "what's map X called" for
// the breadcrumb.
export const mapGroups: CountryGroup[] = [
	// A continent is a group like a country (#39): its Countries and
	// Capitals maps, and for Europe its five parts' cities, sorted with the
	// countries by name.
	{
		country: 'Africa',
		maps: [
			{ id: 'africa-capitals', labelKey: 'mapType.capitals' },
			{ id: 'africa-countries', labelKey: 'mapType.countries' }
		]
	},
	{
		country: 'Argentina',
		maps: [
			{ id: 'argentina-regions', labelKey: 'mapType.regions' },
			{ id: 'argentina-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Asia',
		maps: [
			{ id: 'asia-capitals', labelKey: 'mapType.capitals' },
			{ id: 'asia-countries', labelKey: 'mapType.countries' }
		]
	},
	{
		country: 'Australia',
		maps: [
			{ id: 'australia-regions', labelKey: 'mapType.states' },
			{ id: 'australia-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Brazil',
		maps: [
			{ id: 'brazil-regions', labelKey: 'mapType.states' },
			{ id: 'brazil-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Canada',
		maps: [
			{ id: 'canada-regions', labelKey: 'mapType.provinces' },
			{ id: 'canada-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'China',
		maps: [
			{ id: 'china-regions', labelKey: 'mapType.provinces' },
			{ id: 'china-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Colombia',
		maps: [
			{ id: 'colombia-regions', labelKey: 'mapType.regions' },
			{ id: 'colombia-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Egypt',
		maps: [
			{ id: 'egypt-regions', labelKey: 'mapType.governorates' },
			{ id: 'egypt-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Europe',
		maps: [
			{ id: 'europe-capitals', labelKey: 'mapType.capitals' },
			{ id: 'europe-cities-central', labelKey: 'mapType.citiesCentral' },
			{ id: 'europe-cities-east', labelKey: 'mapType.citiesEast' },
			{ id: 'europe-cities-north', labelKey: 'mapType.citiesNorth' },
			{ id: 'europe-cities-south', labelKey: 'mapType.citiesSouth' },
			{ id: 'europe-cities-west', labelKey: 'mapType.citiesWest' },
			{ id: 'europe-countries', labelKey: 'mapType.countries' }
		]
	},
	{
		country: 'Finland',
		maps: [
			{ id: 'finland-regions', labelKey: 'mapType.regions' },
			{ id: 'finland-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'France',
		maps: [
			{ id: 'france-regions', labelKey: 'mapType.regions' },
			{ id: 'france-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Germany',
		maps: [
			{ id: 'germany-states', labelKey: 'mapType.states' },
			{ id: 'germany-towns-100k', labelKey: 'mapType.towns' },
			// Six parts of the country by its states, 60 towns each, from
			// Wikidata (#39, batch C).
			{ id: 'germany-towns-center', labelKey: 'mapType.townsCenter' },
			{ id: 'germany-towns-east', labelKey: 'mapType.townsEast' },
			{ id: 'germany-towns-north', labelKey: 'mapType.townsNorth' },
			{ id: 'germany-towns-southeast', labelKey: 'mapType.townsSouthEast' },
			{ id: 'germany-towns-southwest', labelKey: 'mapType.townsSouthWest' },
			{ id: 'germany-towns-west', labelKey: 'mapType.townsWest' }
		]
	},
	{
		country: 'Great Britain',
		maps: [
			{ id: 'great-britain-regions', labelKey: 'mapType.regions' },
			{ id: 'great-britain-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'India',
		maps: [
			{ id: 'india-regions', labelKey: 'mapType.states' },
			{ id: 'india-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Indonesia',
		maps: [
			{ id: 'indonesia-regions', labelKey: 'mapType.provinces' },
			{ id: 'indonesia-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Italy',
		maps: [
			{ id: 'italy-provinces', labelKey: 'mapType.provinces' },
			// 110 provinces is the densest map there is; in thirds each one is
			// readable at the zoom it opens at (FT-29).
			{ id: 'italy-provinces-north', labelKey: 'mapType.provincesNorth' },
			{ id: 'italy-provinces-center', labelKey: 'mapType.provincesCenter' },
			{ id: 'italy-provinces-south', labelKey: 'mapType.provincesSouth' },
			{ id: 'italy-regions', labelKey: 'mapType.regions' },
			{ id: 'italy-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Japan',
		maps: [
			{ id: 'japan-regions', labelKey: 'mapType.prefectures' },
			{ id: 'japan-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Mexico',
		maps: [
			{ id: 'mexico-regions', labelKey: 'mapType.states' },
			{ id: 'mexico-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Netherlands',
		maps: [
			{ id: 'netherlands-regions', labelKey: 'mapType.provinces' },
			{ id: 'netherlands-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Nigeria',
		maps: [
			{ id: 'nigeria-regions', labelKey: 'mapType.states' },
			{ id: 'nigeria-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'North America',
		maps: [
			{ id: 'north-america-capitals', labelKey: 'mapType.capitals' },
			{ id: 'north-america-countries', labelKey: 'mapType.countries' }
		]
	},
	{
		country: 'Oceania',
		maps: [
			{ id: 'oceania-capitals', labelKey: 'mapType.capitals' },
			{ id: 'oceania-countries', labelKey: 'mapType.countries' }
		]
	},
	{
		country: 'Poland',
		maps: [
			{ id: 'poland-regions', labelKey: 'mapType.regions' },
			{ id: 'poland-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Portugal',
		maps: [
			{ id: 'portugal-regions', labelKey: 'mapType.districts' },
			{ id: 'portugal-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Russia',
		maps: [
			{ id: 'russia-regions', labelKey: 'mapType.regions' },
			{ id: 'russia-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'South America',
		maps: [
			{ id: 'south-america-capitals', labelKey: 'mapType.capitals' },
			{ id: 'south-america-countries', labelKey: 'mapType.countries' }
		]
	},
	{
		country: 'South Korea',
		maps: [
			{ id: 'south-korea-regions', labelKey: 'mapType.regions' },
			{ id: 'south-korea-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Spain',
		maps: [
			{ id: 'spain-regions', labelKey: 'mapType.regions' },
			{ id: 'spain-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Sweden',
		maps: [
			{ id: 'sweden-regions', labelKey: 'mapType.regions' },
			{ id: 'sweden-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Turkey',
		maps: [
			{ id: 'turkey-regions', labelKey: 'mapType.provinces' },
			{ id: 'turkey-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Ukraine',
		maps: [
			{ id: 'ukraine-regions', labelKey: 'mapType.regions' },
			{ id: 'ukraine-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'USA',
		maps: [
			{ id: 'usa-states', labelKey: 'mapType.states' },
			// "Cities", not "Towns": every entry is over 200 000 people, and the
			// slices are there because one map of 281 cities would be both too
			// long and, around New York, too crowded to play (FT-28).
			{ id: 'usa-cities', labelKey: 'mapType.cities' },
			{ id: 'usa-cities-east', labelKey: 'mapType.citiesEast' },
			{ id: 'usa-cities-center', labelKey: 'mapType.citiesCenter' },
			{ id: 'usa-cities-west', labelKey: 'mapType.citiesWest' }
		]
	},
	{
		country: 'Vietnam',
		maps: [
			{ id: 'vietnam-regions', labelKey: 'mapType.provinces' },
			{ id: 'vietnam-towns-100k', labelKey: 'mapType.towns' }
		]
	}
];

const mapIndex = new Map<string, { country: string; labelKey: MapTypeKey }>();
for (const group of mapGroups) {
	for (const map of group.maps) {
		mapIndex.set(map.id, { country: group.country, labelKey: map.labelKey });
	}
}

// "Sweden — Towns", with "Towns" translated and "Sweden" left as-is -
// undefined for an id not in the catalog above (shouldn't happen for any
// real map, but callers fall back to the map's own map.json `name` rather
// than crash). Reactive to the current language the same way any other
// `t()` call in a template is, since it's a plain function call made
// during render, not a value computed once and cached.
/** Whether a map id is in the catalog - lists stored on the device (recent,
 * favourites) use it to drop maps that have since been removed. */
export function isCatalogMap(mapId: string): boolean {
	return mapIndex.has(mapId);
}

export function mapDisplayName(mapId: string): string | undefined {
	const meta = mapIndex.get(mapId);
	if (!meta) return undefined;
	return `${meta.country} — ${t(meta.labelKey)}`;
}
