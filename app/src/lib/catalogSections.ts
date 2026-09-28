// The start screen's sections (#58, amended 2026-09-26): the catalog grouped
// by continent, the same in the map's panel and in the list. A Continents
// section holds the six continents' own maps; then each continent has a
// section of its countries with maps. Which continent a country is on comes
// from the world picker (data/maps/world-picker/picker.json, FT-76) - the
// continent whose Countries map lists it - bundled at build time like
// data/maps/index.json, so the prerendered list is grouped too.
import picker from '../../../data/maps/world-picker/picker.json';
import { getLanguage, type Language } from './i18n.svelte';
import { pickerIdOf } from './mapCatalog';

/** The continents, in the picker's order (Europe first). */
export const CONTINENT_IDS: string[] = picker.continents.map((c) => c.id);

const continentOfCountry = new Map(picker.countries.map((c) => [c.id, c.continent]));

// The picker's per-language country names, by picker id (#71, FT-84). Only
// it/de are set; a country whose name is the same everywhere has none.
const countryNames = new Map<string, Partial<Record<Language, string>>>(
	(picker.countries as { id: string; names?: Partial<Record<Language, string>> }[]).map((c) => [
		c.id,
		c.names ?? {}
	])
);

type Grouped = { country: string; pickerId?: string };

/** Whether a catalog group is a continent's own (Europe), not a country's. */
export function isContinentGroup(group: Grouped): boolean {
	return CONTINENT_IDS.includes(pickerIdOf(group));
}

/** The continent a group belongs to: its own id for a continent's group. */
export function continentOf(group: Grouped): string | undefined {
	const id = pickerIdOf(group);
	return CONTINENT_IDS.includes(id) ? id : continentOfCountry.get(id);
}

/** The six continents' own groups, in the picker's order. */
export function continentGroups<G extends Grouped>(groups: G[]): G[] {
	return CONTINENT_IDS.flatMap((id) => groups.filter((g) => pickerIdOf(g) === id));
}

/** A continent's country groups, by name. */
export function countryGroupsOf<G extends Grouped>(continent: string, groups: G[]): G[] {
	return groups
		.filter((g) => !isContinentGroup(g) && continentOf(g) === continent)
		.sort((a, b) => countryNameOf(a).localeCompare(countryNameOf(b), getLanguage()));
}

/** A country group's name in the player's language, or the catalog's English
 * when the picker has none (FT-84). "Great Britain" and "USA" keep their
 * catalog names, since the picker's `names` carries only it/de. */
export function countryNameOf(group: Grouped): string {
	return countryNames.get(pickerIdOf(group))?.[getLanguage()] ?? group.country;
}
