#!/usr/bin/env node
// Task-execution helper for the remediation programme (docs/REMEDIATION_PLAN.md).
// Owns the mechanical parts of ORCHESTRATION.md: worktrees, ports, leases, gates.
//
//   node scripts/task.mjs list                 # every task + its wave/deps/engine
//   node scripts/task.mjs show GC-010          # full spec for one task
//   node scripts/task.mjs next                 # tasks whose deps are satisfied
//   node scripts/task.mjs lease GC-010         # worktree + branch + port
//   node scripts/task.mjs release GC-010       # tear the worktree down
//   node scripts/task.mjs gates [--json]       # the four quality gates
//
// Authoritative task state lives on GitHub (issue `state:*` labels).
// .orchestrator/leases/*.json is a local cache only - deleting it is harmless.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASKS_FILE = path.join(REPO_ROOT, 'docs', 'tasks.yaml');
const WORKTREE_ROOT = path.resolve(REPO_ROOT, '..', 'geoclick-wt');
const LEASE_DIR = path.join(REPO_ROOT, '.orchestrator', 'leases');
const PORT_BASE = 5173; // 5173 stays free for the human; tasks get 5174+
const LEASE_TTL_MINUTES = 90;

const GATES = [
	{ name: 'check', argv: ['run', 'check'] },
	{ name: 'test', argv: ['run', 'test'] },
	{ name: 'lint', argv: ['run', 'lint'] },
	{ name: 'build', argv: ['run', 'build', '--workspace=app'] }
];

function loadTasks() {
	const doc = parse(readFileSync(TASKS_FILE, 'utf8'));
	doc.tasks.forEach((t, i) => {
		t.ordinal = i + 1;
		t.port = PORT_BASE + t.ordinal;
		t.worktree = path.join(WORKTREE_ROOT, t.id);
	});
	return doc;
}

function findTask(doc, id) {
	const task = doc.tasks.find((t) => t.id.toLowerCase() === String(id).toLowerCase());
	if (!task) {
		console.error(`Unknown task "${id}". Known: ${doc.tasks.map((t) => t.id).join(', ')}`);
		process.exit(1);
	}
	return task;
}

function git(args, opts = {}) {
	return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', ...opts }).trim();
}

// ---------------------------------------------------------------- list / show

function cmdList(doc) {
	const byRelease = new Map();
	for (const r of doc.releases) byRelease.set(r.version, r);
	console.log(
		['ID', 'ENGINE', 'EFFORT', 'REL', 'PORT', 'DEPS', 'TITLE'].join('\t')
	);
	for (const t of doc.tasks) {
		console.log(
			[
				t.id,
				t.engine,
				t.effort,
				t.release,
				t.port,
				(t.deps ?? []).join('+') || '-',
				t.title
			].join('\t')
		);
	}
	console.log(
		`\n${doc.tasks.length} tasks across ${doc.releases.length} releases. ` +
			`Concurrency cap ${doc.meta.concurrency_max}.`
	);
}

function cmdShow(doc, id) {
	const t = findTask(doc, id);
	console.log(`${t.id}  ${t.title}`);
	console.log(`engine=${t.engine} effort=${t.effort} release=${t.release}`);
	console.log(`branch=${t.branch}`);
	console.log(`worktree=${t.worktree}`);
	console.log(`port=${t.port}`);
	console.log(`deps=${(t.deps ?? []).join(', ') || 'none'}`);
	console.log(`needs=${(t.needs ?? []).join(', ') || 'any machine'}`);
	console.log(`files=${(t.files ?? []).join(', ')}`);
	console.log(`closes review findings: ${(t.review_refs ?? []).join(', ')}`);
	console.log(`\n--- DESCRIPTION ---\n${t.description}`);
	console.log(`--- DEFINITION OF DONE ---`);
	for (const d of t.dod) console.log(`  [ ] ${d}`);
	console.log(`\n--- GATES ---`);
	for (const g of GATES) console.log(`  npm ${g.argv.join(' ')}`);
}

// `next` is a local approximation for humans. The orchestrator must use the
// forge (issue state labels) as the real source of truth - see ORCHESTRATION.md.
function cmdNext(doc, doneIds) {
	const done = new Set(doneIds.map((s) => s.toUpperCase()));
	const ready = doc.tasks.filter(
		(t) => !done.has(t.id) && (t.deps ?? []).every((d) => done.has(d))
	);
	if (!ready.length) {
		console.log('Nothing ready. Either everything is done or deps are unmet.');
		return;
	}
	console.log(`Ready (${ready.length}), cap ${doc.meta.concurrency_max}:`);
	for (const t of ready) console.log(`  ${t.id}  ${t.engine}/${t.effort}  ${t.title}`);
	console.log('\nNOTE: derived from the --done list you passed, not from GitHub.');
	console.log('The orchestrator must read issue state:* labels instead.');
}

// ------------------------------------------------------------ lease / release

