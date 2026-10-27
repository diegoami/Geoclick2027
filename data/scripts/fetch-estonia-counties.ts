// Produce a committed, simplified snapshot of the official county boundaries.
// Routine map rebuilds read the committed GeoJSON and need no network.
// Refresh deliberately: npx tsx data/scripts/fetch-estonia-counties.ts (WSL).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, slugify } from './mapBuildUtils.js';
import { pointInPolygon, type AnyGeometry } from './factGeometry.js';

const URL = 'https://s3.pilw.io/rp-kemit-kataster/EHAK/maakond_shp.zip';
const SHA256 = 'b8862ad2217e3efbb4db3dd95f2d0e32cb2d0ca6b7c3c9447d9c87fb43d0abd9';
const DATE = '2026-09-02';
const cache = path.join(REPO_ROOT, 'data/source/estonia');
mkdirSync(cache, { recursive: true });
const archive = path.join(cache, 'counties-provider.zip');
if (!existsSync(archive))
	execFileSync('curl', [
		'--fail',
		'--location',
		'--silent',
		'--show-error',
		URL,
		'--output',
		archive
	]);
if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== SHA256)
	throw new Error(
		'Provider archive differs from the pinned 2026-09-02 snapshot; review a new edition explicitly.'
	);
const projected = path.join(cache, 'counties-wgs84.geojson');
execFileSync('ogr2ogr', [
	'-overwrite',
	'-f',
	'GeoJSON',
	'-t_srs',
	'EPSG:4326',
	projected,
	'/vsizip/' + archive + '/maakond.shp',
	'-select',
	'MNIMI,MKOOD'
]);
const simplified = path.join(cache, 'counties-simplified.geojson');
execFileSync(
	'npx',
	[
		'mapshaper',
		projected,
		'-simplify',
		'1%',
		'keep-shapes',
		'-clean',
		'-o',
		simplified,
		'format=geojson',
		'precision=0.0001',
		'force'
	],
	{ stdio: 'inherit' }
);
interface Feature {
	type: 'Feature';
	properties: Record<string, unknown>;
	geometry: AnyGeometry;
}
const parsed = JSON.parse(readFileSync(simplified, 'utf8')) as { features: Feature[] };
const expected = [
	'Harju',
	'Hiiu',
	'Ida-Viru',
	'Jõgeva',
	'Järva',
	'Lääne',
	'Lääne-Viru',
	'Põlva',
	'Pärnu',
	'Rapla',
	'Saare',
	'Tartu',
	'Valga',
	'Viljandi',
	'Võru'
].sort();
for (const feature of parsed.features) {
	const name = String(feature.properties.MNIMI ?? '')
		.normalize('NFC')
		.replace(/\s+maakond$/u, '')
		.trim();
	feature.properties = {
		name,
		shapeName: name,
		admin: 'Estonia',
		ehak: String(feature.properties.MKOOD ?? '')
	};
}
const actual = parsed.features.map((feature) => String(feature.properties.name)).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected))
	throw new Error('Unexpected county names/count: ' + actual.join(', '));
// A county count alone would miss the 2017 reform: Lihula must be in Pärnu.
const lihula: [number, number] = [23.845, 58.687];
const parnu = parsed.features.find((feature) => feature.properties.name === 'Pärnu');
const laane = parsed.features.find((feature) => feature.properties.name === 'Lääne');
if (
	!parnu ||
	!laane ||
	!pointInPolygon(lihula, parnu.geometry) ||
	pointInPolygon(lihula, laane.geometry)
)
	throw new Error('Snapshot does not reflect Lihula’s post-2017 county assignment');
parsed.features.sort((a, b) => String(a.properties.name).localeCompare(String(b.properties.name)));
const out = path.join(REPO_ROOT, 'data/boundaries/estonia-counties-' + DATE + '.geojson');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(
	out,
	JSON.stringify({
		type: 'FeatureCollection',
		source: {
			provider: 'Estonian Land and Spatial Development Board',
			providerFileDate: DATE,
			url: URL,
			sha256: SHA256,
			crs: 'EPSG:4326',
			simplification: '1% keep-shapes',
			licence: 'Unrestricted use; credit provider and data date',
			terms:
				'https://geoportaal.maaruum.ee/eng/spatial-data/administrative-and-settlement-division-p312.html'
		},
		features: parsed.features.map((feature) => ({
			...feature,
			id: slugify(String(feature.properties.name))
		}))
	}) + '\n'
);
console.log(
	'Official Estonia counties: 15; Lihula in Pärnu; snapshot ' +
		(readFileSync(out).length / 1024).toFixed(1) +
		' KB'
);
