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
import {
	REPO_ROOT,
	LAKES_SHP,
	parseArgs,
	slugify,
	overallBboxOf,
	selectNearbyLakes,
	pmtilesConvert,
	crossesAntimeridian
} from './mapBuildUtils.js';
import { colorizeMapDir } from './mapColors.js';

const SOURCE_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_admin_1_states_provinces/ne_10m_admin_1_states_provinces.shp'
);
const BASE_FIELDS = ['name', 'name_alt', 'name_local', 'iso_3166_2', 'type', 'type_en', 'admin', 'region', 'geonunit'];

// Natural Earth sometimes gives an English/French/German name where the
// country's own language is expected (regions: Apulia/Sicily; provinces:
// Aoste/Bozen/Turin), and sometimes just has a typo (Crotene/Oristrano
// aren't real Italian province names) - both fixed here so map.json, the
// polygon layer, and the label layer all agree. Audited against every one
// of the 110 raw province records directly, not spot-checked, when the
// italy-provinces map was added (see MAPS.md).
const NAME_FIXUPS: Record<string, Record<string, string>> = {
	Italy: {
		Apulia: 'Puglia',
		Sicily: 'Sicilia',
		Aoste: 'Aosta',
		Bozen: 'Bolzano',
		Turin: 'Torino',
		Crotene: 'Crotone',
		Oristrano: 'Oristano'
	},
	// Spain's post-dissolve `region` values are mostly clean Spanish already
	// (Cataluña, Andalucía, ...) except two names missing the noun their
	// adjective describes (Canary Is./Ceuta/Melilla are excluded outright,
	// not fixed up - see --exclude in MAPS.md).
	Spain: {
		'Foral de Navarra': 'Navarra',
		// Kept as the full "Comunidad Valenciana", not just "Valencia" -
		// unlike Navarra (a single-province region, no ambiguity), the
		// Valencian Community contains a same-named Valencia *province*, so
		// dropping the qualifier would collide with a possible future
		// finer-level map the way it wouldn't for Navarra.
		Valenciana: 'Comunidad Valenciana'
	},
	// Poland's plain `name` field is English-translated ("Silesian", "Lesser
	// Poland" - see --name-field=name_pl below), and `name_pl` itself is the
	// full official form ("województwo śląskie"). Trimmed to the adjective
	// alone, capitalized - how voivodeships are actually referred to in
	// Polish outside formal/legal text (same convention Italy's regions
	// already use: "Toscana", not "Regione Toscana").
	Poland: {
		'województwo śląskie': 'Śląskie',
		'województwo małopolskie': 'Małopolskie',
		'województwo podkarpackie': 'Podkarpackie',
		'województwo dolnośląskie': 'Dolnośląskie',
		'województwo opolskie': 'Opolskie',
		'województwo podlaskie': 'Podlaskie',
		'województwo warmińsko-mazurskie': 'Warmińsko-Mazurskie',
		'województwo lubuskie': 'Lubuskie',
		'województwo zachodniopomorskie': 'Zachodniopomorskie',
		'województwo lubelskie': 'Lubelskie',
		'województwo pomorskie': 'Pomorskie',
		'województwo mazowieckie': 'Mazowieckie',
		'województwo łódzkie': 'Łódzkie',
		'województwo kujawsko-pomorskie': 'Kujawsko-Pomorskie',
		'województwo wielkopolskie': 'Wielkopolskie',
		'województwo świętokrzyskie': 'Świętokrzyskie'
	},
	// Ukraine's plain `name` field mixes real transliterations with dated or
	// English-descriptive forms - fixed to the modern standard Ukrainian-
	// derived transliteration (the same "KyivNotKiev" convention interna-
	// tional style guides adopted after 2018/19), and the soft-sign
	// apostrophes (Donets'k, L'viv, ...) dropped for the common English
	// spelling. Crimea/Sevastopol (merged in via --extra-where, see above)
	// need no fixup - their plain names are already correct.
	Ukraine: {
		Kiev: 'Kyiv Oblast',
		'Kiev City': 'Kyiv',
		"L'viv": 'Lviv',
		"Luhans'k": 'Luhansk',
		"Donets'k": 'Donetsk',
		"Khmel'nyts'kyy": 'Khmelnytskyi',
		"Ternopil'": 'Ternopil',
		"Dnipropetrovs'k": 'Dnipropetrovsk',
		"Ivano-Frankivs'k": 'Ivano-Frankivsk',
		Odessa: 'Odesa',
		Transcarpathia: 'Zakarpattia'
	},
	// Sweden's `name` field is already correct Swedish (Norrbotten,
	// Västerbotten, ...) except one row missing its diacritic entirely -
	// confirmed against `name_sv` ("Örebro län"), not guessed.
	Sweden: {
		Orebro: 'Örebro'
	},
	// Finland's `name` field is inconsistent, not uniformly English or
	// uniformly Finnish - 6 of 18 rows (Kainuu, Kymenlaakso, Uusimaa,
	// Satakunta, Pirkanmaa, Päijät-Häme) are already the correct native
	// Finnish name, the other 12 are English translations. Fixed up to
	// native Finnish throughout (matching every other country's
	// local-name convention, e.g. Sweden/Poland/Ukraine above), using the
	// Finnish segment of `name_alt` (a pipe-separated Finnish|Swedish
	// list, Finland being officially bilingual) rather than a guess - and
	// the modern short form where `name_alt` lists an older formal one
	// first (Lapland's alt list starts "Lapin lääni" but also lists the
	// actual modern name "Lappi").
	Finland: {
		Lapland: 'Lappi',
		'Northern Ostrobothnia': 'Pohjois-Pohjanmaa',
		'North Karelia': 'Pohjois-Karjala',
		'South Karelia': 'Etelä-Karjala',
		'Finland Proper': 'Varsinais-Suomi',
		Ostrobothnia: 'Pohjanmaa',
		'Central Ostrobothnia': 'Keski-Pohjanmaa',
		'Northern Savonia': 'Pohjois-Savo',
		'Southern Savonia': 'Etelä-Savo',
		'Central Finland': 'Keski-Suomi',
		'Southern Ostrobothnia': 'Etelä-Pohjanmaa',
		'Tavastia Proper': 'Kanta-Häme'
	},
	// Russia's raw `name` field mixes three unrelated issues, found by
	// auditing all 86 rows (not spot-checked): one real data corruption
	// ("Maga Buryatdan" - confirmed via iso_3166_2 RU-MAG and name_local
	// "Магаданская область" that this is actually Magadan), one long
	// official title where every other similarly-sized region already
	// uses its short common name (Chukotka, not "Chukchi Autonomous
	// Okrug"), and the same soft-sign-apostrophe transliteration already
	// dropped for Ukraine's fixups above, applied here for the same
	// reason (Astrakhan/Ryazan/Yaroslavl/Tver/Perm/Primorye/Tyumen/
	// Ulyanovsk/Stavropol, not the apostrophed forms). Deliberately not a
	// full pass renaming every republic to its "-ia"-suffixed common
	// form (Chuvashia, Udmurtia, Kalmykia, ...) - those shorter adjectival
	// forms in the source aren't wrong, just less common, a different
	// class of issue from an actual data error or a stray apostrophe.
	Russia: {
		'Maga Buryatdan': 'Magadan',
		'Chukchi Autonomous Okrug': 'Chukotka',
		"Arkhangel'sk": 'Arkhangelsk',
		"Astrakhan'": 'Astrakhan',
		"Ryazan'": 'Ryazan',
		"Yaroslavl'": 'Yaroslavl',
		"Tver'": 'Tver',
		"Perm'": 'Perm',
		"Primor'ye": 'Primorye',
		"Tyumen'": 'Tyumen',
		"Ul'yanovsk": 'Ulyanovsk',
		"Stavropol'": 'Stavropol'
	}
};

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

