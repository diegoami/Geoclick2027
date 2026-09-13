#!/usr/bin/env node
// Single source of truth for the project version: the root package.json.
// Propagates it to the workspace, the Tauri shell and the Android shell.
//
//   node scripts/sync-version.mjs --check    # exit 1 if any file disagrees
//   node scripts/sync-version.mjs            # propagate the root version
//   node scripts/sync-version.mjs 0.2.0      # set the root version, then propagate
//
// Why this exists: at c5c786e the repo disagreed with itself - package.json
// said 0.0.1 while tauri.conf.json and Cargo.toml said 0.1.0. See
// docs/RELEASES.md.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const explicit = argv.find((a) => /^\d+\.\d+\.\d+$/.test(a));

const rootPkgPath = path.join(REPO_ROOT, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
const version = explicit ?? rootPkg.version;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
	console.error(`Root package.json version "${version}" is not semver.`);
	process.exit(1);
}

// Each target: how to read the current value, and how to write a new one.
const targets = [
	{
		label: 'package.json',
		file: rootPkgPath,
		read: (s) => JSON.parse(s).version,
		write: (s, v) => s.replace(/("version"\s*:\s*)"[^"]+"/, `$1"${v}"`)
	},
	{
		label: 'app/package.json',
		file: path.join(REPO_ROOT, 'app', 'package.json'),
		read: (s) => JSON.parse(s).version,
		write: (s, v) => s.replace(/("version"\s*:\s*)"[^"]+"/, `$1"${v}"`)
	},
	{
		label: 'desktop/package.json',
		file: path.join(REPO_ROOT, 'desktop', 'package.json'),
		read: (s) => JSON.parse(s).version,
		write: (s, v) => s.replace(/("version"\s*:\s*)"[^"]+"/, `$1"${v}"`)
	},
	{
		label: 'mobile/package.json',
		file: path.join(REPO_ROOT, 'mobile', 'package.json'),
		read: (s) => JSON.parse(s).version,
		write: (s, v) => s.replace(/("version"\s*:\s*)"[^"]+"/, `$1"${v}"`)
	},
	{
		label: 'tauri.conf.json',
		file: path.join(REPO_ROOT, 'desktop', 'src-tauri', 'tauri.conf.json'),
		read: (s) => JSON.parse(s).version,
		write: (s, v) => s.replace(/("version"\s*:\s*)"[^"]+"/, `$1"${v}"`)
	},
	{
		label: 'Cargo.toml',
		file: path.join(REPO_ROOT, 'desktop', 'src-tauri', 'Cargo.toml'),
		// Only the [package] version, which is the first `version = "..."` line.
		read: (s) => s.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
		write: (s, v) => s.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${v}"`)
	},
	{
		label: 'android build.gradle (versionName)',
		file: path.join(REPO_ROOT, 'mobile', 'android', 'app', 'build.gradle'),
		read: (s) => s.match(/versionName\s+"([^"]+)"/)?.[1],
		write: (s, v) => s.replace(/(versionName\s+)"[^"]+"/, `$1"${v}"`)
	}
];

let drift = false;
const actions = [];

for (const t of targets) {
	if (!existsSync(t.file)) {
		actions.push(['MISSING', t.label, '-']);
		continue;
	}
	const src = readFileSync(t.file, 'utf8');
	let current;
	try {
		current = t.read(src);
	} catch {
		current = undefined;
	}
	if (current === version) {
		actions.push(['ok', t.label, current]);
		continue;
	}
	drift = true;
	actions.push([CHECK ? 'DRIFT' : 'update', t.label, `${current ?? '?'} -> ${version}`]);
	if (!CHECK) {
		const next = t.write(src, version);
		if (next === src) {
			console.error(`Could not rewrite version in ${t.file} - pattern did not match.`);
			process.exit(1);
		}
		writeFileSync(t.file, next);
	}
}

for (const [status, label, detail] of actions) {
	console.log(`  ${status.padEnd(8)} ${label.padEnd(36)} ${detail}`);
}

if (CHECK) {
	if (drift) {
		console.error(`\nVersion drift. Run: node scripts/sync-version.mjs ${version}`);
		process.exit(1);
	}
	console.log(`\nAll shells agree on ${version}.`);
} else {
	console.log(`\nVersion is now ${version} everywhere.`);
	console.log('Remember: task branches must NOT touch version numbers. See docs/RELEASES.md.');
}
