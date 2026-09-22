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
 * Normalise one authored value.
 *
 * A plain list is English, for any kind. An object may carry kinds
 * (`any`/`region`/`city`) and/or language keys at the top level, where a
 * top-level language key is shorthand for `any`. BOTH portions are
 * normalised, so a mixed value such as `{ en, city }` keeps both branches
 * rather than silently dropping one.
 */
export function parseAuthoredHooks(value: unknown): AuthoredHooks | undefined {
	if (isSentences(value)) return { any: { en: value } };
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	const any = asLangHooks(record.any) ?? pickLanguages(record);
	const region = asLangHooks(record.region);
	const city = asLangHooks(record.city);
	const hooks: AuthoredHooks = {};
	if (any) hooks.any = any;
	if (region) hooks.region = region;
	if (city) hooks.city = city;
	return hooks.any || hooks.region || hooks.city ? hooks : undefined;
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
