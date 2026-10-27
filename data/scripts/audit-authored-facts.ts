// Read-only authored-fact coverage; IDs come from the index, never a map-directory scan.
// --maps=id,id narrows release scope; --strict fails below --minimum=3.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs } from './mapBuildUtils.js';
import { authoredResolver, storedHooksFor, factsFileFor, WORLD } from './factsHooks.js';
const args = parseArgs(process.argv.slice(2));
const minimum = Number(args.minimum ?? 3);
if (Object.hasOwn(args, 'strict') && args.strict !== 'true')
	throw new Error('Use --strict or --strict=true');
const strict = process.argv.includes('--strict') || args.strict === 'true';
if (Object.hasOwn(args, 'country') && !args.country?.trim())
	throw new Error('Country selector cannot be empty');
if (Object.hasOwn(args, 'maps') && !args.maps?.trim())
	throw new Error('Map selector cannot be empty');
const wantedFile = args.country ? factsFileFor(args.country) : undefined;
if (![1, 2, 3].includes(minimum)) throw new Error('Minimum must be 1, 2 or 3');
const index = JSON.parse(readFileSync(path.join(REPO_ROOT, 'data/maps/index.json'), 'utf8')) as {
	id: string;
}[];
const selected = args.maps ? args.maps.split(',') : index.map((map) => map.id);
for (const id of selected)
	if (!index.some((map) => map.id === id)) throw new Error('Unknown map: ' + id);
interface Coverage {
	country: string;
	file: string;
	id: string;
	name: string;
	kind: 'city' | 'region';
	maps: string[];
	counts: Record<string, number>;
}
const unique = new Map<string, Coverage>();
const auditedMaps = new Set<string>();
for (const id of selected) {
	const map = JSON.parse(
		readFileSync(path.join(REPO_ROOT, 'data/maps', id, 'map.json'), 'utf8')
	) as {
		country?: string;
		targets: { id: string; name: string; type: string; country?: string }[];
	};
	const resolve = authoredResolver(map.country);
	for (const target of map.targets) {
		const country = target.type === 'country' ? WORLD : (target.country ?? map.country);
		if (!country) throw new Error(id + '/' + target.id + ': missing country');
		const file = factsFileFor(country);
		if (wantedFile && wantedFile !== file) continue;
		auditedMaps.add(id);
		const kind = target.type === 'city' ? 'city' : 'region';
		const key = file + '/' + target.id + '/' + kind;
		const prior = unique.get(key);
		if (prior) {
			prior.maps.push(id);
			continue;
		}
		const stored = storedHooksFor(resolve(target), kind);
		const hooks = Array.isArray(stored) ? { en: stored } : (stored ?? {});
		const counts = Object.fromEntries(
			['en', 'it', 'de'].map((language) => [
				language,
				(hooks as Record<string, string[] | undefined>)[language]?.length ?? 0
			])
		);
		unique.set(key, { country, file, id: target.id, name: target.name, kind, maps: [id], counts });
	}
}
const rows = [...unique.values()];
if (rows.length === 0 && (wantedFile || strict))
	throw new Error('No playable targets match the selected country/maps');
const incomplete = rows.filter((row) => Math.min(...Object.values(row.counts)) < minimum);
const report = {
	maps: auditedMaps.size,
	minimum,
	strict,
	total: rows.length,
	complete: rows.length - incomplete.length,
	withoutAuthoredFacts: rows.filter((row) => Math.min(...Object.values(row.counts)) === 0).length,
	shortSets: rows.filter(
		(row) =>
			Math.min(...Object.values(row.counts)) > 0 && Math.min(...Object.values(row.counts)) < minimum
	).length,
	incomplete
};
if (args.json)
	writeFileSync(path.resolve(REPO_ROOT, args.json), JSON.stringify(report, null, 2) + '\n');
console.log(
	`${report.maps} maps; ${report.complete}/${report.total} unique targets with ${minimum}+ sentences in EN/IT/DE; ${report.withoutAuthoredFacts} without authored facts, ${report.shortSets} short sets`
);
if (strict && incomplete.length) process.exitCode = 1;
