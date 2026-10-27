import { createHash } from 'node:crypto';
import { validateTownBindingsCache, type TownBindingsCache } from './townBindings.js';
import { canonicalRegionAtPoint, type NamedRegion } from './boundaryRegions.js';
// Snapshot towns for the v1.0 batch where Natural Earth is incomplete.
// Run in WSL with GDAL and Natural Earth inputs (Lithuanian county fallback).
// Wikidata CC0 and Natural Earth public domain; refresh deliberately and commit.
//   npx tsx data/scripts/fetch-v1-towns.ts [--country=lithuania]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, ADMIN1_SHP, parseArgs } from './mapBuildUtils.js';
import { pointInPolygon, type AnyGeometry } from './factGeometry.js';
import { newestTownRows, townCoordinate, type TownBinding } from './townSnapshot.js';

interface Country {
	id: string;
	name: string;
	iso: string;
	language: string;
	population: number;
	regionClass?: string;
	boundarySource?: string;
	minimumYear?: number;
	clipToBoundary?: boolean;
	// A sourced representative centre when a detailed island is absent at map scale.
	coordinateOverrides?: Record<string, [number, number]>;
	excludedItems?: Record<string, string>;
}
const countries: Country[] = [
	{
		id: 'denmark',
		name: 'Denmark',
		iso: 'DNK',
		language: 'en',
		population: 1000,
		minimumYear: 2011,
		boundarySource: 'data/boundaries/denmark-regions-gb-9469f09.geojson',
		clipToBoundary: true,
		// Natural Earth Copenhagen centre, preserving the existing map's position.
		coordinateOverrides: { Q1748: [12.5615399, 55.68051] }
	},
	{
		id: 'hungary',
		name: 'Hungary',
		iso: 'HUN',
		language: 'hu',
		population: 10000,
		regionClass: 'Q188604'
	},
	{
		id: 'slovakia',
		name: 'Slovakia',
		iso: 'SVK',
		language: 'sk',
		population: 10000,
		regionClass: 'Q15057583'
	},
	{
		id: 'estonia',
		name: 'Estonia',
		iso: 'EST',
		language: 'et',
		// Include smaller county seats for regional facts; the playable map stays at 5k.
		population: 1000,
		regionClass: 'Q189672'
	},
	{
		id: 'lithuania',
		name: 'Lithuania',
		iso: 'LTU',
		language: 'lt',
		population: 10000,
		regionClass: 'Q273789'
	},
	{
		id: 'united-arab-emirates',
		name: 'United Arab Emirates',
		iso: 'ARE',
		language: 'en',
		population: 1000,
		minimumYear: 2000,
		boundarySource: 'data/boundaries/united-arab-emirates-gb-9469f09.geojson'
	},
	{
		id: 'sri-lanka',
		name: 'Sri Lanka',
		iso: 'LKA',
		language: 'en',
		population: 1000,
		minimumYear: 2000,
		boundarySource: 'data/boundaries/sri-lanka-gb-9469f09.geojson'
	},
	{
		id: 'ghana',
		name: 'Ghana',
		iso: 'GHA',
		language: 'en',
		population: 1000,
		minimumYear: 2000,
		boundarySource: 'data/boundaries/ghana-gb-9469f09.geojson'
	},
	{
		id: 'slovenia',
		name: 'Slovenia',
		iso: 'SVN',
		language: 'sl',
		population: 1000,
		minimumYear: 2000,
		boundarySource: 'data/boundaries/slovenia-regions-2026-10-26.geojson'
	},
	{
		id: 'latvia',
		name: 'Latvia',
		iso: 'LVA',
		language: 'lv',
		population: 1000,
		minimumYear: 2000,
		boundarySource: 'data/boundaries/latvia-regions-2021.geojson'
	},
	{
		id: 'israel',
		name: 'Israel',
		iso: 'ISR',
		language: 'en',
		population: 1000,
		minimumYear: 2000,
		boundarySource: 'data/boundaries/israel-districts-gb-9469f09.geojson',
		clipToBoundary: true
	},
	{
		id: 'nepal',
		name: 'Nepal',
		iso: 'NPL',
		language: 'en',
		population: 1000,
		minimumYear: 2000,
		boundarySource: 'data/boundaries/nepal-gb-9469f09.geojson'
	},
	{
		id: 'uzbekistan',
		name: 'Uzbekistan',
		iso: 'UZB',
		language: 'en',
		population: 1000,
		minimumYear: 2000,
		boundarySource: 'data/boundaries/uzbekistan-gb-9469f09.geojson'
	}
];
const args = parseArgs(process.argv.slice(2));
if (Object.hasOwn(args, 'bindings') && (!args.bindings?.trim() || !args.country?.trim()))
	throw new Error('--bindings requires one explicit --country and a cache file');
