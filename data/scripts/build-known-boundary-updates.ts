// Rebuild only the three packages affected by the approved known border fixes.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './mapBuildUtils.js';
const specs = [
	{
		id: 'germany-districts-center',
		country: 'Germany',
		type: 'county',
		within: 'Hessen,Rheinland-Pfalz,Saarland',
		source: 'germany-districts-2026.geojson'
	},
	{
		id: 'germany-districts-east',
		country: 'Germany',
		type: 'county',
		within: 'Berlin,Brandenburg,Sachsen,Sachsen-Anhalt,Thüringen',
		source: 'germany-districts-2026.geojson'
	},
	{
		id: 'netherlands-municipalities-southwest',
		country: 'Netherlands',
		type: 'region',
		within: 'Zuid-Holland,Zeeland',
		source: 'netherlands-municipalities-2026.geojson'
	}
];
function run(script: string, args: string[] = []) {
	execFileSync(process.execPath, ['--import', 'tsx', 'data/scripts/' + script, ...args], {
		cwd: REPO_ROOT,
		stdio: 'inherit'
	});
}
run('prepare-known-boundary-updates.ts');
for (const spec of specs) {
	const previous = JSON.parse(
		readFileSync(path.join(REPO_ROOT, 'data/maps', spec.id, 'map.json'), 'utf8')
	);
	const boundary = JSON.parse(
		readFileSync(path.join(REPO_ROOT, 'data/boundaries', spec.source), 'utf8')
	);
	run('build-map.ts', [
		'--country=' + spec.country,
		'--type=' + spec.type,
		'--within=' + spec.within,
		'--source=data/boundaries/' + spec.source,
		'--source-name-field=name',
		'--boundary-facts=true',
		'--attribution=' + boundary.source.attribution,
		'--out=data/maps/' + spec.id,
		'--name=' + previous.name
	]);
	run('build-terrain.ts', ['--map=' + spec.id, '--force']);
	run('build-facts.ts', ['--map=' + spec.id]);
}
run('build-map-index.ts');
