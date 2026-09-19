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

// --- the names you have chosen to show (FT-39, docs/PLAN_V0.9.md) ---
//
// The Known map draws a name when the player has placed it cleanly at least
// once (FT-22). A tap now overrides that, either way, and the override
// sticks until it is tapped again - so the map in front of the player is
// the set of names they have chosen to work on, not only what they have
// earned.
//
// Kept HERE, in localStorage, and not in the SQLite progress store, because
// that is what it is: a view of a map on this device, not a record of what
// the player knows. Storing it as progress would mean a schema migration in
// both native backends (capacitorMigrations.ts and lib.rs, which a test
// holds to parity) to record something that is not progress. Same reasoning
// as favourites and recents above.

const SHOWN_KEY = 'geoclick:shown-names:v1';

/** What a tap has said about one name, on top of what the player knows. */
export type NameOverride = 'shown' | 'hidden';

/** Every override, keyed `<mapId>/<targetId>`. */
function readOverrides(): Record<string, NameOverride> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(SHOWN_KEY);
		const value: unknown = raw ? JSON.parse(raw) : {};
		if (!value || typeof value !== 'object') return {};
		const out: Record<string, NameOverride> = {};
		for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
			if (v === 'shown' || v === 'hidden') out[key] = v;
		}
		return out;
	} catch {
		return {};
	}
}

let overrides = $state<Record<string, NameOverride>>(readOverrides());

const overrideKey = (mapId: string, targetId: string) => `${mapId}/${targetId}`;

function writeOverrides(next: Record<string, NameOverride>): void {
	overrides = next;
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SHOWN_KEY, JSON.stringify(next));
	} catch {
		// Full or blocked storage: the choice holds for this session.
	}
}

/** What the player has said about this name, if anything. */
export function nameOverride(mapId: string, targetId: string): NameOverride | undefined {
	return overrides[overrideKey(mapId, targetId)];
}

/** Records a tap: the name is now shown, or now hidden. */
export function setNameOverride(mapId: string, targetId: string, value: NameOverride): void {
	writeOverrides({ ...overrides, [overrideKey(mapId, targetId)]: value });
}

/** Forgets every choice on one map, so it goes back to showing what is known. */
export function clearNameOverrides(mapId: string): void {
	const prefix = `${mapId}/`;
	const next: Record<string, NameOverride> = {};
	for (const [key, value] of Object.entries(overrides)) {
		if (!key.startsWith(prefix)) next[key] = value;
	}
	writeOverrides(next);
}

/** Whether this map has any choice worth clearing. */
export function hasNameOverrides(mapId: string): boolean {
	const prefix = `${mapId}/`;
	return Object.keys(overrides).some((key) => key.startsWith(prefix));
}
