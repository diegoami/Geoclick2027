// Reproducible owner-approved #325 selection/build commands. Run in the GIS worktree.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './mapBuildUtils.js';
import { ALL_NAME_FIELDS, LANGUAGE_NAME_FIELDS } from './multiCountry.js';
import { authoredResolver, storedHooksFor } from './factsHooks.js';
interface Definition {
	id: string;
	country: string;
	region: string;
	countries: string[];
	minPopulation: number;
	maxPerCountry: number;
	maxCount: number;
	minSpacing: number;
	retain?: string[];
	exclude?: string[];
	bounds?: Record<string, number>;
	wrapLongitude?: boolean;
	sourceOverrides?: Record<string, string>;
}
const definitions = JSON.parse(
	readFileSync(path.join(REPO_ROOT, 'data/curation/continent-city-maps.json'), 'utf8')
) as Definition[];
const preview = process.argv.includes('--preview');
const wanted = process.argv.find((arg) => arg.startsWith('--map='))?.slice(6);
const report = [];
for (const definition of definitions.filter((row) => !wanted || row.id === wanted)) {
	// Small states retain their capital even when it is not their largest city.
	const filter = definition.countries
		.map((country) => `'${country.replaceAll("'", "''")}'`)
		.join(',');
	const json = execFileSync(
		'ogr2ogr',
		[
			'-f',
			'GeoJSON',
			'/vsistdout/',
			'-where',
			`ADM0NAME IN (${filter}) AND FEATURECLA = 'Admin-0 capital' AND POP_MAX > ${definition.minPopulation}`,
			'-select',
			'NAME,ADM0NAME',
			'data/source/ne_10m_populated_places/ne_10m_populated_places.shp'
		],
		{ cwd: REPO_ROOT, encoding: 'utf8' }
	);
	const supplement = JSON.parse(
		readFileSync(path.join(REPO_ROOT, 'data/curation/continent-city-supplements.json'), 'utf8')
	) as {
		capitalOverrides: { country: string; name: string; capital: boolean; source: string }[];
		excludeSourceRows: { country: string; name: string; coordinates: [number, number] }[];
		features: {
			type: string;
			properties: Record<string, unknown>;
			geometry: { type: string; coordinates: [number, number] };
		}[];
	};
	const fields = [
		...new Set([
			...ALL_NAME_FIELDS,
			...LANGUAGE_NAME_FIELDS,
			'ADM0NAME',
			'ADM1NAME',
			'ADM0CAP',
			'FEATURECLA',
			'POP_MAX'
		])
	];
	const candidates = JSON.parse(
		execFileSync(
			'ogr2ogr',
			[
				'-f',
				'GeoJSON',
				'/vsistdout/',
				'-where',
				`ADM0NAME IN (${filter})`,
				'-select',
				fields.join(','),
				'data/source/ne_10m_populated_places/ne_10m_populated_places.shp'
			],
			{ cwd: REPO_ROOT, encoding: 'utf8' }
		)
	) as { features: typeof supplement.features };
	candidates.features = candidates.features.filter(
		(feature) =>
			!supplement.excludeSourceRows.some(
				(row) =>
					feature.properties.ADM0NAME === row.country &&
					feature.properties.NAME === row.name &&
					feature.geometry.coordinates.every((n, i) => Math.abs(n - row.coordinates[i]) < 0.00001)
			)
	);
	candidates.features.push(
		...supplement.features.filter((feature) =>
			definition.countries.includes(String(feature.properties.ADM0NAME))
		)
	);
	for (const feature of candidates.features) {
		const row = supplement.capitalOverrides.find(
			(row) => row.country === feature.properties.ADM0NAME && row.name === feature.properties.NAME
		);
		if (row) {
			feature.properties.ADM0CAP = row.capital ? 1 : 0;
			feature.properties.capitalSource = row.source;
		}
	}
	const extraCredits: string[] = [];
	for (const [country, file] of Object.entries(definition.sourceOverrides ?? {})) {
		const snapshot = JSON.parse(readFileSync(path.join(REPO_ROOT, file), 'utf8'));
		candidates.features = candidates.features.filter(
			(feature) => feature.properties.ADM0NAME !== country
		);
		candidates.features.push(...snapshot.features);
		extraCredits.push(snapshot.attribution ?? 'Wikidata (CC0), https://www.wikidata.org');
	}
	const source = `data/places/${definition.id}.geojson`;
	const metadata = {
		...candidates,
		attribution:
			'Natural Earth (public domain), https://www.naturalearthdata.com; ' +
			extraCredits.join('; ') +
			(definition.wrapLongitude
				? '; Yaren coordinates: Wikidata (CC0), https://www.wikidata.org/wiki/Q31026; Yaren district population: Nauru 2021 census, https://stats.gov.nr/'
				: ''),
		curation: 'data/curation/continent-city-maps.json',
		supplements: 'data/curation/continent-city-supplements.json'
	};
	writeFileSync(path.join(REPO_ROOT, source), JSON.stringify(metadata) + '\n');
	const capitals = (JSON.parse(json).features as { properties: { NAME: string } }[])
		.map((feature) => feature.properties.NAME)
		.filter((name) => !definition.exclude?.includes(name));
	const args = [
		'--import',
		'tsx',
		'data/scripts/build-points-map.ts',
		'--source=' + source,
		`--country=${definition.country}`,
		`--countries=${definition.countries.join(',')}`,
		`--out=data/maps/${definition.id}`,
		`--name=${definition.country} — Cities — ${definition.region}`,
		`--min-population=${definition.minPopulation}`,
		`--max-per-country=${definition.maxPerCountry}`,
		`--max-count=${definition.maxCount}`,
		`--min-spacing=${definition.minSpacing}`,
		`--retain-json=${JSON.stringify([...new Set([...capitals, ...(definition.retain ?? [])])])}`,
		...Object.entries(definition.bounds ?? {}).map(([key, value]) => `--${key}=${value}`),
		...(definition.exclude?.length ? ['--exclude=' + definition.exclude.join(',')] : []),
		...(definition.wrapLongitude ? ['--wrap-longitude'] : []),
		...(preview ? ['--preview'] : [])
	];
	const output = execFileSync(process.execPath, args, {
		cwd: REPO_ROOT,
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024
	});
	if (preview) {
		const targets = JSON.parse(output.split('SELECTION_JSON=')[1]) as {
			id: string;
			name: string;
			country: string;
			type: string;
		}[];
		const resolver = authoredResolver(definition.country);
		const missing = targets.filter((target) => {
			const hooks = storedHooksFor(resolver(target), 'city');
			return (
				!hooks ||
				Array.isArray(hooks) ||
				(['en', 'de', 'it'] as const).some((language) => (hooks[language]?.length ?? 0) < 3)
			);
		});
		report.push({ ...definition, count: targets.length, targets, missing });
		console.log(
			`${definition.id}: ${targets.length} cities; ${missing.length} need authored facts`
		);
	} else {
		execFileSync(
			process.execPath,
			['--import', 'tsx', 'data/scripts/build-facts.ts', `--map=${definition.id}`],
			{ cwd: REPO_ROOT, stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 }
		);
		console.log(`${definition.id}: built map and facts`);
	}
}
if (preview) {
	mkdirSync(path.join(REPO_ROOT, 'rendered'), { recursive: true });
	writeFileSync(
		path.join(REPO_ROOT, 'rendered/continent-city-selection.json'),
		JSON.stringify(report, null, 2) + '\n'
	);
}
