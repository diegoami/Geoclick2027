#!/usr/bin/env node
// Task-execution helper for the remediation programme (docs/REMEDIATION_PLAN.md).
// Owns the mechanical parts of docs/ORCHESTRATION.md: local task state,
// worktrees, ports, leases, the review handoff packet, and the four gates.
//
//   node scripts/task.mjs list                      # every task + wave/deps/release
//   node scripts/task.mjs show GC-010               # full spec for one task
//   node scripts/task.mjs init [--dry-run]          # seed state for every task
//   node scripts/task.mjs status [--json]           # the board
//   node scripts/task.mjs next                      # tasks whose deps are integrated
//   node scripts/task.mjs state GC-010 in-review --note "gates green"
//   node scripts/task.mjs lease GC-010 --agent impl-gc-010 [--renew] [--force]
//   node scripts/task.mjs release GC-010            # tear the worktree down
//   node scripts/task.mjs handoff GC-010 [--no-gates]   # the review packet
//   node scripts/task.mjs gates [--json]            # the four quality gates
//
// There is NO GitHub in this programme. Authoritative task state is one JSON
// file per task under <main checkout>/.orchestrator/state/ (gitignored), written
// only through this script: single writer per file, temp-file + rename, and a
// transition table so a confused agent gets an error instead of a plausible
// wrong board. See docs/ORCHESTRATION.md -> "Task state, without a forge".

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// State must live in the MAIN checkout, not in whichever worktree is calling us
// - otherwise every worktree gets its own private board and the orchestrator
// sees nothing. `git rev-parse --git-common-dir` points at the main repo's git
// dir from inside any linked worktree.
function mainCheckout() {
	try {
		const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
			cwd: SCRIPT_ROOT,
			encoding: 'utf8'
		}).trim();
		const abs = path.resolve(SCRIPT_ROOT, common);
		// .../Geoclick2027/.git -> .../Geoclick2027
		return path.basename(abs) === '.git' ? path.dirname(abs) : abs;
	} catch {
		return SCRIPT_ROOT;
	}
}

const MAIN_ROOT = mainCheckout();
const TASKS_FILE = existsSync(path.join(MAIN_ROOT, 'docs', 'tasks.yaml'))
	? path.join(MAIN_ROOT, 'docs', 'tasks.yaml')
	: path.join(SCRIPT_ROOT, 'docs', 'tasks.yaml');
const STATE_DIR = path.join(MAIN_ROOT, '.orchestrator', 'state');
const HANDOFF_DIR = path.join(MAIN_ROOT, '.orchestrator', 'handoff');
const WORKTREE_ROOT = path.resolve(MAIN_ROOT, '..', 'geoclick-wt');
const PORT_BASE = 5173; // 5173 stays free for the human; tasks get 5174+
const INTEGRATION_BRANCH = 'main';

const GATES = [
	{ name: 'check', argv: ['run', 'check'] },
	{ name: 'test', argv: ['run', 'test'] },
	{ name: 'lint', argv: ['run', 'lint'] },
	{ name: 'build', argv: ['run', 'build', '--workspace=app'] }
];

// ORCHESTRATION.md's state machine. Anything not listed is refused.
const TRANSITIONS = {
	backlog: ['ready', 'blocked'],
	ready: ['leased', 'backlog', 'blocked'],
	leased: ['in-progress', 'ready', 'blocked'],
	'in-progress': ['in-review', 'ready', 'blocked'],
	'in-review': ['approved', 'changes-requested', 'escalated', 'blocked'],
	'changes-requested': ['in-progress', 'escalated', 'blocked'],
	approved: ['integrated', 'changes-requested', 'blocked'],
	integrated: ['released', 'blocked'],
	released: [],
	blocked: ['backlog', 'ready', 'in-progress', 'escalated'],
	escalated: ['ready', 'in-progress', 'blocked']
};
const DONE = new Set(['integrated', 'released']);

