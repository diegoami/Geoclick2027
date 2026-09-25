// The build-asset scripts live in app/scripts; the test runner is scoped to
// src/, so the tests that drive them live here. FT-58, issue #5: the map and
// style assets must be prepared on whatever machine builds, and a build that
// ends up without them must fail rather than ship.
import { execFileSync } from 'node:child_process';
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const scriptsDir = fileURLToPath(new URL('../../scripts/', import.meta.url));

function runEnv(env: NodeJS.ProcessEnv, script: string, ...args: string[]) {
	try {
		const stdout = execFileSync(process.execPath, [join(scriptsDir, script), ...args], {
			encoding: 'utf8',
			env: { ...process.env, ...env }
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

function run(script: string, ...args: string[]) {
	return runEnv({}, script, ...args);
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

describe('the build lifecycle', () => {
	// The hooks are the wiring the two scripts rely on. A regression that
	// removed them would leave every test above green while a build shipped
	// with no map data (FT-58).
	const { scripts } = JSON.parse(
		readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')
	) as { scripts: Record<string, string> };

	it('prepares the assets before dev and before the build', () => {
		expect(scripts.predev).toContain('prepare-assets.mjs');
		expect(scripts.prebuild).toContain('prepare-assets.mjs');
	});

	it('checks the assets after the build, and still copies the worker', () => {
		expect(scripts.postbuild).toContain('check-build-assets.mjs');
		expect(scripts.postbuild).toContain('copy-maplibre-worker.mjs');
	});
});

// A scratch repo with commit A tracking a link at app/static/maps (the
// pre-FT-58 shape) and commit B removing it and gitignoring it (FT-58). The
// link entry is staged with `update-index`, so setup needs no OS symlinks.
//
// Git hands a hook GIT_DIR and friends, and the pre-push hook runs these
// tests: inherited, they point every call below at the real repository
// instead of the scratch one. From a worktree, that set core.bare and a test
// [user] on the real .git/config (2026-09-25). So the calls drop them.
const GIT_REPO_VARS = [
	'GIT_DIR',
	'GIT_WORK_TREE',
	'GIT_INDEX_FILE',
	'GIT_COMMON_DIR',
	'GIT_OBJECT_DIRECTORY',
	'GIT_ALTERNATE_OBJECT_DIRECTORIES',
	'GIT_PREFIX'
];
function scratchGitEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const name of GIT_REPO_VARS) delete env[name];
	return env;
}

function scratchGitRepo() {
	const repo = tempDir('geoclick-git-');
	const env = scratchGitEnv();
	const git = (...args: string[]) =>
		execFileSync('git', args, {
			cwd: repo,
			env,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		});

	git('init', '-q');
	git('config', 'user.email', 'test@example.com');
	git('config', 'user.name', 'test');
	mkdirSync(join(repo, 'data', 'maps'), { recursive: true });
	mkdirSync(join(repo, 'data', 'styles'), { recursive: true });
	mkdirSync(join(repo, 'app', 'static'), { recursive: true });
	writeFileSync(join(repo, 'data', 'maps', 'marker.json'), '{"keep":true}');
	writeFileSync(join(repo, 'data', 'styles', 'base.json'), '{}');
	git('add', '-A');

	// Commit A: a tracked symlink, without asking the OS to create one.
	const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], {
		cwd: repo,
		env,
		encoding: 'utf8',
		input: '../../data/maps'
	}).trim();
	git('update-index', '--add', '--cacheinfo', `120000,${blob},app/static/maps`);
	git('commit', '-qm', 'A');
	const old = git('rev-parse', 'HEAD').trim();

	// Commit B: the link is removed from the index and gitignored.
	git('rm', '-q', '--cached', 'app/static/maps');
	writeFileSync(join(repo, '.gitignore'), '/app/static/maps\n');
	git('add', '-A');
	git('commit', '-qm', 'B');

	return { repo, old, git };
}

describe('the scratch repo, inside a git hook', () => {
	it('leaves the repository named by an inherited GIT_DIR alone', () => {
		const outer = tempDir('geoclick-outer-');
		execFileSync('git', ['init', '-q'], { cwd: outer, env: scratchGitEnv(), stdio: 'ignore' });
		const config = join(outer, '.git', 'config');
		const before = readFileSync(config, 'utf8');

		const saved = process.env.GIT_DIR;
		process.env.GIT_DIR = join(outer, '.git');
		try {
			const { git } = scratchGitRepo();
			expect(git('log', '--format=%s').trim().split('\n')).toEqual(['B', 'A']);
		} finally {
			if (saved === undefined) delete process.env.GIT_DIR;
			else process.env.GIT_DIR = saved;
		}
		expect(readFileSync(config, 'utf8')).toBe(before);
	});
});

describe('prepare-assets and a checkout over it (FT-58 regression)', () => {
	// Git for Windows recurses through a Windows *junction* when it replaces
	// the path, deleting the junction's target contents - it emptied the real
	// data/maps during the FT-58 merge. prepare-assets uses a true symlink or
	// a copy instead; both survive the checkout that caused it.
	const canCreateSymlink = (() => {
		const dir = mkdtempSync(join(tmpdir(), 'geoclick-symlink-check-'));
		try {
			mkdirSync(join(dir, 'target'));
			symlinkSync(join(dir, 'target'), join(dir, 'link'), 'dir');
			return true;
		} catch {
			return false;
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	})();

	it.skipIf(!canCreateSymlink)('survives a checkout when it prepared a symlink', () => {
		const { repo, old, git } = scratchGitRepo();
		expect(run('prepare-assets.mjs', repo).status).toBe(0);
		expect(lstatSync(join(repo, 'app', 'static', 'maps')).isSymbolicLink()).toBe(true);

		git('checkout', '-q', '-f', old);
		expect(existsSync(join(repo, 'data', 'maps', 'marker.json'))).toBe(true);
	});

	it('survives a checkout when it prepared a copy', () => {
		const { repo, old, git } = scratchGitRepo();
		const prepared = runEnv({ GEOCLICK_PREPARE_ASSETS_COPY: '1' }, 'prepare-assets.mjs', repo);
		expect(prepared.status).toBe(0);
		// A real directory, not a link: the no-symlink-privilege path.
		expect(lstatSync(join(repo, 'app', 'static', 'maps')).isSymbolicLink()).toBe(false);

		git('checkout', '-q', '-f', old);
		expect(existsSync(join(repo, 'data', 'maps', 'marker.json'))).toBe(true);
	});
});
