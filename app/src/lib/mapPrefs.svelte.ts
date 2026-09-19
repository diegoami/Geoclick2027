// Per-device map preferences: the maps opened most recently (FT-15) and the
// player's favourites (FT-16). Kept in localStorage like the UI language
// (i18n.svelte.ts). It's a convenience of this device, not progress, so it's
// not in the ProgressRepository / SQLite, and it isn't synced anywhere. The
// lists are $state, so the home page updates as soon as they change.

import { isCatalogMap } from './mapCatalog';

const RECENT_KEY = 'geoclick:recent-maps:v1';
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

let recent = $state<string[]>(readIds(RECENT_KEY));

// The tutorial sets this to its map (FT-10), so its practice run on
// italy-regions doesn't show up in Recent (decision 16). Other maps opened
// while the tutorial is paused are still recorded.
let unrecordedMap: string | undefined;
export function setUnrecordedMap(mapId: string | undefined): void {
	unrecordedMap = mapId;
}

/** Called when a map view opens (MapNav). Unknown ids are ignored. */
export function recordVisit(mapId: string): void {
	if (mapId === unrecordedMap || !isCatalogMap(mapId)) return;
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
// for each of 63 maps would be worse than no setting. Off by default -
// the layer is there to help, and it should not change what a returning
// player sees without being asked for.

const TERRAIN_KEY = 'geoclick:terrain:v1';

function readFlag(key: string): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		return localStorage.getItem(key) === '1';
	} catch {
		return false;
	}
}

let terrain = $state<boolean>(readFlag(TERRAIN_KEY));

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
