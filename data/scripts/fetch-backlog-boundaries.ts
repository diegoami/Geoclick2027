// Current Norway counties plus the canonical Denmark/Serbia town footprints.
// Run in the documented Linux GDAL/mapshaper toolchain; downloads are cached.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, ADMIN0_SHP, slugify } from './mapBuildUtils.js';
import { boundaryFeatureDigest } from './boundaryContentHash.js';
const cache = path.join(REPO_ROOT, 'data/source/v1-content');
mkdirSync(cache, { recursive: true });
const raw = path.join(cache, 'norway-counties-api-2026-10-26.geojson');
const base = 'https://ws.geonorge.no/kommuneinfo/v1/';
const digest = 'ff960f3a64aebccd5fe8a941d26f56f9a766ac4839dda0a811abc586bd02aa15';
async function get(route: string) {
	const response = await fetch(base + route, { signal: AbortSignal.timeout(120000) });
	if (!response.ok) throw new Error('Kartverket HTTP ' + response.status);
	return response.json();
}
if (!existsSync(raw)) {
	const list = (await get('fylker?filtrer=fylkesnummer,fylkesnavn')) as {
		fylkesnummer: string;
		fylkesnavn: string;
	}[];
	if (list.length !== 15) throw new Error('Expected the 15 counties effective from 2024');
	const features = [];
	for (const county of list.sort((a, b) => a.fylkesnummer.localeCompare(b.fylkesnummer))) {
		const data = await get(`fylker/${county.fylkesnummer}/omrade?utkoordsys=4326`);
		features.push({
			type: 'Feature',
			properties: { name: data.fylkesnavn, admin: 'Norway', code: data.fylkesnummer },
			geometry: data.omrade
		});
	}
	writeFileSync(raw, JSON.stringify({ type: 'FeatureCollection', features }));
}
if (boundaryFeatureDigest(readFileSync(raw), 'name', 'code') !== digest)
	throw new Error('Kartverket geometry changed: review and pin a new source edition');
const run = (args: string[]) => {
	if (!path.resolve(args[0]).startsWith(path.resolve(cache) + path.sep))
		throw new Error('Temporary output must stay inside the source cache');
	rmSync(args[0], { force: true });
	return execFileSync('ogr2ogr', ['-f', 'GeoJSON', ...args], { stdio: 'pipe' });
};
const land = path.join(cache, 'norway-land.geojson');
run([land, ADMIN0_SHP, '-where', "ADMIN = 'Norway'", '-select', 'ADMIN', '-t_srs', 'EPSG:4326']);
const clipped = path.join(cache, 'norway-land-counties.geojson');
// Official areas include territorial waters. Teach terrestrial counties, using
// the same Natural Earth coastline as the game; retain official inland borders.
run([clipped, raw, '-clipsrc', land, '-makevalid', '-nlt', 'PROMOTE_TO_MULTI']);
const simple = path.join(cache, 'norway-counties-simplified.geojson');
execFileSync(
	'npx',
	[
		'mapshaper',
		clipped,
		'-simplify',
		'10%',
		'keep-shapes',
		'-clean',
		'-o',
		simple,
		'format=geojson',
		'precision=0.000001',
		'force'
	],
	{ stdio: 'pipe' }
);
const norway = JSON.parse(readFileSync(simple, 'utf8'));
if (
	norway.features.length !== 15 ||
	new Set(norway.features.map((f: { properties: { name: string } }) => f.properties.name)).size !==
		15
)
	throw new Error('Expected 15 unique nonempty terrestrial counties');
const boundaryDir = path.join(REPO_ROOT, 'data/boundaries');
mkdirSync(boundaryDir, { recursive: true });
const credit =
	'Kartverket, current counties from 2024, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; Natural Earth terrestrial clipping (public domain)';
writeFileSync(
	path.join(boundaryDir, 'norway-counties-2024.geojson'),
	JSON.stringify({
		type: 'FeatureCollection',
		source: {
			provider: 'Kartverket',
			url: base,
			edition: '2026-10-26',
			year: '2024',
			licence: 'CC BY 4.0',
			licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
			featureDigest: digest,
			attribution: credit,
			preparation:
				'Official inland borders; terrestrial intersection with Natural Earth admin-0; mapshaper 10% keep-shapes, clean, precision 0.000001'
		},
		features: norway.features
	}) + '\n'
);
// Detailed coastline avoids dropping Fredericia, Sønderborg and Svendborg.
const denmarkUrl =
	'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/DNK/ADM1/geoBoundaries-DNK-ADM1.geojson';
