// Rewrites only the authored sentences (`hooks`) in every committed map's
// facts.json (or one map's), from data/facts/<country>.json. Node only: the
// derived fields, which need the WSL2 toolchain (build-facts.ts), are left
// exactly as they are. Run it after editing or translating a country file
// (FT-50); a full build-facts.ts run gives the same sentences.
//
//   npm run refresh-facts-hooks                  # every map in data/maps
//   npm run refresh-facts-hooks -- --map=china-regions

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_MAPS_DIR } from './build-map-index.js';
import { authoredResolver, withHooks } from './factsHooks.js';

const only = process.argv.find((a) => a.startsWith('--map='))?.slice('--map='.length);
const ids = readdirSync(DEFAULT_MAPS_DIR)
	.filter((id) => existsSync(path.join(DEFAULT_MAPS_DIR, id, 'facts.json')))
	.filter((id) => !only || id === only)
	.sort();
if (only && ids.length === 0) throw new Error(`no facts.json for "${only}" in ${DEFAULT_MAPS_DIR}`);

let changed = 0;
for (const id of ids) {
	const dir = path.join(DEFAULT_MAPS_DIR, id);
	const { country, targets } = JSON.parse(readFileSync(path.join(dir, 'map.json'), 'utf8')) as {
		country?: string;
		targets: { id: string; country?: string }[];
	};
	const hooksFor = authoredResolver(country);
	const targetById = new Map(targets.map((t) => [t.id, t]));
	const file = path.join(dir, 'facts.json');
	const before = readFileSync(file, 'utf8');
	const facts = JSON.parse(before) as Record<string, { kind?: 'region' | 'city'; hooks?: unknown }>;
	const refreshed: Record<string, unknown> = {};
	for (const [targetId, fact] of Object.entries(facts)) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { hooks, ...derived } = fact;
		refreshed[targetId] = withHooks(
			derived,
			hooksFor(targetById.get(targetId) ?? { id: targetId })
		);
	}
	const after = `${JSON.stringify(refreshed, null, '\t')}\n`;
	if (after === before) continue;
	writeFileSync(file, after);
	changed++;
	console.log(`${id.padEnd(26)} refreshed`);
}
console.log(`${changed} of ${ids.length} facts.json changed`);
