// Official settlement counts + complete public coordinate gazetteer, not city classes.
// Linux: Python standard library, no spreadsheet/translation service dependency.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './mapBuildUtils.js';
import { canonicalRegionAtPoint, type NamedRegion } from './boundaryRegions.js';
import type { Position } from './factGeometry.js';
const censusUrl = 'https://popis2022.stat.gov.rs/media/31319/0_ukupan-broj-stanovnika-naselja.xlsx';
const gazetteerUrl = 'https://download.geonames.org/export/dump/RS.zip';
const cache = path.join(REPO_ROOT, 'data/source/v1-content');
mkdirSync(cache, { recursive: true });
async function pinned(file: string, url: string, sha: string) {
	const full = path.join(cache, file);
	if (!existsSync(full)) {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'GeoclickContentBuild/1.0 (https://github.com/diegoami/Geoclick2027)'
			},
			signal: AbortSignal.timeout(120000)
		});
		if (!response.ok) throw new Error('Source HTTP ' + response.status);
		writeFileSync(full, Buffer.from(await response.arrayBuffer()));
	}
	if (createHash('sha256').update(readFileSync(full)).digest('hex') !== sha)
		throw new Error(file + ': content changed; review a new edition');
	return full;
}
const census = await pinned(
	'serbia-2022-settlements.xlsx',
	censusUrl,
	'5b1498923b90ec9930485ac3115cf10ad8f5ccf988840807d87ae70a58f57dc2'
);
const gazetteer = await pinned(
	'RS-geonames.zip',
	gazetteerUrl,
	'fcb96cc69baa80c27968ad50d2a593a1c64f33e0b620ee527076d81ecd7e937b'
);
const parsed = JSON.parse(
	execFileSync(
		'python3',
		[path.join(REPO_ROOT, 'data/scripts/read-serbia-census.py'), census, gazetteer],
		{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
	)
);
const boundary = JSON.parse(
	readFileSync(path.join(REPO_ROOT, 'data/boundaries/serbia-districts-gb.geojson'), 'utf8')
) as { features: NamedRegion[]; source: unknown };
const names = new Set(boundary.features.map((feature) => String(feature.properties.name)));
const features = [];
for (const feature of parsed.features) {
	const region = canonicalRegionAtPoint(
		feature.geometry.coordinates as Position,
		boundary.features,
		'Serbia',
		names
	);
	if (
		!region ||
		typeof feature.properties.censusDistrict !== 'string' ||
		!names.has(feature.properties.censusDistrict) ||
		region !== feature.properties.censusDistrict
	) {
		throw new Error(
			'Census/gazetteer district mismatch for ' +
				feature.properties.NAME +
				': expected ' +
				feature.properties.censusDistrict +
				', found ' +
				region
		);
	}
	feature.properties.ADM1NAME = region;
	features.push(feature);
}
for (const name of [
	'Belgrade',
	'Šabac',
	'Smederevo',
	'Sombor',
	'Požarevac',
	'Pirot',
	'Zaječar',
	'Sremska Mitrovica'
])
	if (!features.some((feature) => feature.properties.NAME === name))
		throw new Error('Required urban settlement missing: ' + name);
if (new Set(features.map((feature) => feature.properties.ADM1NAME)).size !== 25)
	throw new Error('At least one district has no urban settlement');
features.sort((a, b) => a.properties.NAME.localeCompare(b.properties.NAME));
writeFileSync(
	path.join(REPO_ROOT, 'data/places/serbia.geojson'),
	JSON.stringify(
		{
			type: 'FeatureCollection',
			source:
				'Statistical Office of the Republic of Serbia, 2022 census urban settlements; GeoNames coordinates, CC BY 4.0',
			attribution:
				'Population: Statistical Office of the Republic of Serbia, 2022 census, https://popis2022.stat.gov.rs; coordinates: GeoNames, CC BY 4.0, https://www.geonames.org',
			populationSource: censusUrl,
			coordinateSource: gazetteerUrl,
			populationSha256: '5b1498923b90ec9930485ac3115cf10ad8f5ccf988840807d87ae70a58f57dc2',
			coordinateSha256: 'fcb96cc69baa80c27968ad50d2a593a1c64f33e0b620ee527076d81ecd7e937b',
			fetchedAt: new Date().toISOString(),
			populationDate: '2022-10-01',
			populationDefinition:
				'Urban settlements only; Belgrade/Niš parts aggregated; no municipal/city-administration totals',
			regionSource: boundary.source,
			urbanTotal: parsed.urbanTotal,
			urbanSettlements: parsed.urbanSettlements,
			excluded: parsed.excluded,
			features
		},
		null,
		'\t'
	) + '\n'
);
console.log('Serbia: ' + features.length + ' sourced urban settlements; all 25 districts covered');
