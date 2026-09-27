// Publishes a packaged release's installers to the public releases-only repo
// (FT-08). Public and outward-facing, so: product owner's OK first, every time
// (docs/RELEASES.md, "Build and publish the installers").
//
//   node scripts/publish-release.mjs            # dry run: checks + shows what it would do
//   node scripts/publish-release.mjs --confirm  # actually creates the GitHub Release
//
// Needs dist-release/vX.Y.Z/ from scripts/package-release.mjs, and `gh` logged in
// with access to the releases repo.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASES_REPO = 'diegoami/geoclick-releases';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIRM = process.argv.includes('--confirm');
const version = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const tag = `v${version}`;
// alpha / beta: published as a GitHub pre-release, never "latest", so the
// website's download link keeps pointing at the last stable release
// (docs/RELEASES.md, "Pre-releases"). No .msi for pre-releases.
const stage = /-(alpha|beta)\.\d+$/.exec(version)?.[1];
const dir = path.join(ROOT, 'dist-release', tag);
const files = [
	`Geoclick-${version}-windows-x64-setup.exe`,
	...(stage ? [] : [`Geoclick-${version}-windows-x64.msi`]),
	`Geoclick-${version}-android.apk`,
	'SHA256SUMS.txt'
];

const fail = (msg) => {
	console.error(`\npublish-release: ${msg}`);
	process.exit(1);
};

// --- the packaged files, intact ---
for (const f of files)
	if (!existsSync(path.join(dir, f)))
		fail(`missing ${path.relative(ROOT, path.join(dir, f))} - run node scripts/package-release.mjs first.`);
for (const line of readFileSync(path.join(dir, 'SHA256SUMS.txt'), 'utf8').trim().split('\n')) {
	const [hash, name] = line.split(/\s+/);
	const actual = createHash('sha256').update(readFileSync(path.join(dir, name))).digest('hex');
	if (actual !== hash) fail(`${name} does not match SHA256SUMS.txt - repackage.`);
}

// --- the tagged commit the release is built from (AGENTS.md, Releases) ---
const git = (a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
const tagged = git(['rev-parse', '--verify', '--quiet', `${tag}^{commit}`]).stdout.trim();
if (!tagged) fail(`there is no ${tag} tag here - tag the commit first, then package from it.`);
if (git(['rev-parse', 'HEAD']).stdout.trim() !== tagged)
	fail(`HEAD is not ${tag} (${tagged.slice(0, 7)}) - check out the tag the release was packaged from.`);

// --- notes: the player-facing part of this version's CHANGELOG entry ---
// A beta is built from a milestone candidate, which already carries its
// `## vX.Y.Z — …` entry (docs/RELEASES.md, "The milestone"); an alpha has no
// entry of its own yet and uses "## Unreleased".
const changelog = readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const stableHeading = `## v${version.replace(/-(alpha|beta)\.\d+$/, '')} `;
const heading =
	!stage || changelog.includes(`\n${stableHeading}`) ? stableHeading : '## Unreleased';
const start = changelog.indexOf(heading);
if (start < 0) fail(`CHANGELOG.md has no "${heading.trim()}" entry yet - write it first.`);
const next = changelog.indexOf('\n## ', start + 1);
const entry = changelog.slice(start, next < 0 ? undefined : next);
// Public readers get the bold lead sentence and the "For players:" bullets -
// not the rest of the lead paragraph or "Under the hood:", which name internal
// docs and task ids from this (private) repo.
const lead = /\*\*[^*]+\*\*/.exec(entry)?.[0] ?? '';
const forPlayers = /\nFor players:\n([\s\S]*?)(?=\n(?:Under the hood|Not covered)[^\n]*:\n|$)/.exec(entry)?.[1];
if (!forPlayers) fail(`the "${heading.trim()}" CHANGELOG entry has no "For players:" section to publish.`);
const playerPart = `${lead}\n\n${forPlayers.trim()}`;
const banner = {
	alpha:
		'> ⚠️ **Alpha pre-release: a preview for testing.** It contains work that is not finished yet and has only had the developer\'s checks. Things may break. For everyday use, take the [latest stable release](https://github.com/diegoami/geoclick-releases/releases/latest). Your progress is kept when you later install a stable version over it.\n\n',
	beta: '> ⚠️ **Beta pre-release: a release candidate.** Everything for this version is in and has passed the developer\'s checks, but it is still being tested before it becomes the stable release. For everyday use, take the [latest stable release](https://github.com/diegoami/geoclick-releases/releases/latest). Your progress is kept when you later install the stable version over it.\n\n'
};
const notes =
	(stage ? banner[stage] : '') +
	`${playerPart}\n\n---\n\n` +
	`Built from commit \`${tagged}\` (tag \`${tag}\`).\n\n` +
	`**Play in the browser:** https://geoclick.netlify.app/\n\n` +
	`Windows: run the \`-setup.exe\` (SmartScreen warns about an unknown publisher: *More info → Run anyway*). ` +
	`Android: open the \`.apk\` on your phone and allow installing unknown apps. ` +
	`Details and checksums: see the [README](https://github.com/${RELEASES_REPO}#download).\n`;
const notesFile = path.join(os.tmpdir(), `geoclick-${tag}-notes.md`);
writeFileSync(notesFile, notes);

const args = [
	'release', 'create', tag,
	'--repo', RELEASES_REPO,
	'--title', stage ? `Geoclick ${version} (${stage})` : `Geoclick ${version}`,
	'--notes-file', notesFile,
	...(stage ? ['--prerelease'] : ['--latest']),
	...files.map((f) => path.join(dir, f))
];

// gh is a real executable - no shell, so nothing in the notes path is reinterpreted.
const gh = (a) => spawnSync('gh', a, { encoding: 'utf8' });
if (gh(['--version']).status !== 0) fail('GitHub CLI (gh) not found.');
if (gh(['repo', 'view', RELEASES_REPO, '--json', 'visibility']).status !== 0)
	fail(`cannot see ${RELEASES_REPO} - does it exist, and is gh logged in?`);
if (gh(['release', 'view', tag, '--repo', RELEASES_REPO]).status === 0)
	fail(`${RELEASES_REPO} already has a ${tag} release. Delete it on GitHub first if it must be replaced.`);

console.log(`Release notes (${notesFile}):\n\n${notes}`);
console.log(`Files:\n${files.map((f) => `  ${f}`).join('\n')}`);
if (!CONFIRM) {
	console.log(`\nDry run - nothing published. With the product owner's OK:\n  node scripts/publish-release.mjs --confirm`);
	process.exit(0);
}
const res = spawnSync('gh', args, { stdio: 'inherit' });
if (res.status !== 0) fail('gh release create failed.');
console.log(`\nPublished: https://github.com/${RELEASES_REPO}/releases/tag/${tag}`);
