// Per-device map preferences: the maps opened most recently (FT-15) and the
// player's favourites (FT-16). Kept in localStorage like the UI language
// (i18n.svelte.ts). It's a convenience of this device, not progress, so it's
// not in the ProgressRepository / SQLite, and it isn't synced anywhere. The
// lists are $state, so the home page updates as soon as they change.

import { isAdvancedMap, isCatalogMap } from './mapCatalog';

const RECENT_KEY = 'geoclick:recent-maps:v1';
const MAP_TYPE_SELECTIONS_KEY = 'geoclick:map-type-selections:v1';
/** How many recent maps the home page shows (FEATURE_PLAN.md, decision 13). */
export const RECENT_SHOWN = 5;
// Stored a little longer than shown, so a map dropping out of the catalog
// doesn't shorten the visible list.
const RECENT_STORED = 10;

// --- pure list logic (unit-tested) ---

/** `mapId` moved to the front, without duplicates, capped at `limit`. */
export function withVisit(list: readonly string[], mapId: string, limit = RECENT_STORED): string[] {
	return [mapId, ...list.filter((id) => id !== mapId)].slice(0, limit);
}

/** A stored value back as a list of ids; anything malformed reads as empty. */
export function parseIdList(raw: string | null): string[] {
	if (!raw) return [];
	try {
		const value = JSON.parse(raw);
		return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
	} catch {
		return [];
	}
}

// --- storage: same guards as i18n.svelte.ts. No localStorage during the
// prerendered build; private modes can throw on access. ---

function readIds(key: string): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		return parseIdList(localStorage.getItem(key));
	} catch {
		return [];
	}
}

function writeIds(key: string, ids: string[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(ids));
	} catch {
		// Full or blocked storage: the list still works for this session.
	}
}

/** A stored per-row map choice, back as a plain object; malformed storage is empty. */
export function parseMapTypeSelections(raw: string | null): Record<string, string> {
	if (!raw) return {};
	try {
		const value: unknown = JSON.parse(raw);
		if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
		return Object.fromEntries(
			Object.entries(value).filter(
				(entry): entry is [string, string] => typeof entry[1] === 'string'
			)
		);
	} catch {
		return {};
	}
}

/** A saved map is used only while it remains in this row; otherwise use its first map. */
export function chosenMapType(
	selections: Record<string, string>,
	groupId: string,
	mapIds: readonly string[]
): string | undefined {
	const saved = selections[groupId];
	return saved && mapIds.includes(saved) ? saved : mapIds[0];
}

/** The row's remembered choice, or its first listed map when none is valid. */
export function mapTypeSelectionOf(groupId: string, mapIds: readonly string[]): string | undefined {
	if (typeof localStorage === 'undefined') return mapIds[0];
	try {
		return chosenMapType(
			parseMapTypeSelections(localStorage.getItem(MAP_TYPE_SELECTIONS_KEY)),
			groupId,
			mapIds
		);
	} catch {
		return mapIds[0];
	}
}

/** Remember a player's explicit map choice per country/continent row. */
export function rememberMapTypeSelection(groupId: string, mapId: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		const selections = parseMapTypeSelections(localStorage.getItem(MAP_TYPE_SELECTIONS_KEY));
		localStorage.setItem(
			MAP_TYPE_SELECTIONS_KEY,
			JSON.stringify({ ...selections, [groupId]: mapId })
		);
	} catch {
		// Blocked/full storage should not stop choosing a map in this session.
	}
}

let recent = $state<string[]>(readIds(RECENT_KEY));

// The tutorial sets this to its map (FT-10), so its practice run on
// italy-regions doesn't show up in Recent (decision 16). Other maps opened
// while the tutorial is paused are still recorded.
let unrecordedMap: string | undefined;
export function setUnrecordedMap(mapId: string | undefined): void {
	unrecordedMap = mapId;
}

// A detailed map the player has opened stays among the normal ones: in a
// country's list and in the map bar's type row (v0.17, owner, 2026-10-03).
const SEEN_DETAILED_KEY = 'geoclick:seen-detailed:v1';
let seenDetailed = $state<string[]>(readIds(SEEN_DETAILED_KEY));

/** Whether the player has opened this detailed map before. */
export function isSeenDetailed(mapId: string): boolean {
	return seenDetailed.includes(mapId);
}

/** Take a detailed map back out of the normal maps: it goes behind the line again. */
export function forgetDetailed(mapId: string): void {
	seenDetailed = seenDetailed.filter((id) => id !== mapId);
	writeIds(SEEN_DETAILED_KEY, seenDetailed);
}

