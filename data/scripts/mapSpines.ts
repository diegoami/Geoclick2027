// Writes a `spine` onto every polygon target of a committed map (FT-66), from
// the map's own tiles - node only, no WSL2 toolchain, tiles never rebuilt.
// Called at the end of build-map.ts, and for committed maps by
// `npm run build-map-spines`. See spine.ts for what a spine is.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decodeTargetTiles } from './mapColors.js';
import { computeSpine, type Ring, type Spine } from './spine.js';

interface TargetLike {
	name: string;
	type: string;
	spine?: Spine;
}

/** Adds, updates or drops `spine` on each target; the file is otherwise
 * unchanged. Point maps (towns) are left alone - a dot has no long axis. */
export async function spineMapDir(mapDir: string): Promise<{ spines: number; targets: number }> {
	const file = path.join(mapDir, 'map.json');
	const map = JSON.parse(readFileSync(file, 'utf8')) as { targets: TargetLike[] };
	if (map.targets.every((t) => t.type === 'city')) return { spines: 0, targets: 0 };

	const names = new Set(map.targets.map((t) => t.name));
	const { polys, worldSize } = await decodeTargetTiles(path.join(mapDir, 'tiles.pmtiles'), names);
	const pieces = new Map<string, Ring[][]>();
	for (const { name, rings } of polys) {
		const piece = rings.map((ring) => ring.map(([x, y]) => [x / worldSize, y / worldSize]) as Ring);
		pieces.set(name, [...(pieces.get(name) ?? []), piece]);
	}

	let spines = 0;
	for (const target of map.targets) {
		const spine = computeSpine(pieces.get(target.name) ?? []);
		if (spine) {
			target.spine = spine;
			spines++;
		} else {
			delete target.spine;
		}
	}
	writeFileSync(file, JSON.stringify(map, null, '\t') + '\n');
	return { spines, targets: map.targets.length };
}
