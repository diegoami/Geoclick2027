// Fails the build when the map and style assets never reached app/build. The
// copy is the easy half of FT-58; this check is the point: a build whose every
// map.json 404s at runtime must fail here rather than ship. Runs in
// `postbuild`, after `vite build` has copied app/static into app/build.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The build to check: app/scripts/ -> app/ -> build. An argument overrides it,
// for the test that drives this script against a scratch directory.
const buildDir = process.argv[2]
	? resolve(process.argv[2])
	: join(dirname(fileURLToPath(import.meta.url)), '..', 'build');

const maps = join(buildDir, 'maps');
const missing = [join(maps, 'index.json'), join(buildDir, 'styles', 'base.json')].filter(
	(path) => !existsSync(path)
);

// At least one map's own data too, so an empty maps/ directory fails as well.
const hasMapData =
	existsSync(maps) &&
	statSync(maps).isDirectory() &&
	readdirSync(maps, { withFileTypes: true }).some(
		(entry) => entry.isDirectory() && existsSync(join(maps, entry.name, 'map.json'))
	);
if (!hasMapData) missing.push(join(maps, '<map>', 'map.json'));

if (missing.length > 0) {
	console.error('Build is missing map/style assets, so the app would 404 on every map:');
	for (const path of missing) console.error(`  - ${path}`);
	console.error(
		'Run `node scripts/prepare-assets.mjs`, and check that data/maps and data/styles exist.'
	);
	process.exit(1);
}
console.log('Map and style assets are present in the build.');
