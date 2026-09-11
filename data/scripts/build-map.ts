// Builds one demo map package from the Natural Earth admin-1 dataset:
// filters by country, simplifies geometry, builds a PMTiles tileset, and
// derives a draft map.json (Target[] + a default north-to-south tour
// order) for manual curation afterward.
//
// Usage:
//   npx tsx data/scripts/build-map.ts --country="Italy" --out=data/maps/italy-regions --type=region --name="Italy — Regions"

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const SOURCE_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_admin_1_states_provinces/ne_10m_admin_1_states_provinces.shp'
);
const LAKES_SHP = path.join(REPO_ROOT, 'data/source/ne_10m_lakes/ne_10m_lakes.shp');
const FIELDS = 'name,name_alt,name_local,iso_3166_2,type,type_en,admin,region';

// Natural Earth sometimes gives an English name where the country's own
// language is expected (e.g. Italy's regions). Fixed at the source so
// map.json, the polygon layer, and the label layer all agree.
const NAME_FIXUPS: Record<string, Record<string, string>> = {
	Italy: { Apulia: 'Puglia', Sicily: 'Sicilia' }
};

function parseArgs(argv: string[]) {
	const out: Record<string, string> = {};
	for (const arg of argv) {
		const match = /^--([^=]+)=(.*)$/.exec(arg);
		if (match) out[match[1]] = match[2];
	}
	return out;
}