const denmarkRaw = path.join(cache, 'DNK-ADM1-gb-9469f09.geojson');
if (!existsSync(denmarkRaw)) {
	const response = await fetch(denmarkUrl);
	if (!response.ok) throw new Error('Danish source HTTP ' + response.status);
	writeFileSync(denmarkRaw, Buffer.from(await response.arrayBuffer()));
}
const denmarkBytes = readFileSync(denmarkRaw);
const denmarkSha = '5aedd6ecb225af8b5bbfac416e7024d15255b4bbdb884d1d8e77b8b4a58baca9';
if (createHash('sha256').update(denmarkBytes).digest('hex') !== denmarkSha)
	throw new Error('Danish source SHA256 changed');
const denmark = JSON.parse(denmarkBytes.toString('utf8'));
const danishNames = new Set([
	'Nordjylland',
	'Midtjylland',
	'Sjælland',
	'Hovedstaden',
	'Syddanmark'
]);
if (
	denmark.features.length !== 5 ||
	new Set(
		denmark.features.map((f: { properties: { shapeName: string } }) => f.properties.shapeName)
	).size !== 5
)
	throw new Error('Expected five distinct Danish regions');
for (const feature of denmark.features) {
	const name = feature.properties.shapeName;
	if (!danishNames.has(name)) throw new Error('Unrecognized Danish region: ' + name);
	feature.properties = { name, admin: 'Denmark' };
}
writeFileSync(
	path.join(boundaryDir, 'denmark-regions-gb-9469f09.geojson'),
	JSON.stringify({
		type: 'FeatureCollection',
		source: {
			provider: 'geoBoundaries 9469f09; Web Vectors Map',
			url: denmarkUrl,
			licence: 'CC BY 4.0',
			licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
			sha256: denmarkSha,
			attribution:
				'geoBoundaries / Web Vectors Map, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/'
		},
		features: denmark.features
	}) + '\n'
);
// Reuse Serbia's existing pinned, licensed 25-district source, not Natural
// Earth's absent Serbian admin-1 rows. Preserve the names already taught.
const serbiaSource = path.join(REPO_ROOT, 'data/source/geoboundaries/SRB-ADM1.geojson');
const serbiaUrl =
	'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/SRB/ADM1/geoBoundaries-SRB-ADM1_simplified.geojson';
if (!existsSync(serbiaSource)) {
	mkdirSync(path.dirname(serbiaSource), { recursive: true });
	const response = await fetch(serbiaUrl);
	if (!response.ok) throw new Error('Serbian source HTTP ' + response.status);
	writeFileSync(serbiaSource, Buffer.from(await response.arrayBuffer()));
}
const serbiaBytes = readFileSync(serbiaSource);
const serbiaSha = '886d17adb5d9491d9b464b02a2b3f02ff1a7f2ef71a702840019ab3739f4f562';
if (createHash('sha256').update(serbiaBytes).digest('hex') !== serbiaSha)
	throw new Error('Serbian source SHA256 changed');
const canonical = [
	'North Bačka',
	'North Banat',
	'West Bačka',
	'South Bačka',
	'Central Banat',
	'South Banat',
	'Syrmia',
	'Belgrade',
	'Mačva',
	'Podunavlje',
	'Braničevo',
	'Kolubara',
	'Bor',
	'Šumadija',
	'Pomoravlje',
	'Moravica',
	'Zaječar',
	'Zlatibor',
	'Rasina',
	'Nišava',
	'Raška',
	'Toplica',
	'Pirot',
	'Jablanica',
	'Pčinja'
].map((name) => ({ name }));
const serbia = JSON.parse(serbiaBytes.toString('utf8'));
if (serbia.features.length !== 25) throw new Error('Expected 25 Serbian districts');
for (const feature of serbia.features) {
	const originalName = String(feature.properties.shapeName);
	const name = canonical.find(
		(target) => slugify(target.name) === slugify(originalName.replace(/ District$/, ''))
	)?.name;
	if (!name) throw new Error('Unrecognized Serbian district: ' + originalName);
	feature.properties = { name, admin: 'Serbia', originalName };
}
writeFileSync(
	path.join(boundaryDir, 'serbia-districts-gb.geojson'),
	JSON.stringify({
		type: 'FeatureCollection',
		source: {
			provider: 'geoBoundaries 9469f09; OpenStreetMap',
			url: serbiaUrl,
			licence: 'ODbL 1.0',
			licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
			sha256: serbiaSha,
			attribution: '© OpenStreetMap contributors, ODbL (via geoBoundaries)'
		},
		features: serbia.features
	}) + '\n'
);
console.log('Prepared Norway 15, Denmark 5, Serbia 25 canonical divisions');
