// Writes a `spine` onto every polygon target of every committed map (or one
// map), for names drawn along their region (FT-66). Node only - reads
// map.json and the committed tiles, never rebuilds tiles. See mapSpines.ts.
//
//   npm run build-map-spines                  # every map in data/maps
//   npm run build-map-spines -- --map=italy-regions

import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_MAPS_DIR } from './build-map-index.js';
import { spineMapDir } from './mapSpines.js';

const only = process.argv.find((a) => a.startsWith('--map='))?.slice('--map='.length);
const ids = readdirSync(DEFAULT_MAPS_DIR)
	.filter((id) => existsSync(path.join(DEFAULT_MAPS_DIR, id, 'map.json')))
	.filter((id) => !only || id === only)
	.sort();
if (only && ids.length === 0) throw new Error(`no map "${only}" in ${DEFAULT_MAPS_DIR}`);

for (const id of ids) {
	const { spines, targets } = await spineMapDir(path.join(DEFAULT_MAPS_DIR, id));
	if (targets) console.log(`${id.padEnd(26)} ${spines}/${targets} spines`);
}