function loadTasks() {
	const doc = parse(readFileSync(TASKS_FILE, 'utf8'));
	// meta shape is tolerated in both spellings so a schema tweak in tasks.yaml
	// does not break the harness.
	const m = doc.meta ?? {};
	doc.roles = {
		implementer: m.implementer_engine ?? m.roles?.implementer ?? 'sonnet',
		reviewer: m.reviewer_engine ?? m.roles?.reviewer ?? 'opus',
		orchestrator: m.orchestrator_engine ?? m.roles?.orchestrator ?? 'opus'
	};
	doc.leaseTtlMinutes = m.lease_ttl_minutes ?? 90;
	doc.concurrency = m.concurrency_max ?? 3;
	doc.tasks.forEach((t, i) => {
		t.ordinal = i + 1;
		t.port = PORT_BASE + t.ordinal;
		t.worktree = path.join(WORKTREE_ROOT, t.id);
	});
	return doc;
}

function findTask(doc, id) {
	const task = doc.tasks.find((t) => t.id.toLowerCase() === String(id ?? '').toLowerCase());
	if (!task) {
		console.error(`Unknown task "${id}". Known: ${doc.tasks.map((t) => t.id).join(', ')}`);
		process.exit(1);
	}
	return task;
}

function git(args, opts = {}) {
	return execFileSync('git', args, { cwd: MAIN_ROOT, encoding: 'utf8', ...opts }).trim();
}

function gitOk(args, opts = {}) {
	return spawnSync('git', args, { cwd: MAIN_ROOT, ...opts }).status === 0;
}

// ------------------------------------------------------------------- state I/O

const statePath = (id) => path.join(STATE_DIR, `${id}.json`);

function readState(id) {
	const p = statePath(id);
	if (!existsSync(p)) return null;
	return JSON.parse(readFileSync(p, 'utf8'));
}

// Temp file + rename: a reader never sees a partial write, and a crash mid-write
// leaves the previous state intact rather than an unparseable file.
function writeState(rec) {
	mkdirSync(STATE_DIR, { recursive: true });
	rec.updatedAt = new Date().toISOString();
	const target = statePath(rec.task);
	const tmp = `${target}.tmp`;
	writeFileSync(tmp, JSON.stringify(rec, null, 2) + '\n');
	renameSync(tmp, target);
	return rec;
}

function requireState(id) {
	const rec = readState(id);
	if (!rec) {
		console.error(`No state file for ${id}. Run: node scripts/task.mjs init`);
		process.exit(1);
	}
	return rec;
}

function pushHistory(rec, state, note) {
	rec.history = rec.history ?? [];
	rec.history.push({ at: new Date().toISOString(), state, ...(note ? { note } : {}) });
}

// ---------------------------------------------------------------- list / show

function cmdList(doc) {
	console.log(['ID', 'ENGINE', 'EFFORT', 'WAVE', 'REL', 'PORT', 'DEPS', 'TITLE'].join('\t'));
	for (const t of doc.tasks) {
		console.log(
			[
				t.id,
				t.engine,
				t.effort,
				t.wave,
				t.release,
				t.port,
				(t.deps ?? []).join('+') || '-',
				t.title
			].join('\t')
		);
	}
	console.log(
		`\n${doc.tasks.length} tasks across ${doc.releases.length} releases. ` +
			`Concurrency cap ${doc.concurrency}. ` +
			`Implementer ${doc.roles.implementer}, reviewer/orchestrator ${doc.roles.reviewer}.`
	);
}

function cmdShow(doc, id) {
	const t = findTask(doc, id);
	const rec = readState(t.id);
	console.log(`${t.id}  ${t.title}`);
	console.log(`engine=${t.engine} effort=${t.effort} wave=${t.wave} release=${t.release}`);
	console.log(`branch=${t.branch}`);
	console.log(`worktree=${t.worktree}`);
	console.log(`port=${t.port}`);
	console.log(`deps=${(t.deps ?? []).join(', ') || 'none'}`);
	console.log(`state=${rec ? rec.state : '(uninitialised)'}${rec?.round ? ` round=${rec.round}` : ''}`);
	console.log(`files=${(t.files ?? []).join(', ')}`);
	console.log(`closes review findings: ${(t.review_refs ?? []).join(', ')}`);
	console.log(`\n--- DESCRIPTION ---\n${t.description}`);
	console.log(`--- DEFINITION OF DONE ---`);
	for (const d of t.dod) console.log(`  [ ] ${d}`);
	console.log(`\n--- GATES ---`);
	for (const g of GATES) console.log(`  npm ${g.argv.join(' ')}`);
}

// --------------------------------------------------------------------- init

