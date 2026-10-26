// Release content backlog #236. IDs stay stable to preserve existing progress.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './mapBuildUtils.js';
const run = (script: string, args: string[]) =>
	execFileSync(process.execPath, ['--import', 'tsx', 'data/scripts/' + script, ...args], {
		cwd: REPO_ROOT,
		stdio: 'inherit'
	});
export const BACKLOG_TOWNS = [
	{
		id: 'denmark',
		country: 'Denmark',
		regions: 'denmark-regions',
		retained: ['Aalborg', 'Aarhus', 'Vejle', 'Copenhagen', 'Esbjerg', 'Odense', 'Hillerød']
	},
	{
		id: 'norway',
		country: 'Norway',
		regions: 'norway-counties',
		retained: [
			'Tromsø',
			'Trondheim',
			'Bergen',
			'Oslo',
			'Drammen',
			'Skien',
			'Stavanger',
			'Kristiansand'
		]
	},
	{
		id: 'serbia',
		country: 'Serbia',
		regions: 'serbia-districts',
		retained: [
			'Subotica',
			'Zrenjanin',
			'Novi Sad',
			'Belgrade',
			'Kragujevac',
			'Čačak',
			'Niš',
			'Kikinda',
			'Pančevo',
			'Valjevo',
			'Bor',
			'Jagodina',
			'Užice',
			'Kraljevo',
			'Kruševac',
			'Prijepolje',
			'Novi Pazar',
			'Leskovac',
			'Vranje',
			'Vršac',
			'Prokuplje'
		]
	}
];
for (const spec of BACKLOG_TOWNS.filter((spec) => spec.id !== 'norway')) {
	const source =
		spec.id === 'denmark' ? 'denmark-regions-gb-9469f09.geojson' : 'serbia-districts-gb.geojson';
	run('build-map.ts', [
		'--country=' + spec.country,
		'--type=' + (spec.id === 'denmark' ? 'region' : 'district'),
		'--out=data/maps/' + spec.regions,
		'--name=' + spec.country + ' — ' + (spec.id === 'denmark' ? 'Regions' : 'Districts'),
		'--source=data/boundaries/' + source,
		'--source-name-field=name',
		'--name-field=name',
		'--boundary-facts=true',
		'--places-source=data/places/' + spec.id + '.geojson',
		'--attribution=' +
			(spec.id === 'denmark'
				? 'geoBoundaries / Web Vectors Map, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/'
				: '© OpenStreetMap contributors, ODbL (via geoBoundaries)')
	]);
	run('build-terrain.ts', ['--map=' + spec.regions, '--force']);
	run('build-facts.ts', ['--map=' + spec.regions]);
}
run('build-map.ts', [
	'--country=Norway',
	'--type=county',
	'--out=data/maps/norway-counties',
	'--name=Norway — Counties',
	'--source=data/boundaries/norway-counties-2024.geojson',
	// Natural Earth is a curated place sample, insufficient for county-wide ranks.
	'--largest-city-facts=false',
	'--source-name-field=name',
	'--name-field=name',
	'--boundary-facts=true',
	'--attribution=Kartverket, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; Natural Earth terrestrial clipping (public domain)'
]);
run('build-terrain.ts', ['--map=norway-counties', '--force']);
run('build-facts.ts', ['--map=norway-counties']);
for (const spec of BACKLOG_TOWNS) {
	const id = spec.id + '-towns-50k';
	run('build-points-map.ts', [
		'--country=' + spec.country,
		...(spec.id === 'norway' ? [] : ['--source=data/places/' + spec.id + '.geojson']),
		'--name-field=NAME',
		'--min-population=10000',
		'--min-count=20',
		'--max-count=' + (spec.id === 'serbia' ? 30 : 20),
		'--retain=' + spec.retained.join(','),
		'--regions-map=' + spec.regions,
		'--out=data/maps/' + id,
		'--name=' + spec.country + ' — Towns',
		...(spec.id === 'norway' ? ['--exclude=Bærum'] : [])
	]);
	run('build-terrain.ts', ['--map=' + id, '--force']);
	run('build-facts.ts', ['--map=' + id]);
	const map = JSON.parse(readFileSync(path.join(REPO_ROOT, 'data/maps', id, 'map.json'), 'utf8'));
	if (map.targets.length < 20 || map.targets.length > 60)
		throw new Error(id + ': expected 20–60 towns');
}
run('build-map-index.ts', []);
