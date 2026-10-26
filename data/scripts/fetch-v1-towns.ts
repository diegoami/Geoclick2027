// Snapshot towns for the v1.0 batch where Natural Earth is incomplete.
// Run in WSL with GDAL and Natural Earth inputs (Lithuanian county fallback).
// Wikidata CC0 and Natural Earth public domain; refresh deliberately and commit.
//   npx tsx data/scripts/fetch-v1-towns.ts [--country=lithuania]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, ADMIN1_SHP, parseArgs } from './mapBuildUtils.js';
import { pointInPolygon, type AnyGeometry } from './factGeometry.js';
import { newestTownRows, type TownBinding } from './townSnapshot.js';

interface Country {
	id: string;
	name: string;
	iso: string;
	language: string;
	population: number;
	regionClass: string;
}
const countries: Country[] = [
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
	}
];
const args = parseArgs(process.argv.slice(2));
const selected = args.country
	? countries.filter((country) => country.id === args.country)
	: countries;
if (!selected.length) throw new Error('Unknown country in this snapshot batch: ' + args.country);
for (const country of selected) {
	const query = [
		'SELECT DISTINCT ?item ?coord ?name ?en ?it ?de ?population ?date ?capital ?regionName WHERE {',
		// Keep country-first traversal; the planner otherwise expands global paths.
		'  hint:Query hint:optimizer "None" .',
		'  ?country wdt:P298 "' + country.iso + '"; wdt:P36 ?capitalCity .',
		'  ?item wdt:P17 ?country; wdt:P625 ?coord; wdt:P31 ?kind .',
		'  VALUES ?base { wd:Q515 wd:Q3957 }',
		'  ?kind wdt:P279* ?base .',
		// Fetch every observed statement before applying the population threshold.
		// A truthy/preferred old count must not hide a qualifying newer count.
		'  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }',
		'  ?item p:P1082 ?statement .',
		'  ?statement ps:P1082 ?population; wikibase:rank ?rank .',
		'  FILTER(?rank != wikibase:DeprecatedRank)',
		'  OPTIONAL { ?statement pq:P585 ?date }',
		'  FILTER(!BOUND(?date) || (?date >= "2011-01-01T00:00:00Z"^^xsd:dateTime && ?date <= NOW()))',
		'  OPTIONAL { ?item rdfs:label ?name FILTER(LANG(?name)="' + country.language + '") }',
		'  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en)="en") }',
		'  OPTIONAL { ?item rdfs:label ?it FILTER(LANG(?it)="it") }',
		'  OPTIONAL { ?item rdfs:label ?de FILTER(LANG(?de)="de") }',
		'  OPTIONAL {',
		'    ?item wdt:P131* ?region .',
		'    ?region wdt:P31 wd:' + country.regionClass + '; wdt:P17 ?country;',
		'      rdfs:label ?regionName . FILTER(LANG(?regionName)="' + country.language + '")',
		'  }',
		'  BIND(?item = ?capitalCity AS ?capital)',
		'} ORDER BY ?item DESC(?date) DESC(?population) LIMIT 10000'
	].join('\n');
	const url = new URL('https://query.wikidata.org/sparql');
	url.search = new URLSearchParams({ query, format: 'json' }).toString();
	const response = await fetch(url, {
		headers: {
			Accept: 'application/sparql-results+json',
			'User-Agent': 'GeoclickMapBuild/1.0 (https://github.com/diegoami/Geoclick2027)'
		},
		signal: AbortSignal.timeout(90_000)
	});
	if (!response.ok) throw new Error(country.name + ': Wikidata HTTP ' + response.status);
	const raw = (await response.json()) as { results: { bindings: TownBinding[] } };
	if (raw.results.bindings.length === 10000)
		throw new Error('Query limit reached; refusing partial snapshot');
	const fetchedAt = new Date().toISOString();
	const newest = newestTownRows(raw.results.bindings, fetchedAt);
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
			const coordinate = /^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(row.coord?.value ?? '');
			const name = row.name?.value ?? row.en?.value;
			if (!coordinate || !name) throw new Error('Missing coordinates/name for ' + row.item?.value);
			const coordinates = [Number(coordinate[1]), Number(coordinate[2])];
			if (
				!coordinates.every(Number.isFinite) ||
				Math.abs(coordinates[0]) > 180 ||
				Math.abs(coordinates[1]) > 90
			)
				throw new Error('Invalid coordinates for ' + name);
			let regionName = row.regionName?.value;
			if (!regionName && country.id === 'hungary' && row.capital?.value === 'true')
				regionName = name; // Budapest itself is the county-equivalent capital.
			if (!regionName && countyRows.length) {
				const matches = countyRows.filter((f) =>
					pointInPolygon(coordinates as [number, number], f.geometry)
				);
				if (matches.length === 1 && countyNames[matches[0].properties.name])
					regionName = countyNames[matches[0].properties.name] + ' apskritis';
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
					ADM0CAP: row.capital?.value === 'true' ? 1 : 0,
					POP_MAX: Number(row.population?.value),
					POP1950: 0,
					populationDate: row.date?.value ?? null,
					wikidata: row.item?.value
				}
			};
		})
		.sort((a, b) => a.properties.NAME.localeCompare(b.properties.NAME));
	if (!features.length) throw new Error('Empty snapshot for ' + country.name);
	const out = path.join(REPO_ROOT, 'data/places', country.id + '.geojson');
	mkdirSync(path.dirname(out), { recursive: true });
	writeFileSync(
		out,
		JSON.stringify(
			{
				type: 'FeatureCollection',
				source:
					country.id === 'lithuania'
						? 'Wikidata (CC0); missing county labels from Natural Earth (public domain), matched by point-in-polygon'
						: 'Wikidata (CC0)',
				fetchedAt,
				query,
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