function cmdInit(doc, dryRun) {
	const plan = [];
	for (const t of doc.tasks) {
		const existing = readState(t.id);
		if (existing) {
			plan.push([t.id, `keep (${existing.state})`]);
			continue;
		}
		const state = (t.deps ?? []).length === 0 ? 'ready' : 'backlog';
		plan.push([t.id, `create -> ${state}`]);
		if (!dryRun) {
			const rec = {
				task: t.id,
				state,
				round: 0,
				engine: t.engine,
				branch: t.branch,
				worktree: t.worktree,
				port: t.port,
				release: t.release,
				wave: t.wave,
				agent: null,
				host: null,
				leasedAt: null,
				ttlMinutes: doc.leaseTtlMinutes,
				note: 'seeded by task.mjs init',
				history: []
			};
			pushHistory(rec, state, 'seeded');
			writeState(rec);
		}
	}
	for (const [id, what] of plan) console.log(`  ${id.padEnd(8)} ${what}`);
	console.log(
		dryRun
			? `\n--dry-run: nothing written. State dir would be ${STATE_DIR}`
			: `\nState dir: ${STATE_DIR}\ninit is idempotent - existing files are never overwritten.`
	);
}

// ------------------------------------------------------------------- status

function leaseAge(rec) {
	if (!rec.leasedAt) return null;
	const mins = (Date.now() - Date.parse(rec.leasedAt)) / 60000;
	return { mins, expired: mins > (rec.ttlMinutes ?? 90) };
}

function cmdStatus(doc, asJson) {
	const rows = doc.tasks.map((t) => {
		const rec = readState(t.id);
		const age = rec ? leaseAge(rec) : null;
		return {
			id: t.id,
			wave: t.wave,
			release: t.release,
			state: rec?.state ?? 'uninitialised',
			round: rec?.round ?? 0,
			agent: rec?.agent ?? null,
			port: t.port,
			leaseMinutes: age ? Math.round(age.mins) : null,
			leaseExpired: age ? age.expired : null,
			note: rec?.note ?? null
		};
	});

	if (asJson) {
		const byRelease = doc.releases.map((r) => ({
			version: r.version,
			tasks: r.tasks,
			complete: r.tasks.every((id) => DONE.has(rows.find((x) => x.id === id)?.state))
		}));
		console.log(JSON.stringify({ tasks: rows, releases: byRelease }, null, 2));
		return;
	}

	console.log(['ID', 'WAVE', 'REL', 'STATE', 'RND', 'AGENT', 'LEASE'].join('\t'));
	for (const r of rows) {
		const lease =
			r.leaseMinutes === null ? '-' : `${r.leaseMinutes}m${r.leaseExpired ? ' EXPIRED' : ''}`;
		console.log([r.id, r.wave, r.release, r.state, r.round, r.agent ?? '-', lease].join('\t'));
	}

	const counts = {};
	for (const r of rows) counts[r.state] = (counts[r.state] ?? 0) + 1;
	console.log(
		'\n' +
			Object.entries(counts)
				.map(([k, v]) => `${k}:${v}`)
				.join('  ')
	);

	// Wave completion is the release batching unit - see docs/RELEASES.md.
	const waves = [...new Set(doc.tasks.map((t) => t.wave))].sort();
	for (const w of waves) {
		const ids = doc.tasks.filter((t) => t.wave === w).map((t) => t.id);
		const done = ids.filter((id) => DONE.has(rows.find((r) => r.id === id).state));
		console.log(`  wave ${w}: ${done.length}/${ids.length} integrated`);
	}
	for (const r of doc.releases) {
		const done = r.tasks.filter((id) => DONE.has(rows.find((x) => x.id === id)?.state));
		const ready = done.length === r.tasks.length;
		console.log(
			`  ${r.version}: ${done.length}/${r.tasks.length}${ready ? '  <- BATCH COMPLETE, cut the release (docs/RELEASES.md)' : ''}`
		);
	}
	const expired = rows.filter((r) => r.leaseExpired);
	if (expired.length) {
		console.log(`\nEXPIRED LEASES: ${expired.map((r) => r.id).join(', ')}`);
		console.log('Reclaim with: node scripts/task.mjs release <id> && node scripts/task.mjs state <id> ready --note "lease expired"');
	}
}

