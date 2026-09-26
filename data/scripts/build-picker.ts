// Builds the world picker (FT-76, docs/PLAN_V0.13.md): the map the home
// screen opens on. It holds the same 172 countries as the six continents'
// Countries maps, each tagged with its continent, so a tap can go world ->
// continent -> that country's maps. It is not a map anyone plays: it has no
// map.json (every scan for maps skips it), no terrain, no facts, no tour.
//
// Each continent is filtered and clipped exactly as its Countries map is
// (MAPS.md), so France has no French Guiana and the USA no Hawaii, and a
// country sits on the continent whose Countries map lists it. One change:
// Europe keeps all of Russia, so the world view has no hole where Siberia
// is. Each continent also records its Countries map's box as the view the
// home screen fits to, so "Europe" frames Europe rather than Europe plus
// Siberia.
//
//   npx tsx data/scripts/build-picker.ts [--simplify=5%] [--max-zoom=5]
//
// Writes data/maps/world-picker/tiles.pmtiles and picker.json.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
	ADMIN0_SHP,
	COUNTRY_FIELDS,
	REPO_ROOT,
	boundsOf,
	missingSources,
	parseArgs,
	pmtilesConvert,
	reassignAdmin1,
	slugify
} from './mapBuildUtils.js';
import {
	COUNTRY_NAME_FIXUPS,
	COUNTRY_TYPES,
	NOT_COUNTRIES,
	countryNames,
	type NameLanguage,
	polygonAreaKm2,
	sqlIn,
	sqlString
} from './multiCountry.js';
import { interiorPoint, type AnyGeometry } from './factGeometry.js';

type Box = [number, number, number, number];

interface ContinentSpec {
	/** Natural Earth's CONTINENT value, and the name the home screen shows. */
	name: string;
	/** What cuts the shapes: the Countries map's --clip, except Europe's. */
	clip: string;
	/** The box the continent view fits to: its Countries map's extent. */
	view: Box;
	assignAdmin1?: string;
}

// From MAPS.md's six `--level=country` commands. --min-area is 2500 for all.
const CONTINENTS: ContinentSpec[] = [
	{
		name: 'Europe',
		clip: '-25,34,180,82',
		view: [-25, 34, 60, 72],
		assignAdmin1: 'Crimea,Sevastopol:Ukraine'
	},
	{ name: 'Africa', clip: '-26,-36,64,38', view: [-26, -36, 64, 38] },
	{ name: 'Asia', clip: '25,-12,150,56', view: [25, -12, 150, 56] },
	{
		name: 'North America',
		clip: 'POLYGON((-150 5,-50 5,-50 84,-170 84,-170 30,-150 30,-150 5))',
		view: [-170, 5, -50, 84]
	},
	{ name: 'South America', clip: '-92,-56,-30,13', view: [-92, -56, -30, 13] },
	{ name: 'Oceania', clip: '110,-50,180,0', view: [110, -50, 180, 0] }
];
const MIN_AREA_KM2 = 2500;

interface Feature {
	type: 'Feature';
	properties: Record<string, string>;
	geometry: { type: string; coordinates: unknown };
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const simplify = args.simplify ?? '5%';
	const maxZoom = Number(args['max-zoom'] ?? 5);
	const missing = missingSources([ADMIN0_SHP]);
	if (missing.length > 0) {
		console.error(
			`Missing sources (run data/scripts/fetch-natural-earth.sh):\n  ${missing.join('\n  ')}`
		);
		process.exit(1);
	}

	const outDir = path.join(REPO_ROOT, 'data/maps/world-picker');
	mkdirSync(outDir, { recursive: true });
	const mergedPath = path.join(outDir, '.tmp-merged.geojson');
	const simplifiedPath = path.join(outDir, '.tmp-simplified.geojson');
	const mbtilesPath = path.join(outDir, '.tmp.mbtiles');
	const landRawPath = path.join(outDir, '.tmp-land-raw.geojson');
	const landPath = path.join(outDir, '.tmp-land.geojson');

