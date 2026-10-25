// Reproducible first country batch for the approved 1.0 plan (#241).
// Run in the documented WSL toolchain. Each map is generated, never hand-edited.
//   npx tsx data/scripts/build-v1-country-maps.ts [--country=iceland]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, slugify } from './mapBuildUtils.js';

interface Country {
	country: string;
	id: string;
	type: string;
	label: string;
	expectedRegions: number;
	nameField?: string;
	population: number;
	clip?: string;
	rename?: string;
	dissolve?: string;
	townSource?: string;
	source?: string;
	attribution?: string;
	boundaryFacts?: boolean;
	townExclude?: string;
	expectedLargest?: Record<string, string>;
}
// Natural Earth separates county-right cities; merge them into their counties.
// Budapest remains its own unit. Veszprém city already shares its county name.
const hungarianCounties: Record<string, string> = {
	Sopron: 'Győr-Moson-Sopron',
	Szeged: 'Csongrád-Csanád',
	Salgótarján: 'Nógrád',
	Szolnok: 'Jász-Nagykun-Szolnok',
	Érd: 'Pest',
	Eger: 'Heves',
	Miskolc: 'Borsod-Abaúj-Zemplén',
	Hódmezôvásárhely: 'Csongrád-Csanád',
	Dunaújváros: 'Fejér',
	Kecskemét: 'Bács-Kiskun',
	Tatabánya: 'Komárom-Esztergom',
	Gyôr: 'Győr-Moson-Sopron',
	Szombathely: 'Vas',
	Zalaegerszeg: 'Zala',
	Nagykanizsa: 'Zala',
	Kaposvár: 'Somogy',
	Pécs: 'Baranya',
	Szekszárd: 'Tolna',
	Székesfehérvár: 'Fejér',
	Békéscsaba: 'Békés',
	Debrecen: 'Hajdú-Bihar',
	Nyíregyháza: 'Szabolcs-Szatmár-Bereg',
	'Gyor-Moson-Sopron': 'Győr-Moson-Sopron',
	Csongrád: 'Csongrád-Csanád'
};
const countries: Country[] = [
	{
		country: 'Hungary',
		id: 'hungary',
		expectedLargest: { 'csongrad-csanad': 'Szeged' },
		type: 'county',
		label: 'Counties',
		expectedRegions: 20,
		dissolve: 'name',
		rename: Object.entries(hungarianCounties)
			.map(([from, to]) => from + '=' + to)
			.join(','),
		population: 10000
	},
	{
		country: 'Slovakia',
		id: 'slovakia',
		// Petržalka is a Bratislava borough, not a separate town (petrzalka.sk).
		townExclude: 'Petržalka',
		townSource: 'data/places/slovakia.geojson',
		rename: 'Prešov=Prešovský,Trenciansky=Trenčiansky',
		type: 'region',
		label: 'Regions',
		expectedRegions: 8,
		population: 10000
	},
	{
		country: 'Estonia',
		id: 'estonia',
		source: 'data/boundaries/estonia-counties-2026-09-02.geojson',
		attribution:
			'Administrative and settlement units: Estonian Land and Spatial Development Board, snapshot 2026-09-02; unrestricted use with attribution',
		boundaryFacts: true,
		expectedLargest: { parnu: 'Pärnu', saare: 'Kuressaare' },
		townSource: 'data/places/estonia.geojson',
		type: 'county',
		label: 'Counties',
		expectedRegions: 15,
		population: 5000
	},
	{
		country: 'Lithuania',
		id: 'lithuania',
		townSource: 'data/places/lithuania.geojson',
		rename:
			'Telšiai=Telšių,Šiauliai=Šiaulių,Panevezio=Panevėžio,Klaipedos=Klaipėdos,Taurages=Tauragės,Marijampoles=Marijampolės',
		type: 'county',
		label: 'Counties',
		expectedRegions: 10,
		population: 10000
	},
	{
		country: 'Iceland',
		id: 'iceland',
		expectedLargest: { [slugify('Höfuðborgarsvæðið')]: 'Reykjavík' },
		dissolve: 'name',
		rename: 'Reykjavík=Höfuðborgarsvæðið,Höfuðborgarsvæði=Höfuðborgarsvæðið',
		type: 'region',
		label: 'Regions',
		expectedRegions: 8,
		population: 1000
	},
	{
		country: 'Costa Rica',
		id: 'costa-rica',
		type: 'province',
		label: 'Provinces',
		expectedRegions: 7,
		nameField: 'name_es',
		population: 1000,
		clip: '-86.1,7.8,-82.3,11.3'
	}
];
const args = parseArgs(process.argv.slice(2));
const selected = args.country
	? countries.filter((country) => country.id === args.country)
	: countries;
if (!selected.length) throw new Error('Unknown country in this batch: ' + args.country);
const run = (script: string, flags: string[]) =>
	execFileSync(process.execPath, ['--import', 'tsx', 'data/scripts/' + script, ...flags], {
		cwd: REPO_ROOT,
		stdio: 'inherit'
	});
for (const country of selected) {
	const regionId = country.id + '-' + country.label.toLowerCase();
	run('build-map.ts', [
		'--country=' + country.country,
		'--out=data/maps/' + regionId,
		'--type=' + country.type,
		'--name=' + country.country + ' — ' + country.label,
		...(country.nameField ? ['--name-field=' + country.nameField] : []),
		...(country.source
			? ['--source=' + country.source, '--attribution=' + country.attribution]
			: []),
		...(country.boundaryFacts ? ['--boundary-facts=true'] : []),
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
	const townsId = country.id + '-towns-' + country.population / 1000 + 'k';
	run('build-points-map.ts', [
		'--country=' + country.country,
		'--out=data/maps/' + townsId,
		'--name=' + country.country + ' — Towns',
		'--min-population=' + country.population,
		'--max-count=20',
		'--name-field=' + (country.townSource ? 'NAME' : 'local'),
		...(country.townSource ? ['--source=' + country.townSource] : []),
		...(country.townExclude ? ['--exclude=' + country.townExclude] : []),
		...(country.clip ? ['--lat-min=7.8', '--lon-min=-86.1', '--lon-max=-82.3'] : [])
	]);
	run('build-terrain.ts', ['--map=' + townsId, '--force']);
	run('build-facts.ts', ['--map=' + townsId]);
	console.log('Completed ' + country.country);
}