// --------------------------------------------------------------------- next

function cmdNext(doc) {
	const stateOf = (id) => readState(id)?.state ?? 'uninitialised';
	const ready = doc.tasks.filter((t) => {
		const s = stateOf(t.id);
		if (s !== 'ready' && s !== 'backlog') return false;
		return (t.deps ?? []).every((d) => DONE.has(stateOf(d)));
	});
	const active = doc.tasks.filter((t) =>
		['leased', 'in-progress', 'in-review', 'changes-requested'].includes(stateOf(t.id))
	);

	console.log(`In flight: ${active.length}/${doc.concurrency}` +
		(active.length ? ` (${active.map((t) => t.id).join(', ')})` : ''));
	if (!ready.length) {
		console.log('Nothing dependency-ready. Either everything is done or deps are unmet.');
		return;
	}
	console.log(`\nDependency-ready (${ready.length}):`);
	for (const t of ready) {
		const s = stateOf(t.id);
		console.log(
			`  ${t.id}  wave ${t.wave}  ${t.engine}/${t.effort}  ${t.title}` +
				(s === 'backlog' ? '   [state still backlog - transition to ready first]' : '')
		);
	}
	const slots = doc.concurrency - active.length;
	console.log(`\nFree concurrency slots: ${slots > 0 ? slots : 0}. Each worktree needs its own \`npm install\`.`);
}

// -------------------------------------------------------------------- state

function cmdState(doc, id, to, { note, round }) {
	const t = findTask(doc, id);
	const rec = requireState(t.id);
	if (!to) {
		console.error(`Usage: node scripts/task.mjs state ${t.id} <state> [--note "..."]`);
		console.error(`Current: ${rec.state}. Allowed next: ${TRANSITIONS[rec.state].join(', ') || '(terminal)'}`);
		process.exit(1);
	}
	if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, to)) {
		console.error(`Unknown state "${to}". Known: ${Object.keys(TRANSITIONS).join(', ')}`);
		process.exit(1);
	}
	if (rec.state === to) {
		console.log(`${t.id} is already ${to}. Nothing to do.`);
		return;
	}
	if (!TRANSITIONS[rec.state].includes(to)) {
		console.error(`Refused: ${t.id} is "${rec.state}"; that cannot go to "${to}".`);
		console.error(`Allowed: ${TRANSITIONS[rec.state].join(', ') || '(terminal)'}`);
		console.error('See the state machine in docs/ORCHESTRATION.md.');
		process.exit(1);
	}

	// A second changes-requested is the escalation trigger (two rounds, then stop).
	if (to === 'changes-requested') rec.round = (rec.round ?? 0) + 1;
	if (round !== undefined) rec.round = Number(round);

	const from = rec.state;
	rec.state = to;
	rec.note = note ?? null;
	if (to === 'ready' || to === 'backlog') {
		rec.agent = null;
		rec.host = null;
		rec.leasedAt = null;
	}
	pushHistory(rec, to, note);
	writeState(rec);

	console.log(`${t.id}: ${from} -> ${to}${note ? `  (${note})` : ''}`);
	if (to === 'changes-requested' && rec.round >= 2) {
		console.log('\nThis is round 2. Per ORCHESTRATION.md: do NOT start a third round.');
		console.log('Escalate to the human: node scripts/task.mjs state ' + t.id + ' escalated --note "..."');
	}
	if (to === 'approved') {
		console.log('\nNext: rebase onto main, re-run gates, then ASK THE HUMAN before merging.');
	}
}

// ------------------------------------------------------------ lease / release