function slugify(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

type Geometry = { type: string; coordinates: unknown };

function boundsOf(geometry: Geometry): {
	bbox: [number, number, number, number];
	center: [number, number];
} {
	const lons: number[] = [];
	const lats: number[] = [];
	const walk = (coords: unknown): void => {
		if (typeof (coords as number[])[0] === 'number') {
			const [lon, lat] = coords as unknown as [number, number];
			lons.push(lon);
			lats.push(lat);
		} else {
			for (const c of coords as unknown[]) walk(c);
		}
	};
	walk(geometry.coordinates);

	const minLat = Math.min(...lats);
	const maxLat = Math.max(...lats);

	// Antimeridian-crossing shapes (e.g. Alaska's Aleutians) have points on
	// both sides of +/-180deg, so naive min/max spans the globe "the long
	// way" and yields a nonsense centroid. Shift whichever side is smaller
	// so the shape becomes numerically contiguous, then unwrap back.
	let workingLons = lons;
	if (Math.max(...lons) - Math.min(...lons) > 180) {
		const shiftedPositive = lons.map((lon) => (lon > 0 ? lon - 360 : lon));
		const shiftedNegative = lons.map((lon) => (lon < 0 ? lon + 360 : lon));
		const spanPositive = Math.max(...shiftedPositive) - Math.min(...shiftedPositive);
		const spanNegative = Math.max(...shiftedNegative) - Math.min(...shiftedNegative);
		workingLons = spanPositive <= spanNegative ? shiftedPositive : shiftedNegative;
	}
	const wrap = (lon: number) => (lon < -180 ? lon + 360 : lon > 180 ? lon - 360 : lon);
	const minWorking = Math.min(...workingLons);
	const maxWorking = Math.max(...workingLons);

	return {
		bbox: [wrap(minWorking), minLat, wrap(maxWorking), maxLat],
		center: [wrap((minWorking + maxWorking) / 2), (minLat + maxLat) / 2]
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const country = args.country;
	const outDir = args.out;
	const type = args.type ?? 'region';
	const mapName = args.name ?? `${country} — ${type === 'state' ? 'States' : 'Regions'}`;
	// Some countries' admin-1 features in Natural Earth are finer than the
	// level we want (e.g. Italy's admin-1 is provinces, with regions only
	// available as an attribute). --dissolve=<field> merges same-attribute
	// features into one shape per value before deriving targets.
	const dissolveField = args.dissolve;
	// --exclude=Alaska,Hawaii drops named features by their `name` field
	// (pre-dissolve) — e.g. USA's far-flung Alaska/Hawaii, which are more
	// trouble (antimeridian wraparound, huge dead map space) than they're
	// worth for a demo map.
	const exclude = args.exclude
		? args.exclude.split(',').map((s) => s.trim())
		: [];

	if (!country || !outDir) {
		console.error(
			'Usage: build-map.ts --country="Italy" --out=data/maps/italy-regions [--type=region|state] [--name="Italy — Regions"] [--dissolve=region] [--exclude=Alaska,Hawaii]'
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
	const simplifiedPath = path.join(absOutDir, '.tmp-simplified.geojson');
	const labelsPath = path.join(absOutDir, '.tmp-labels.geojson');
	const lakesPath = path.join(absOutDir, '.tmp-lakes.geojson');
	const mbtilesPath = path.join(absOutDir, '.tmp-tiles.mbtiles');
	const pmtilesPath = path.join(absOutDir, 'tiles.pmtiles');
	const mapJsonPath = path.join(absOutDir, 'map.json');
	const tourJsonPath = path.join(absOutDir, 'tour.json');

	console.log(`[1/6] Filtering "${country}" from Natural Earth admin-1 dataset...`);
	const whereClause =
		`admin='${country}'` +
		(exclude.length ? ` AND name NOT IN (${exclude.map((n) => `'${n}'`).join(',')})` : '');
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-where',
		whereClause,
		'-select',
		FIELDS,
		filteredPath,
		SOURCE_SHP
	]);

	const mapshaperArgs = [filteredPath];
	if (dissolveField) {
		console.log(`[2/6] Dissolving by "${dissolveField}" and simplifying geometry (mapshaper)...`);
		mapshaperArgs.push('-dissolve', dissolveField, '-rename-fields', `name=${dissolveField}`);
	} else {
		console.log('[2/6] Simplifying geometry (mapshaper)...');
	}
	mapshaperArgs.push(
		'-simplify',
		'10%',
		'keep-shapes',
		'-clean',
		'-o',
		simplifiedPath,
		'format=geojson',
		'precision=0.0001'
	);
	execFileSync('npx', ['mapshaper', ...mapshaperArgs], { stdio: 'inherit' });

	console.log('[3/6] Fixing up names and deriving draft map.json...');
	const geojson = JSON.parse(readFileSync(simplifiedPath, 'utf-8'));
	const fixups = NAME_FIXUPS[country] ?? {};
	for (const feature of geojson.features) {
		const fixed = fixups[feature.properties.name];
		if (fixed) feature.properties.name = fixed;
	}
	writeFileSync(simplifiedPath, JSON.stringify(geojson));

	const targets = geojson.features.map((feature: any) => {
		const p = feature.properties;
		const { bbox, center } = boundsOf(feature.geometry);
		return {
			id: slugify(p.name),
			name: p.name as string,
			type,
			tier: 1,
			aliases: [] as string[],
			centroid: center,
			bbox
		};
	});
	targets.sort((a: any, b: any) => b.centroid[1] - a.centroid[1]); // north to south, default

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

	// Draft guided-tour script: default dwell per step, in map.json's
	// already-curated tourOrder (a north-to-south sweep, see Iteration 1).
	// Narration text is left for manual curation later, same as aliases/tiers.
	const DEFAULT_DWELL_MS = 3000;
	const tour = {
		mapId: mapDefinition.id,
		steps: mapDefinition.tourOrder.map((targetId: string) => ({
			targetId,
			dwellMs: DEFAULT_DWELL_MS
		}))
	};
	writeFileSync(tourJsonPath, JSON.stringify(tour, null, '\t') + '\n');

	// A separate point layer, one feature per target at its precomputed
	// centroid, so labels render once per feature. Relying on MapLibre's
	// default polygon-label placement instead causes a duplicate label
	// wherever a region's polygon is split across tile boundaries.
	const labelsGeojson = {
		type: 'FeatureCollection',
		features: targets.map((t: any) => ({
			type: 'Feature',
			properties: { name: t.name, id: t.id },
			geometry: { type: 'Point', coordinates: t.centroid }
		}))
	};
	writeFileSync(labelsPath, JSON.stringify(labelsGeojson));

	// Water context: without lakes rendered, a state whose border runs
	// along one (Michigan on the Great Lakes is the worst case - two
	// peninsulas with no visual indication there's a lake, not just a gap
	// in the data, between them and their neighbors) reads as a confusing
	// blob rather than a recognizable coastline. Select by bounding-box
	// intersection with this map's overall extent (`-spat`, a feature
	// filter, not a geometry clip) rather than by country - lakes aren't
	// tagged by admin boundary the way states are, and a lake is still
	// worth rendering even if it pokes slightly outside the map's bounds.
	console.log('[4/6] Selecting nearby lakes for context...');
	const overallBbox = targets.reduce(
		(acc: [number, number, number, number], t: any) => [
			Math.min(acc[0], t.bbox[0]),
			Math.min(acc[1], t.bbox[1]),
			Math.max(acc[2], t.bbox[2]),
			Math.max(acc[3], t.bbox[3])
		],
		[Infinity, Infinity, -Infinity, -Infinity]
	);
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-spat',
		...overallBbox.map(String),
		'-select',
		'name',
		lakesPath,
		LAKES_SHP
	]);

	console.log('[5/6] Building vector tiles (tippecanoe + pmtiles convert)...');
	execFileSync('tippecanoe', [
		'--output',
		mbtilesPath,
		'--force',
		'--minimum-zoom=0',
		'--maximum-zoom=8',
		`--name=${mapName}`,
		'--attribution=Natural Earth (public domain)',
		'--generate-ids',
		'-L',
		`targets:${simplifiedPath}`,
		'-L',
		`labels:${labelsPath}`,
		'-L',
		`lakes:${lakesPath}`
	]);
	execFileSync(path.join(process.env.HOME ?? '', '.local/bin/pmtiles'), [
		'convert',
		mbtilesPath,
		pmtilesPath
	]);

	console.log('[6/6] Cleaning up...');
	rmSync(filteredPath);
	rmSync(simplifiedPath);
	rmSync(labelsPath);
	rmSync(lakesPath);
	rmSync(mbtilesPath);

	console.log(`Done: ${targets.length} targets -> ${mapJsonPath}`);
	console.log(`Tour -> ${tourJsonPath}`);
	console.log(`Tiles -> ${pmtilesPath}`);
}

main();
