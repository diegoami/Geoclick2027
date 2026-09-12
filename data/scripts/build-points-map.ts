// Builds one point-target map package (towns/cities) from Natural Earth's
// populated-places dataset: filters by country + a minimum population,
// builds a PMTiles tileset, and derives a draft map.json (Target[] with
// point geometry) for manual curation afterward.
//
// A separate script from build-map.ts on purpose, not a --type flag
// added to it - populated places need no dissolve, no polygon
// simplification, and no separate "labels" layer (a point target's own
// geometry already is its label anchor, unlike a polygon's). See
// MAPS.md's "Point-target implementation" section for the full reasoning.
//
// Usage:
//   npx tsx data/scripts/build-points-map.ts --country="Italy" --out=data/maps/italy-towns-100k --name-field=NAME_IT --min-population=100000 --name="Italy — Towns"

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
	REPO_ROOT,
	LAKES_SHP,
	parseArgs,
	slugify,
	overallBboxOf,
	selectNearbyLakes
} from './mapBuildUtils.js';

const SOURCE_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_populated_places/ne_10m_populated_places.shp'
);

function main() {
	const args = parseArgs(process.argv.slice(2));
	const country = args.country; // matches the dataset's ADM0NAME field
	const outDir = args.out;
	const minPopulation = Number(args['min-population'] ?? 100000);
	// Which localized name field to prefer (e.g. NAME_IT, NAME_DE) - falls
	// back to the plain NAME field (usually English) for any row where the
	// localized one is empty, same spirit as build-map.ts's NAME_FIXUPS but
	// using a field the dataset already provides instead of a manual table.
	const nameField = args['name-field'] ?? 'NAME';
	const mapName = args.name ?? `${country} — Towns`;

	if (!country || !outDir) {
		console.error(
			'Usage: build-points-map.ts --country="Italy" --out=data/maps/italy-towns-100k [--name-field=NAME_IT] [--min-population=100000] [--name="Italy — Towns"]'
		);
		process.exit(1);
	}
	if (!existsSync(SOURCE_SHP) || !existsSync(LAKES_SHP)) {
		console.error(
			`Source shapefile not found (${SOURCE_SHP} / ${LAKES_SHP}). Run data/scripts/fetch-natural-earth.sh first.`
		);
		process.exit(1);
	}

	const absOutDir = path.resolve(REPO_ROOT, outDir);
	mkdirSync(absOutDir, { recursive: true });

	const filteredPath = path.join(absOutDir, '.tmp-filtered.geojson');
	const targetsPath = path.join(absOutDir, '.tmp-targets.geojson');
	const lakesPath = path.join(absOutDir, '.tmp-lakes.geojson');
	const mbtilesPath = path.join(absOutDir, '.tmp-tiles.mbtiles');
	const pmtilesPath = path.join(absOutDir, 'tiles.pmtiles');
	const mapJsonPath = path.join(absOutDir, 'map.json');
	const tourJsonPath = path.join(absOutDir, 'tour.json');

	console.log(`[1/5] Filtering "${country}" (population > ${minPopulation}) from Natural Earth...`);
	// POP_MAX, deliberately, not POP_MIN or the POPxxxx yearly fields -
	// checked all three against known-tricky rows before choosing: POP_MIN
	// reads as flatly wrong for some capitals (Rome: 35,452 - a real bug in
	// the source data, would silently exclude Italy's own capital from a
	// ">100k" list), and the yearly POPxxxx fields are only populated for a
	// handful of the world's largest cities (0/missing for all but a few
	// rows checked here). POP_MAX sometimes reads as an urban-agglomeration
	// estimate rather than city-proper (inflates a few German cities, e.g.
	// Stuttgart/Mannheim, well past their real city population) - but it
	// never wrongly *excludes* a real major city, which is the safer
	// failure mode for a threshold filter. Disclosed in MAPS.md.
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-where',
		`ADM0NAME='${country}' AND POP_MAX > ${minPopulation}`,
		'-select',
		`${nameField},NAME,POP_MAX`,
		filteredPath,
		SOURCE_SHP
	]);

	console.log('[2/5] Deriving draft map.json...');
	const geojson = JSON.parse(readFileSync(filteredPath, 'utf-8'));
	const targets = geojson.features.map((feature: any) => {
		const p = feature.properties;
		const name: string = p[nameField] || p.NAME;
		const centroid = feature.geometry.coordinates as [number, number];
		return {
			id: slugify(name),
			name,
			type: 'city',
			tier: 1,
			aliases: [] as string[],
			centroid,
			// Degenerate, not a real extent - a point target has no area.
			// TourView branches on target.type before reading bbox for
			// camera framing; see mapDefinition.ts and MAPS.md.
			bbox: [...centroid, ...centroid] as [number, number, number, number]
		};
	});
	targets.sort((a: any, b: any) => b.centroid[1] - a.centroid[1]); // north to south, same convention as build-map.ts

	const mapDefinition = {
		id: path.basename(outDir),
		name: mapName,
		country,
		attribution: 'Natural Earth (public domain), https://www.naturalearthdata.com',
		tiles: 'tiles.pmtiles',
		targets,
		tourOrder: targets.map((t: any) => t.id)
	};
	writeFileSync(mapJsonPath, JSON.stringify(mapDefinition, null, '\t') + '\n');

	const DEFAULT_DWELL_MS = 3000;
	const tour = {
		mapId: mapDefinition.id,
		steps: mapDefinition.tourOrder.map((targetId: string) => ({
			targetId,
			dwellMs: DEFAULT_DWELL_MS
		}))
	};
	writeFileSync(tourJsonPath, JSON.stringify(tour, null, '\t') + '\n');

	// Clean targets GeoJSON for the tileset - name/id only, not the raw
	// dataset's field names, so the 'targets' source-layer matches what
	// build-map.ts's polygon maps produce (promoteId: 'name' needs a plain
	// `name` property either way). No separate "labels" layer for points -
	// a point's own geometry already is its label anchor.
	const targetsGeojson = {
		type: 'FeatureCollection',
		features: targets.map((t: any) => ({
			type: 'Feature',
			properties: { name: t.name, id: t.id },
			geometry: { type: 'Point', coordinates: t.centroid }
		}))
	};
	writeFileSync(targetsPath, JSON.stringify(targetsGeojson));

	console.log('[3/5] Selecting nearby lakes for context...');
	selectNearbyLakes(overallBboxOf(targets), lakesPath);

	console.log('[4/5] Building vector tiles (tippecanoe + pmtiles convert)...');
	// --drop-rate=1: tippecanoe's default behavior thins out point features
	// at lower zoom levels for visual decluttering (a general-basemap
	// assumption) - caught directly, not assumed, by checking
	// queryRenderedFeatures against a built tileset and finding only 4 of
	// 40 city markers actually rendered at the map's initial (zoomed-out,
	// whole-country) view. Every target has to be hittable at whatever zoom
	// the quiz displays it at, since it's a fixed curated set, not a
	// general map - --drop-rate=1 disables that thinning entirely.
	execFileSync('tippecanoe', [
		'--output',
		mbtilesPath,
		'--force',
		'--minimum-zoom=0',
		'--maximum-zoom=8',
		'--drop-rate=1',
		`--name=${mapName}`,
		'--attribution=Natural Earth (public domain)',
		'--generate-ids',
		'-L',
		`targets:${targetsPath}`,
		'-L',
		`lakes:${lakesPath}`
	]);
	execFileSync(path.join(process.env.HOME ?? '', '.local/bin/pmtiles'), [
		'convert',
		mbtilesPath,
		pmtilesPath
	]);

	console.log('[5/5] Cleaning up...');
	rmSync(filteredPath);
	rmSync(targetsPath);
	rmSync(lakesPath);
	rmSync(mbtilesPath);

	console.log(`Done: ${targets.length} targets -> ${mapJsonPath}`);
	console.log(`Tour -> ${tourJsonPath}`);
	console.log(`Tiles -> ${pmtilesPath}`);
}

main();
