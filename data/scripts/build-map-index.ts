// Scans data/maps/*/map.json and writes data/maps/index.json: one entry per
// map with its id, country, target count and target type.
//
//   npm run build-map-index
//
// Reads only the committed map.json files - no ogr2ogr/tippecanoe/pmtiles, so
// unlike build-map.ts it runs anywhere node runs, WSL2 not required. Re-run it
// whenever a map is added, removed or rebuilt; app/src/lib/mapData.test.ts
// regenerates the index in memory and fails if the committed file is stale.
//
// data/maps is also what the app serves under /maps (app/static/maps is a
// symlink to it), so the index ships as /maps/index.json.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface MapIndexEntry {
	id: string;
	country: string;
	targetCount: number;
	targetType: string;
}

interface MapJson {
	id: string;
	country: string;
	targets: { type: string }[];
}

export const DEFAULT_MAPS_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'maps'
);

/** Ids of every map directory (a directory containing a map.json), sorted. */
export function listMapIds(mapsDir: string = DEFAULT_MAPS_DIR): string[] {
	return readdirSync(mapsDir)
		.filter((name) => statSync(path.join(mapsDir, name)).isDirectory())
		.filter((name) => {
			try {
				return statSync(path.join(mapsDir, name, 'map.json')).isFile();
			} catch {
				return false;
			}
		})
		.sort();
}

export function buildMapIndex(mapsDir: string = DEFAULT_MAPS_DIR): MapIndexEntry[] {
	return listMapIds(mapsDir).map((id) => {
		const map = JSON.parse(readFileSync(path.join(mapsDir, id, 'map.json'), 'utf8')) as MapJson;
		const types = [...new Set(map.targets.map((t) => t.type))];
		if (types.length !== 1) {
			throw new Error(`${id}: expected one target type, found ${JSON.stringify(types)}`);
		}
		return {
			id: map.id,
			country: map.country,
			targetCount: map.targets.length,
			targetType: types[0]
		};
	});
}

/** Exactly what gets written to disk, so the test can compare byte-for-byte. */
export function serializeMapIndex(entries: MapIndexEntry[]): string {
	return JSON.stringify(entries, null, '\t') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	const entries = buildMapIndex();
	const out = path.join(DEFAULT_MAPS_DIR, 'index.json');
	writeFileSync(out, serializeMapIndex(entries));
	console.log(`Wrote ${entries.length} maps to ${path.relative(process.cwd(), out)}`);
}
