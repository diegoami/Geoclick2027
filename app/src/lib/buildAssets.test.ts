// The build-asset scripts live in app/scripts; the test runner is scoped to
// src/, so the tests that drive them live here. FT-58, issue #5: the map and
// style assets must be prepared on whatever machine builds, and a build that
// ends up without them must fail rather than ship.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const scriptsDir = fileURLToPath(new URL('../../scripts/', import.meta.url));

function run(script: string, ...args: string[]) {
	try {
		const stdout = execFileSync(process.execPath, [join(scriptsDir, script), ...args], {
			encoding: 'utf8'
		});
		return { status: 0, output: stdout };
	} catch (e) {
		const failure = e as { status?: number; stdout?: string; stderr?: string };
		return {
			status: failure.status ?? 1,
			output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`
		};
	}
}

const scratch: string[] = [];
function tempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	scratch.push(dir);
	return dir;
}
afterEach(() => {
	for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A scratch repo with the authored/generated data a real one has. */
function scratchRepo(): string {
	const repo = tempDir('geoclick-assets-');
	mkdirSync(join(repo, 'data', 'maps'), { recursive: true });
	mkdirSync(join(repo, 'data', 'styles'), { recursive: true });
	writeFileSync(join(repo, 'data', 'maps', 'index.json'), '[]');
	writeFileSync(join(repo, 'data', 'styles', 'base.json'), '{}');
	return repo;
}

describe('prepare-assets', () => {
	it('puts the map and style data where the build looks for it', () => {
		const repo = scratchRepo();
		const result = run('prepare-assets.mjs', repo);
		expect(result.status).toBe(0);
		// Readable through the static path, whether it was linked or copied.
		expect(existsSync(join(repo, 'app', 'static', 'maps', 'index.json'))).toBe(true);
		expect(existsSync(join(repo, 'app', 'static', 'styles', 'base.json'))).toBe(true);
	});

	it('can run again over what it made before', () => {
		const repo = scratchRepo();
		expect(run('prepare-assets.mjs', repo).status).toBe(0);
		expect(run('prepare-assets.mjs', repo).status).toBe(0);
		expect(existsSync(join(repo, 'app', 'static', 'maps', 'index.json'))).toBe(true);
	});

	it('fails when the data is not there to prepare', () => {
		const repo = tempDir('geoclick-assets-missing-');
		mkdirSync(join(repo, 'app', 'static'), { recursive: true });
		const result = run('prepare-assets.mjs', repo);
		expect(result.status).toBe(1);
		expect(result.output).toContain('data');
	});
});

describe('check-build-assets', () => {
	it('passes when the build has its map and style assets', () => {
		const build = tempDir('geoclick-check-ok-');
		mkdirSync(join(build, 'maps', 'italy-regions'), { recursive: true });
		mkdirSync(join(build, 'styles'), { recursive: true });
		writeFileSync(join(build, 'maps', 'index.json'), '[]');
		writeFileSync(join(build, 'maps', 'italy-regions', 'map.json'), '{}');
		writeFileSync(join(build, 'styles', 'base.json'), '{}');
		expect(run('check-build-assets.mjs', build).status).toBe(0);
	});

	it('fails when the build is missing them, instead of shipping', () => {
		const build = tempDir('geoclick-check-broken-');
		const result = run('check-build-assets.mjs', build);
		expect(result.status).toBe(1);
		expect(result.output).toContain('map/style assets');
	});
});
