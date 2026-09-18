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
	selectNearbyLakes,
	selectCountryContext,
	pmtilesConvert
} from './mapBuildUtils.js';
import { colorizeMapDir } from './mapColors.js';
import { disambiguate, isUnbounded, parseBounds, withinBounds } from './placeSelection.js';

const SOURCE_SHP = path.join(
	REPO_ROOT,
	'data/source/ne_10m_populated_places/ne_10m_populated_places.shp'
);

// Same mechanism and reasoning as build-map.ts's NAME_FIXUPS: for the rare
// row where even the chosen --name-field is wrong or dated, not a whole new
// per-country table until there's more than one or two exceptions.
const NAME_FIXUPS: Record<string, Record<string, string>> = {
	// NAME_EN gives "Odessa" (dated) even though the same dataset's NAME_UK
	// (Одеса) and every other Ukrainian city's NAME_EN already use the
	// modern standard transliteration - matches the regions map's fixup.
	Ukraine: { Odessa: 'Odesa' },
	// NAME_ES gives "Orense", the historic Castilian exonym - Ourense has
	// been this city's sole official name (Spanish and Galician alike)
	// since 1998. The plain NAME field already has this one right.
	Spain: { Orense: 'Ourense' },
	// Two real typos in the plain NAME field, found by auditing the full
	// top-50 list rather than spot-checking: "Shenyeng" isn't a real
	// Chinese city name (Shenyang is); "Xian" without the apostrophe reads
	// as a different, ambiguous romanization from the correct "Xi'an".
	China: { Shenyeng: 'Shenyang', Xian: "Xi'an" },
	// "Jaboatao" is missing its final diacritic - the real city (in the
	// Recife metro area) is "Jaboatão", confirmed against NAME_PT.
	Brazil: { Jaboatao: 'Jaboatão' },
	Mexico: {
		// The plain NAME field is the English exonym for the capital, unlike
		// every other Mexican city already in its correct Spanish form -
		// same reasoning as Lisbon->Lisboa (Portugal) and The Hague->Den
		// Haag (Netherlands). NAME_ES gives full official forms elsewhere
		// ("Puebla de Zaragoza", "León de Los Aldama") that are more formal
		// than how these cities are actually referred to day-to-day, so
		// this is a targeted fixup, not a wholesale --name-field switch.
		'Mexico City': 'Ciudad de México',
		// Two more missing diacritics, confirmed against NAME_ES.
		Nezahualcoyotl: 'Nezahualcóyotl',
		'Ciudad Obregon': 'Ciudad Obregón'
	},
	// Three double-space typos in the US list, found by auditing every name
	// above 200k for FT-27 - the same class as the Russian one below. The two
	// abbreviations are expanded while they are being fixed: a quiz slip that
	// says 'Ft. Worth' asks the player to recognise an abbreviation rather
	// than a city.
	'United States of America': {
		'Washington,  D.C.': 'Washington, D.C.',
		// Only the double space goes: 'St.' is how these cities write
		// themselves, and the source already has St. Louis, St. Petersburg and
		// St. Charles that way.
		'St.  Paul': 'St. Paul',
		// 'Ft.' is not - the same source writes Fort Wayne, Fort Collins, Fort
		// Lauderdale and Fort Pierce in full, so this one row is the odd one.
		'Ft.  Worth': 'Fort Worth',
		// A real typo, not a variant: the city east of Memphis is Bartlett,
		// Tennessee (found auditing the >200k list for FT-28).
		Barlett: 'Bartlett'
	},
	// Plain NAME has a literal double-space typo for the one Russian city
	// whose name contains a space - confirmed against NAME_EN's correctly
	// spaced "Saint Petersburg".
	Russia: { 'St.  Petersburg': 'Saint Petersburg' },
	India: {
		// NAME_EN already gives the modern standard English spelling for
		// four of these (Howrah, Solapur, Nashik, Visakhapatnam) - the same
		// kind of gap already seen for Odessa/Ukraine. Allahabad is
		// different: NAME_EN hasn't caught up either, since this one is a
		// genuine 2018 official rename (Allahabad -> Prayagraj by the Uttar
		// Pradesh government), not a transliteration-convention update -
		// same "use the current official name" principle as Kyiv/Odesa.
		Haora: 'Howrah',
		Sholapur: 'Solapur',
		Nasik: 'Nashik',
		Vishakhapatnam: 'Visakhapatnam',
		Allahabad: 'Prayagraj'
	},
	// Colonial-era Dutch spelling ("Bandjarmasin") and a plain typo
	// ("Pakalongan", missing its second syllable's real vowel) - the
	// correct modern Indonesian forms are Banjarmasin and Pekalongan.
	Indonesia: { Bandjarmasin: 'Banjarmasin', Pakalongan: 'Pekalongan' },
	// Missing diacritic, confirmed against NAME_ES ("San Nicolás de los
	// Arroyos" - kept short, same reasoning as Mexico's Puebla/León above).
	Argentina: { 'San Nicolas': 'San Nicolás' }
};