async function main() {
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
	// worth for a demo map. --exclude-field picks a different field to match
	// against (e.g. `geonunit`, to drop every Northern Ireland district by
	// country-within-the-UK rather than needing each district's own name).
	const exclude = args.exclude
		? args.exclude.split(',').map((s) => s.trim())
		: [];
	const excludeField = args['exclude-field'] ?? 'name';
	// Which field holds the display name (default the plain `name` field,
	// correct as-is for every map built so far). Poland's `name` field is
	// English-translated ("Silesian", "Lesser Poland") - `name_pl` gives the
	// correct Polish, same reasoning as build-points-map.ts's --name-field.
	const nameField = args['name-field'] ?? 'name';
	// An independent extra ogr2ogr filter (no country constraint), merged in
	// alongside the main country filter before dissolve - for features a
	// plain `admin='<country>'` filter can't reach. Added for Ukraine:
	// Natural Earth tags Crimea/Sevastopol under admin='Russia' (reflecting
	// de facto control, not international recognition - most of the world,
	// including the UN, considers them Ukrainian territory under occupation)
	// so they'd otherwise be silently missing from the map. See MAPS.md.
	const extraWhere = args['extra-where'];

	if (!country || !outDir) {
		console.error(
			'Usage: build-map.ts --country="Italy" --out=data/maps/italy-regions [--type=region|state] [--name="Italy — Regions"] [--dissolve=region] [--exclude=Alaska,Hawaii] [--exclude-field=name] [--name-field=name] [--extra-where="name IN (\'Crimea\')"]'
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

	// Select every base field plus whichever extra ones this run actually
	// needs (name-field/exclude-field default to 'name', already included).
	const fields = Array.from(new Set([...BASE_FIELDS, nameField, excludeField]));

	console.log(`[1/6] Filtering "${country}" from Natural Earth admin-1 dataset...`);
	const whereClause =
		`admin='${country}'` +
		(exclude.length
			? ` AND ${excludeField} NOT IN (${exclude.map((n) => `'${n}'`).join(',')})`
			: '');
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-where',
		whereClause,
		'-select',
		fields.join(','),
		filteredPath,
		SOURCE_SHP
	]);

	if (extraWhere) {
		console.log(`[1b/6] Merging in extra features ("${extraWhere}")...`);
		const extraPath = path.join(absOutDir, '.tmp-extra.geojson');
		execFileSync('ogr2ogr', [
			'-f',
			'GeoJSON',
			'-where',
			extraWhere,
			'-select',
			fields.join(','),
			extraPath,
			SOURCE_SHP
		]);
		const primaryFC = JSON.parse(readFileSync(filteredPath, 'utf-8'));
		const extraFC = JSON.parse(readFileSync(extraPath, 'utf-8'));
		primaryFC.features.push(...extraFC.features);
		writeFileSync(filteredPath, JSON.stringify(primaryFC));
		rmSync(extraPath);
	}

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
		// --name-field only matters pre-dissolve: dissolving already renames
		// the grouping field to `name` (see mapshaperArgs above), so by this
		// point `name` is already correct for a dissolved map.
		if (nameField !== 'name' && !dissolveField) {
			feature.properties.name = feature.properties[nameField] || feature.properties.name;
		}
		const fixed = fixups[feature.properties.name];
		if (fixed) feature.properties.name = fixed;
	}
	writeFileSync(simplifiedPath, JSON.stringify(geojson));

	const targets = geojson.features.map((feature: any) => {
		const p = feature.properties;
		const { bbox, center } = boundsOf(feature.geometry);
		// Only emitted when true, so maps with no such target come out
		// byte-identical to before this flag existed.
		const wraps = crossesAntimeridian(bbox);
		if (wraps) {
			console.warn(
				`  WARNING: "${p.name}" crosses the antimeridian - bbox west > east ${JSON.stringify(bbox)}; flagged crossesAntimeridian (see MAPS.md)`
			);
		}
		return {
			id: slugify(p.name),
			name: p.name as string,
			type,
			tier: 1,
			aliases: [] as string[],
			centroid: center,
			bbox,
			...(wraps ? { crossesAntimeridian: true } : {})
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

	console.log('[4/6] Selecting nearby lakes for context...');
	selectNearbyLakes(overallBboxOf(targets), lakesPath);

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
	pmtilesConvert(mbtilesPath, pmtilesPath);

	console.log('[6/6] Cleaning up...');
	rmSync(filteredPath);
	rmSync(simplifiedPath);
	rmSync(labelsPath);
	rmSync(lakesPath);
	rmSync(mbtilesPath);

	console.log(`Done: ${targets.length} targets -> ${mapJsonPath}`);
	console.log(`Tour -> ${tourJsonPath}`);
	console.log(`Tiles -> ${pmtilesPath}`);

	// Adjacency-aware colour slots (GC-032), computed from the tiles just built -
	// rerun `npm run build-map-colors -- --map=<id>` after hand-editing map.json.
	const { colours } = await colorizeMapDir(absOutDir);
	console.log(`Colours -> ${colours} colorIndex slots in map.json`);
}

await main();
