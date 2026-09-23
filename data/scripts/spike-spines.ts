// FT-64 spike only - not part of the map build. Recomputes a map's simplified
// geometry the way build-map.ts does (mapshaper alone; no ogr2ogr needed),
// computes one spine per target, and writes data/maps/<id>/spines.json next
// to the map.json it matches. Targets are matched by nearest centroid, so
// build-map's name fixups do not have to be repeated here.
//
//   npx tsx data/scripts/spike-spines.ts --map=italy-regions --country=Italy --dissolve=region
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeSpine, type Geometry } from './spine.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const SHP = 'data/source/ne_10m_admin_1_states_provinces/ne_10m_admin_1_states_provinces.shp';

const args = Object.fromEntries(
	process.argv.slice(2).map((a) => {
		const [k, ...v] = a.replace(/^--/, '').split('=');
		return [k, v.join('=')];
	})
);
const { map: mapId, country, dissolve } = args;
const exclude = args.exclude ? args.exclude.split(',') : [];

const tmp = mkdtempSync(path.join(tmpdir(), 'spine-'));
const out = path.join(tmp, 'shapes.geojson');
const filter = [`admin=='${country}'`, ...exclude.map((n) => `name!='${n}'`)].join(' && ');
const cmd = [
	'npx mapshaper',
	`"${SHP}"`,
	`-filter "${filter}"`,
	dissolve ? `-dissolve ${dissolve}` : '',
	'-simplify 10% keep-shapes -clean',
	`-o "${out}" format=geojson precision=0.0001`
].join(' ');
execSync(cmd, { cwd: REPO_ROOT, stdio: 'ignore' });

const shapes: { features: { geometry: Geometry }[] } = JSON.parse(readFileSync(out, 'utf-8'));
rmSync(tmp, { recursive: true });
const mapJson = path.join(REPO_ROOT, 'data/maps', mapId, 'map.json');
const def: { targets: { id: string; bbox: number[] }[] } = JSON.parse(
	readFileSync(mapJson, 'utf-8')
);

const bboxMid = (g: Geometry): [number, number] => {
	const pts = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat(2);
	const xs = pts.map((p) => p[0]);
	const ys = pts.map((p) => p[1]);
	return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

const spines: Record<string, ReturnType<typeof computeSpine>> = {};
const matchedD: Record<string, number> = {};
for (const { geometry } of shapes.features) {
	if (!geometry) continue;
	const [x, y] = bboxMid(geometry);
	let best = def.targets[0];
	let bestD = Infinity;
	for (const t of def.targets) {
		const d = ((t.bbox[0] + t.bbox[2]) / 2 - x) ** 2 + ((t.bbox[1] + t.bbox[3]) / 2 - y) ** 2;
		if (d < bestD) [best, bestD] = [t, d];
	}
	// Overseas parts land on some target too; the nearest feature wins.
	if (bestD >= (matchedD[best.id] ?? Infinity)) continue;
	matchedD[best.id] = bestD;
	spines[best.id] = computeSpine(geometry);
}
const missing = def.targets.filter((t) => !(t.id in spines)).map((t) => t.id);
const none = Object.entries(spines)
	.filter(([, s]) => !s)
	.map(([id]) => id);
writeFileSync(path.join(path.dirname(mapJson), 'spines.json'), JSON.stringify(spines));
console.log(
	`${mapId}: ${Object.keys(spines).length}/${def.targets.length} matched` +
		(missing.length ? `, unmatched: ${missing.join(', ')}` : '') +
		(none.length ? `, no spine: ${none.join(', ')}` : '')
);
