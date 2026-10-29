import { placeCorrectionAttribution } from './placeCorrections.js';
import { V1_COUNTRIES } from './v1CountrySpecs.js';
// Reproducible maps for all 22 countries in the approved 1.0 plan (#241).
// Run in the documented WSL toolchain. Each map is generated, never hand-edited.
//   npx tsx data/scripts/build-v1-country-maps.ts [--country=iceland]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, slugify } from './mapBuildUtils.js';

const args = parseArgs(process.argv.slice(2));
const selected = args.country
	? V1_COUNTRIES.filter((country) => country.id === args.country)
	: V1_COUNTRIES;
if (!selected.length) throw new Error('Unknown country in this batch: ' + args.country);
const run = (script: string, flags: string[]) =>
	execFileSync(process.execPath, ['--import', 'tsx', 'data/scripts/' + script, ...flags], {
		cwd: REPO_ROOT,
		stdio: 'inherit'
	});
for (const country of selected) {
	const regionId = country.mapId ?? country.id + '-' + slugify(country.label);
	run('build-map.ts', [
		'--country=' + country.country,
		'--out=data/maps/' + regionId,
		'--type=' + country.type,
		'--name=' + country.country + ' — ' + country.label,
		...(country.nameField ? ['--name-field=' + country.nameField] : []),
		...(country.source
			? [
					'--source=' + country.source,
					'--attribution=' +
						[country.attribution, placeCorrectionAttribution(country.country)]
							.filter(Boolean)
							.join('; ')
				]
			: []),
		...(country.boundaryFacts ? ['--boundary-facts=true'] : []),
		...(country.largestCityFacts === false ? ['--largest-city-facts=false'] : []),
		...(country.townSource ? ['--places-source=' + country.townSource] : []),
		...(country.rename ? ['--rename=' + country.rename] : []),
		...(country.dissolve ? ['--dissolve=' + country.dissolve] : []),
		...(country.clip ? ['--clip=' + country.clip] : [])
	]);
	const regionMap = JSON.parse(
		readFileSync(path.join(REPO_ROOT, 'data/maps', regionId, 'map.json'), 'utf8')
	) as { targets: unknown[] };
	if (regionMap.targets.length !== country.expectedRegions)
		throw new Error(
			regionId +
				': expected ' +
				country.expectedRegions +
				' regions, got ' +
				regionMap.targets.length
		);
	run('build-terrain.ts', ['--map=' + regionId, '--force']);
	run('build-facts.ts', ['--map=' + regionId]);
	if (country.expectedLargest) {
		const derived = JSON.parse(
			readFileSync(path.join(REPO_ROOT, 'data/maps', regionId, 'facts.json'), 'utf8')
		) as Record<string, { largestCity?: { name: string } }>;
		for (const [id, name] of Object.entries(country.expectedLargest))
			if (derived[id]?.largestCity?.name !== name)
				throw new Error(regionId + '/' + id + ': expected largest city ' + name);
	}
	if (country.secondAdministrative) {
		const extra = country.secondAdministrative;
		const extraId = extra.mapId ?? country.id + '-' + slugify(extra.label);
		run('build-map.ts', [
			'--country=' + country.country,
			'--out=data/maps/' + extraId,
			'--type=' + extra.type,
			'--name=' + country.country + ' — ' + extra.label,
			'--source=' + extra.source,
			'--attribution=' + extra.attribution,
			'--boundary-facts=true',
			...(extra.largestCityFacts === false ? ['--largest-city-facts=false'] : [])
		]);
		const extraMap = JSON.parse(
			readFileSync(path.join(REPO_ROOT, 'data/maps', extraId, 'map.json'), 'utf8')
		) as { targets: unknown[] };
		if (extraMap.targets.length !== extra.expectedRegions)
			throw new Error(extraId + ': unexpected unit count');
		run('build-terrain.ts', ['--map=' + extraId, '--force']);
		run('build-facts.ts', ['--map=' + extraId]);
		console.log('Completed ' + country.country);
		continue;
	}
	const townsId = country.id + '-towns-' + country.population / 1000 + 'k';
	run('build-points-map.ts', [
		'--country=' + country.country,
		'--out=data/maps/' + townsId,
		'--name=' + country.country + ' — Towns',
		'--min-population=' + country.population,
		'--max-count=20',
		'--name-field=' + (country.townNameField ?? (country.townSource ? 'NAME' : 'local')),
		'--regions-map=' + regionId,
		...(country.townSourceCountry ? ['--source-country=' + country.townSourceCountry] : []),
		...(country.townSource ? ['--source=' + country.townSource] : []),
		...(country.townExclude ? ['--exclude=' + country.townExclude] : []),
		...(country.retainTowns ? ['--retain=' + country.retainTowns] : []),
		...(country.townsExtentFromRegions ? ['--extent=regions'] : []),
		...(country.clip ? ['--lat-min=7.8', '--lon-min=-86.1', '--lon-max=-82.3'] : [])
	]);
	run('build-terrain.ts', ['--map=' + townsId, '--force']);
	run('build-facts.ts', ['--map=' + townsId]);
	console.log('Completed ' + country.country);
}