	console.log('[1/4] Filtering and clipping each continent as its Countries map does...');
	const features: Feature[] = [];
	// Each country's names in the other languages (#71), by id; not in the tiles.
	const namesOf = new Map<string, Partial<Record<NameLanguage, string>>>();
	for (const spec of CONTINENTS) {
		const partPath = path.join(outDir, `.tmp-${slugify(spec.name)}.geojson`);
		const where = [
			sqlIn('TYPE', COUNTRY_TYPES),
			`NOT (${sqlIn('ADMIN', NOT_COUNTRIES)})`,
			`CONTINENT = ${sqlString(spec.name)}`
		].join(' AND ');
		const clipArgs = [
			'-clipsrc',
			...(spec.clip.includes('(') ? [spec.clip] : spec.clip.split(','))
		];
		execFileSync('ogr2ogr', [
			'-f',
			'GeoJSON',
			'-where',
			where,
			...clipArgs,
			'-nlt',
			'MULTIPOLYGON',
			'-select',
			COUNTRY_FIELDS.join(','),
			partPath,
			ADMIN0_SHP
		]);
		if (spec.assignAdmin1) reassignAdmin1(partPath, spec.assignAdmin1, outDir);
		const part: { features: Feature[] } = JSON.parse(readFileSync(partPath, 'utf-8'));
		rmSync(partPath);
		let kept = 0;
		for (const feature of part.features) {
			const p = feature.properties;
			const englishName = p.NAME_EN || p.ADMIN;
			const name = COUNTRY_NAME_FIXUPS[englishName] ?? englishName;
			if (polygonAreaKm2(feature.geometry) < MIN_AREA_KM2) continue;
			// Only what the home screen reads travels into the tiles.
			const names = countryNames(name, p.NAME_IT, p.NAME_DE);
			if (Object.keys(names).length > 0) namesOf.set(slugify(name), names);
			feature.properties = { id: slugify(name), name, continent: slugify(spec.name) };
			features.push(feature);
			kept++;
		}
		console.log(`      ${spec.name}: ${kept}`);
	}
	writeFileSync(mergedPath, JSON.stringify({ type: 'FeatureCollection', features }));

	// All the land, as one pale shape under the countries (FT-77): Greenland,
	// Antarctica and the parts the continents' clips cut away (French Guiana,
	// Hawaii) would otherwise be holes in the world view. Not tappable.
	console.log('[1b/4] The land underneath...');
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-clipsrc',
		'-180',
		'-60',
		'180',
		'84',
		'-nlt',
		'MULTIPOLYGON',
		'-select',
		'ADMIN',
		landRawPath,
		ADMIN0_SHP
	]);
	execFileSync(
		'npx',
		[
			'mapshaper',
			landRawPath,
			'-dissolve',
			'-simplify',
			simplify,
			'keep-shapes',
			'-clean',
			'-o',
			landPath,
			'format=geojson',
			// With no fields left, mapshaper would write a GeometryCollection,
			// which tippecanoe does not read.
			'geojson-type=FeatureCollection',
			'precision=0.001'
		],
		{ stdio: 'inherit' }
	);

	console.log(`[2/4] Simplifying to ${simplify} (mapshaper)...`);
	execFileSync(
		'npx',
		[
			'mapshaper',
			mergedPath,
			'-simplify',
			simplify,
			'keep-shapes',
			'-clean',
			'-o',
			simplifiedPath,
			'format=geojson',
			'precision=0.001'
		],
		{ stdio: 'inherit' }
	);
	const simplified: { features: Feature[] } = JSON.parse(readFileSync(simplifiedPath, 'utf-8'));

	console.log('[3/4] Writing picker.json...');
	const countries = simplified.features.map((f) => {
		const { bbox } = boundsOf(f.geometry);
		const [lon, lat] = interiorPoint(f.geometry as AnyGeometry);
		return {
			id: f.properties.id,
			name: f.properties.name,
			continent: f.properties.continent,
			...(namesOf.has(f.properties.id) ? { names: namesOf.get(f.properties.id) } : {}),
			bbox: bbox.map((v) => Math.round(v * 1000) / 1000),
			centroid: [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]
		};
	});
	countries.sort((a, b) => a.id.localeCompare(b.id));
	const picker = {
		id: 'world-picker',
		attribution: 'Natural Earth (public domain), https://www.naturalearthdata.com',
		tiles: 'tiles.pmtiles',
		continents: CONTINENTS.map((spec) => ({
			id: slugify(spec.name),
			name: spec.name,
			view: spec.view
		})),
		countries
	};
	writeFileSync(path.join(outDir, 'picker.json'), JSON.stringify(picker, null, '\t') + '\n');

	console.log(`[4/4] Building vector tiles, zoom 0-${maxZoom} (tippecanoe + pmtiles convert)...`);
	execFileSync('tippecanoe', [
		'--output',
		mbtilesPath,
		'--force',
		'--minimum-zoom=0',
		`--maximum-zoom=${maxZoom}`,
		'--name=World picker',
		'--attribution=Natural Earth (public domain)',
		'--generate-ids',
		'--detect-shared-borders',
		'-L',
		`land:${landPath}`,
		'-L',
		`countries:${simplifiedPath}`
	]);
	pmtilesConvert(mbtilesPath, path.join(outDir, 'tiles.pmtiles'));
	rmSync(mergedPath);
	rmSync(simplifiedPath);
	rmSync(landRawPath);
	rmSync(landPath);
	rmSync(mbtilesPath, { force: true });

	const bytes = statSync(path.join(outDir, 'tiles.pmtiles')).size;
	console.log(
		`Done: ${countries.length} countries, tiles ${(bytes / 1024).toFixed(0)} KB ` +
			`(simplify ${simplify}, max zoom ${maxZoom}).`
	);
}

main();