/** Called when a map view opens (MapNav). Unknown ids are ignored. */
export function recordVisit(mapId: string): void {
	if (!isCatalogMap(mapId)) return;
	// Remembered even for the tutorial's map, which is never an advanced one.
	if (isAdvancedMap(mapId) && !seenDetailed.includes(mapId)) {
		seenDetailed = [...seenDetailed, mapId];
		writeIds(SEEN_DETAILED_KEY, seenDetailed);
	}
	if (mapId === unrecordedMap) return;
	recent = withVisit(recent, mapId);
	writeIds(RECENT_KEY, recent);
}

/** Most recent first, at most RECENT_SHOWN, maps no longer in the catalog left out. */
export function recentMaps(): string[] {
	return recent.filter(isCatalogMap).slice(0, RECENT_SHOWN);
}

// --- favourites (FT-16) ---

const FAVOURITES_KEY = 'geoclick:favourite-maps:v1';

/** `mapId` added at the end if missing, removed if present. */
export function withToggled(list: readonly string[], mapId: string): string[] {
	return list.includes(mapId) ? list.filter((id) => id !== mapId) : [...list, mapId];
}

let favourites = $state<string[]>(readIds(FAVOURITES_KEY));

/** Star / unstar a map (home page cards and the map bar). Unknown ids are ignored. */
export function toggleFavourite(mapId: string): void {
	if (!isCatalogMap(mapId)) return;
	favourites = withToggled(favourites, mapId);
	writeIds(FAVOURITES_KEY, favourites);
}

export function isFavourite(mapId: string): boolean {
	return favourites.includes(mapId);
}

/** In the order they were starred, maps no longer in the catalog left out. */
export function favouriteMaps(): string[] {
	return favourites.filter(isCatalogMap);
}

// --- the Terrain layer (FT-33) ---
//
// One setting for every map, not one per map: a player who wants the sea
// and the rivers wants them everywhere, and having to switch it on again
// for each of 63 maps would be worse than no setting.
//
// ON by default since v0.9.1 (product owner, 2026-09-19). It shipped off,
// on the argument that a layer should not change what a returning player
// sees unasked - but the effect of that was that nobody who did not press
// the button ever saw the feature at all, which is the worse failure. See
// DECISIONS.md, "The map can show what is under it".

const TERRAIN_KEY = 'geoclick:terrain:v1';

/**
 * Read a stored flag that has a default.
 *
 * Three states, not two: '1' is on, '0' is off, and ABSENT means the player
 * has never touched the button and gets `fallback`. That distinction is what
 * lets the default flip without overriding anyone - a player who turned
 * Terrain off wrote '0' and stays off.
 */
function readFlag(key: string, fallback: boolean): boolean {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const stored = localStorage.getItem(key);
		if (stored === '1') return true;
		if (stored === '0') return false;
		return fallback;
	} catch {
		return fallback;
	}
}

const TERRAIN_DEFAULT = true;

let terrain = $state<boolean>(readFlag(TERRAIN_KEY, TERRAIN_DEFAULT));

export function terrainShown(): boolean {
	return terrain;
}

export function setTerrainShown(shown: boolean): void {
	terrain = shown;
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(TERRAIN_KEY, shown ? '1' : '0');
	} catch {
		// Full or blocked storage: the setting still holds for this session.
	}
}

// --- detailed maps in the map bar (v0.17, #162) ---
//
// The small divisions and slices (districts, provinces, the parts of a
// country) are left out of a map's own type row unless the player ticks
// "Show detailed maps". One setting for every map, remembered on this device,
// off until ticked.

const DETAILED_MAPS_KEY = 'geoclick:detailed-maps:v1';

let detailedMaps = $state<boolean>(readFlag(DETAILED_MAPS_KEY, false));

export function detailedMapsShown(): boolean {
	return detailedMaps;
}

export function setDetailedMapsShown(shown: boolean): void {
	detailedMaps = shown;
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(DETAILED_MAPS_KEY, shown ? '1' : '0');
	} catch {
		// Full or blocked storage: the setting still holds for this session.
	}
}

// --- the map's buttons, hidden (tablet play, 2026-09-24) ---
//
// The button under the zoom control hides the map bar - the view tabs, the
// map's name, the language, Terrain and Tutorial - so a round on a tablet has
// the whole map to itself. Session-only like the chosen names below: it holds
// from map to map for the sitting, and a fresh start shows the buttons, so a
// player who hid them once never has to hunt for how to get them back.

let navHidden = $state(false);

export function mapNavHidden(): boolean {
	return navHidden;
}

export function setMapNavHidden(hidden: boolean): void {
	navHidden = hidden;
}

