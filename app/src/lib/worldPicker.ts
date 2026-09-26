// The start screen's map (FT-77, #58): the world, then a continent, then a
// country's maps in a panel. The map itself is data/maps/world-picker/,
// built by data/scripts/build-picker.ts (FT-76): the 172 countries of the six
// Countries maps, each tagged with its continent, and each continent with
// the box its view fits to.
//
// What a tap opens is decided here, away from MapLibre, so it can be tested:
// a country with maps opens its own; a country with none opens its
// continent's, since that is where it can be played.
import { asset } from '$app/paths';
import { mapGroups, pickerIdOf } from './mapCatalog';
import type { Target } from './mapDefinition';
import { isNativeShell } from './platform';
import { ensurePmtilesProtocol, registerTilesArchive } from './pmtilesSource';

export type Box = [number, number, number, number];

export interface PickerContinent {
	id: string;
	name: string;
	/** The box the continent view fits to: its Countries map's extent. */
	view: Box;
}

export interface PickerCountry extends Pick<Target, 'name' | 'names'> {
	id: string;
	continent: string;
	bbox: Box;
	centroid: [number, number];
}

export interface Picker {
	id: string;
	attribution: string;
	tiles: string;
	continents: PickerContinent[];
	countries: PickerCountry[];
}

/** The whole world, as the world view shows it. */
export const WORLD_VIEW: Box = [-170, -57, 180, 80];

/** The start screen's view: the world, or one continent by its id. */
export type PickerView = 'world' | string;

/** Loads picker.json and makes its tiles readable, on the web and in the apps. */
export async function fetchPicker(): Promise<{ picker: Picker; tilesUrl: string }> {
	ensurePmtilesProtocol();
	const response = await fetch(asset('/maps/world-picker/picker.json'));
	if (!response.ok) throw new Error('Could not load the world map.');
	const picker: Picker = await response.json();
	const tilesUrl = new URL(asset(`/maps/world-picker/${picker.tiles}`), location.origin).href;
	if (await isNativeShell()) await registerTilesArchive(tilesUrl);
	return { picker, tilesUrl };
}

/** A catalog group: a country's or a continent's maps. */
export type MapGroup = (typeof mapGroups)[number];

const groupsByPickerId = new Map<string, MapGroup[]>();
for (const group of mapGroups) {
	const id = pickerIdOf(group);
	groupsByPickerId.set(id, [...(groupsByPickerId.get(id) ?? []), group]);
}

/** The catalog groups of a country or a continent on the picker. */
export function groupsOf(pickerId: string): MapGroup[] {
	return groupsByPickerId.get(pickerId) ?? [];
}

/** Whether a country has maps of its own. */
export function hasMaps(countryId: string): boolean {
	return groupsOf(countryId).length > 0;
}

/** What the panel shows for a country: its own maps, or its continent's. */
export interface PanelContent {
	country: PickerCountry;
	groups: MapGroup[];
	/** True when the country has no maps and these are its continent's. */
	continentInstead: boolean;
}

export function panelFor(picker: Picker, countryId: string): PanelContent | undefined {
	const country = picker.countries.find((c) => c.id === countryId);
	if (!country) return undefined;
	const own = groupsOf(country.id);
	if (own.length > 0) return { country, groups: own, continentInstead: false };
	return { country, groups: groupsOf(country.continent), continentInstead: true };
}

/** A view that names a continent the picker has, or the world. */
export function validView(picker: Picker, view: string): PickerView {
	return picker.continents.some((c) => c.id === view) ? view : 'world';
}
