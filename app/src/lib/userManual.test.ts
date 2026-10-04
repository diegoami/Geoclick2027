// The user manual describes the app as it is (FT-85, proposal #204). It went
// stale once, at v0.5.0, so these tests tie it to the things that change:
// the tutorial's steps, the version, the map counts, the words on the buttons
// and the pictures.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tForLanguage, type TranslationKey } from './i18n.svelte';
import { NUMBERED_STEPS } from './tutorialMachine';

const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const manual = readFileSync(repo('docs/USER_MANUAL.md'), 'utf8');

/** The tutorial section's "The steps" table, one row per numbered step. */
function stepRows(): string[][] {
	const from = manual.indexOf('### The steps');
	const to = manual.indexOf('\n## ', from);
	return manual
		.slice(from, to)
		.split('\n')
		.filter((line) => /^\|\s*\d+\s*\|/.test(line))
		.map((line) =>
			line
				.split('|')
				.slice(1, -1)
				.map((cell) => cell.trim())
		);
}

describe('the user manual: the tutorial (FT-85)', () => {
	it('lists the tutorial as the numbered steps, in order', () => {
		expect(stepRows().map((row) => Number(row[0]))).toEqual(
			Array.from({ length: NUMBERED_STEPS }, (_, i) => i + 1)
		);
	});
});

describe('the user manual: what it says about the app (#204)', () => {
	it('names the version it describes, and it is the current one', () => {
		const root = JSON.parse(readFileSync(repo('package.json'), 'utf8')) as { version: string };
		expect(manual).toContain(`**Geoclick v${root.version}**`);
	});

	it('states the map and country counts the app really has', () => {
		const index = JSON.parse(readFileSync(repo('data/maps/index.json'), 'utf8')) as {
			country: string;
		}[];
		const continents = new Set([
			'Africa',
			'Asia',
			'Europe',
			'North America',
			'South America',
			'Oceania'
		]);
		const countries = new Set(index.map((m) => m.country).filter((c) => !continents.has(c)));
		const stated = [...manual.matchAll(/(\d+) maps across (\d+) countries/g)];
		expect(stated.length).toBeGreaterThan(0);
		for (const [, maps, nations] of stated) {
			expect(Number(maps)).toBe(index.length);
			expect(Number(nations)).toBe(countries.size);
		}
	});

	it('uses the words that are on the buttons', () => {
		const keys: TranslationKey[] = [
			'nav.maps',
			'nav.explore',
			'nav.overview',
			'nav.quiz',
			'nav.tour',
			'nav.terrain',
			'nav.detailedMaps',
			'home.myMaps',
			'known.clear',
			'known.chosen',
			'quiz.done',
			'quiz.playAgain',
			'tutorial.start',
			'tutorial.resume',
			'tutorial.end',
			'tutorial.finish',
			'tutorial.replay'
		];
		const missing = keys.filter((key) => !manual.includes(tForLanguage(key, 'en')));
		expect(missing).toEqual([]);
	});

	it('shows only pictures that exist, and every picture is shown', () => {
		const shown = new Set([...manual.matchAll(/\]\(manual\/([^)\s]+)\)/g)].map((m) => m[1]));
		const files = readdirSync(repo('docs/manual'));
		expect([...shown].filter((f) => !existsSync(repo(`docs/manual/${f}`)))).toEqual([]);
		expect(files.filter((f) => !shown.has(f))).toEqual([]);
	});
});
