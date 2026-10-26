// Approved known legal changes before 1.0 (#244); Linux GDAL/SQLite GEOS.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './mapBuildUtils.js';
import { germanDistrictName } from './admin2.js';
import { boundaryFeatureDigest } from './boundaryContentHash.js';
interface Feature {
	properties: Record<string, string>;
	geometry: unknown;
}
interface Collection {
	features: Feature[];
}
const cache = path.join(REPO_ROOT, 'data/source/v1-content');
mkdirSync(cache, { recursive: true });
const boundaries = path.join(REPO_ROOT, 'data/boundaries');
mkdirSync(boundaries, { recursive: true });
async function pinnedGB(code: string, sha: string) {
	const file = path.join(REPO_ROOT, 'data/source/geoboundaries', code + '.geojson');
	if (!existsSync(file)) {
		const [country, level] = code.split('-');
		const response = await fetch(
			`https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/${country}/${level}/geoBoundaries-${code}_simplified.geojson`
		);
		if (!response.ok) throw new Error(code + ': HTTP ' + response.status);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, Buffer.from(await response.arrayBuffer()));
	}
	const bytes = readFileSync(file);
	if (createHash('sha256').update(bytes).digest('hex') !== sha)
		throw new Error(code + ': source content changed');
	return JSON.parse(bytes.toString('utf8')) as Collection;
}
function ogr(out: string, args: string[]) {
	rmSync(out, { force: true });
	execFileSync('ogr2ogr', ['-f', out.endsWith('.gpkg') ? 'GPKG' : 'GeoJSON', out, ...args], {
		stdio: 'pipe'
	});
}
function measure(file: string, query: string): Record<string, number> {
	const json = execFileSync(
		'ogr2ogr',
		['-f', 'GeoJSON', '/vsistdout/', file, '-dialect', 'SQLite', '-sql', query],
		{ encoding: 'utf8', maxBuffer: 1024 * 1024 }
	);
	return JSON.parse(json).features[0].properties;
}
function validCollection(file: string, expected: number) {
	const result = measure(
		file,
		'SELECT COUNT(*) AS n, MIN(ST_IsValid(geometry)) AS valid, SUM(ST_IsEmpty(geometry)) AS empty FROM "SELECT"'
	);
	if (result.n !== expected || result.valid !== 1 || result.empty !== 0)
		throw new Error('Invalid prepared geometry: ' + file);
}
function prepared(file: string, source: Record<string, unknown>, features: unknown[]) {
	writeFileSync(
		path.join(boundaries, file),
		JSON.stringify({ type: 'FeatureCollection', source, features }) + '\n'
	);
}
const nl = await pinnedGB(
	'NLD-ADM2',
	'a973d6452362a29a8b8d364df0a377362e0cf68ce8f7da0298008c77c1c678c7'
);
const merged = new Set(['Brielle', 'Hellevoetsluis', 'Westvoorne']);
if (merged.size !== nl.features.filter((f: Feature) => merged.has(f.properties.shapeName)).length)
	throw new Error('Expected three predecessor Dutch municipalities');
for (const f of nl.features)
	f.properties = {
		name: merged.has(f.properties.shapeName) ? 'Voorne aan Zee' : f.properties.shapeName,
		admin: 'Netherlands'
	};
const nlIn = path.join(cache, 'nl-named.geojson');
writeFileSync(nlIn, JSON.stringify(nl));
const nlOut = path.join(cache, 'nl-342.geojson');
ogr(nlOut, [
	nlIn,
	'-dialect',
	'SQLite',
	'-sql',
	'SELECT name, admin, ST_Union(geometry) AS geometry FROM "nl-named" GROUP BY name,admin',
	'-lco',
	'COORDINATE_PRECISION=6'
]);
validCollection(nlOut, 342);
const nld = JSON.parse(readFileSync(nlOut, 'utf8'));
if (nld.features.length !== 342) throw new Error('Expected 342 Dutch municipalities');
prepared(
	'netherlands-municipalities-2026.geojson',
	{
		provider: 'Kadaster / CBS via geoBoundaries 9469f09, with 2023 Voorne aan Zee merger',
		licence: 'CC0',
		attribution:
			'Kadaster / CBS via geoBoundaries (CC0); Voorne aan Zee merger reconstructed by dissolving its three predecessors',
		legalReference:
			'https://www.cbs.nl/nl-nl/onze-diensten/methoden/classificaties/overig/gemeentelijke-indelingen-per-jaar/indeling-per-jaar/gemeentelijke-indeling-op-1-januari-2026',
		preparation:
			'Known 2023 merger only; retained generalised older geometry elsewhere, not a survey of all small boundary corrections',
		sourceSha256: 'a973d6452362a29a8b8d364df0a377362e0cf68ce8f7da0298008c77c1c678c7'
	},
	nld.features
);
const de = await pinnedGB(
	'DEU-ADM3',
	'a711f65d1eafa075e24c9efe0b37af042567bea00e7b2b6d9e49d63f0a421ade'
);
for (const f of de.features) {
	const name = germanDistrictName(f.properties.shapeName);
	f.properties = { name: name === 'Eisenach' ? 'Wartburgkreis' : name, admin: 'Germany' };
}
const deIn = path.join(cache, 'de-named.geojson');
writeFileSync(deIn, JSON.stringify(de));
const gpkg = path.join(cache, 'de-updates.gpkg');
ogr(gpkg, [
	deIn,
	'-nln',
	'districts',
	'-dialect',
	'SQLite',
	'-sql',
	'SELECT name, admin, ST_Union(geometry) AS geom FROM "de-named" GROUP BY name,admin'
]);
const hesseUrl =
	'https://basisdienste.geoportal.hessen.de/ogc/borders?service=WFS&request=GetFeature&version=2.0.0&typeNames=borders:landkreiseHE_wfs&srsName=EPSG:4326&count=100';
