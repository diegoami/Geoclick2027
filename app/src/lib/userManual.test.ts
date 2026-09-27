// FT-85: the user manual's tutorial section describes the current tutorial.
// The table's rows must be the numbered steps, in order, with no "Known" step
// (FT-39 took it out; the Known map is where steps 4-6 happen now).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NUMBERED_STEPS } from './tutorialMachine';

const manual = readFileSync(
	fileURLToPath(new URL('../../../docs/USER_MANUAL.md', import.meta.url)),
	'utf8'
);

/** §13's "The steps" table, one row per numbered step. */
function stepRows(): string[][] {
	const section = manual.slice(manual.indexOf('### The steps'), manual.indexOf('## 14. Languages'));
	return section
		.split('\n')
		.filter((line) => /^\|\s*\d+\s*\|/.test(line))
		.map((line) =>
			line
				.split('|')
				.slice(1, -1)
				.map((cell) => cell.trim())
		);
}

describe('the user manual (FT-85)', () => {
	it('lists the tutorial as the numbered steps, in order', () => {
		expect(stepRows().map((row) => Number(row[0]))).toEqual(
			Array.from({ length: NUMBERED_STEPS }, (_, i) => i + 1)
		);
	});

	it('has no "Known" step, which the tutorial dropped at FT-39', () => {
		expect(stepRows().map((row) => row[1])).not.toContain('Known');
	});
});