// The slice of the populated-places export this script reads - ogr2ogr's
// -select below asks for exactly `<name-field>,NAME,POP_MAX`. The localized
// name field varies per run (NAME_IT, NAME_DE...), hence the index signature.
interface PlaceFeature {
	type: 'Feature';
	properties: {
		NAME: string;
		POP_MAX: number;
		[field: string]: string | number | null | undefined;
	};
	geometry: { type: 'Point'; coordinates: [number, number] };
}
interface PlaceCollection {
	type: 'FeatureCollection';
	features: PlaceFeature[];
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const country = args.country; // matches the dataset's ADM0NAME field
	const outDir = args.out;
	const minPopulation = Number(args['min-population'] ?? 100000);
	// Adaptive selection, added when the >100k-population threshold alone
	// stopped scaling across a much wider range of countries (Sweden: 5
	// towns clear 100k, an unhelpfully tiny map even though it's the
	// correct threshold answer; China/India-scale countries: hundreds to
	// thousands would clear it, unusable for a curated quiz). Both are
	// no-ops at their defaults, so every map built before these existed
	// regenerates identically:
	// --min-count guarantees at least N towns even if that means dipping
	// below --min-population - the N most populous places in the country,
	// not just whatever happens to clear the threshold.
	const minCount = Number(args['min-count'] ?? 0);
	// --max-count caps the result at the N most populous places that
	// cleared --min-population, for a country where the threshold alone
	// would select far more than a curated quiz can reasonably use.
	const maxCount = args['max-count'] ? Number(args['max-count']) : Infinity;
	// Which localized name field to prefer (e.g. NAME_IT, NAME_DE) - falls
	// back to the plain NAME field (usually English) for any row where the
	// localized one is empty, same spirit as build-map.ts's NAME_FIXUPS but
	// using a field the dataset already provides instead of a manual table.
	const nameField = args['name-field'] ?? 'NAME';
	const mapName = args.name ?? `${country} — Towns`;
	// --exclude=Belfast drops named features by their NAME field - e.g. a
	// "Great Britain" towns map excluding Northern Ireland (part of the UK,
	// not Great Britain), same reasoning as build-map.ts's --exclude.
	const exclude = args.exclude ? args.exclude.split(',').map((s) => s.trim()) : [];
	// --lon-min/--lon-max/--lat-min/--lat-max cut a country into slices, for a
	// country with far more cities than one map can hold (FT-27,
	// docs/PLAN_V0.7.md). Unbounded by default, so every map built before
	// these existed rebuilds identically.
	const bounds = parseBounds(args);

	if (!country || !outDir) {
		console.error(
			'Usage: build-points-map.ts --country="Italy" --out=data/maps/italy-towns-100k [--name-field=NAME_IT] [--min-population=100000] [--min-count=5] [--max-count=50] [--name="Italy — Towns"] [--exclude=Belfast] [--lon-min=-104 --lon-max=-87] [--lat-min=41.3 --lat-max=43.8]'
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
	const contextPath = path.join(absOutDir, '.tmp-context.geojson');
	const mbtilesPath = path.join(absOutDir, '.tmp-tiles.mbtiles');
	const pmtilesPath = path.join(absOutDir, 'tiles.pmtiles');
	const mapJsonPath = path.join(absOutDir, 'map.json');
	const tourJsonPath = path.join(absOutDir, 'tour.json');

	console.log(`[1/5] Filtering "${country}" from Natural Earth...`);
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
	//
	// The population threshold itself is applied in JS below, not here -
	// --min-count/--max-count need to see every candidate (not just the
	// ones already above --min-population) to decide whether to reach
	// below the threshold or truncate above it. `POP_MAX > 0` just drops
	// rows with missing/zero population data, which are meaningless for
	// any of the three selection modes.
	const whereClause =
		`ADM0NAME='${country}' AND POP_MAX > 0` +
		(exclude.length ? ` AND NAME NOT IN (${exclude.map((n) => `'${n}'`).join(',')})` : '');
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-where',
		whereClause,
		'-select',
		// ADM1NAME rides along so two places of the same name can be told
		// apart by the region they are in (FT-27).
		`${nameField},NAME,ADM1NAME,POP_MAX`,
		filteredPath,
		SOURCE_SHP
	]);

