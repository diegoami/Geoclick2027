// Fetch verified geoBoundaries objects and prepare canonical input polygons.
// WSL: node --import tsx data/scripts/fetch-v1-boundaries.ts [--country=nepal]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs } from './mapBuildUtils.js';
import { V1_BOUNDARY_SOURCES } from './v1BoundarySources.js';
const args = parseArgs(process.argv.slice(2));
const selected = args.country
	? V1_BOUNDARY_SOURCES.filter((s) => s.id === args.country)
	: V1_BOUNDARY_SOURCES;
if (!selected.length) throw new Error('Unknown boundary country: ' + args.country);
for (const spec of selected) {
	const cache = path.join(REPO_ROOT, 'data/source/v1-boundaries');
	mkdirSync(cache, { recursive: true });
	const rawFile = path.join(cache, spec.iso + '-ADM1.geojson');
	if (!existsSync(rawFile))
		execFileSync('curl', [
			'--fail',
			'--location',
			'--silent',
			'--show-error',
			spec.url,
			'--output',
			rawFile
		]);
	const raw = readFileSync(rawFile);
	if (createHash('sha256').update(raw).digest('hex') !== spec.sha256)
		throw new Error(spec.id + ': source SHA-256 mismatch; review a new edition deliberately');
	const simplified = path.join(cache, spec.iso + '-simplified.geojson');
	execFileSync(
		'npx',
		[
			'mapshaper',
			rawFile,
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
	if (data.features.length !== spec.units) throw new Error(spec.id + ': unexpected feature count');
	const seen = new Set<string>();
	const features = data.features.map((f) => {
		const originalName = String(f.properties.shapeName ?? '');
		const name = (spec.renames as Record<string, string>)[originalName] ?? originalName;
		if (!name || seen.has(name) || !['Polygon', 'MultiPolygon'].includes(f.geometry.type))
			throw new Error(spec.id + ': invalid/duplicate named polygon ' + name);
		seen.add(name);
		return {
			type: 'Feature',
			properties: { name, shapeName: name, originalName, admin: spec.country },
			geometry: f.geometry
		};
	});
	const out = path.join(REPO_ROOT, 'data/boundaries', spec.id + '-gb-9469f09.geojson');
	mkdirSync(path.dirname(out), { recursive: true });
	writeFileSync(
		out,
		JSON.stringify({
			type: 'FeatureCollection',
			source: {
				provider: spec.provider,
				via: 'geoBoundaries gbOpen 9469f09',
				year: spec.year,
				url: spec.url,
				sha256: spec.sha256,
				licence: spec.licence,
				licenceUrl: spec.licenceUrl,
				simplification: '25%, keep-shapes; precision 0.000001'
			},
			features
		}) + '\n'
	);
	console.log(spec.id + ': prepared ' + features.length + ' named polygons');
}
