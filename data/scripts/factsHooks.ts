// The authored half of facts.json (FT-36/FT-49): which of a country file's
// sentences each target carries, and in what shape they are stored. Shared by
// build-facts.ts, which writes a whole facts.json and needs the WSL2 toolchain
// for the derived half, and refresh-facts-hooks.ts, which rewrites only the
// sentences - node only - after a country file is edited or translated.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseAuthoredFile, type AuthoredHooks, type LangHooks } from './authoredHooks.js';
import { REPO_ROOT, slugify } from './mapBuildUtils.js';

/**
 * The hand-written name-facts for a country, keyed by target id.
 *
 * Authored per COUNTRY and projected into every map that contains the
 * place, so Italy's regions and its provinces - and, for a towns file, a
 * country's cities and each of its regional slices - share one sentence
 * rather than four copies drifting apart. Missing file, or a country
 * nobody has written for yet: no hooks, and the card shows its derived
 * line alone. The file's shape is parsed by authoredHooks.ts.
 */
export function hooksForCountry(country: string | undefined): Record<string, AuthoredHooks> {
	if (!country) return {};
	// The filename is the country as map.json spells it: "United States of
	// America" is united-states-of-america.json. Naming it for the country
	// rather than for a convenient short form is what makes the lookup need
	// no table.
	const file = path.join(REPO_ROOT, 'data/facts', `${slugify(country)}.json`);
	if (!existsSync(file)) return {};
	return parseAuthoredFile(JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>);
}

/**
 * The authored sentences for each target of one map. A target that names its
 * own country - the towns of a map of several countries (#39), whose
 * map.json country is "Europe" - takes them from that country's file, so
 * München says the same thing on Central Europe as on Germany.
 */
export function authoredResolver(
	mapCountry: string | undefined
): (target: { id: string; country?: string }) => AuthoredHooks | undefined {
	const byCountry = new Map<string, Record<string, AuthoredHooks>>();
	const forCountry = (country: string | undefined) => {
		const key = country ?? '';
		if (!byCountry.has(key)) byCountry.set(key, hooksForCountry(country));
		return byCountry.get(key)!;
	};
	return (target) => forCountry(target.country ?? mapCountry)[target.id];
}

/**
 * What goes into facts.json: the plain list when a place has English only,
 * the per-language object once a second language exists. Keeping the plain
 * list means a country nobody has translated stays byte-identical to its
 * earlier build (FT-49); the app reads both.
 */
export function asStoredHooks(hooks: LangHooks): string[] | LangHooks {
	const languages = Object.keys(hooks);
	return languages.length === 1 && hooks.en ? hooks.en : hooks;
}

/**
 * The sentences one target carries. A kind-specific list wins over the
 * catch-all, so a province's facts are never shown for a town that shares
 * its id.
 */
export function storedHooksFor(
	authored: AuthoredHooks | undefined,
	kind: 'region' | 'city' | undefined
): string[] | LangHooks | undefined {
	const sentences = (kind && authored?.[kind]) || authored?.any;
	return sentences ? asStoredHooks(sentences) : undefined;
}

/** A target's fact with its sentences set - last, as facts.json has always
 * had them - or without any, if nobody has written one. */
export function withHooks<T extends { kind?: 'region' | 'city' }>(
	fact: T,
	authored: AuthoredHooks | undefined
): T & { hooks?: string[] | LangHooks } {
	const stored = storedHooksFor(authored, fact?.kind);
	return stored ? { ...fact, hooks: stored } : fact;
}