	console.log(
		`[2/5] Selecting towns (population > ${minPopulation}, min ${minCount}, max ${maxCount === Infinity ? 'none' : maxCount}) and deriving draft map.json...`
	);
	const geojson: PlaceCollection = JSON.parse(readFileSync(filteredPath, 'utf-8'));
	// The slice is applied first: "the 50 biggest" then means the 50 biggest
	// of this part of the country, not of the whole of it.
	const inSlice = withinBounds(
		geojson.features.map((feature) => ({
			feature,
			lon: feature.geometry.coordinates[0],
			lat: feature.geometry.coordinates[1]
		})),
		bounds
	).map((entry) => entry.feature);
	if (!isUnbounded(bounds))
		console.log(
			`      slice keeps ${inSlice.length} of ${geojson.features.length} places in the country`
		);
	const byPopulationDesc = [...inSlice].sort((a, b) => b.properties.POP_MAX - a.properties.POP_MAX);
	let selectedFeatures = byPopulationDesc.filter(
		(feature) => feature.properties.POP_MAX > minPopulation
	);
	// Reach below the threshold, most-populous-first, rather than leaving a
	// sparse country (e.g. Sweden: only 5 places clear 100k) with an
	// unhelpfully tiny map.
	if (selectedFeatures.length < minCount) {
		selectedFeatures = byPopulationDesc.slice(0, minCount);
	}
	// Truncate to the most populous places, for a country where the
	// threshold alone would select far more than a curated quiz can
	// reasonably use (e.g. China).
	if (selectedFeatures.length > maxCount) {
		selectedFeatures = selectedFeatures.slice(0, maxCount);
	}

	const fixups = NAME_FIXUPS[country] ?? {};
	// Two places of the same name would collide on the map's feature-state key
	// (promoteId: 'name'), so each gets its region added and keeps the plain
	// name as an alias - "Kansas City, Missouri" and "Kansas City, Kansas"
	// (FT-27). A name that is already unique is untouched.
	const named = disambiguate(
		selectedFeatures.map((feature) => {
			const p = feature.properties;
			const rawName: string = (p[nameField] as string | null | undefined) || p.NAME;
			return {
				feature,
				name: fixups[rawName] ?? rawName,
				region: (p.ADM1NAME as string | null | undefined) || undefined
			};
		})
	);
	const withNames = named.map(({ feature, name, aliases }) => {
		const centroid = feature.geometry.coordinates as [number, number];
		return {
			id: slugify(name),
			name,
			type: 'city',
			tier: 1,
			aliases,
			centroid,
			// Degenerate, not a real extent - a point target has no area.
			// TourView branches on target.type before reading bbox for
			// camera framing; see mapDefinition.ts and MAPS.md.
			bbox: [...centroid, ...centroid] as [number, number, number, number]
		};
	});
	// Natural Earth has a handful of exact-duplicate rows for the same city
	// (found while adding Brazil/Mexico/Indonesia: Vila Velha and Natal
	// twice each in Brazil, Mazatlán twice in Mexico, Bandar Lampung twice
	// in Indonesia) - a real data bug, not a naming issue, and left
	// unhandled it would silently ship two identically-named/identically-ID
	// slips for the same target. `withNames` is still in population-
	// descending order at this point, so keeping the first occurrence of
	// each id keeps whichever duplicate row had the higher POP_MAX.
	const seenIds = new Set<string>();
	const targets = withNames.filter((target) => {
		if (seenIds.has(target.id)) return false;
		seenIds.add(target.id);
		return true;
	});
	targets.sort((a, b) => b.centroid[1] - a.centroid[1]); // north to south, same convention as build-map.ts

	const mapDefinition = {
		id: path.basename(outDir),
		name: mapName,
		country,
		attribution: 'Natural Earth (public domain), https://www.naturalearthdata.com',
		tiles: 'tiles.pmtiles',
		targets,
		tourOrder: targets.map((t) => t.id)
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
		features: targets.map((t) => ({
			type: 'Feature',
			properties: { name: t.name, id: t.id },
			geometry: { type: 'Point', coordinates: t.centroid }
		}))
	};
	writeFileSync(targetsPath, JSON.stringify(targetsGeojson));

	console.log('[3/5] Selecting nearby lakes and country/region context...');
	selectNearbyLakes(overallBboxOf(targets), lakesPath);
	// A point map's markers otherwise float with nothing showing the
	// country's outline or internal admin-1 borders - a polygon map doesn't
	// have this problem (the targets themselves, filled edge to edge,
	// already show the whole country). Same admin-1 dataset build-map.ts
	// uses for actual polygon targets, purely for visual context here. See
	// MAPS.md's "Point-target implementation" section.
	selectCountryContext(country, contextPath);

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
		`lakes:${lakesPath}`,
		'-L',
		`context:${contextPath}`
	]);
	pmtilesConvert(mbtilesPath, pmtilesPath);

	console.log('[5/5] Cleaning up...');
	rmSync(filteredPath);
	rmSync(targetsPath);
	rmSync(lakesPath);
	rmSync(contextPath);
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
