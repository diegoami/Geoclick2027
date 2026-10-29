// Coverage audit for the full agreed country expansion; no source downloads.
// node --import tsx data/scripts/audit-v1-country-facts.ts [--json=rendered/v1-facts-needed.json] [--strict]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs } from './mapBuildUtils.js';
import { authoredResolver, storedHooksFor, factsFileFor } from './factsHooks.js';
import { V1_COUNTRIES, v1MapIds } from './v1CountrySpecs.js';
const args = parseArgs(process.argv.slice(2));
const missing: {
	country: string;
	file: string;
	map: string;
	id: string;
	name: string;
	kind: 'city' | 'region';
	languages: string[];
}[] = [];
let total = 0,
	complete = 0;
for (const country of V1_COUNTRIES) {
	let count = 0,
		done = 0;
	for (const id of v1MapIds(country)) {
		const map = JSON.parse(
			readFileSync(path.join(REPO_ROOT, 'data/maps', id, 'map.json'), 'utf8')
		) as { country: string; targets: { id: string; name: string; type: string }[] };
		const resolve = authoredResolver(map.country);
		for (const target of map.targets) {
			const kind = target.type === 'city' ? 'city' : 'region';
			const stored = storedHooksFor(resolve(target), kind);
			const hooks = Array.isArray(stored) ? { en: stored } : (stored ?? {});
			const languages = ['en', 'it', 'de'].filter(
				(l) => ((hooks as Record<string, string[] | undefined>)[l]?.length ?? 0) < 3
			);
			count++;
			if (!languages.length) done++;
			else
				missing.push({
					country: country.id,
					file: factsFileFor(map.country),
					map: id,
					id: target.id,
					name: target.name,
					kind,
					languages
				});
		}
	}
	total += count;
	complete += done;
	console.log(country.id + ': ' + done + '/' + count + ' targets complete');
}
if (args.json)
	writeFileSync(
		path.resolve(REPO_ROOT, args.json),
		JSON.stringify(
			{
				countries: V1_COUNTRIES.length,
				maps: V1_COUNTRIES.flatMap(v1MapIds).length,
				total,
				complete,
				missing
			},
			null,
			2
		) + '\n'
	);
console.log(
	'Full scope: ' +
		V1_COUNTRIES.length +
		' countries, ' +
		V1_COUNTRIES.flatMap(v1MapIds).length +
		' maps; ' +
		complete +
		'/' +
		total +
		' targets complete in EN/IT/DE'
);
if (process.argv.includes('--strict') && missing.length) process.exitCode = 1;
