// Small helpers shared between build-map.ts (polygon targets) and
// build-points-map.ts (point targets) - kept here rather than duplicated,
// since both scripts need them identically. See MAPS.md's "Point-target
// design" section for why point maps get a separate script instead of
// branches added throughout build-map.ts.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const LAKES_SHP = path.join(REPO_ROOT, 'data/source/ne_10m_lakes/ne_10m_lakes.shp');

export function parseArgs(argv: string[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const arg of argv) {
		const match = /^--([^=]+)=(.*)$/.exec(arg);
		if (match) out[match[1]] = match[2];
	}
	return out;
}

export function slugify(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function overallBboxOf(
	targets: { bbox: [number, number, number, number] }[]
): [number, number, number, number] {
	return targets.reduce(
		(acc: [number, number, number, number], t) => [
			Math.min(acc[0], t.bbox[0]),
			Math.min(acc[1], t.bbox[1]),
			Math.max(acc[2], t.bbox[2]),
			Math.max(acc[3], t.bbox[3])
		],
		[Infinity, Infinity, -Infinity, -Infinity]
	);
}

// Water context: without lakes rendered, a target whose border runs along
// one (Michigan on the Great Lakes is the worst case) reads as an
// unexplained gap next to its neighbors rather than a coastline. Selected
// by bounding-box intersection with the map's overall extent (`-spat`, a
// feature filter, not a geometry clip) rather than by country - lakes
// aren't tagged to an admin boundary the way states/provinces are, and a
// lake is still worth rendering even if it pokes slightly outside the
// map's bounds.
export function selectNearbyLakes(
	bbox: [number, number, number, number],
	outPath: string
): void {
	execFileSync('ogr2ogr', [
		'-f',
		'GeoJSON',
		'-spat',
		...bbox.map(String),
		'-select',
		'name',
		outPath,
		LAKES_SHP
	]);
}