const hesse = path.join(cache, 'hes-districts-2026.gml');
if (!existsSync(hesse)) {
	const r = await fetch(hesseUrl);
	if (!r.ok) throw new Error('Hesse HTTP ' + r.status);
	writeFileSync(hesse, Buffer.from(await r.arrayBuffer()));
}
const hanau = path.join(cache, 'hanau-official.geojson');
ogr(hanau, [
	hesse,
	'-where',
	"KREIS_NR = '415'",
	'-t_srs',
	'EPSG:4326',
	'-lco',
	'COORDINATE_PRECISION=6'
]);
const h = JSON.parse(readFileSync(hanau, 'utf8'));
if (h.features.length !== 1 || h.features[0].properties.KREIS_BZ !== 'Kreisfreie Stadt Hanau')
	throw new Error('Expected official independent Hanau');
h.features[0].properties = { name: 'Hanau', admin: 'Germany' };
writeFileSync(hanau, JSON.stringify(h));
const hd = boundaryFeatureDigest(readFileSync(hanau), 'name', 'admin');
if (hd !== 'fb36267ed157f5dc3f76e81a4a1dd527b918c98c731dc054e639b184b8fb3e63')
	throw new Error('Hanau geometry edition changed: ' + hd);
execFileSync('ogr2ogr', ['-update', gpkg, hanau, '-nln', 'hanau'], { stdio: 'pipe' });
const retained = measure(
	gpkg,
	"SELECT ST_Area(ST_Intersection(d.geom,h.geom))/ST_Area(h.geom) AS fraction FROM districts d,hanau h WHERE d.name='Main-Kinzig-Kreis'"
);
if (retained.fraction < 0.99 || retained.fraction > 1.000001)
	throw new Error('Hanau source incompatible with existing district footprint');
const out = path.join(cache, 'de-401.geojson');
// Keep the original coarse outer district outline; share exactly the same cut
// between Hanau and Main-Kinzig to avoid gaps/slivers from mixed scales.
const cut =
	"(SELECT ST_Intersection(d.geom,h.geom) FROM districts d,hanau h WHERE d.name='Main-Kinzig-Kreis')";
ogr(out, [
	gpkg,
	'-dialect',
	'SQLite',
	'-sql',
	`SELECT name,admin,CASE WHEN name='Main-Kinzig-Kreis' THEN ST_Difference(geom,${cut}) ELSE geom END AS geom FROM districts UNION ALL SELECT 'Hanau' AS name,'Germany' AS admin,${cut} AS geom`,
	'-lco',
	'COORDINATE_PRECISION=6'
]);
validCollection(out, 401);
const overlap = measure(
	out,
	'SELECT ST_Area(ST_Intersection(a.geometry,b.geometry)) AS area FROM "SELECT" a,"SELECT" b WHERE a.name=\'Hanau\' AND b.name=\'Main-Kinzig-Kreis\''
);
if (overlap.area > 1e-12) throw new Error('Hanau overlaps Main-Kinzig');
const deu = JSON.parse(readFileSync(out, 'utf8'));
if (deu.features.length !== 401 || deu.features.some((f: Feature) => !f.geometry))
	throw new Error('Expected 401 nonempty German districts');
prepared(
	'germany-districts-2026.geojson',
	{
		provider: 'GeoBasis-DE / BKG 2023 via geoBoundaries; HVBG/ZKFG Hessen 2026',
		licence: 'BKG dl-de/by-2-0; Hesse dl-de/zero-2-0',
		attribution:
			'© GeoBasis-DE / BKG 2023, https://www.govdata.de/dl-de/by-2-0; Hanau: HVBG/ZKFG Hessen, https://www.govdata.de/dl-de/zero-2-0. Modified: Eisenach merger; Hanau split clipped to existing coarse footprint; Leipzig city/county separated.',
		hanauSource: hesseUrl,
		hanauFeatureDigest: hd,
		hanauEdition: '2026-06-17',
		preparation:
			'Eisenach dissolved into Wartburgkreis (2021); Hanau split from Main-Kinzig-Kreis (2026) using official municipal footprint intersected with old district; Leipzig names disambiguated. Other geometry retains pinned source edition.',
		sourceSha256: 'a711f65d1eafa075e24c9efe0b37af042567bea00e7b2b6d9e49d63f0a421ade'
	},
	deu.features
);
console.log('Prepared known changes: Netherlands342, Germany401');