const selected = args.country
	? countries.filter((country) => country.id === args.country)
	: countries;
if (!selected.length) throw new Error('Unknown country in this snapshot batch: ' + args.country);
for (const country of selected) {
	const query = [
		'SELECT DISTINCT ?item ?coord ?name ?en ?it ?de ?population ?date ?capital ?regionName ?precision ?defaultName WHERE {',
		// Keep country-first traversal; the planner otherwise expands global paths.
		'  hint:Query hint:optimizer "None" .',
		'  ?country wdt:P298 "' + country.iso + '"; wdt:P36 ?capitalCity .',
		'  ?item wdt:P17 ?country .',
		// Admit candidate ITEMS using any recorded count, then retrieve ALL their
		// observations below. A newer low count still defeats an older high one.
		// This avoids expanding every Norwegian settlement's class hierarchy.
		'  FILTER EXISTS { ?item p:P1082/ps:P1082 ?candidatePopulation . FILTER(?candidatePopulation >= ' +
			country.population +
			') }',
		'  ?item wdt:P31 ?kind; p:P625 ?coordinateStatement .',
		'  ?coordinateStatement ps:P625 ?coord; psv:P625 ?coordinateValue; wikibase:rank ?coordinateRank .',
		'  FILTER(?coordinateRank != wikibase:DeprecatedRank)',
		'  ?coordinateValue wikibase:geoPrecision ?precision .',
		'  VALUES ?base { wd:Q515 wd:Q3957 }',
		'  ?kind wdt:P279* ?base .',
		// Fetch every observed statement before applying the population threshold.
		// A truthy/preferred old count must not hide a qualifying newer count.
		'  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }',
		'  ?item p:P1082 ?statement .',
		'  ?statement ps:P1082 ?population; wikibase:rank ?rank .',
		'  FILTER(?rank != wikibase:DeprecatedRank)',
		'  OPTIONAL { ?statement pq:P585 ?date }',
		'  FILTER(!BOUND(?date) || (?date >= "' +
			(country.minimumYear ?? 2011) +
			'-01-01T00:00:00Z"^^xsd:dateTime && ?date <= NOW()))',
		'  OPTIONAL { ?item rdfs:label ?name FILTER(LANG(?name)="' + country.language + '") }',
		'  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en)="en") }',
		'  OPTIONAL { ?item rdfs:label ?defaultName FILTER(LANG(?defaultName)="mul") }',
		'  OPTIONAL { ?item rdfs:label ?it FILTER(LANG(?it)="it") }',
		'  OPTIONAL { ?item rdfs:label ?de FILTER(LANG(?de)="de") }',
		...(country.regionClass
			? [
					'  OPTIONAL {',
					'    ?item wdt:P131* ?region .',
					'    ?region wdt:P31 wd:' + country.regionClass + '; wdt:P17 ?country;',
					'      rdfs:label ?regionName . FILTER(LANG(?regionName)="' + country.language + '")',
					'  }'
				]
			: []),
		'  BIND(?item = ?capitalCity AS ?capital)',
		'} ORDER BY ?item DESC(?date) DESC(?population) LIMIT 10000'
	].join('\n');
	const url = new URL('https://query.wikidata.org/sparql');
	url.search = new URLSearchParams({ query, format: 'json' }).toString();
	// --bindings reprocesses an explicitly supplied saved SPARQL response.
	const rawDir = path.join(REPO_ROOT, 'data/source/v1-town-bindings');
	let raw: TownBindingsCache;
	let bindingBytes: Buffer;
	if (args.bindings) {
		bindingBytes = readFileSync(path.resolve(REPO_ROOT, args.bindings));
		raw = validateTownBindingsCache(JSON.parse(bindingBytes.toString('utf8')), country.id, query);
	} else {
		const response = await fetch(url, {
			headers: {
				Accept: 'application/sparql-results+json',
				'User-Agent': 'GeoclickMapBuild/1.0 (https://github.com/diegoami/Geoclick2027)'
			},
			signal: AbortSignal.timeout(90_000)
		});
		if (!response.ok) throw new Error(country.name + ': Wikidata HTTP ' + response.status);
		const reply = (await response.json()) as { results: { bindings: TownBinding[] } };
		raw = validateTownBindingsCache(
			{
				...reply,
				countryId: country.id,
				fetchedAt: new Date().toISOString(),
				query,
				querySha256: createHash('sha256').update(query).digest('hex')
			},
			country.id,
			query
		);
		bindingBytes = Buffer.from(JSON.stringify(raw));
		mkdirSync(rawDir, { recursive: true });
		writeFileSync(path.join(rawDir, country.id + '.json'), bindingBytes);
	}
	const fetchedAt = raw.fetchedAt;
	const bindingsSha256 = createHash('sha256').update(bindingBytes).digest('hex');
	const reprocessedAt = args.bindings ? new Date().toISOString() : undefined;
	const capitalIds = new Set(
		raw.results.bindings
			.filter((row) => row.capital?.value === 'true')
			.map((row) => row.item?.value)
	);
	const boundary = country.boundarySource
		? (JSON.parse(readFileSync(path.join(REPO_ROOT, country.boundarySource), 'utf8')) as {
				source: unknown;
				features: NamedRegion[];
			})
		: undefined;
	const boundaryNames = new Set(boundary?.features.map((f) => String(f.properties.name)) ?? []);
	const excluded: { item: string | undefined; name: string; reason: string }[] = [];
	const pointOverride = (row: TownBinding) =>
		country.coordinateOverrides?.[row.item?.value?.split('/').pop() ?? ''];
	const newest = newestTownRows(raw.results.bindings, fetchedAt, (row) => {
		if (!boundary) return true;
		const { coordinates, precision } = townCoordinate(row, pointOverride(row));
		return !!canonicalRegionAtPoint(
			coordinates,
			boundary.features,
			country.name,
			boundaryNames,
			precision
		);
	});
	// Do not let population-row ordering choose between conflicting regions.
	const eligibleIds = new Set(
		newest
			.filter((row) => Number(row.population?.value) >= country.population)
			.map((row) => row.item?.value)
	);
	const regionNames = new Map<string, Set<string>>();
	for (const row of raw.results.bindings) {
		if (!row.item?.value || !eligibleIds.has(row.item.value) || !row.regionName?.value) continue;
		const names = regionNames.get(row.item.value) ?? new Set<string>();
		names.add(row.regionName.value);
		regionNames.set(row.item.value, names);
		if (names.size > 1) throw new Error('Ambiguous regions for ' + row.item.value);
	}

	// Lithuania's municipal hierarchy often bypasses the counties since 2010.
	// Fill only missing county labels by actual polygon containment, never bbox.
	const countyNames: Record<string, string> = {
		Utenos: 'Utenos',
		Vilniaus: 'Vilniaus',
		Alytaus: 'Alytaus',
		Panevezio: 'Panevėžio',
		Telšiai: 'Telšių',
		Klaipedos: 'Klaipėdos',
		Šiauliai: 'Šiaulių',
		Marijampoles: 'Marijampolės',
		Taurages: 'Tauragės',
		Kauno: 'Kauno'
	};
	const countyRows =
		country.id === 'lithuania'
			? (
					JSON.parse(
						execFileSync(
							'ogr2ogr',
							[
								'-f',
								'GeoJSON',
								'/vsistdout/',
								ADMIN1_SHP,
								'-where',
								"admin = 'Lithuania'",
								'-select',
								'name'
							],
							{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
						)
					) as {
						features: { geometry: AnyGeometry; properties: { name: string } }[];
					}
				).features
			: [];
	const features = newest
		.filter((row) => Number(row.population?.value) >= country.population)
		.map((row) => {
			const name = row.name?.value ?? row.en?.value ?? row.defaultName?.value;
			if (!name) throw new Error('Missing name for ' + row.item?.value);
			const exclusion = country.excludedItems?.[row.item?.value?.split('/').pop() ?? ''];
			if (exclusion) {
				excluded.push({ item: row.item?.value, name, reason: exclusion });
				return undefined;
			}
			const override = pointOverride(row);
			const { coordinates, precision } = townCoordinate(row, override);
			let regionName = row.regionName?.value;
			if (!regionName && country.id === 'hungary' && row.capital?.value === 'true')
				regionName = name; // Budapest itself is the county-equivalent capital.
			if (!regionName && boundary)
				regionName = canonicalRegionAtPoint(
					coordinates as [number, number],
					boundary.features,
					country.name,
					boundaryNames,
					precision
				);
			if (!regionName && countyRows.length) {
				const matches = countyRows.filter((f) =>
					pointInPolygon(coordinates as [number, number], f.geometry)
				);
				if (matches.length === 1 && countyNames[matches[0].properties.name])
					regionName = countyNames[matches[0].properties.name] + ' apskritis';
			}
			if (!regionName && country.clipToBoundary) {
				excluded.push({
					item: row.item?.value,
					name,
					reason: 'Outside or ambiguous within the selected administrative-source footprint'
				});
				return undefined;
			}
			if (!regionName)
				throw new Error(
					'Missing unambiguous region for ' +
						name +
						' (' +
						row.item?.value +
						'; capital=' +
						row.capital?.value +
						')'
				);
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates },
				properties: {
					NAME: name,
					NAME_EN: row.en?.value ?? name,
					NAME_IT: row.it?.value ?? name,
					NAME_DE: row.de?.value ?? name,
					ADM0NAME: country.name,
					ADM1NAME: regionName,
					coordinatePrecision: precision,
					...(override
						? { coordinateSource: 'Natural Earth (public domain), representative city centre' }
						: {}),
					ADM0CAP: capitalIds.has(row.item?.value) ? 1 : 0,
					POP_MAX: Number(row.population?.value),
					POP1950: 0,
					populationDate: row.date?.value ?? null,
					wikidata: row.item?.value
				}
			};
		})
		.filter((feature): feature is NonNullable<typeof feature> => !!feature)
		.sort((a, b) => a.properties.NAME.localeCompare(b.properties.NAME));
	if (!features.length) throw new Error('Empty snapshot for ' + country.name);
	if (!features.some((f) => f.properties.ADM0CAP === 1))
		throw new Error('Country capital missing from snapshot: ' + country.name);
	const out = path.join(REPO_ROOT, 'data/places', country.id + '.geojson');
	mkdirSync(path.dirname(out), { recursive: true });
	writeFileSync(
		out,
		JSON.stringify(
			{
				type: 'FeatureCollection',
				...(boundary ? { regionSource: boundary.source } : {}),
				source: boundary
					? 'Wikidata (CC0); regional associations under regionSource licence'
					: country.id === 'lithuania'
						? 'Wikidata (CC0); missing county labels from Natural Earth (public domain), matched by point-in-polygon'
						: 'Wikidata (CC0)',
				fetchedAt,
				...(reprocessedAt ? { reprocessedAt } : {}),
				bindingsSha256,
				querySha256: raw.querySha256,
				query: raw.query,
				...(country.coordinateOverrides
					? {
							coordinateOverrides: country.coordinateOverrides,
							coordinateOverrideSource:
								'Natural Earth (public domain); same representative centres as the existing maps'
						}
					: {}),
				...(excluded.length ? { excluded } : {}),
				features
			},
			null,
			'\t'
		) + '\n'
	);
	console.log(
		country.name + ': ' + features.length + ' towns -> data/places/' + country.id + '.geojson'
	);
}
