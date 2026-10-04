// The README and ARCHITECTURE.md say how many maps and countries ship. They
// were left at "63 maps across 28 countries" for fifteen releases; these
// numbers now have to match data/maps/index.json (the user manual's test does
// the same for the manual).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
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

describe('the map counts the docs state', () => {
	for (const file of ['README.md', 'ARCHITECTURE.md']) {
		it(`${file} says how many maps and countries ship, correctly`, () => {
			const text = readFileSync(repo(file), 'utf8');
			const stated = [...text.matchAll(/(\d+) maps across (\d+) countries/g)];
			expect(stated.length).toBeGreaterThan(0);
			for (const [, maps, nations] of stated) {
				expect(Number(maps)).toBe(index.length);
				expect(Number(nations)).toBe(countries.size);
			}
		});
	}
});
