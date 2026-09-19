// Builds the Terrain tileset (terrain.pmtiles) for maps that already exist.
//
// Both map builders write this file for any map they build from now on, but
// the 63 maps that shipped before v0.8.0 already have their tiles.pmtiles and
// there is no reason to rebuild those: the Terrain layer is a SEPARATE
// archive, so the existing tilesets do not change at all. Rebuilding them
// anyway would mean 63 binary files in one commit, each differing only by
// whatever the current tippecanoe emits - MAPS.md's reproducibility note
// warns that tilesets are not byte-identical across versions, which is
// exactly why a rebuild nobody asked for is a bad idea.
//
// The bbox comes from the committed map.json, so this produces the same
// coverage the builders would: the targets' overall box, padded.
//
// Usage:
//   npx tsx data/scripts/build-terrain.ts --map=italy-regions
//   npx tsx data/scripts/build-terrain.ts --all
//   npx tsx data/scripts/build-terrain.ts --all --force   (rebuild existing)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
	REPO_ROOT,
	terrainMaxZoom,
	PHYSICAL_SHPS,
	missingSources,
	parseArgs,
	overallBboxOf,
	crossesAntimeridian,
	selectPhysical,
	physicalPaths,
	buildTerrainTileset,
	cleanupPhysical,
	padBbox
} from './mapBuildUtils.js';

const MAPS_DIR = path.join(REPO_ROOT, 'data/maps');
// How far past the targets a terrain NAME may still be drawn. Small: the
// polygons reach much further (padBbox's default) so the sea covers the
// screen, but a name out there belongs to a country this map is not about.
const LABEL_MARGIN = 0.05;

interface MapJson {
	name: string;
	targets: { bbox: [number, number, number, number]; crossesAntimeridian?: boolean }[];
}

function buildOne(mapId: string, force: boolean): { built: boolean; bytes: number; zoom: number } {
	const absOutDir = path.join(MAPS_DIR, mapId);
	const outPath = path.join(absOutDir, 'terrain.pmtiles');
	if (existsSync(outPath) && !force)
		return { built: false, bytes: statSync(outPath).size, zoom: 0 };

	const mapJson: MapJson = JSON.parse(readFileSync(path.join(absOutDir, 'map.json'), 'utf8'));
	// Same guard the lakes selection needs: a target that wraps +/-180deg
	// makes a naive min/max box span the globe the long way round, which
	// would clip the whole world's ocean into one map (see
	// crossesAntimeridian's note). Those targets are left out of the box.
	const usable = mapJson.targets.filter(
		(t) => !t.crossesAntimeridian && !crossesAntimeridian(t.bbox)
	);
	const unpadded = overallBboxOf(usable.length > 0 ? usable : mapJson.targets);
	const bbox = padBbox(unpadded);

	const physical = physicalPaths(absOutDir);
	// Polygons out to the padded box so the sea reaches the screen edge;
	// names only where the map actually is.
	selectPhysical(bbox, physical, padBbox(unpadded, LABEL_MARGIN));
	buildTerrainTileset(physical, { absOutDir, mapName: mapJson.name, bbox });
	cleanupPhysical(physical);
	return { built: true, bytes: statSync(outPath).size, zoom: terrainMaxZoom(bbox) };
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const force = 'force' in args || process.argv.includes('--force');
	const all = 'all' in args || process.argv.includes('--all');

	const missing = missingSources(PHYSICAL_SHPS);
	if (missing.length > 0) {
		console.error(
			`Source shapefile(s) not found:\n  ${missing.join('\n  ')}\n` +
				'Run data/scripts/fetch-natural-earth.sh first.'
		);
		process.exit(1);
	}

	const mapIds = all
		? readdirSync(MAPS_DIR).filter((d) => existsSync(path.join(MAPS_DIR, d, 'map.json')))
		: [args.map];
	if (mapIds.length === 0 || !mapIds[0]) {
		console.error('Give --map=<id> or --all.');
		process.exit(1);
	}

	let total = 0;
	for (const [index, mapId] of mapIds.entries()) {
		const { built, bytes, zoom } = buildOne(mapId, force);
		total += bytes;
		const kb = `${(bytes / 1024).toFixed(1)} KB`.padStart(9);
		console.log(
			`[${String(index + 1).padStart(2)}/${mapIds.length}] ${mapId.padEnd(24)} ${kb}` +
				(built ? `  z0-${zoom}` : '  (kept)')
		);
	}
	console.log(`\n${mapIds.length} maps, ${(total / 1024 / 1024).toFixed(2)} MB of terrain tiles.`);
}

main();
