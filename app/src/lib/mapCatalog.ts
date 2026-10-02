// Single source of truth for "which country and map-type does this map id
// belong to" - used by the home page (to build the grouped and ordered
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
// The part of the country a map covers, added to its type: "Districts —
// North" (#39). One key per part rather than one per type-and-part pair.
type MapPartKey = Extract<TranslationKey, `mapPart.${string}`>;

interface MapEntry {
	id: string;
	labelKey: MapTypeKey;
	partKey?: MapPartKey;
	/** A small division (Kreise, powiaty, departments, municipalities,
	 * provinces) or a slice of a towns map: listed after a separator on the
	 * start screen and left out of the in-map row (v0.17, #162). The catalog
	 * keeps standard maps first, then advanced ones, whole nation before parts. */
	advanced?: boolean;
}

interface CountryGroup {
	country: string;
	/** The country or continent on the start screen's map (FT-77), where its
	 * id is not simply the group's name made into an id (pickerIdOf). */
	pickerId?: string;
	/** Override the first map in catalog order for a world-picker entry tap. */
	pickerDefaultMapId?: string;
	maps: MapEntry[];
}

// Alphabetical by country name. Each country's maps are deliberately ordered
// broad-to-specific for the picker and MapNav selectors; continent map order
// remains curated. Country order/grouping lives here now instead of
// +page.svelte so this module can also answer "what's map X called" for the
// breadcrumb.
export const mapGroups: CountryGroup[] = [
	// A continent is a group like a country (#39): its Countries and
	// Capitals maps, and for Europe its five parts' cities, sorted with the
	// countries by name.
	{
		country: 'Africa',
		maps: [
			{ id: 'africa-countries', labelKey: 'mapType.countries' },
			{ id: 'africa-capitals', labelKey: 'mapType.capitals' }
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
			{ id: 'asia-countries', labelKey: 'mapType.countries' },
			{ id: 'asia-capitals', labelKey: 'mapType.capitals' }
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
		country: 'Austria',
		maps: [{ id: 'austria-states', labelKey: 'mapType.states' }]
	},
	{
		country: 'Belgium',
		maps: [{ id: 'belgium-provinces', labelKey: 'mapType.provinces' }]
	},
	{
		country: 'Brazil',
		maps: [
			{ id: 'brazil-regions', labelKey: 'mapType.states' },
			{ id: 'brazil-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Bulgaria',
		maps: [{ id: 'bulgaria-provinces', labelKey: 'mapType.provinces' }]
	},
	{
		country: 'Canada',
		maps: [
			{ id: 'canada-regions', labelKey: 'mapType.provinces' },
			{ id: 'canada-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Chile',
		maps: [
			{ id: 'chile-regions', labelKey: 'mapType.regions' },
			{ id: 'chile-towns-100k', labelKey: 'mapType.towns' }
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
		country: 'Croatia',
		maps: [{ id: 'croatia-counties', labelKey: 'mapType.croatianCounties' }]
	},
	{
		country: 'Czechia',
		maps: [{ id: 'czechia-regions', labelKey: 'mapType.regions' }]
	},
	{
		country: 'Denmark',
		maps: [
			{ id: 'denmark-regions', labelKey: 'mapType.regions' },
			{ id: 'denmark-towns-50k', labelKey: 'mapType.towns' }
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
			{ id: 'europe-countries', labelKey: 'mapType.countries' },
			{ id: 'europe-capitals', labelKey: 'mapType.capitals' },
			{ id: 'europe-cities-central', labelKey: 'mapType.citiesCentral' },
			{ id: 'europe-cities-east', labelKey: 'mapType.citiesEast' },
			{ id: 'europe-cities-north', labelKey: 'mapType.citiesNorth' },
			{ id: 'europe-cities-south', labelKey: 'mapType.citiesSouth' },
			{ id: 'europe-cities-west', labelKey: 'mapType.citiesWest' }
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
			{ id: 'france-towns-100k', labelKey: 'mapType.towns' },
			{ id: 'france-departments', labelKey: 'mapType.departments', advanced: true },
			{
				id: 'france-departments-north',
				labelKey: 'mapType.departments',
				partKey: 'mapPart.north',
				advanced: true
			},
			{
				id: 'france-departments-south',
				labelKey: 'mapType.departments',
				partKey: 'mapPart.south',
				advanced: true
			}
		]
	},
	{
		country: 'Germany',
		maps: [
			{ id: 'germany-states', labelKey: 'mapType.states' },
			{ id: 'germany-towns-100k', labelKey: 'mapType.towns' },
			{
				id: 'germany-districts-center',
				labelKey: 'mapType.germanDistricts',
				partKey: 'mapPart.center',
				advanced: true
			},
			{
				id: 'germany-districts-east',
				labelKey: 'mapType.germanDistricts',
				partKey: 'mapPart.east',
				advanced: true
			},
			{
				id: 'germany-districts-north',
				labelKey: 'mapType.germanDistricts',
				partKey: 'mapPart.north',
				advanced: true
			},
			{
				id: 'germany-districts-southeast',
				labelKey: 'mapType.germanDistricts',
				partKey: 'mapPart.southEast',
				advanced: true
			},
			{
				id: 'germany-districts-southwest',
				labelKey: 'mapType.germanDistricts',
				partKey: 'mapPart.southWest',
				advanced: true
			},
			{
				id: 'germany-districts-west',
				labelKey: 'mapType.germanDistricts',
				partKey: 'mapPart.west',
				advanced: true
			},
			// Six country parts: 60 towns each from Wikidata (#39, batch C).
			{
				id: 'germany-towns-center',
				labelKey: 'mapType.towns',
				partKey: 'mapPart.center',
				advanced: true
			},
			{
				id: 'germany-towns-east',
				labelKey: 'mapType.towns',
				partKey: 'mapPart.east',
				advanced: true
			},
			{
				id: 'germany-towns-north',
				labelKey: 'mapType.towns',
				partKey: 'mapPart.north',
				advanced: true
			},
			{
				id: 'germany-towns-southeast',
				labelKey: 'mapType.towns',
				partKey: 'mapPart.southEast',
				advanced: true
			},
			{
				id: 'germany-towns-southwest',
				labelKey: 'mapType.towns',
				partKey: 'mapPart.southWest',
				advanced: true
			},
			{
				id: 'germany-towns-west',
				labelKey: 'mapType.towns',
				partKey: 'mapPart.west',
				advanced: true
			}
		]
	},
	{
		country: 'Great Britain',
		pickerId: 'united-kingdom',
		maps: [
			{ id: 'great-britain-regions', labelKey: 'mapType.regions' },
			{ id: 'great-britain-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Greece',
		maps: [{ id: 'greece-regions', labelKey: 'mapType.regions' }]
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
		country: 'Iran',
		maps: [
			{ id: 'iran-provinces', labelKey: 'mapType.provinces' },
			{ id: 'iran-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Ireland',
		maps: [{ id: 'ireland-counties', labelKey: 'mapType.counties' }]
	},
	{
		country: 'Italy',
		// The largest administrative units are the Regions; Provinces are finer.
		pickerDefaultMapId: 'italy-regions',
		maps: [
			{ id: 'italy-regions', labelKey: 'mapType.regions' },
			{ id: 'italy-towns-100k', labelKey: 'mapType.towns' },
			{ id: 'italy-provinces', labelKey: 'mapType.provinces', advanced: true },
			// 110 provinces is the densest map there is; in thirds each one is
			// readable at the zoom it opens at (FT-29).
			{
				id: 'italy-provinces-north',
				labelKey: 'mapType.provinces',
				partKey: 'mapPart.north',
				advanced: true
			},
			{
				id: 'italy-provinces-center',
				labelKey: 'mapType.provinces',
				partKey: 'mapPart.center',
				advanced: true
			},
			{
				id: 'italy-provinces-south',
				labelKey: 'mapType.provinces',
				partKey: 'mapPart.south',
				advanced: true
			}
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
		country: 'Kazakhstan',
		maps: [
			{ id: 'kazakhstan-regions', labelKey: 'mapType.regions' },
			{ id: 'kazakhstan-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Kenya',
		maps: [
			{ id: 'kenya-counties', labelKey: 'mapType.counties' },
			{ id: 'kenya-towns-50k', labelKey: 'mapType.towns' }
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
			{ id: 'netherlands-towns-100k', labelKey: 'mapType.towns' },
			{
				id: 'netherlands-municipalities-east',
				labelKey: 'mapType.municipalities',
				advanced: true,
				partKey: 'mapPart.east'
			},
			{
				id: 'netherlands-municipalities-north',
				labelKey: 'mapType.municipalities',
				advanced: true,
				partKey: 'mapPart.north'
			},
			{
				id: 'netherlands-municipalities-south',
				labelKey: 'mapType.municipalities',
				advanced: true,
				partKey: 'mapPart.south'
			},
			{
				id: 'netherlands-municipalities-southwest',
				labelKey: 'mapType.municipalities',
				advanced: true,
				partKey: 'mapPart.southWest'
			},
			{
				id: 'netherlands-municipalities-west',
				labelKey: 'mapType.municipalities',
				advanced: true,
				partKey: 'mapPart.west'
			}
		]
	},
	{
		country: 'New Zealand',
		maps: [
			{ id: 'new-zealand-regions', labelKey: 'mapType.regions' },
			{ id: 'new-zealand-towns-50k', labelKey: 'mapType.towns' }
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
			{ id: 'north-america-countries', labelKey: 'mapType.countries' },
			{ id: 'north-america-capitals', labelKey: 'mapType.capitals' }
		]
	},
	{
		country: 'Norway',
		maps: [
			{ id: 'norway-counties', labelKey: 'mapType.counties' },
			{ id: 'norway-towns-50k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Oceania',
		maps: [
			{ id: 'oceania-countries', labelKey: 'mapType.countries' },
			{ id: 'oceania-capitals', labelKey: 'mapType.capitals' }
		]
	},
	{
		country: 'Peru',
		maps: [
			{ id: 'peru-regions', labelKey: 'mapType.regions' },
			{ id: 'peru-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Philippines',
		maps: [
			{ id: 'philippines-regions', labelKey: 'mapType.regions' },
			{ id: 'philippines-towns-100k', labelKey: 'mapType.towns' },
			{ id: 'philippines-provinces', labelKey: 'mapType.provinces', advanced: true }
		]
	},
	{
		country: 'Poland',
		maps: [
			{ id: 'poland-regions', labelKey: 'mapType.regions' },
			{ id: 'poland-towns-100k', labelKey: 'mapType.towns' },
			{
				id: 'poland-counties-north',
				labelKey: 'mapType.polishCounties',
				advanced: true,
				partKey: 'mapPart.north'
			},
			{
				id: 'poland-counties-west',
				labelKey: 'mapType.polishCounties',
				advanced: true,
				partKey: 'mapPart.west'
			},
			{
				id: 'poland-counties-east',
				labelKey: 'mapType.polishCounties',
				advanced: true,
				partKey: 'mapPart.east'
			},
			{
				id: 'poland-counties-southeast',
				labelKey: 'mapType.polishCounties',
				advanced: true,
				partKey: 'mapPart.southEast'
			},
			{
				id: 'poland-counties-south',
				labelKey: 'mapType.polishCounties',
				advanced: true,
				partKey: 'mapPart.south'
			}
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
		country: 'Romania',
		maps: [{ id: 'romania-counties', labelKey: 'mapType.romanianCounties' }]
	},
	{
		country: 'Russia',
		maps: [
			{ id: 'russia-regions', labelKey: 'mapType.regions' },
			{ id: 'russia-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Saudi Arabia',
		maps: [
			{ id: 'saudi-arabia-regions', labelKey: 'mapType.regions' },
			{ id: 'saudi-arabia-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'Serbia',
		maps: [
			{ id: 'serbia-districts', labelKey: 'mapType.districts' },
			{ id: 'serbia-towns-50k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'South Africa',
		maps: [
			{ id: 'south-africa-provinces', labelKey: 'mapType.provinces' },
			{ id: 'south-africa-towns-100k', labelKey: 'mapType.towns' }
		]
	},
	{
		country: 'South America',
		maps: [
			{ id: 'south-america-countries', labelKey: 'mapType.countries' },
			{ id: 'south-america-capitals', labelKey: 'mapType.capitals' }
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
			{ id: 'spain-towns-100k', labelKey: 'mapType.towns' },
			{ id: 'spain-provinces', labelKey: 'mapType.provinces', advanced: true }
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
		country: 'Switzerland',
		maps: [{ id: 'switzerland-cantons', labelKey: 'mapType.cantons' }]
	},
	{
		country: 'Thailand',
		maps: [
			{ id: 'thailand-provinces', labelKey: 'mapType.provinces' },
			{ id: 'thailand-towns-100k', labelKey: 'mapType.towns' }
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
		pickerId: 'united-states',
		maps: [
			{ id: 'usa-states', labelKey: 'mapType.states' },
			// "Cities", not "Towns": every entry is over 200 000 people, and the
			// slices are there because one map of 281 cities would be both too
			// long and, around New York, too crowded to play (FT-28).
			{ id: 'usa-cities', labelKey: 'mapType.cities' },
			{
				id: 'usa-cities-east',
				labelKey: 'mapType.cities',
				partKey: 'mapPart.east',
				advanced: true
			},
			{
				id: 'usa-cities-center',
				labelKey: 'mapType.cities',
				partKey: 'mapPart.center',
				advanced: true
			},
			{
				id: 'usa-cities-west',
				labelKey: 'mapType.cities',
				partKey: 'mapPart.west',
				advanced: true
			}
		]
	},
	{
		country: 'Venezuela',
		maps: [
			{ id: 'venezuela-states', labelKey: 'mapType.states' },
			{ id: 'venezuela-towns-100k', labelKey: 'mapType.towns' }
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

/** A map's type, and the part of the country it covers if it is one of
 * several: "Towns — North". Translated, so call it during render. */
export function mapTypeLabel(entry: Pick<MapEntry, 'labelKey' | 'partKey'>): string {
	return entry.partKey ? `${t(entry.labelKey)} — ${t(entry.partKey)}` : t(entry.labelKey);
}

const mapIndex = new Map<string, { country: string; entry: MapEntry }>();
for (const group of mapGroups) {
	for (const map of group.maps) {
		mapIndex.set(map.id, { country: group.country, entry: map });
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
	return `${meta.country} — ${mapTypeLabel(meta.entry)}`;
}

/** A name made into an id, as the map builders make target ids. */
function slugify(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * The id of a group's country or continent on the start screen's map
 * (FT-77, #58): "Italy" is `italy`, "Europe" is `europe`. The catalog names
 * two groups differently from the map: "Great Britain" and "USA".
 */
export function pickerIdOf(group: Pick<CountryGroup, 'country' | 'pickerId'>): string {
	return group.pickerId ?? slugify(group.country);
}

/** The world-picker entry destination: an explicit preference or first available map. */
export function pickerDefaultMapIdOf(group: {
	pickerDefaultMapId?: string;
	maps: { id: string }[];
}): string | undefined {
	const preferred = group.pickerDefaultMapId;
	return preferred && group.maps.some((map) => map.id === preferred)
		? preferred
		: group.maps[0]?.id;
}
