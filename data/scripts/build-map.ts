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
const FIELDS = 'name,name_alt,name_local,iso_3166_2,type,type_en,admin,region';

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

	if (!country || !outDir) {
		console.error(
			'Usage: build-map.ts --country="Italy" --out=data/maps/italy-regions [--type=region|state] [--name="Italy — Regions"] [--dissolve=region]'
		);
		process.exit(1);
	}
	if (!existsSync(SOURCE_SHP)) {
		console.error(
			`Source shapefile not found at ${SOURCE_SHP}. Run data/scripts/fetch-natural-earth.sh first.`
		);
		process.exit(1);
	}

	const absOutDir = path.resolve(REPO_ROOT, outDir);
	mkdirSync(absOutDir, { recursive: true });

	const filteredPath = path.join(absOutDir, '.tmp-filtered.geojson');
	const simplifiedPath = path.join(absOutDir, '.tmp-simplified.geojson');
	const mbtilesPath = path.join(absOutDir, '.tmp-tiles.mbtiles');
	const pmtilesPath = path.join(absOutDir, 'tiles.pmtiles');
	const mapJsonPath = path.join(absOutDir, 'map.json');

	console.log(`[1/4] Filtering "${country}" from Natural Earth admin-1 dataset...`);
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-where',
		`admin='${country}'`,
		'-select',
		FIELDS,
		filteredPath,
		SOURCE_SHP
	]);

	const mapshaperArgs = [filteredPath];
	if (dissolveField) {
		console.log(`[2/4] Dissolving by "${dissolveField}" and simplifying geometry (mapshaper)...`);
		mapshaperArgs.push('-dissolve', dissolveField, '-rename-fields', `name=${dissolveField}`);
	} else {
		console.log('[2/4] Simplifying geometry (mapshaper)...');
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

	console.log('[3/4] Building vector tiles (tippecanoe + pmtiles convert)...');
	execFileSync('tippecanoe', [
		'--output',
		mbtilesPath,
		'--force',
		'--minimum-zoom=0',
		'--maximum-zoom=8',
		'--layer=targets',
		`--name=${mapName}`,
		'--attribution=Natural Earth (public domain)',
		'--generate-ids',
		simplifiedPath
	]);
	execFileSync(path.join(process.env.HOME ?? '', '.local/bin/pmtiles'), [
		'convert',
		mbtilesPath,
		pmtilesPath
	]);

	console.log('[4/4] Deriving draft map.json...');
	const geojson = JSON.parse(readFileSync(simplifiedPath, 'utf-8'));
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

	rmSync(filteredPath);
	rmSync(simplifiedPath);
	rmSync(mbtilesPath);

	console.log(`Done: ${targets.length} targets -> ${mapJsonPath}`);
	console.log(`Tiles -> ${pmtilesPath}`);
}

main();
