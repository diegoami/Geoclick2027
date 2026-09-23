// Adds a language to one authored country file (FT-50). Two steps:
//
//   # what still needs translating, as a patch-shaped file to fill in
//   npm run translate-facts -- --country=portugal --lang=it --extract=/tmp/pt.en.json
//
//   # merge the filled-in patch (same ids, same sentence counts, in order)
//   npm run translate-facts -- --country=portugal --lang=it --merge=/tmp/pt.it.json
//
// The merge is all or nothing and never overwrites a language a place already
// has. Afterwards, `npm run refresh-facts-hooks` ships it to every map of the
// country. See translation.ts for the patch shape.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Language } from './authoredHooks.js';
import { REPO_ROOT } from './mapBuildUtils.js';
import { mergeTranslations, missingTranslations, type Patch } from './translation.js';

const arg = (name: string) =>
	process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const country = arg('country');
const lang = arg('lang') as Language | undefined;
const extract = arg('extract');
const merge = arg('merge');
if (!country || (lang !== 'it' && lang !== 'de') || !(extract || merge)) {
	console.error(
		'Usage: translate-facts.ts --country=<file basename> --lang=it|de --extract=<out.json> | --merge=<patch.json>'
	);
	process.exit(1);
}

const file = path.join(REPO_ROOT, 'data/facts', `${country}.json`);
const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

if (extract) {
	const missing = missingTranslations(raw, lang);
	writeFileSync(extract, `${JSON.stringify(missing, null, '\t')}\n`);
	const sentences = Object.values(missing).flatMap((v) =>
		Array.isArray(v) ? v : Object.values(v).flat()
	).length;
	console.log(
		`${country}: ${Object.keys(missing).length} places, ${sentences} sentences -> ${extract}`
	);
} else {
	const patch = JSON.parse(readFileSync(merge!, 'utf8')) as Patch;
	const { merged, problems } = mergeTranslations(raw, lang, patch);
	if (problems.length > 0) {
		console.error(
			`${country}: not merged, ${problems.length} problem(s):\n  ${problems.join('\n  ')}`
		);
		process.exit(1);
	}
	writeFileSync(file, `${JSON.stringify(merged, null, '\t')}\n`);
	const left = Object.keys(missingTranslations(merged, lang)).length;
	console.log(
		`${country}: merged ${Object.keys(patch).length} places; ${left} still without "${lang}"`
	);
}
