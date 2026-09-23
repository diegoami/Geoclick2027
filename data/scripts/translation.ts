// Adding a language to an authored country file (FT-50, docs/PLAN_V0.10.md).
// Pure and dependency-free, like authoredHooks.ts, so it is unit-tested from
// the app; translate-facts.ts is the command around it.
//
// A translation is a PATCH, keyed like the country file: for each place, the
// new language's sentences in the same order as the English ones - the app
// falls back per sentence, by position (facts.ts), so sentence 2 in Italian
// must be sentence 2 in English. A place split by kind ({ region, city })
// gets a patch split the same way.

import type { Language } from './authoredHooks.js';

const LANGUAGES: Language[] = ['en', 'it', 'de'];
const KINDS = ['any', 'region', 'city'] as const;
type Kind = (typeof KINDS)[number];

/** One place's sentences in one language: a list, or split by kind. */
export type PlaceSentences = string[] | Partial<Record<Kind, string[]>>;
export type Patch = Record<string, PlaceSentences>;

const isList = (v: unknown): v is string[] =>
	Array.isArray(v) && v.every((s) => typeof s === 'string');
const isRecord = (v: unknown): v is Record<string, unknown> =>
	!!v && typeof v === 'object' && !Array.isArray(v);
const isByKind = (v: Record<string, unknown>) => KINDS.some((k) => k in v);

/** A list or a per-language object: its English, and whether `lang` is there. */
function languagesOf(value: unknown, lang: Language): { en?: string[]; has: boolean } {
	if (isList(value)) return { en: value, has: false };
	if (!isRecord(value)) return { has: false };
	return { en: isList(value.en) ? value.en : undefined, has: value[lang] !== undefined };
}

/** The English still waiting for `lang`, as a patch-shaped object to translate. */
export function missingTranslations(raw: Record<string, unknown>, lang: Language): Patch {
	const missing: Patch = {};
	for (const [id, value] of Object.entries(raw)) {
		if (id.startsWith('_')) continue;
		if (isRecord(value) && isByKind(value)) {
			const kinds: Partial<Record<Kind, string[]>> = {};
			for (const kind of KINDS) {
				const { en, has } = languagesOf(value[kind], lang);
				if (en && !has) kinds[kind] = en;
			}
			if (Object.keys(kinds).length > 0) missing[id] = kinds;
			continue;
		}
		const { en, has } = languagesOf(value, lang);
		if (en && !has) missing[id] = en;
	}
	return missing;
}

/**
 * Italian house style (docs/TRANSLATION_STYLE_IT.md): the English em dash
 * becomes a colon or a comma, the apostrophe is the typographic one, and a
 * sentence left in English is not a translation.
 */
export function houseStyle(lang: Language, given: string[], en: string[]): string | undefined {
	if (lang !== 'it') return undefined;
	for (const [n, s] of given.entries()) {
		if (s.includes('—')) return `sentence ${n + 1} keeps an em dash`;
		if (/\p{L}'\p{L}/u.test(s)) return `sentence ${n + 1} has a straight apostrophe`;
		if (s === en[n]) return `sentence ${n + 1} is still the English`;
	}
	return undefined;
}

/** A list or a per-language object with `lang` added, keys in en/it/de order. */
function withLanguage(
	value: unknown,
	lang: Language,
	sentences: string[]
): Record<string, unknown> {
	const record: Record<string, unknown> = isList(value) ? { en: value } : { ...(value as object) };
	record[lang] = sentences;
	const ordered: Record<string, unknown> = {};
	for (const l of LANGUAGES) if (record[l] !== undefined) ordered[l] = record[l];
	return ordered;
}

/**
 * The country file with `patch` merged in as `lang`, or the reasons it cannot
 * be: a place that does not exist, a place already translated, a sentence
 * count that differs from the English, an empty sentence. All or nothing, so
 * a bad patch never half-lands.
 */
export function mergeTranslations(
	raw: Record<string, unknown>,
	lang: Language,
	patch: Patch
): { merged: Record<string, unknown>; problems: string[] } {
	const problems: string[] = [];
	const merged: Record<string, unknown> = { ...raw };
	const check = (where: string, en: string[] | undefined, has: boolean, given: unknown) => {
		let problem: string | undefined;
		if (!en) problem = 'no English to translate';
		else if (has) problem = `already has "${lang}"`;
		else if (!isList(given) || given.some((s) => s.trim() === ''))
			problem = 'not a list of non-empty sentences';
		else if (given.length !== en.length)
			problem = `${given.length} sentences for ${en.length} English`;
		else problem = houseStyle(lang, given, en);
		if (problem) problems.push(`${where}: ${problem}`);
		return !problem;
	};
	for (const [id, given] of Object.entries(patch)) {
		const value = raw[id];
		if (id.startsWith('_') || value === undefined) {
			problems.push(`${id}: no such place in the country file`);
			continue;
		}
		if (isRecord(value) && isByKind(value)) {
			if (!isRecord(given)) {
				problems.push(`${id}: split by kind in the file, so the patch must be too`);
				continue;
			}
			const next: Record<string, unknown> = { ...value };
			for (const [kind, sentences] of Object.entries(given)) {
				const { en, has } = languagesOf(value[kind], lang);
				if (check(`${id}.${kind}`, en, has, sentences)) {
					next[kind] = withLanguage(value[kind], lang, sentences as string[]);
				}
			}
			merged[id] = next;
			continue;
		}
		const { en, has } = languagesOf(value, lang);
		if (check(id, en, has, given)) merged[id] = withLanguage(value, lang, given as string[]);
	}
	return { merged: problems.length ? raw : merged, problems };
}