function cmdLease(doc, id, { agent, renew, force }) {
	const t = findTask(doc, id);
	const rec = requireState(t.id);

	if (renew) {
		if (rec.state !== 'leased' && rec.state !== 'in-progress') {
			console.error(`Cannot renew ${t.id}: state is "${rec.state}", not leased/in-progress.`);
			process.exit(1);
		}
		rec.leasedAt = new Date().toISOString();
		pushHistory(rec, rec.state, 'lease renewed');
		writeState(rec);
		console.log(`Renewed lease on ${t.id} for ${rec.ttlMinutes} more minutes.`);
		return;
	}

	if (rec.state !== 'ready') {
		console.error(`Cannot lease ${t.id}: state is "${rec.state}", not "ready".`);
		console.error('That is the double-lease guard. Reclaim an expired lease with `release` first.');
		process.exit(1);
	}

	const unmet = (t.deps ?? []).filter((d) => !DONE.has(readState(d)?.state));
	if (unmet.length && !force) {
		console.error(`Cannot lease ${t.id}: deps not integrated into ${INTEGRATION_BRANCH}: ${unmet.join(', ')}`);
		console.error('This is a DAG violation, not a hiccup. Use --force only if you know why.');
		process.exit(1);
	}

	if (existsSync(t.worktree)) {
		console.error(`Worktree already exists: ${t.worktree}`);
		console.error(`To reclaim: node scripts/task.mjs release ${t.id}`);
		process.exit(1);
	}

	mkdirSync(WORKTREE_ROOT, { recursive: true });
	const branchExists = gitOk(['rev-parse', '--verify', '--quiet', t.branch]);
	git(
		branchExists
			? ['worktree', 'add', t.worktree, t.branch]
			: ['worktree', 'add', '-b', t.branch, t.worktree, INTEGRATION_BRANCH]
	);

	rec.state = 'leased';
	rec.agent = agent ?? 'unassigned';
	rec.host = hostname();
	rec.branch = t.branch;
	rec.worktree = t.worktree;
	rec.port = t.port;
	rec.leasedAt = new Date().toISOString();
	rec.note = `worktree created from ${INTEGRATION_BRANCH}`;
	pushHistory(rec, 'leased', `agent=${rec.agent} port=${t.port}`);
	writeState(rec);

	console.log(`Leased ${t.id} to ${rec.agent}`);
	console.log(`  worktree : ${t.worktree}`);
	console.log(`  branch   : ${t.branch}  (from ${INTEGRATION_BRANCH})`);
	console.log(`  port     : ${t.port}`);
	console.log(`  state    : ${statePath(t.id)}`);
	console.log('');
	console.log('In the worktree, FIRST (never skip - see ORCHESTRATION.md):');
	console.log(`  cd ${t.worktree}`);
	console.log('  npm install');
	console.log(`  npm run dev --workspace=app -- --port ${t.port}`);
	console.log('');
	console.log(`Then: node scripts/task.mjs state ${t.id} in-progress`);
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
	const rec = readState(t.id);
	if (rec) {
		rec.agent = null;
		rec.host = null;
		rec.leasedAt = null;
		pushHistory(rec, rec.state, 'worktree released');
		writeState(rec);
	}
	console.log(`Released ${t.id}. The branch is kept; delete it after it merges.`);
	console.log(`State is still "${rec?.state ?? 'uninitialised'}" - change it explicitly if that is wrong.`);
}

// ------------------------------------------------------------------ handoff

// The review packet. This is what replaces the first draft's draft PR: a branch
// name, a diff, the DoD, and the gate result. Nothing more is invented.
function cmdHandoff(doc, id, runGates) {
	const t = findTask(doc, id);
	const rec = requireState(t.id);
	const range = `${INTEGRATION_BRANCH}...${t.branch}`;

	// Quiet: an absent branch is a normal "you have not pushed yet" case, not a
	// crash, and git's own fatal: line on stderr only confuses the reader.
	const gitTry = (args) => {
		const res = spawnSync('git', args, { cwd: MAIN_ROOT, encoding: 'utf8', stdio: 'pipe' });
		return res.status === 0 ? res.stdout.trim() : null;
	};
	const missing = `(branch "${t.branch}" not found - commit and push it first)`;
	const stat = gitTry(['diff', '--stat', range]) ?? missing;
	const commits = gitTry(['log', '--oneline', `${INTEGRATION_BRANCH}..${t.branch}`]) ?? missing;

	let gatesBlock = '_not run by this packet_';
	if (runGates) {
		const res = runGateSet(true);
		gatesBlock = '```json\n' + JSON.stringify(res, null, 2) + '\n```';
	}

	const md = [
		`# Handoff: ${t.id} — ${t.title}`,
		'',
		`- branch: \`${t.branch}\`  (base: \`${INTEGRATION_BRANCH}\`)`,
		`- engine: ${t.engine} (implementer) — review runs on ${doc.roles.reviewer}, cold context`,
		`- round: ${rec.round ?? 0}`,
		`- review findings closed: ${(t.review_refs ?? []).join(', ') || '—'}`,
		'',
		'## Read the diff',
		'',
		'```',
		`git diff ${range}`,
		'```',
		'',
		'### Diffstat',
		'',
		'```',
		stat,
		'```',
		'',
		'### Commits',
		'',
		'```',
		commits,
		'```',
		'',
		'## Definition of done',
		'',
		...(t.dod ?? []).map((d) => `- [ ] ${d}`),
		'',
		'## Gates',
		'',
		gatesBlock,
		'',
		'## Implementer notes',
		'',
		'_What you deliberately did NOT do, and anything the reviewer should not mistake',
		'for an omission. Out-of-scope items spotted along the way go here, not in the diff._',
		''
	].join('\n');

	mkdirSync(HANDOFF_DIR, { recursive: true });
	const out = path.join(HANDOFF_DIR, `${t.id}.md`);
	writeFileSync(out, md);
	console.log(md);
	console.log(`\nWritten to ${out}`);
	console.log(`Then: node scripts/task.mjs state ${t.id} in-review --note "round ${rec.round ?? 0} ready"`);
}

