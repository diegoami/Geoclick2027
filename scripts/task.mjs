#!/usr/bin/env node
// Harness for the remediation programme (docs/REMEDIATION_PLAN.md).
// ONE agent, ONE task at a time, in the main checkout. No worktrees, no ports
// to allocate, no leases, no second agent to hand off to. See
// docs/ORCHESTRATION.md -> "The loop".
//
//   node scripts/task.mjs list                 # every task + wave/deps/release
//   node scripts/task.mjs show GC-010          # full spec for one task
//   node scripts/task.mjs init [--dry-run]     # seed state for every task
//   node scripts/task.mjs status [--json]      # the board
//   node scripts/task.mjs next                 # the next task the DAG allows
//   node scripts/task.mjs start GC-010         # branch + state -> in-progress
//   node scripts/task.mjs log GC-010           # worklog for the approval request
//   node scripts/task.mjs state GC-010 awaiting-approval --note "gates green"
//   node scripts/task.mjs finish GC-010        # after the merge: clean up + integrated
//   node scripts/task.mjs doctor [--fix]       # zombie sweep: worktrees, branches, ports
//   node scripts/task.mjs gates [--json|--quiet]  # the four quality gates
//
// Live state is one JSON file per task under <repo>/.orchestrator/state/
// (gitignored), written only through this script: temp-file + rename, and a
// transition table so a wrong move is refused instead of silently recorded.
// The state the PRODUCT OWNER reads is the ledger table in
// docs/REMEDIATION_PLAN.md, ticked as each task merges.

