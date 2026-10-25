// Snapshot towns for the v1.0 batch where Natural Earth only has 5–7 places.
// Wikidata CC0; run explicitly to refresh, then commit data/places/<id>.geojson.
//   npx tsx data/scripts/fetch-v1-towns.ts [--country=lithuania]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs } from './mapBuildUtils.js';
import { newestTownRows, type TownBinding } from './townSnapshot.js';

interface Country {
	id: string;
	name: string;
	iso: string;
	language: string;
	population: number;
}
const countries: Country[] = [
	{ id: 'slovakia', name: 'Slovakia', iso: 'SVK', language: 'sk', population: 10000 },
	{ id: 'estonia', name: 'Estonia', iso: 'EST', language: 'et', population: 5000 },
	{ id: 'lithuania', name: 'Lithuania', iso: 'LTU', language: 'lt', population: 10000 },
	{ id: 'costa-rica', name: 'Costa Rica', iso: 'CRI', language: 'es', population: 10000 }
];
const args = parseArgs(process.argv.slice(2));
const selected = args.country
	? countries.filter((country) => country.id === args.country)
	: countries;
if (!selected.length) throw new Error('Unknown country in this snapshot batch: ' + args.country);
for (const country of selected) {
	const query = [
		'SELECT DISTINCT ?item ?coord ?name ?en ?it ?de ?population ?date ?capital WHERE {',
		'  ?country wdt:P298 "' + country.iso + '" .',
		'  ?item wdt:P17 ?country; wdt:P1082 ?best; wdt:P625 ?coord; wdt:P31 ?kind .',
		'  VALUES ?base { wd:Q515 wd:Q3957 }',
		'  ?kind wdt:P279* ?base .',
		'  FILTER(?best >= ' + country.population + ')',
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
		'  BIND(EXISTS { ?country wdt:P36 ?item } AS ?capital)',
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
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates },
				properties: {
					NAME: name,
					NAME_EN: row.en?.value ?? name,
					NAME_IT: row.it?.value ?? name,
					NAME_DE: row.de?.value ?? name,
					ADM0NAME: country.name,
					ADM1NAME: '',
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
				source: 'Wikidata (CC0)',
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
