// Gives the Polish county maps their reader-facing names without rebuilding
// their tiles (#182): "powiat oleski" stays the target's `name`, the key the
// tiles join on, and `names` carries "oleski". The same labels come out of
// build-map.ts with --clean-names=polish-counties; this patches the committed
// map.json files in place. Run: npx tsx data/scripts/label-polish-counties.ts
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { polishCountyLabel } from './admin2.js';

const root = join(import.meta.dirname, '..', 'maps');
for (const dir of readdirSync(root).filter((d) => d.startsWith('poland-counties-'))) {
	const file = join(root, dir, 'map.json');
	const raw = readFileSync(file, 'utf-8');
	const map = JSON.parse(raw);
	let changed = 0;
	for (const target of map.targets as { name: string; names?: Record<string, string> }[]) {
		if (!target.name.startsWith('powiat ')) continue;
		const label = polishCountyLabel(target.name);
		target.names = { en: label, it: label, de: label };
		changed++;
	}
	const indent = raw.startsWith('{\n\t') ? '\t' : 2;
	writeFileSync(file, JSON.stringify(map, null, indent) + (raw.endsWith('\n') ? '\n' : ''));
	console.log(`${dir}: ${changed} labelled`);
}
