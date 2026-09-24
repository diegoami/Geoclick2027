// Fetches a country's towns from Wikidata (CC0) into a committed GeoJSON
// snapshot, for towns maps denser than Natural Earth allows (#39, batch C).
//
// Natural Earth has 58 places in all of Germany, and germany-towns-100k
// already uses 49 of them. Wikidata has every German municipality, with its
// official key (Amtlicher Gemeindeschlüssel, P439), its population with a
// date, and its coordinates - and it is CC0, so the project's public-domain
// rule (DECISIONS.md) still holds.
//
// The output is a SNAPSHOT, committed under data/places/, so a map rebuilds
// the same way without a network and a later Wikidata edit changes nothing
// until someone refetches on purpose. Its fields are named like Natural
// Earth's populated places (NAME, POP_MAX, ADM1NAME, ...), so
// build-points-map.ts --source and build-facts.ts read it with the same code.
//
// Usage (node only, no WSL toolchain):
//   npx tsx data/scripts/fetch-wikidata-places.ts --country=germany --min-population=15000

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs } from './mapBuildUtils.js';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'GeoclickMapBuild/1.0 (https://github.com/diegoami/Geoclick2027)';

interface CountrySpec {
	/** ADM0NAME written into every feature, as Natural Earth spells it. */
	adm0: string;
	/** Its capital's item, flagged ADM0CAP = 1 as Natural Earth does. */
	capitalQid: string;
	/** The municipality-key property whose prefix gives the admin-1 area. */
	keyProperty: string;
	/** Admin-1 name by key prefix. */
	admin1ByPrefix: Record<string, string>;
}

// The first two digits of a German municipality key are its state.
const COUNTRIES: Record<string, CountrySpec> = {
	germany: {
		adm0: 'Germany',
		capitalQid: 'Q64',
		keyProperty: 'P439',
		admin1ByPrefix: {
			'01': 'Schleswig-Holstein',
			'02': 'Hamburg',
			'03': 'Niedersachsen',
			'04': 'Bremen',
			'05': 'Nordrhein-Westfalen',
			'06': 'Hessen',
			'07': 'Rheinland-Pfalz',
			'08': 'Baden-Württemberg',
			'09': 'Bayern',
			'10': 'Saarland',
			'11': 'Berlin',
			'12': 'Brandenburg',
			'13': 'Mecklenburg-Vorpommern',
			'14': 'Sachsen',
			'15': 'Sachsen-Anhalt',
			'16': 'Thüringen'
		}
	}
};

interface Binding {
	[name: string]: { value: string } | undefined;
}

/**
 * The current municipalities over the threshold, with their key,
 * coordinates and names. The best-rank population narrows the set; the
 * municipality key already implies the country. Dissolved municipalities
 * (P576) are dropped - their last population lingers.
 */
function townsQuery(spec: CountrySpec, minPopulation: number): string {
	return `
SELECT ?item ?key ?coord ?de ?en ?it WHERE {
  ?item wdt:${spec.keyProperty} ?key ; wdt:P1082 ?best ; wdt:P625 ?coord .
  FILTER(?best >= ${minPopulation})
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  OPTIONAL { ?item rdfs:label ?de FILTER(LANG(?de) = "de") }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?it FILTER(LANG(?it) = "it") }
}`;
}

/**
 * Their population statements since 2011, the last census, or undated.
 * Statements rather than the best-rank value, so the newest can be picked
 * by date: many towns carry a preferred census figure next to a newer
 * normal-rank estimate, and either rank alone picks the wrong one somewhere.
 * A separate query because joined with the labels it takes most of the
 * endpoint's minute.
 */
function populationsQuery(spec: CountrySpec, minPopulation: number): string {
	return `
SELECT ?item ?pop ?date WHERE {
  ?item wdt:${spec.keyProperty} ?key ; wdt:P1082 ?best ; p:P1082 ?statement .
  FILTER(?best >= ${minPopulation})
  ?statement ps:P1082 ?pop ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?statement pq:P585 ?date }
  FILTER(!BOUND(?date) || ?date >= "2011-01-01T00:00:00Z"^^xsd:dateTime)
}`;
}

