// Builds the installers for a tagged release into dist-release/vX.Y.Z/ (FT-07).
// Local only - no CI (FEATURE_PLAN.md, decision 2).
//
//   node scripts/package-release.mjs                  # HEAD must be at vX.Y.Z
//   node scripts/package-release.mjs --allow-untagged # dry run on any clean commit
//
// Produces Geoclick-X.Y.Z-windows-x64.msi, -windows-x64-setup.exe and
// -android.apk (release-signed), plus SHA256SUMS.txt. Publishing them is a
// separate, deliberate step - see docs/RELEASES.md.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOW_UNTAGGED = process.argv.includes('--allow-untagged');
const WIN = process.platform === 'win32';
const version = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const tag = `v${version}`;
const outDir = path.join(ROOT, 'dist-release', tag);

const fail = (msg) => {
	console.error(`\npackage-release: ${msg}`);
	process.exit(1);
};
// Only npm and .bat files need a shell on Windows. Everything else runs
// without one, because cmd.exe would eat the ^ in `git rev-parse v1.2.3^{commit}`.
const run = (cmd, args, opts = {}) =>
	spawnSync(cmd, args, {
		cwd: ROOT,
		encoding: 'utf8',
		shell: WIN && (cmd === 'npm' || /\.(bat|cmd)$/i.test(cmd)),
		...opts
	});
const step = (label, cmd, args, opts = {}) => {
	console.log(`\n=== ${label} ===`);
	const res = run(cmd, args, { stdio: 'inherit', ...opts });
	if (res.status !== 0) fail(`${label} failed (exit ${res.status}).`);
};

// --- preconditions: what is being packaged ---
if (run('git', ['status', '--porcelain']).stdout.trim())
	fail('the working tree has uncommitted changes. Package from a clean checkout of the tag.');
const head = run('git', ['rev-parse', 'HEAD']).stdout.trim();
const tagged = run('git', ['rev-parse', '--verify', '--quiet', `${tag}^{commit}`]).stdout.trim();
if (!ALLOW_UNTAGGED && tagged !== head)
	fail(
		tagged
			? `HEAD is not at ${tag}. Check out the tag first (git checkout ${tag}).`
			: `tag ${tag} does not exist. Tag the release first (docs/RELEASES.md), or use --allow-untagged for a dry run.`
	);
if (run('node', ['scripts/sync-version.mjs', '--check']).status !== 0)
	fail('version drift between the shells - run node scripts/sync-version.mjs --check.');

// --- preconditions: toolchains and the signing key ---
if (run('cargo', ['--version']).status !== 0)
	fail('Rust (cargo) not found - the desktop build needs it. See README.md, desktop.');

const sdk =
	process.env.ANDROID_HOME ||
	process.env.ANDROID_SDK_ROOT ||
	(WIN ? path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : path.join(os.homedir(), 'Android', 'Sdk'));
if (!existsSync(path.join(sdk, 'platform-tools')))
	fail(`Android SDK not found (looked in ${sdk}). Install Android Studio or set ANDROID_HOME.`);

// Gradle 8.14 needs a JDK <= 24: JAVA_HOME if set, else Android Studio's cached JDK.
const jdksDir = path.join(os.homedir(), '.jdks');
const javaHome =
	process.env.JAVA_HOME ||
	(existsSync(jdksDir)
		? readdirSync(jdksDir)
				.filter((d) => /-(1[7-9]|2[0-4])[.\d]*$/.test(d))
				.map((d) => path.join(jdksDir, d))
				.sort()
				.pop()
		: undefined);
if (!javaHome) fail('no JDK 17-24 found. Set JAVA_HOME (ONBOARDING.md, "Gradle JDK gotcha").');

const keystoreProps = path.join(ROOT, 'mobile', 'android', 'keystore.properties');
if (!existsSync(keystoreProps) && !process.env.GEOCLICK_KEYSTORE_FILE)
	fail(
		'no Android signing key configured - mobile/android/keystore.properties is missing and ' +
			'GEOCLICK_KEYSTORE_FILE is not set. See ONBOARDING.md, "Release (signed) APK".'
	);

// --- builds ---
const bundle = path.join(ROOT, 'desktop', 'src-tauri', 'target', 'release', 'bundle');
const apkDir = path.join(ROOT, 'mobile', 'android', 'app', 'build', 'outputs', 'apk', 'release');
// A signed APK left over from an earlier build must never be mistaken for this one.
rmSync(apkDir, { recursive: true, force: true });
step('desktop (tauri build: web app + .msi + -setup.exe)', 'npm', ['run', 'build', '--workspace=desktop']);
step('android: copy the web build in (cap sync)', 'npm', ['run', 'sync'], { cwd: path.join(ROOT, 'mobile') });
const androidDir = path.join(ROOT, 'mobile', 'android');
step('android: release APK', path.join(androidDir, WIN ? 'gradlew.bat' : 'gradlew'), ['assembleRelease'], {
	cwd: androidDir,
	env: { ...process.env, JAVA_HOME: javaHome }
});

// --- collect ---
if (existsSync(path.join(apkDir, 'app-release-unsigned.apk')))
	fail('Gradle produced an unsigned APK - check keystore.properties / the GEOCLICK_* variables.');
const artefacts = [
	[path.join(bundle, 'msi', `Geoclick_${version}_x64_en-US.msi`), `Geoclick-${version}-windows-x64.msi`],
	[path.join(bundle, 'nsis', `Geoclick_${version}_x64-setup.exe`), `Geoclick-${version}-windows-x64-setup.exe`],
	[path.join(apkDir, 'app-release.apk'), `Geoclick-${version}-android.apk`]
];
for (const [from] of artefacts) if (!existsSync(from)) fail(`expected build output missing: ${from}`);

// Refuse to ship an APK whose signature doesn't verify.
const buildTools = path.join(sdk, 'build-tools');
const apksigner = existsSync(buildTools)
	? readdirSync(buildTools)
			.sort()
			.map((v) => path.join(buildTools, v, WIN ? 'apksigner.bat' : 'apksigner'))
			.filter(existsSync)
			.pop()
	: undefined;
let signer = '(not checked: apksigner not found)';
if (apksigner) {
	const res = run(apksigner, ['verify', '--print-certs', artefacts[2][0]], { env: { ...process.env, JAVA_HOME: javaHome } });
	if (res.status !== 0) fail(`the APK does not verify:\n${res.stdout}${res.stderr}`);
	signer = /certificate DN: (.*)/.exec(res.stdout)?.[1] ?? 'verified';
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const sums = [];
for (const [from, name] of artefacts) {
	const to = path.join(outDir, name);
	copyFileSync(from, to);
	sums.push(`${createHash('sha256').update(readFileSync(to)).digest('hex')}  ${name}`);
}
writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), sums.join('\n') + '\n');

console.log(`\nPackaged ${tag}${tagged === head ? '' : ` (UNTAGGED dry run at ${head.slice(0, 7)})`} -> ${path.relative(ROOT, outDir)}`);
for (const [, name] of artefacts) {
	const mb = (statSync(path.join(outDir, name)).size / 1024 / 1024).toFixed(1);
	console.log(`  ${name.padEnd(42)} ${mb.padStart(6)} MB`);
}
console.log(`  SHA256SUMS.txt`);
console.log(`APK signed by: ${signer}`);
console.log('Unsigned Windows installers - SmartScreen will warn "unknown publisher" (see FEATURE_PLAN.md, out of scope).');