// ------------------------------------------------------------------- gates

function runGateSet(quiet) {
	const results = [];
	let failed = null;
	for (const gate of GATES) {
		if (!quiet) console.log(`\n=== gate: ${gate.name} (npm ${gate.argv.join(' ')}) ===`);
		const started = Date.now();
		const res = spawnSync('npm', gate.argv, {
			cwd: process.cwd(),
			stdio: quiet ? 'pipe' : 'inherit',
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
			...(quiet && !ok ? { output: `${res.stdout ?? ''}${res.stderr ?? ''}`.slice(-4000) } : {})
		});
		if (!ok) {
			failed = gate.name;
			break; // stop at the first failure
		}
	}
	return { ok: !failed, failedGate: failed, cwd: process.cwd(), results };
}

function cmdGates(asJson) {
	const verdict = runGateSet(asJson);
	if (asJson) {
		console.log(JSON.stringify(verdict, null, 2));
	} else {
		console.log('\n--- summary ---');
		for (const r of verdict.results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.gate}  (${r.ms}ms)`);
		if (verdict.failedGate) {
			console.log(`\nGATES FAILED at "${verdict.failedGate}". Later gates were not run.`);
			if (verdict.failedGate === 'lint') {
				console.log('If GC-001 has not merged yet, a lint failure here is EXPECTED.');
				console.log('See docs/REMEDIATION_PLAN.md -> Quality gate.');
			}
		} else {
			console.log('\nALL GATES PASS.');
		}
	}
	process.exit(verdict.ok ? 0 : 1);
}

// -------------------------------------------------------------------- main

function flag(rest, name) {
	const i = rest.indexOf(name);
	return i === -1 ? undefined : (rest[i + 1] ?? '');
}

const [, , cmd, ...rest] = process.argv;

if (cmd === 'gates') {
	cmdGates(rest.includes('--json')); // does not need tasks.yaml
}

const doc = cmd ? loadTasks() : null;

switch (cmd) {
	case 'list':
		cmdList(doc);
		break;
	case 'show':
		cmdShow(doc, rest[0]);
		break;
	case 'init':
		cmdInit(doc, rest.includes('--dry-run'));
		break;
	case 'status':
		cmdStatus(doc, rest.includes('--json'));
		break;
	case 'next':
		cmdNext(doc);
		break;
	case 'state':
		cmdState(doc, rest[0], rest[1], { note: flag(rest, '--note'), round: flag(rest, '--round') });
		break;
	case 'lease':
		cmdLease(doc, rest[0], {
			agent: flag(rest, '--agent'),
			renew: rest.includes('--renew'),
			force: rest.includes('--force')
		});
		break;
	case 'release':
		cmdRelease(doc, rest[0]);
		break;
	case 'handoff':
		cmdHandoff(doc, rest[0], !rest.includes('--no-gates'));
		break;
	default:
		console.log(
			readFileSync(fileURLToPath(import.meta.url), 'utf8')
				.split('\n')
				.filter((l) => l.startsWith('//'))
				.map((l) => l.replace(/^\/\/ ?/, ''))
				.join('\n')
		);
		process.exit(cmd ? 1 : 0);
}