/** One SPARQL query, POSTed as a form as the endpoint asks for long ones. */
async function sparql(text: string): Promise<Binding[]> {
	const response = await fetch(ENDPOINT, {
		method: 'POST',
		headers: {
			Accept: 'application/sparql-results+json',
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': USER_AGENT
		},
		body: new URLSearchParams({ query: text })
	});
	if (!response.ok) throw new Error(`Wikidata answered ${response.status}`);
	const json = (await response.json()) as { results: { bindings: Binding[] } };
	return json.results.bindings;
}

const qidOf = (b: Binding) => b.item!.value.split('/').pop()!;

interface Town {
	qid: string;
	key: string;
	population: number;
	date: string;
	lon: number;
	lat: number;
	de: string;
	en?: string;
	it?: string;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const spec = COUNTRIES[args.country ?? ''];
	if (!spec) {
		console.error(`Usage: --country=${Object.keys(COUNTRIES).join('|')} [--min-population=15000]`);
		process.exit(1);
	}
	const minPopulation = Number(args['min-population'] ?? 15000);

	// A town's first key, coordinate and name win, so a rerun is stable.
	const towns = new Map<string, Town>();
	for (const b of await sparql(townsQuery(spec, minPopulation))) {
		const qid = qidOf(b);
		const match = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord!.value);
		if (towns.has(qid) || !match || !b.de) continue;
		towns.set(qid, {
			qid,
			key: b.key!.value,
			population: 0,
			date: '',
			lon: Number(Number(match[1]).toFixed(5)),
			lat: Number(Number(match[2]).toFixed(5)),
			de: b.de.value,
			en: b.en?.value,
			it: b.it?.value
		});
	}

	// Each town's newest dated figure; an undated one only if it has no
	// dated one, and between two of the same date the larger.
	for (const b of await sparql(populationsQuery(spec, minPopulation))) {
		const town = towns.get(qidOf(b));
		if (!town) continue;
		const population = Number(b.pop!.value);
		const date = b.date?.value.slice(0, 10) ?? '';
		if (date > town.date || (date === town.date && population > town.population)) {
			town.population = population;
			town.date = date;
		}
	}

	const features = [...towns.values()]
		.filter((t) => t.population >= minPopulation && spec.admin1ByPrefix[t.key.slice(0, 2)])
		.sort((a, b) => b.population - a.population || a.qid.localeCompare(b.qid))
		.map((t) => ({
			type: 'Feature',
			properties: {
				NAME: t.de,
				NAME_DE: t.de,
				NAME_EN: t.en ?? t.de,
				NAME_IT: t.it ?? t.de,
				POP_MAX: t.population,
				POP_YEAR: t.date.slice(0, 4),
				POP1950: null,
				ADM0CAP: t.qid === spec.capitalQid ? 1 : 0,
				ADM0NAME: spec.adm0,
				ADM1NAME: spec.admin1ByPrefix[t.key.slice(0, 2)],
				WIKIDATA: t.qid
			},
			geometry: { type: 'Point', coordinates: [t.lon, t.lat] }
		}));

	const outDir = path.join(REPO_ROOT, 'data/places');
	mkdirSync(outDir, { recursive: true });
	const outPath = path.join(outDir, `${args.country}.geojson`);
	// One feature per line: a refetch then diffs as the towns that changed.
	const header = {
		type: 'FeatureCollection',
		// Where it came from and when, for whoever refetches it.
		source: 'Wikidata (CC0), https://www.wikidata.org',
		fetched: new Date().toISOString().slice(0, 10),
		minPopulation
	};
	const head = JSON.stringify(header).slice(0, -1);
	const body = features.map((feature) => JSON.stringify(feature)).join(',\n');
	writeFileSync(outPath, `${head},"features":[\n${body}\n]}\n`);
	console.log(
		`${features.length} towns >= ${minPopulation} -> ${path.relative(REPO_ROOT, outPath)}`
	);
}

await main();
