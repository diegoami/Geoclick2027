// Small helpers shared between build-map.ts (polygon targets) and
// build-points-map.ts (point targets) - kept here rather than duplicated,
// since both scripts need them identically. See MAPS.md's "Point-target
// design" section for why point maps get a separate script instead of
// branches added throughout build-map.ts.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const LAKES_SHP = path.join(REPO_ROOT, 'data/source/ne_10m_lakes/ne_10m_lakes.shp');
export const ADMIN1_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_admin_1_states_provinces/ne_10m_admin_1_states_provinces.shp'
);

export function parseArgs(argv: string[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const arg of argv) {
		const match = /^--([^=]+)=(.*)$/.exec(arg);
		if (match) out[match[1]] = match[2];
	}
	return out;
}

// The pmtiles CLI, from PATH by default. Set PMTILES_BIN to point elsewhere
// (e.g. PMTILES_BIN=$HOME/.local/bin/pmtiles if ~/.local/bin is not on PATH).
// Replaced a hardcoded $HOME/.local/bin path that only worked on one machine.
export const PMTILES_BIN = process.env.PMTILES_BIN ?? 'pmtiles';

export function pmtilesConvert(mbtilesPath: string, pmtilesPath: string): void {
	try {
		execFileSync(PMTILES_BIN, ['convert', mbtilesPath, pmtilesPath]);
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new Error(
				`pmtiles CLI not found ("${PMTILES_BIN}"). Put it on PATH, or set PMTILES_BIN to its full path - see MAPS.md.`,
				{ cause: e }
			);
		}
		throw e;
	}
}

// Strips combining diacritics after NFD (U+0300-U+036F: "München" -> "munchen").
// LIMITATIONS, documented rather than fixed (GC-031):
// - No non-Latin fallback. Every character outside a-z/0-9 becomes "-", so a
//   name in Cyrillic, CJK, Devanagari etc. slugs to "" - a future
//   --name-field=NAME_RU or NAME_ZH would give every target the id "".
//   GC-030's mapData.test.ts would catch the duplicate ids; pick a
//   transliteration (or keep the English name for the id) first.
// - Latin letters with no NFD decomposition (Ł, Ø, ß, Đ, Æ...) are dropped, not
//   transliterated. Shipped ids already carry this: "ma-opolskie", "wroc-aw",
//   "bia-ystok", "odz", "odzkie" (Poland). Do NOT "fix" slugify in place:
//   target ids key every player's saved progress (card_states), so changing
//   them silently orphans it. A fix needs a transliteration applied to NEW maps
//   only, or an id migration in the progress stores.
export function slugify(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * True when a bbox wraps the antimeridian: build-map.ts's boundsOf unwraps a
 * shape spanning +/-180deg (Chukotka, the Aleutians) and emits west > east,
 * e.g. [157.692, 61.8148, -169.7009, 71.6]. MapLibre handles that
 * (cameraForBounds adjusts for it), but naive min/max consumers do not -
 * overallBboxOf below is one (it mis-clips the lake -spat filter for Russia).
 * The bbox is deliberately NOT "fixed"; targets like this get an explicit
 * `crossesAntimeridian: true` so the condition is documented, not rediscovered.
 */
export function crossesAntimeridian(bbox: [number, number, number, number]): boolean {
	return bbox[0] > bbox[2];
}

export function overallBboxOf(
	targets: { bbox: [number, number, number, number] }[]
): [number, number, number, number] {
	return targets.reduce(
		(acc: [number, number, number, number], t) => [
			Math.min(acc[0], t.bbox[0]),
			Math.min(acc[1], t.bbox[1]),
			Math.max(acc[2], t.bbox[2]),
			Math.max(acc[3], t.bbox[3])
		],
		[Infinity, Infinity, -Infinity, -Infinity]
	);
}

// Water context: without lakes rendered, a target whose border runs along
// one (Michigan on the Great Lakes is the worst case) reads as an
// unexplained gap next to its neighbors rather than a coastline. Selected
// by bounding-box intersection with the map's overall extent (`-spat`, a
// feature filter, not a geometry clip) rather than by country - lakes
// aren't tagged to an admin boundary the way states/provinces are, and a
// lake is still worth rendering even if it pokes slightly outside the
// map's bounds.
export function selectNearbyLakes(bbox: [number, number, number, number], outPath: string): void {
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-spat',
		...bbox.map(String),
		'-select',
		'name',
		outPath,
		LAKES_SHP
	]);
}

// Land context for a point map: without any shape at all behind the
// markers, a towns map has no sense of the country's outline or its
// internal region/state borders - a polygon map doesn't have this problem
// (the targets themselves, filled edge to edge, already show the whole
// country), but a point map has nothing filling that role. Reuses the
// same admin-1 dataset build-map.ts already uses for the actual polygon
// maps, purely for visual context here - not hit-tested, no feature-state,
// same treatment as the lakes layer.
export function selectCountryContext(country: string, outPath: string): void {
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-where',
		`admin='${country}'`,
		'-select',
		'name',
		outPath,
		ADMIN1_SHP
	]);
}
