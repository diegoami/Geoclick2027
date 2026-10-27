// Prepare current official/open snapshots for the last eight approved countries.
// WSL: node --import tsx data/scripts/fetch-v1-current-boundaries.ts [--country=angola]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, slugify } from './mapBuildUtils.js';
import { boundaryFeatureDigest } from './boundaryContentHash.js';
import { deriveAngolaProvinces } from './deriveAngolaProvinces.js';
import { V1_CURRENT_BOUNDARY_SOURCES } from './v1CurrentBoundarySources.js';
const args = parseArgs(process.argv.slice(2));
const selected = args.country
	? V1_CURRENT_BOUNDARY_SOURCES.filter(
			(s) => s.id === args.country || slugify(s.country) === args.country
		)
	: V1_CURRENT_BOUNDARY_SOURCES;
if (!selected.length) throw new Error('Unknown current-boundary country: ' + args.country);
const cache = path.join(REPO_ROOT, 'data/source/v1-current');
mkdirSync(cache, { recursive: true });
const rawSha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const spec of selected) {
	const raw = path.join(cache, spec.cacheName);
	if (!existsSync(raw)) {
		let url = spec.url;
		if (spec.resolver === 'datagovsg') {
			const response = await fetch(url);
			if (!response.ok) throw new Error('Download resolver HTTP ' + response.status);
			const info = (await response.json()) as { data: { url?: string } };
			if (!info.data.url) throw new Error('No public dataset download URL');
			url = info.data.url;
		}
		execFileSync('curl', [
			'--fail',
			'--location',
			'--silent',
			'--show-error',
			url,
			'--output',
			raw
		]);
	}
	const digest =
		spec.hashMode === 'features'
			? boundaryFeatureDigest(readFileSync(raw), spec.nameField, spec.idField!)
			: rawSha(raw);
	if (digest !== spec.sha256)
		throw new Error(spec.id + ': source content changed; review a new edition');
	let input = spec.member ? '/vsizip/' + raw + '/' + spec.member : raw;
	const projected = path.join(cache, spec.id + '-normalized.geojson');
	rmSync(projected, { force: true });
	if (spec.format === 'osm' || spec.format === 'angola') {
		const sql =
			"SELECT osm_id,name,hstore_get_value(other_tags,'name:en') AS name_en,hstore_get_value(other_tags,'ISO3166-2') AS iso_code FROM multipolygons WHERE boundary='administrative' AND admin_level='4'";
		execFileSync(
			'ogr2ogr',
			[
				'-overwrite',
				'-f',
				'GeoJSON',
				projected,
				raw,
				'-sql',
				sql,
				'--config',
				'OSM_MAX_TMPFILE_SIZE',
				'512'
			],
			{ stdio: 'inherit' }
		);
		if (spec.format === 'angola') {
			const secondary = spec.secondary!;
			const zip = path.join(cache, secondary.cacheName);
			if (!existsSync(zip))
				execFileSync('curl', [
					'--fail',
					'--location',
					'--silent',
					'--show-error',
					secondary.url,
					'--output',
					zip
				]);
			if (rawSha(zip) !== secondary.sha256)
				throw new Error('Angola municipality source SHA-256 mismatch');
			const municipalities = path.join(cache, 'angola-municipalities-normalized.geojson');
			rmSync(municipalities, { force: true });
			execFileSync('ogr2ogr', [
				'-overwrite',
				'-f',
				'GeoJSON',
				municipalities,
				'/vsizip/' + zip + '/' + secondary.member,
				'-t_srs',
				'EPSG:4326'
			]);
			const derived = path.join(cache, 'angola-current-derived.geojson');
			deriveAngolaProvinces(projected, municipalities, derived);
			input = derived;
		} else input = projected;
	} else {
		execFileSync('ogr2ogr', [
			'-overwrite',
			'-f',
			'GeoJSON',
			projected,
			input,
			'-t_srs',
			'EPSG:4326'
		]);
		input = projected;
	}
	const simplified = path.join(cache, spec.id + '-current-simplified.geojson');
	execFileSync(
		'npx',
		[
			'mapshaper',
			input,
			'-simplify',
			'25%',
			'keep-shapes',
			'-clean',
			'-o',
			simplified,
			'format=geojson',
			'precision=0.000001',
			'force'
		],
		{ stdio: 'inherit' }
	);
	const data = JSON.parse(readFileSync(simplified, 'utf8')) as {
		features: {
			type: string;
			properties: Record<string, unknown>;
			geometry: { type: string; coordinates: unknown };
		}[];
	};
	if (data.features.length !== (spec.sourceUnits ?? spec.units))
		throw new Error(spec.id + ': unexpected source polygon count');
	const seen = new Set<string>();
	const features = data.features.map((f) => {
		const originalName = String(f.properties[spec.nameField] ?? '');
		let name = spec.renames[originalName] ?? originalName;
		if (spec.stripSuffix && name.endsWith(spec.stripSuffix))
			name = name.slice(0, -spec.stripSuffix.length);
		if (spec.titleCase) name = name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
		if (!name || seen.has(name) || !['Polygon', 'MultiPolygon'].includes(f.geometry.type))
			throw new Error(spec.id + ': invalid/duplicate polygon ' + name);
		seen.add(name);
		return {
			type: 'Feature',
			properties: { name, shapeName: name, originalName, admin: spec.country },
			geometry: f.geometry
		};
	});
	const context = new Set(spec.contextNames ?? []);
	const quiz = features.filter((f) => !context.has(f.properties.name));
	const contextFeatures = features.filter((f) => context.has(f.properties.name));
	if (quiz.length !== spec.units) throw new Error(spec.id + ': incorrect quiz-unit count');
	const out = path.join(REPO_ROOT, 'data/boundaries', spec.filename);
	writeFileSync(
		out,
		JSON.stringify({
			type: 'FeatureCollection',
			source: {
				provider: spec.provider,
				year: spec.year,
				url: spec.url,
				sha256: digest,
				hashMode: spec.hashMode ?? 'raw',
				rawSha256: rawSha(raw),
				licence: spec.licence,
				licenceUrl: spec.licenceUrl,
				...(spec.secondary ? { additionalSource: spec.secondary } : {}),
				...(spec.references ? { references: spec.references } : {}),
				...(spec.notes ? { notes: spec.notes } : {}),
				simplification: '25%, keep-shapes; EPSG:4326 precision 0.000001',
				contextOnly: spec.contextNames ?? []
			},
			features: quiz,
			...(contextFeatures.length ? { contextFeatures } : {})
		}) + '\n'
	);
	console.log(
		spec.id +
			': ' +
			quiz.length +
			' quiz polygons' +
			(contextFeatures.length ? ', ' + contextFeatures.length + ' neutral context polygon' : '')
	);
}
