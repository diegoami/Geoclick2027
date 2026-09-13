#!/usr/bin/env node
// Creates the GitHub labels, milestones and issues for the remediation
// programme from docs/tasks.yaml.
//
//   node scripts/seed-forge.mjs            # DRY RUN - prints every gh command
//   node scripts/seed-forge.mjs --apply    # actually creates them
//   node scripts/seed-forge.mjs --apply --only GC-010,GC-020
//
// Idempotent: label/milestone creation tolerates "already exists", and an
// issue whose title already starts with the task id is skipped.
//
// This script is deliberately NOT run by the review/planning session. Creating
// issues is a side-effectful act on the user's GitHub account; the product
// owner runs it when they are ready to start the programme.

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doc = parse(readFileSync(path.join(REPO_ROOT, 'docs', 'tasks.yaml'), 'utf8'));

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx === -1 ? null : new Set((argv[onlyIdx + 1] ?? '').split(',').map((s) => s.trim().toUpperCase()));

const LABELS = [
	['type:fix', 'd73a4a', 'Corrects incorrect behaviour'],
	['type:feat', '0e8a16', 'Adds capability'],
	['type:perf', '1d76db', 'Performance only'],
	['type:refactor', '5319e7', 'Behaviour-preserving restructure'],
	['type:chore', 'c5def5', 'Tooling, build, housekeeping'],
	['type:docs', '0075ca', 'Documentation only'],
	['area:quiz', 'fbca04', 'QuizView / quiz-engine'],
	['area:srs', 'fbca04', 'packages/srs scheduler'],
	['area:storage', 'fbca04', 'ProgressRepository and backends'],
	['area:data', 'fbca04', 'Map data and build pipeline'],
	['area:ui', 'fbca04', 'Views, styling, popups'],
	['area:app', 'fbca04', 'SvelteKit app shell and routing'],
	['area:i18n', 'fbca04', 'Translations and locale'],
	['area:a11y', 'fbca04', 'Accessibility'],
	['area:testing', 'fbca04', 'Test harness and coverage'],
	['area:tooling', 'fbca04', 'Lint, gates, scripts'],
	['wave:0', 'ededed', 'Must land alone'],
	['wave:1', 'ededed', 'Parallel wave 1'],
	['wave:2', 'ededed', 'Parallel wave 2'],
	['wave:3', 'ededed', 'Parallel wave 3'],
	['wave:4', 'ededed', 'Parallel wave 4'],
	['priority:must-fix', 'b60205', 'Real defect, not a nicety'],
	['state:backlog', 'ffffff', 'Dependencies unmet'],
	['state:ready', 'ffffff', 'Dependencies met, may be leased'],
	['state:leased', 'ffffff', 'Worktree and branch allocated'],
	['state:in-progress', 'ffffff', 'Implementer working'],
	['state:in-review', 'ffffff', 'Draft PR open, review requested'],
	['state:changes-requested', 'ffffff', 'Reviewer asked for changes'],
	['state:approved', 'ffffff', 'Reviewer approved'],
	['state:integrated', 'ffffff', 'Merged into the release branch'],
	['state:released', 'ffffff', 'Shipped to main and tagged'],
	['state:blocked', 'ffffff', 'Cannot proceed; see comments'],
	['state:escalated', 'ffffff', 'Two review rounds disagreed; human owns it']
];

function run(args, { tolerate = [] } = {}) {
	if (!APPLY) {
		console.log(`gh ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
		return '';
	}
	const res = spawnSync('gh', args, { cwd: REPO_ROOT, encoding: 'utf8' });
	const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
	if (res.status !== 0) {
		if (tolerate.some((t) => out.includes(t))) {
			console.log(`  (already exists, skipped)`);
			return '';
		}
		console.error(`gh ${args.join(' ')}\n${out}`);
		process.exit(1);
	}
	return out.trim();
}

function issueBody(task) {
	const deps = (task.deps ?? []).length ? task.deps.join(', ') : 'none';
	return [
		`**Task \`${task.id}\`** — from the 2026-09-13 independent code review.`,
		'',
		`| | |`,
		`|---|---|`,
		`| Engine | \`${task.engine}\` |`,
		`| Effort | ${task.effort} |`,
		`| Release | ${task.release} |`,
		`| Branch | \`${task.branch}\` |`,
		`| Depends on | ${deps} |`,
		`| Machine needs | ${(task.needs ?? []).join(', ') || 'any (node + npm + gh)'} |`,
		`| Closes findings | ${(task.review_refs ?? []).join(', ')} |`,
		`| Files | ${(task.files ?? []).map((f) => `\`${f}\``).join(', ')} |`,
		'',
		'## Description',
		'',
		task.description.trimEnd(),
		'',
		'## Definition of done',
		'',
		...task.dod.map((d) => `- [ ] ${d}`),
		'',
		'## Quality gate',
		'',
		'```',
		...doc.meta.gates,
		'```',
		'',
		`Baseline: ${doc.meta.gates_baseline}`,
		'',
		'## Process',
		'',
		'- Work in the worktree from `node scripts/task.mjs lease ' + task.id + '`.',
		'- One branch, one task. Never merge to `main`. Never trigger a deploy.',
		'- Open a **draft PR against the release branch**, not `main`.',
		'- End every commit with the attribution trailer (see `docs/tasks.yaml` → `meta`).',
		'- Full context: `docs/REMEDIATION_PLAN.md`, `docs/ORCHESTRATION.md`.'
	].join('\n');
}

// ---------------------------------------------------------------------------

console.log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to execute) ===\n');

console.log('\n--- labels ---');
for (const [name, color, desc] of LABELS) {
	run(['label', 'create', name, '--color', color, '--description', desc], {
		tolerate: ['already exists']
	});
}

console.log('\n--- milestones ---');
for (const r of doc.releases) {
	// gh has no `milestone create`; use the REST API.
	run(
		[
			'api',
			'repos/{owner}/{repo}/milestones',
			'-f', `title=${r.version}`,
			'-f', `description=${r.theme} — ${r.tasks.length} tasks. See docs/RELEASES.md.`
		],
		{ tolerate: ['already_exists'] }
	);
}

console.log('\n--- issues ---');
let existingTitles = [];
if (APPLY) {
	const raw = execFileSync('gh', ['issue', 'list', '--limit', '300', '--state', 'all', '--json', 'title'], {
		cwd: REPO_ROOT,
		encoding: 'utf8'
	});
	existingTitles = JSON.parse(raw).map((i) => i.title);
}

for (const task of doc.tasks) {
	if (ONLY && !ONLY.has(task.id)) continue;
	const title = `${task.id}: ${task.title}`;
	if (existingTitles.some((t) => t.startsWith(`${task.id}:`))) {
		console.log(`  skip ${task.id} (issue already exists)`);
		continue;
	}
	const state = (task.deps ?? []).length ? 'state:backlog' : 'state:ready';
	const args = [
		'issue', 'create',
		'--title', title,
		'--body', issueBody(task),
		'--milestone', task.release
	];
	for (const l of [...(task.labels ?? []), state]) args.push('--label', l);
	run(args);
}

console.log('\n--- done ---');
if (!APPLY) {
	console.log('Nothing was created. Re-run with --apply when you are ready.');
	console.log(`Would create: ${LABELS.length} labels, ${doc.releases.length} milestones, ` +
		`${doc.tasks.filter((t) => !ONLY || ONLY.has(t.id)).length} issues.`);
} else {
	console.log('Next: create the release branches, then start the orchestrator.');
	for (const r of doc.releases) console.log(`  git branch ${r.branch} main`);
}