// --- the names you have chosen to show (FT-39, docs/PLAN_V0.9.md) ---
//
// The Known map draws a name when the player has placed it cleanly at least
// once (FT-22). A tap overrides that, either way, and the override sticks
// until it is tapped again or the app is closed - so the map in front of the
// player is the set of names they have chosen to work on, not only what
// they have earned.
//
// Session-only (product owner, #11, 2026-09-22): the choice lives in memory
// for the sitting, and reopening the app shows what is known and nothing
// else. FT-39 kept it in localStorage; that key is dropped once on load so a
// choice made under the old rule does not linger in storage. Never in the
// SQLite progress store either way: it is a view of a map, not a record of
// what the player knows.

const LEGACY_SHOWN_KEY = 'geoclick:shown-names:v1';

/** What a tap has said about one name, on top of what the player knows. */
export type NameOverride = 'shown' | 'hidden';

function dropLegacyOverrides(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(LEGACY_SHOWN_KEY);
	} catch {
		// Blocked storage: nothing was read from it, so nothing to undo.
	}
}

dropLegacyOverrides();

/** Every override this session, keyed `<mapId>/<targetId>`. */
let overrides = $state<Record<string, NameOverride>>({});

const overrideKey = (mapId: string, targetId: string) => `${mapId}/${targetId}`;

/** What the player has said about this name, if anything. */
export function nameOverride(mapId: string, targetId: string): NameOverride | undefined {
	return overrides[overrideKey(mapId, targetId)];
}

/** Records a tap: the name is now shown, or now hidden. */
export function setNameOverride(mapId: string, targetId: string, value: NameOverride): void {
	overrides = { ...overrides, [overrideKey(mapId, targetId)]: value };
}

/** Forgets every choice on one map, so it goes back to showing what is known. */
export function clearNameOverrides(mapId: string): void {
	const prefix = `${mapId}/`;
	const next: Record<string, NameOverride> = {};
	for (const [key, value] of Object.entries(overrides)) {
		if (!key.startsWith(prefix)) next[key] = value;
	}
	overrides = next;
}

/** Whether this map has any choice worth clearing. */
export function hasNameOverrides(mapId: string): boolean {
	const prefix = `${mapId}/`;
	return Object.keys(overrides).some((key) => key.startsWith(prefix));
}

// --- the start screen's view (FT-77, #58) ---
//
// The world, or one continent by its id: where the start screen opens next
// time is where the player left it. Kept on the device, like Terrain. An id
// the picker no longer has falls back to the world (worldPicker.validView).

const PICKER_VIEW_KEY = 'geoclick:picker-view:v1';

function readPickerView(): string {
	if (typeof localStorage === 'undefined') return 'world';
	try {
		return localStorage.getItem(PICKER_VIEW_KEY) || 'world';
	} catch {
		return 'world';
	}
}

let pickerViewState = $state<string>(readPickerView());

export function pickerView(): string {
	return pickerViewState;
}

export function setPickerView(view: string): void {
	pickerViewState = view;
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(PICKER_VIEW_KEY, view);
	} catch {
		// Full or blocked storage: the view still holds for this session.
	}
}

// Whether the start screen's map is up, loaded, with its view checked
// against the picker (WorldPicker sets it). The list, or a map not yet
// loaded, has no continent to go up from.
let pickerShown = false;

export function setPickerShown(shown: boolean): void {
	pickerShown = shown;
}

/**
 * The phone's back button on the start screen: from a continent up to the
 * world, and only then out of the app. True when it moved up. A continent
 * the player can't see - behind the list (#81) - is not one to go up from.
 */
export function pickerGoUp(): boolean {
	if (!pickerShown || pickerViewState === 'world') return false;
	setPickerView('world');
	return true;
}

// --- the start screen: the map or the list (FT-78, #58) ---
//
// The map by default; the list is one tap away and the choice is kept on the
// device. The prerendered page is the list, and the map takes its place after
// mount when it is the choice.

const HOME_VIEW_KEY = 'geoclick:home-view:v1';
export type HomeView = 'map' | 'list';

function readHomeView(): HomeView {
	if (typeof localStorage === 'undefined') return 'map';
	try {
		return localStorage.getItem(HOME_VIEW_KEY) === 'list' ? 'list' : 'map';
	} catch {
		return 'map';
	}
}

let homeViewState = $state<HomeView>(readHomeView());

export function homeView(): HomeView {
	return homeViewState;
}

export function setHomeView(view: HomeView): void {
	homeViewState = view;
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(HOME_VIEW_KEY, view);
	} catch {
		// Full or blocked storage: the choice still holds for this session.
	}
}