function cmdLease(doc, id, agent) {
	const t = findTask(doc, id);

	if (existsSync(t.worktree)) {
		console.error(`Worktree already exists: ${t.worktree}`);
		console.error(`Another agent may hold this task. Check the issue's state:* label.`);
		console.error(`To reclaim: node scripts/task.mjs release ${t.id}`);
		process.exit(1);
	}

	mkdirSync(WORKTREE_ROOT, { recursive: true });

	const exists = spawnSync('git', ['rev-parse', '--verify', '--quiet', t.branch], {
		cwd: REPO_ROOT
	}).status === 0;

	// Branch off the release branch when it exists, else main.
	const release = doc.releases.find((r) => r.version === t.release);
	let base = 'main';
	if (release) {
		const hasRelease = spawnSync('git', ['rev-parse', '--verify', '--quiet', release.branch], {
			cwd: REPO_ROOT
		}).status === 0;
		if (hasRelease) base = release.branch;
	}

	git(exists
		? ['worktree', 'add', t.worktree, t.branch]
		: ['worktree', 'add', '-b', t.branch, t.worktree, base]);

	const lease = {
		task: t.id,
		agent: agent ?? 'unassigned',
		host: hostname(),
		worktree: t.worktree,
		branch: t.branch,
		base,
		port: t.port,
		acquiredAt: new Date().toISOString(),
		ttlMinutes: LEASE_TTL_MINUTES
	};
	mkdirSync(LEASE_DIR, { recursive: true });
	writeFileSync(path.join(LEASE_DIR, `${t.id}.json`), JSON.stringify(lease, null, 2) + '\n');

	console.log(`Leased ${t.id}`);
	console.log(`  worktree : ${t.worktree}`);
	console.log(`  branch   : ${t.branch}  (from ${base})`);
	console.log(`  port     : ${t.port}`);
	console.log('');
	console.log('Post this as a comment on the task issue - the forge is authoritative:');
	console.log('```json');
	console.log(JSON.stringify(lease, null, 2));
	console.log('```');
	console.log('');
	console.log('Then, in the worktree:');
	console.log(`  cd ${t.worktree} && npm ci`);
	console.log(`  npm run dev --workspace=app -- --port ${t.port}`);
}

function cmdRelease(doc, id) {
	const t = findTask(doc, id);
	if (existsSync(t.worktree)) {
		git(['worktree', 'remove', '--force', t.worktree]);
		console.log(`Removed worktree ${t.worktree}`);
	} else {
		console.log(`No worktree at ${t.worktree}`);
	}
	git(['worktree', 'prune']);
	const leaseFile = path.join(LEASE_DIR, `${t.id}.json`);
	if (existsSync(leaseFile)) rmSync(leaseFile);
	console.log(`Released ${t.id}. The branch is kept - delete it via the merged PR.`);
}

// ------------------------------------------------------------------- gates

function cmdGates(asJson) {
	const results = [];
	let failed = null;

	for (const gate of GATES) {
		if (!asJson) console.log(`\n=== gate: ${gate.name} (npm ${gate.argv.join(' ')}) ===`);
		const started = Date.now();
		const res = spawnSync('npm', gate.argv, {
			cwd: process.cwd(),
			stdio: asJson ? 'pipe' : 'inherit',
			shell: process.platform === 'win32',
			encoding: 'utf8'
		});
		const ok = res.status === 0;
		results.push({
			gate: gate.name,
			command: `npm ${gate.argv.join(' ')}`,
			ok,
			exitCode: res.status,
			ms: Date.now() - started,
			...(asJson && !ok ? { output: `${res.stdout ?? ''}${res.stderr ?? ''}`.slice(-4000) } : {})
		});
		if (!ok) {
			failed = gate.name;
			break; // stop at the first failure
		}
	}

	if (asJson) {
		console.log(JSON.stringify({ ok: !failed, failedGate: failed, results }, null, 2));
	} else {
		console.log('\n--- summary ---');
		for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.gate}  (${r.ms}ms)`);
		if (failed) {
			console.log(`\nGATES FAILED at "${failed}". Later gates were not run.`);
			if (failed === 'lint') {
				console.log('If GC-001 has not merged yet, a lint failure here is EXPECTED.');
				console.log('See docs/REMEDIATION_PLAN.md -> Quality gate.');
			}
		} else {
			console.log('\nALL GATES PASS.');
		}
	}
	process.exit(failed ? 1 : 0);
}

// -------------------------------------------------------------------- main

const [, , cmd, ...rest] = process.argv;
const doc = loadTasks();

switch (cmd) {
	case 'list':
		cmdList(doc);
		break;
	case 'show':
		cmdShow(doc, rest[0]);
		break;
	case 'next': {
		const i = rest.indexOf('--done');
		cmdNext(doc, i === -1 ? [] : (rest[i + 1] ?? '').split(',').filter(Boolean));
		break;
	}
	case 'lease': {
		const i = rest.indexOf('--agent');
		cmdLease(doc, rest[0], i === -1 ? undefined : rest[i + 1]);
		break;
	}
	case 'release':
		cmdRelease(doc, rest[0]);
		break;
	case 'gates':
		cmdGates(rest.includes('--json'));
		break;
	default:
		console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8')
			.split('\n')
			.filter((l) => l.startsWith('//'))
			.map((l) => l.replace(/^\/\/ ?/, ''))
			.join('\n'));
		process.exit(cmd ? 1 : 0);
}