import { execFileSync, spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASKS_FILE = path.join(REPO_ROOT, 'docs', 'tasks.yaml');
const STATE_DIR = path.join(REPO_ROOT, '.orchestrator', 'state');
const LOG_DIR = path.join(REPO_ROOT, '.orchestrator', 'log');
const INTEGRATION_BRANCH = 'main';
const DEV_PORT = 5174; // 5173 stays free for the product owner
const PORT_SWEEP = [5173, 5199]; // doctor looks for strays in here

const GATES = [
	{ name: 'check', argv: ['run', 'check'] },
	{ name: 'test', argv: ['run', 'test'] },
	{ name: 'lint', argv: ['run', 'lint'] },
	{ name: 'build', argv: ['run', 'build', '--workspace=app'] }
];

// docs/ORCHESTRATION.md's state machine. One agent, so there is no `leased`
// state and no reviewer states. Since the automerge change (2026-09-13)
// `awaiting-approval` means "gates green, DoD verified, merge it" - the name is
// kept so existing state files stay valid; the product owner no longer gates it.
const TRANSITIONS = {
	backlog: ['ready', 'blocked'],
	ready: ['in-progress', 'backlog', 'blocked'],
	'in-progress': ['awaiting-approval', 'ready', 'blocked', 'escalated'],
	'awaiting-approval': ['integrated', 'changes-requested', 'blocked', 'escalated'],
	'changes-requested': ['in-progress', 'blocked', 'escalated'],
	integrated: ['released', 'blocked'],
	released: [],
	blocked: ['backlog', 'ready', 'in-progress', 'escalated'],
	escalated: ['ready', 'in-progress', 'blocked']
};
const DONE = new Set(['integrated', 'released']);
const ACTIVE = new Set(['in-progress', 'awaiting-approval', 'changes-requested']);

function loadTasks() {
	const doc = parse(readFileSync(TASKS_FILE, 'utf8'));
	const m = doc.meta ?? {};
	doc.engine = m.engine ?? 'opus';
	doc.concurrency = m.concurrency_max ?? 1;
	doc.devPort = m.dev_port ?? DEV_PORT;
	doc.tasks.forEach((t, i) => {
		t.ordinal = i + 1;
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

function git(args) {
	return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function gitTry(args) {
	const res = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
	return res.status === 0 ? res.stdout.trim() : null;
}

const branchExists = (b) => gitTry(['rev-parse', '--verify', '--quiet', b]) !== null;

// ------------------------------------------------------------------- state I/O

const statePath = (id) => path.join(STATE_DIR, `${id}.json`);

function readState(id) {
	const p = statePath(id);
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, 'utf8'));
	} catch {
		console.error(`State file for ${id} is not valid JSON: ${p}`);
		process.exit(1);
	}
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

const stateOf = (id) => readState(id)?.state ?? 'uninitialised';

// ---------------------------------------------------------------- list / show

function cmdList(doc) {
	console.log(['ID', 'EFFORT', 'WAVE', 'REL', 'PRIORITY', 'DEPS', 'TITLE'].join('\t'));
	for (const t of doc.tasks) {
		console.log(
			[
				t.id,
				t.effort,
				t.wave,
				t.release,
				t.priority ?? '-',
				(t.deps ?? []).join('+') || '-',
				t.title
			].join('\t')
		);
	}
	console.log(
		`\n${doc.tasks.length} tasks, ${doc.releases.length} releases, engine ${doc.engine} for all of them.` +
			`\nOne task at a time (concurrency ${doc.concurrency}); dev server on port ${doc.devPort}.`
	);
}

function cmdShow(doc, id) {
	const t = findTask(doc, id);
	const rec = readState(t.id);
	console.log(`${t.id}  ${t.title}`);
	console.log(`engine=${t.engine} effort=${t.effort} wave=${t.wave} release=${t.release}`);
	console.log(`priority=${t.priority ?? '-'} type=${t.type ?? '-'}`);
	console.log(`branch=${t.branch}`);
	console.log(`deps=${(t.deps ?? []).join(', ') || 'none'}`);
	console.log(`state=${rec ? rec.state : '(uninitialised)'}${rec?.attempts ? ` attempts=${rec.attempts}` : ''}`);
	console.log(`files=${(t.files ?? []).join(', ')}`);
	console.log(`closes review findings: ${(t.review_refs ?? []).join(', ')}`);
	console.log(`\n--- DESCRIPTION ---\n${t.description}`);
	console.log('--- DEFINITION OF DONE ---');
	for (const d of t.dod) console.log(`  [ ] ${d}`);
	console.log('\n--- GATES ---');
	for (const g of GATES) console.log(`  npm ${g.argv.join(' ')}`);
}

// --------------------------------------------------------------------- init

function cmdInit(doc, dryRun) {
	for (const t of doc.tasks) {
		const existing = readState(t.id);
		if (existing) {
			console.log(`  ${t.id.padEnd(8)} keep (${existing.state})`);
			continue;
		}
		const state = (t.deps ?? []).length === 0 ? 'ready' : 'backlog';
		console.log(`  ${t.id.padEnd(8)} create -> ${state}`);
		if (dryRun) continue;
		const rec = {
			task: t.id,
			state,
			attempts: 0,
			engine: t.engine,
			branch: t.branch,
			release: t.release,
			wave: t.wave,
			host: hostname(),
			mergedAt: null,
			note: 'seeded by task.mjs init',
			history: []
		};
		pushHistory(rec, state, 'seeded');
		writeState(rec);
	}
	console.log(
		dryRun
			? `\n--dry-run: nothing written. State would live in ${STATE_DIR}`
			: `\nState: ${STATE_DIR}\ninit is idempotent - it never overwrites an existing file.` +
					'\nThe ledger the product owner reads is the table in docs/REMEDIATION_PLAN.md.'
	);
}

// ------------------------------------------------------------------- status

function cmdStatus(doc, asJson) {
	const rows = doc.tasks.map((t) => {
		const rec = readState(t.id);
		return {
			id: t.id,
			wave: t.wave,
			release: t.release,
			priority: t.priority ?? null,
			state: rec?.state ?? 'uninitialised',
			attempts: rec?.attempts ?? 0,
			branch: t.branch,
			branchExists: branchExists(t.branch),
			note: rec?.note ?? null
		};
	});

	if (asJson) {
		console.log(
			JSON.stringify(
				{
					tasks: rows,
					releases: doc.releases.map((r) => ({
						version: r.version,
						tasks: r.tasks,
						done: r.tasks.filter((id) => DONE.has(rows.find((x) => x.id === id)?.state)).length,
						complete: r.tasks.every((id) => DONE.has(rows.find((x) => x.id === id)?.state))
					}))
				},
				null,
				2
			)
		);
		return;
	}

	console.log(['ID', 'WAVE', 'REL', 'STATE', 'TRY', 'BRANCH?'].join('\t'));
	for (const r of rows) {
		console.log(
			[r.id, r.wave, r.release, r.state, r.attempts, r.branchExists ? 'yes' : '-'].join('\t')
		);
	}

	const counts = {};
	for (const r of rows) counts[r.state] = (counts[r.state] ?? 0) + 1;
	console.log('\n' + Object.entries(counts).map(([k, v]) => `${k}:${v}`).join('  '));

	for (const r of doc.releases) {
		const done = r.tasks.filter((id) => DONE.has(rows.find((x) => x.id === id)?.state));
		const complete = done.length === r.tasks.length;
		// A pushed tag means the release is already cut - don't tell a restarted
		// session to cut it again.
		const tagged = gitTry(['rev-parse', '--verify', '--quiet', `refs/tags/${r.version}`]) !== null;
		const note = tagged
			? '  released (tagged)'
			: complete
				? '  <- BATCH COMPLETE: cut the release (docs/RELEASES.md)'
				: '';
		console.log(`  ${r.version}: ${done.length}/${r.tasks.length}${note}`);
	}

	const active = rows.filter((r) => ACTIVE.has(r.state));
	if (active.length > doc.concurrency) {
		console.log(
			`\nWARNING: ${active.length} tasks are active (${active.map((r) => r.id).join(', ')}) ` +
				`but concurrency is ${doc.concurrency}. One of them is a zombie - run \`doctor\`.`
		);
	}
	const stuck = rows.filter((r) => r.state === 'escalated' || r.state === 'blocked');
	if (stuck.length) {
		console.log(`\nNEEDS THE PRODUCT OWNER: ${stuck.map((r) => `${r.id} (${r.state})`).join(', ')}`);
	}
}

// --------------------------------------------------------------------- next

function cmdNext(doc) {
	const active = doc.tasks.filter((t) => ACTIVE.has(stateOf(t.id)));
	if (active.length) {
		console.log(`Finish what is open first: ${active.map((t) => `${t.id} (${stateOf(t.id)})`).join(', ')}`);
		console.log('One task at a time is the whole point of the loop.');
		return;
	}
	const ready = doc.tasks.filter((t) => {
		const s = stateOf(t.id);
		return (s === 'ready' || s === 'backlog') && (t.deps ?? []).every((d) => DONE.has(stateOf(d)));
	});
	if (!ready.length) {
		const left = doc.tasks.filter((t) => !DONE.has(stateOf(t.id)));
		if (left.some((t) => stateOf(t.id) === 'uninitialised')) {
			console.log('No state yet. Seed it first:  node scripts/task.mjs init');
			return;
		}
		console.log(
			left.length
				? `Nothing startable. Blocked on: ${left.map((t) => `${t.id} (${stateOf(t.id)})`).join(', ')}`
				: 'Every task is integrated. Cut the final release - docs/RELEASES.md.'
		);
		return;
	}
	// Lowest wave first, then declaration order: that is the plan's own sequence.
	ready.sort((a, b) => a.wave - b.wave || a.ordinal - b.ordinal);
	const pick = ready[0];
	console.log(`NEXT: ${pick.id}  wave ${pick.wave}  ${pick.effort}  ${pick.title}`);
	console.log(`  node scripts/task.mjs show ${pick.id}`);
	console.log(`  node scripts/task.mjs start ${pick.id}`);
	if (ready.length > 1) {
		console.log(`\nAlso startable (do them after): ${ready.slice(1).map((t) => t.id).join(', ')}`);
	}
}

// -------------------------------------------------------------------- state

function cmdState(doc, id, to, { note }) {
	const t = findTask(doc, id);
	const rec = requireState(t.id);
	if (!to) {
		console.error(`Usage: node scripts/task.mjs state ${t.id} <state> [--note "..."]`);
		console.error(`Current: ${rec.state}. Allowed: ${TRANSITIONS[rec.state].join(', ') || '(terminal)'}`);
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

	if (to === 'changes-requested') rec.attempts = (rec.attempts ?? 0) + 1;
	const from = rec.state;
	rec.state = to;
	rec.note = note ?? null;
	pushHistory(rec, to, note);
	writeState(rec);
	console.log(`${t.id}: ${from} -> ${to}${note ? `  (${note})` : ''}`);

	if (to === 'awaiting-approval') {
		console.log('\nGates green and DoD verified: automerge (ORCHESTRATION.md, 2026-09-13).');
		console.log(`  git checkout ${INTEGRATION_BRANCH} && git merge --no-ff ${t.branch} && git push`);
		console.log(`  node scripts/task.mjs finish ${t.id}`);
		console.log('Then report the merge to the product owner in one short summary. Do not wait for a reply.');
	}
	if (to === 'changes-requested' && rec.attempts >= 2) {
		console.log('\nThis is the second round of changes on this task.');
		console.log('Per ORCHESTRATION.md: stop and escalate rather than starting a third.');
		console.log(`  node scripts/task.mjs state ${t.id} escalated --note "..."`);
	}
	if (to === 'escalated') {
		console.log('\nStop working this task. Move to the next one and let the product owner adjudicate.');
	}
}

// -------------------------------------------------------------- start / finish

function cmdStart(doc, id, force) {
	const t = findTask(doc, id);
	const rec = requireState(t.id);

	const active = doc.tasks.filter((x) => x.id !== t.id && ACTIVE.has(stateOf(x.id)));
	if (active.length && !force) {
		console.error(`Refused: ${active.map((x) => `${x.id} (${stateOf(x.id)})`).join(', ')} still open.`);
		console.error('One task at a time. Finish or park that one first (--force overrides).');
		process.exit(1);
	}
	if (!['ready', 'changes-requested', 'escalated'].includes(rec.state)) {
		console.error(`Refused: ${t.id} is "${rec.state}"; start expects ready/changes-requested/escalated.`);
		process.exit(1);
	}
	const unmet = (t.deps ?? []).filter((d) => !DONE.has(stateOf(d)));
	if (unmet.length && !force) {
		console.error(`Refused: deps not merged into ${INTEGRATION_BRANCH}: ${unmet.join(', ')}`);
		console.error('That is a DAG violation. --force only if you know exactly why.');
		process.exit(1);
	}
	const dirty = git(['status', '--porcelain']);
	if (dirty && !force) {
		console.error('Refused: the working tree is dirty. Commit, stash or clean it first:');
		console.error(dirty.split('\n').slice(0, 10).join('\n'));
		process.exit(1);
	}

	if (branchExists(t.branch)) {
		git(['checkout', t.branch]);
		console.log(`Resumed existing branch ${t.branch}`);
	} else {
		git(['checkout', INTEGRATION_BRANCH]);
		git(['checkout', '-b', t.branch]);
		console.log(`Created ${t.branch} from ${INTEGRATION_BRANCH}`);
	}

	if (rec.state !== 'in-progress') {
		const from = rec.state;
		rec.state = 'in-progress';
		rec.note = `started on ${t.branch}`;
		pushHistory(rec, 'in-progress', `from ${from}`);
		writeState(rec);
	}

	console.log(`\n${t.id}  ${t.title}`);
	console.log(`  spec     : node scripts/task.mjs show ${t.id}`);
	console.log(`  dev      : npm run dev --workspace=app -- --port ${doc.devPort}`);
	console.log(`  gates    : node scripts/task.mjs gates [--quiet|--json]`);
	console.log(`  worklog  : node scripts/task.mjs log ${t.id}`);
	console.log('\nWhen the DoD is met and the gates are green:');
	console.log(`  node scripts/task.mjs state ${t.id} awaiting-approval --note "..."`);
	console.log('Then merge it yourself (automerge) - never with a red gate or an unverified DoD item.');
	console.log('\nStop the dev server before you finish. No orphan processes.');
}

function cmdFinish(doc, id, force) {
	const t = findTask(doc, id);
	const rec = requireState(t.id);

	const merged = (gitTry(['branch', '--merged', INTEGRATION_BRANCH]) ?? '')
		.split('\n')
		.map((l) => l.replace('*', '').trim())
		.includes(t.branch);

	if (!merged && !force) {
		console.error(`Refused: ${t.branch} is not merged into ${INTEGRATION_BRANCH}.`);
		console.error('`finish` is the post-merge cleanup step. Merge first, then run it.');
		process.exit(1);
	}

	const current = gitTry(['rev-parse', '--abbrev-ref', 'HEAD']);
	if (current === t.branch) git(['checkout', INTEGRATION_BRANCH]);
	if (branchExists(t.branch)) {
		git(['branch', '-d', t.branch]);
		console.log(`Deleted merged branch ${t.branch}`);
	}
	const remoteRef = gitTry(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${t.branch}`]);
	if (remoteRef) {
		// Under automerge nobody reads a printed reminder, so do it: a merged
		// remote branch left behind is exactly the zombie `doctor` hunts for.
		if (gitTry(['push', 'origin', '--delete', t.branch]) !== null) {
			console.log(`Deleted merged remote branch origin/${t.branch}`);
		} else {
			console.log(`Could not delete origin/${t.branch} - do it by hand:  git push origin --delete ${t.branch}`);
		}
	}

	if (rec.state === 'awaiting-approval') {
		rec.state = 'integrated';
		rec.mergedAt = new Date().toISOString();
		rec.note = `merged into ${INTEGRATION_BRANCH}`;
		pushHistory(rec, 'integrated', 'merged');
		writeState(rec);
		console.log(`${t.id}: awaiting-approval -> integrated`);
	}

	// Unblock whatever this just made startable.
	const unblocked = [];
	for (const other of doc.tasks) {
		if (stateOf(other.id) !== 'backlog') continue;
		if ((other.deps ?? []).every((d) => DONE.has(stateOf(d)))) {
			const r = requireState(other.id);
			r.state = 'ready';
			r.note = `deps satisfied by ${t.id}`;
			pushHistory(r, 'ready', `unblocked by ${t.id}`);
			writeState(r);
			unblocked.push(other.id);
		}
	}
	if (unblocked.length) console.log(`Now ready: ${unblocked.join(', ')}`);

	console.log('\nTICK THE LEDGER: mark ' + t.id + ' done in docs/REMEDIATION_PLAN.md\'s progress table.');
	console.log('That table is what the product owner reads; the state files are not committed.');
	console.log('\nThen: node scripts/task.mjs doctor && node scripts/task.mjs next');
}

// -------------------------------------------------------------------- log

// The worklog. With one agent there is no handoff to a reviewer - this exists so
// the PRODUCT OWNER can see what they are approving, and so a restarted session
// can pick up where it left off.
function cmdLog(doc, id, runGates) {
	const t = findTask(doc, id);
	const rec = requireState(t.id);
	const range = `${INTEGRATION_BRANCH}...${t.branch}`;
	const missing = `(branch "${t.branch}" not found - commit it first)`;
	const stat = gitTry(['diff', '--stat', range]) ?? missing;
	const commits = gitTry(['log', '--oneline', `${INTEGRATION_BRANCH}..${t.branch}`]) ?? missing;

	let gatesBlock = '_not run by this log - run `node scripts/task.mjs gates` and paste_';
	if (runGates) {
		const res = runGateSet(true);
		gatesBlock =
			(res.ok ? 'ALL FOUR GATES PASS.' : `FAILED at "${res.failedGate}".`) +
			'\n\n```json\n' +
			JSON.stringify(res, null, 2) +
			'\n```';
	}

	const md = [
		`# ${t.id} — ${t.title}`,
		'',
		`- branch: \`${t.branch}\` (off \`${INTEGRATION_BRANCH}\`)`,
		`- release: ${t.release} · wave ${t.wave} · ${t.effort} · ${t.priority ?? '-'}`,
		`- state: ${rec.state}${rec.attempts ? ` (attempt ${rec.attempts + 1})` : ''}`,
		`- closes: ${(t.review_refs ?? []).join(', ') || '—'}`,
		'',
		'## What to look at',
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
		'## Notes for the product owner',
		'',
		'_What was verified by hand and how; anything deliberately left alone;',
		'anything spotted but out of scope (report it, do not fix it)._',
		''
	].join('\n');

	mkdirSync(LOG_DIR, { recursive: true });
	const out = path.join(LOG_DIR, `${t.id}.md`);
	writeFileSync(out, md);
	console.log(md);
	console.log(`\nWritten to ${out}`);
}

// ------------------------------------------------------------------- doctor

// "Let us make sure that we have no zombies." Orphan worktrees, stray branches,
// dev servers nobody stopped, state files for tasks that no longer exist.
function cmdDoctor(doc, fix) {
	const problems = [];
	const note = (msg, cmd) => problems.push({ msg, cmd });

	// 1. worktrees: the loop itself uses none - but another session may (the
	// product owner runs a separate planning session in its own worktree). So a
	// worktree is REPORTED, never removed, even with --fix: `git worktree remove
	// --force` would destroy someone's uncommitted work. Only prune the
	// bookkeeping of worktrees whose directory is already gone.
	const wtList = gitTry(['worktree', 'list', '--porcelain']) ?? '';
	const worktrees = [];
	for (const block of wtList.split(/\r?\n\r?\n/)) {
		const wtPath = /^worktree (.+)$/m.exec(block)?.[1]?.trim();
		if (!wtPath || path.resolve(wtPath) === path.resolve(REPO_ROOT)) continue;
		const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1]?.trim() ?? '(detached)';
		worktrees.push({ wtPath, branch });
	}
	for (const { wtPath, branch } of worktrees) {
		const exists = existsSync(wtPath);
		const dirty = exists
			? (spawnSync('git', ['status', '--porcelain'], { cwd: wtPath, encoding: 'utf8' }).stdout ??
					'').trim() !== ''
			: false;
		note(
			`git worktree ${wtPath} on ${branch}${exists ? (dirty ? ' - HAS UNCOMMITTED CHANGES' : '') : ' - directory missing'} (not removed: may be another session's live work)`,
			exists ? `only if you are sure it is abandoned: git worktree remove "${wtPath}"` : 'git worktree prune'
		);
	}
	if (fix) spawnSync('git', ['worktree', 'prune'], { cwd: REPO_ROOT }); // missing directories only

	const wtRoot = path.resolve(REPO_ROOT, '..', 'geoclick-wt');
	if (existsSync(wtRoot)) {
		note(
			`leftover worktree directory from the old parallel design: ${wtRoot}`,
			`remove it once \`git worktree list\` shows only the main checkout`
		);
	}

	// 2. stale agent branches from earlier runs
	const allBranches = (gitTry(['for-each-ref', '--format=%(refname:short)', 'refs/heads']) ?? '')
		.split('\n')
		.filter(Boolean);
	for (const b of allBranches.filter((b) => b.startsWith('worktree-agent-'))) {
		note(`stale agent branch: ${b}`, `git branch -D ${b}`);
		if (fix) {
			spawnSync('git', ['branch', '-D', b], { cwd: REPO_ROOT });
			console.log(`  deleted ${b}`);
		}
	}

	// 3. task branches already merged but never cleaned up
	const currentBranch = gitTry(['rev-parse', '--abbrev-ref', 'HEAD']);
	const mergedBranches = (gitTry(['branch', '--merged', INTEGRATION_BRANCH]) ?? '')
		.split('\n')
		.map((l) => l.replace('*', '').trim())
		// Never suggest deleting main, or the branch you are standing on.
		.filter((b) => b && b !== INTEGRATION_BRANCH && b !== currentBranch);
	const taskBranches = new Set(doc.tasks.map((t) => t.branch));
	for (const b of mergedBranches.filter((b) => taskBranches.has(b))) {
		note(`merged task branch not deleted: ${b}`, `git branch -d ${b}`);
		if (fix) {
			spawnSync('git', ['branch', '-d', b], { cwd: REPO_ROOT });
			console.log(`  deleted merged ${b}`);
		}
	}

	// 3b. old merged feature branches. Reported, never auto-deleted: some are
	// history the product owner may still want (deploy/*, the parked SSO branch).
	const otherMerged = mergedBranches.filter(
		(b) => !taskBranches.has(b) && !b.startsWith('worktree-agent-')
	);
	if (otherMerged.length) {
		note(
			`${otherMerged.length} old branch(es) already merged into ${INTEGRATION_BRANCH}: ${otherMerged.join(', ')}`,
			`git branch -d ${otherMerged.join(' ')}   (your call - these are history, not zombies of this programme)`
		);
	}

	// 4. state/branch disagreement
	for (const t of doc.tasks) {
		const s = stateOf(t.id);
		if (ACTIVE.has(s) && !branchExists(t.branch)) {
			note(`${t.id} is "${s}" but ${t.branch} does not exist`, `node scripts/task.mjs state ${t.id} ready --note "branch lost"`);
		}
		if (DONE.has(s) && branchExists(t.branch)) {
			note(`${t.id} is "${s}" but ${t.branch} still exists`, `node scripts/task.mjs finish ${t.id}`);
		}
	}

	// 5. more than one task in flight
	const active = doc.tasks.filter((t) => ACTIVE.has(stateOf(t.id)));
	if (active.length > doc.concurrency) {
		note(
			`${active.length} tasks active (${active.map((t) => t.id).join(', ')}), concurrency is ${doc.concurrency}`,
			'park all but one: node scripts/task.mjs state <id> ready --note "parked"'
		);
	}

	// 6. junk in the state dir
	if (existsSync(STATE_DIR)) {
		const known = new Set(doc.tasks.map((t) => `${t.id}.json`));
		for (const f of readdirSync(STATE_DIR)) {
			if (f.endsWith('.tmp')) {
				note(`interrupted state write: ${f}`, 'safe to delete');
				if (fix) rmSync(path.join(STATE_DIR, f));
			} else if (!known.has(f)) {
				note(`state file for an unknown task: ${f}`, 'safe to delete');
				if (fix) rmSync(path.join(STATE_DIR, f));
			}
		}
	}

	// 7. dev servers nobody stopped. Reported, never killed automatically -
	// the product owner's own server may be one of them.
	const strays = listeningPorts();
	for (const { port, pid } of strays) {
		note(
			`something is listening on port ${port} (pid ${pid})` +
				(port === 5173 ? ' - probably the product owner\'s own dev server, leave it' : ''),
			port === 5173 ? 'leave it alone' : `taskkill /PID ${pid} /F   (check it is yours first)`
		);
	}

	if (!problems.length) {
		console.log('No zombies. Worktrees clean, branches clean, state consistent, no stray servers.');
		return;
	}
	console.log(`${problems.length} thing(s) to look at:\n`);
	for (const p of problems) {
		console.log(`  - ${p.msg}`);
		if (p.cmd) console.log(`      ${p.cmd}`);
	}
	if (!fix) console.log('\nRe-run with --fix to clean up worktrees, stale branches and state junk.');
	else console.log('\n--fix does not kill processes; do that yourself after checking what they are.');
}

function listeningPorts() {
	const out = [];
	const res =
		process.platform === 'win32'
			? spawnSync('netstat', ['-ano'], { encoding: 'utf8' })
			: spawnSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' });
	if (res.status !== 0 || !res.stdout) return out;
	for (const line of res.stdout.split('\n')) {
		const m =
			process.platform === 'win32'
				? line.match(/\s\S*?:(\d+)\s+\S+\s+LISTENING\s+(\d+)/)
				: line.match(/:(\d+)\s+\(LISTEN\)/);
		if (!m) continue;
		const port = Number(m[1]);
		if (port < PORT_SWEEP[0] || port > PORT_SWEEP[1]) continue;
		const pid = process.platform === 'win32' ? m[2] : (line.split(/\s+/)[1] ?? '?');
		if (!out.some((o) => o.port === port)) out.push({ port, pid });
	}
	return out;
}

// ------------------------------------------------------------------- gates

// `quiet` pipes each gate's output instead of streaming it. The four gates
// together emit ~100 KB, most of it the names of 683 passing tests, which
// buries the one line that matters when something fails. Piped output is held
// in memory and only the tail of a FAILING gate is ever printed.
function runGateSet(quiet, tailChars = 4000) {
	const results = [];
	let failed = null;
	for (const gate of GATES) {
		if (!quiet) console.log(`\n=== gate: ${gate.name} (npm ${gate.argv.join(' ')}) ===`);
		const started = Date.now();
		// Always the repo root, never process.cwd(): run from app/, `npm run test`
		// would only test the app workspace and silently skip packages/*.
		const res = spawnSync('npm', gate.argv, {
			cwd: REPO_ROOT,
			stdio: quiet ? 'pipe' : 'inherit',
			shell: process.platform === 'win32',
			encoding: 'utf8',
			// --json captures output in memory; the build gate is chatty.
			maxBuffer: 64 * 1024 * 1024
		});
		const ok = res.status === 0;
		if (quiet) process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${gate.name}\n`);
		results.push({
			gate: gate.name,
			command: `npm ${gate.argv.join(' ')}`,
			ok,
			exitCode: res.status,
			...(res.signal ? { signal: res.signal } : {}),
			...(res.error ? { error: res.error.message } : {}),
			ms: Date.now() - started,
			...(quiet && !ok
				? { output: `${res.stdout ?? ''}${res.stderr ?? ''}`.slice(-tailChars) }
				: {})
		});
		if (!ok) {
			failed = gate.name;
			break; // stop at the first failure
		}
	}
	return { ok: !failed, failedGate: failed, cwd: REPO_ROOT, results };
}

function cmdGates(asJson, quiet = false) {
	// Three modes: --json pipes and prints a machine-readable verdict, --quiet
	// pipes and prints a human summary, and the default streams everything.
	const verdict = runGateSet(asJson || quiet, quiet ? 12000 : 4000);
	if (asJson) {
		console.log(JSON.stringify(verdict, null, 2));
	} else {
		if (quiet && verdict.failedGate) {
			const failed = verdict.results.at(-1);
			console.log(`\n--- ${verdict.failedGate} output (tail) ---`);
			console.log(failed?.output?.trimEnd() ?? '(no output captured)');
		}
		console.log('\n--- summary ---');
		for (const r of verdict.results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.gate}  (${r.ms}ms)`);
		if (verdict.failedGate) {
			const failed = verdict.results.at(-1);
			if (failed?.error) console.log(`\n${failed.gate}: could not run - ${failed.error}`);
			console.log(`\nGATES FAILED at "${verdict.failedGate}". Later gates were not run.`);
			if (verdict.failedGate === 'lint') {
				console.log('Formatting? `npm run format` fixes Prettier failures. Every file at once?');
				console.log('Check line endings first - see ONBOARDING.md, "The fifth variant".');
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

if (cmd === 'gates') cmdGates(rest.includes('--json'), rest.includes('--quiet')); // needs no tasks.yaml

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
		cmdState(doc, rest[0], rest[1], { note: flag(rest, '--note') });
		break;
	case 'start':
		cmdStart(doc, rest[0], rest.includes('--force'));
		break;
	case 'finish':
		cmdFinish(doc, rest[0], rest.includes('--force'));
		break;
	case 'log':
		cmdLog(doc, rest[0], !rest.includes('--no-gates'));
		break;
	case 'doctor':
		cmdDoctor(doc, rest.includes('--fix'));
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
