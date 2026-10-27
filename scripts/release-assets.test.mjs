import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	releaseAssets,
	html5Assets,
	verifyReleaseChecksums,
	verifyHtml5Provenance
} from './release-assets.mjs';
const version = '1.0.0';
const commit = 'a'.repeat(40);
const sha = (value) => createHash('sha256').update(value).digest('hex');
function fixture(t) {
	const dir = mkdtempSync(path.join(tmpdir(), 'geoclick-release-assets-'));
	t.after(() => {
		assert.equal(path.dirname(dir), path.resolve(tmpdir()));
		assert.match(path.basename(dir), /^geoclick-release-assets-/);
		assert.equal(lstatSync(dir).isSymbolicLink(), false);
		rmSync(dir, { recursive: true, force: true });
	});
	const [archive, sidecar, reportName] = html5Assets(version);
	for (const name of releaseAssets(version)) writeFileSync(path.join(dir, name), name);
	const digest = sha(readFileSync(path.join(dir, archive)));
	writeFileSync(path.join(dir, sidecar), `${digest}  ${archive}\n`);
	const report = {
		version,
		commit,
		archive,
		sha256: digest,
		draft: false,
		dirty: false,
		verifiedTag: true,
		authoredCoverageVerified: true
	};
	const saveReport = () => writeFileSync(path.join(dir, reportName), JSON.stringify(report));
	saveReport();
	const sums = releaseAssets(version).map(
		(name) => `${sha(readFileSync(path.join(dir, name)))}  ${name}`
	);
	writeFileSync(path.join(dir, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
	return { dir, archive, sidecar, report, saveReport, sums };
}
test('stable and prerelease upload lists include the browser ZIP, report and sidecar', () => {
	assert.equal(releaseAssets(version).length, 6);
	assert.ok(releaseAssets(version).includes('Geoclick-1.0.0-windows-x64.msi'));
	const beta = releaseAssets('1.0.0-beta.1');
	assert.equal(beta.length, 5);
	assert.ok(beta.includes('Geoclick-1.0.0-beta.1-html5.zip'));
	assert.equal(
		beta.some((name) => name.endsWith('.msi')),
		false
	);
});
test('complete matching checksums and exact tagged HTML5 provenance pass', (t) => {
	const { dir } = fixture(t);
	verifyReleaseChecksums(dir, version);
	verifyHtml5Provenance(dir, version, commit);
});
test('omitted, duplicate, unexpected and traversal checksum entries are rejected', (t) => {
	const { dir, sums } = fixture(t);
	for (const rows of [
		sums.slice(1),
		[...sums, sums[0]],
		[...sums, `${'a'.repeat(64)}  other.zip`],
		[`${'a'.repeat(64)}  ../outside`, ...sums]
	]) {
		writeFileSync(path.join(dir, 'SHA256SUMS.txt'), rows.join('\n'));
		assert.throws(
			() => verifyReleaseChecksums(dir, version),
			/Missing release checksums|Unexpected, duplicate or malformed/
		);
	}
});
test('tampered HTML5 archive, checksum sidecar and report are rejected', (t) => {
	const { dir, archive, sidecar, report, saveReport } = fixture(t);
	writeFileSync(path.join(dir, archive), 'tampered');
	assert.throws(() => verifyReleaseChecksums(dir, version), /does not match/);
	assert.throws(() => verifyHtml5Provenance(dir, version, commit), /does not match/);
	writeFileSync(path.join(dir, archive), archive);
	writeFileSync(path.join(dir, sidecar), 'wrong');
	assert.throws(() => verifyHtml5Provenance(dir, version, commit), /does not match/);
	writeFileSync(path.join(dir, sidecar), `${report.sha256}  ${archive}\n`);
	report.sha256 = 'a'.repeat(64);
	saveReport();
	assert.throws(() => verifyHtml5Provenance(dir, version, commit), /does not match/);
});
test('draft, dirty, wrong commit/version and unverified coverage cannot be published', (t) => {
	const { dir, report, saveReport } = fixture(t);
	for (const [key, value] of [
		['draft', true],
		['dirty', true],
		['authoredCoverageVerified', false],
		['version', '0.20.0'],
		['commit', 'b'.repeat(40)]
	]) {
		const original = report[key];
		report[key] = value;
		saveReport();
		assert.throws(() => verifyHtml5Provenance(dir, version, commit), /does not match|draft, dirty/);
		report[key] = original;
	}
});
test('clean candidate packages require an explicit allowance and still cannot publish', (t) => {
	const { dir, report, saveReport } = fixture(t);
	report.verifiedTag = false;
	saveReport();
	assert.throws(() => verifyHtml5Provenance(dir, version, commit), /verified version tag/);
	verifyHtml5Provenance(dir, version, commit, { allowUntagged: true });
	report.draft = true;
	saveReport();
	assert.throws(
		() => verifyHtml5Provenance(dir, version, commit, { allowUntagged: true }),
		/draft, dirty/
	);
});
