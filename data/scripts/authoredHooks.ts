// Parsing the authored name-facts' file shape (FT-49, docs/PLAN_V0.10.md).
// Pure and dependency-free, so it is unit-tested from the app the same way
// factGeometry.ts and mapBuildUtils.ts are - build-facts.ts itself needs
// ogr2ogr, these parts do not.

/** The languages the authored name-facts can be written in. */
export type Language = 'en' | 'it' | 'de';

/**
 * A place's name-facts per language. Only the languages a place actually has
 * sentences in appear, so a half-translated country is partly English; the
 * app falls back per sentence at read time.
 */
export type LangHooks = Partial<Record<Language, string[]>>;

/**
 * A place's facts, split by the kind of target that carries its id. A kind
 * exists only where the authored file says something specific to it; `any`
 * applies to whichever kind has the id.
 */
export interface AuthoredHooks {
	any?: LangHooks;
	region?: LangHooks;
	city?: LangHooks;
}

const LANGUAGES: Language[] = ['en', 'it', 'de'];
const KINDS = ['any', 'region', 'city'] as const;

function isSentences(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((s) => typeof s === 'string' && s !== '')
	);
}

/** The en/it/de keys of an object, normalised; undefined if none. */
function pickLanguages(record: Record<string, unknown>): LangHooks | undefined {
	const hooks: LangHooks = {};
	for (const language of LANGUAGES) {
		const sentences = record[language];
		if (isSentences(sentences)) hooks[language] = sentences;
	}
	return Object.keys(hooks).length > 0 ? hooks : undefined;
}

/** A list (English) or a per-language object, normalised; undefined if empty. */
export function asLangHooks(value: unknown): LangHooks | undefined {
	if (isSentences(value)) return { en: value };
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	return pickLanguages(value as Record<string, unknown>);
}

/**
 * Normalise one authored value. There are exactly two object forms, and
 * mixing them in one object is an ERROR rather than a silent choice:
 *
 *   - per-language: `{ en: [...], it: [...] }` - applies to any kind;
 *   - per-kind: `{ any?: ..., region?: ..., city?: ... }` - each value is a
 *     list or a per-language object.
 *
 * (A plain list is English, for any kind.) An object with both a language key
 * and a kind key - `{ en, city }`, or `{ any, en, city }` - is rejected,
 * because either reading would silently discard the other branch.
 */
export function parseAuthoredHooks(value: unknown): AuthoredHooks | undefined {
	if (isSentences(value)) return { any: { en: value } };
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	const kinds = KINDS.filter((kind) => record[kind] !== undefined);
	const languages = LANGUAGES.filter((language) => record[language] !== undefined);
	if (kinds.length > 0 && languages.length > 0) {
		throw new Error(
			`an authored value cannot mix a language key (${languages.join(', ')}) with a kind key ` +
				`(${kinds.join(', ')}); use { en, it } for any kind, or { any, region, city } for the kinds`
		);
	}
	if (kinds.length > 0) {
		const hooks: AuthoredHooks = {};
		const any = asLangHooks(record.any);
		const region = asLangHooks(record.region);
		const city = asLangHooks(record.city);
		if (any) hooks.any = any;
		if (region) hooks.region = region;
		if (city) hooks.city = city;
		return hooks.any || hooks.region || hooks.city ? hooks : undefined;
	}
	const any = pickLanguages(record);
	return any ? { any } : undefined;
}

/**
 * Every authored place in a country file, keyed by target id. `_note` and any
 * other commentary key is skipped: the authored files explain themselves at
 * the top, and that is not a place.
 */
export function parseAuthoredFile(raw: Record<string, unknown>): Record<string, AuthoredHooks> {
	const hooks: Record<string, AuthoredHooks> = {};
	for (const [id, value] of Object.entries(raw)) {
		if (id.startsWith('_')) continue;
		const parsed = parseAuthoredHooks(value);
		if (parsed) hooks[id] = parsed;
	}
	return hooks;
}
