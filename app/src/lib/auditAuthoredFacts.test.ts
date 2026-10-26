import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
const script = fileURLToPath(
	new URL('../../../data/scripts/audit-authored-facts.ts', import.meta.url)
);
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
describe('coverage CLI scope guards', () => {
	it.each(['Norwey', 'Denmrak'])(
		'rejects the unknown country %s instead of passing zero targets',
		(country) => {
			const result = spawnSync(
				process.execPath,
				['--import', 'tsx', script, '--country=' + country, '--strict'],
				{ encoding: 'utf8' }
			);
			expect(result.status).not.toBe(0);
			expect(result.stdout + result.stderr).toContain('No playable targets');
		}
	);
	it('counts only matching maps and normalizes country aliases', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'gc-audit-scope-'));
		dirs.push(dir);
		const file = path.join(dir, 'audit.json');
		execFileSync(
			process.execPath,
			['--import', 'tsx', script, '--country=Czech Republic', '--json=' + file],
			{ stdio: 'pipe' }
		);
		const result = JSON.parse(readFileSync(file, 'utf8'));
		expect(result.total).toBeGreaterThan(0);
		expect(result.maps).toBeGreaterThan(0);
		expect(result.maps).toBeLessThan(217);
		expect(result.incomplete.every((row: { file: string }) => row.file === 'czechia.json')).toBe(
			true
		);
	});
	it.each(['--country=', '--maps='])('rejects the empty selector %s', (selector) => {
		const result = spawnSync(process.execPath, ['--import', 'tsx', script, selector, '--strict'], {
			encoding: 'utf8'
		});
		expect(result.status).not.toBe(0);
		expect(result.stdout + result.stderr).toContain('selector cannot be empty');
	});
});
