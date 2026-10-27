import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const html5Assets = (version) => [
	`Geoclick-${version}-html5.zip`,
	`Geoclick-${version}-html5.zip.sha256`,
	'html5-report.json'
];

export function releaseAssets(version) {
	const prerelease = /-(alpha|beta)\.\d+$/.test(version);
	return [
		`Geoclick-${version}-windows-x64-setup.exe`,
		...(prerelease ? [] : [`Geoclick-${version}-windows-x64.msi`]),
		`Geoclick-${version}-android.apk`,
		...html5Assets(version)
	];
}

const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

// Check an exact allowlist: a truncated checksum list must not omit an upload.
export function verifyReleaseChecksums(dir, version) {
	const expected = new Set(releaseAssets(version));
	const lines = readFileSync(path.join(dir, 'SHA256SUMS.txt'), 'utf8').trim().split(/\r?\n/);
	for (const line of lines) {
		const match = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9.-]*)$/.exec(line);
		if (!match || !expected.delete(match[2]))
			throw new Error('Unexpected, duplicate or malformed checksum entry: ' + line);
		if (digest(path.join(dir, match[2])) !== match[1])
			throw new Error(match[2] + ' does not match SHA256SUMS.txt - repackage.');
	}
	if (expected.size) throw new Error('Missing release checksums: ' + [...expected].join(', '));
}

export function verifyHtml5Provenance(dir, version, commit, { allowUntagged = false } = {}) {
	const [archive, sidecar, reportName] = html5Assets(version);
	const report = JSON.parse(readFileSync(path.join(dir, reportName), 'utf8'));
	if (report.version !== version || report.commit !== commit || report.archive !== archive)
		throw new Error('HTML5 export does not match the release version and commit - repackage.');
	if (report.draft !== false || report.dirty !== false || report.authoredCoverageVerified !== true)
		throw new Error(
			'HTML5 export is a draft, dirty or missing verified authored coverage - repackage.'
		);
	if (report.verifiedTag !== true && !(allowUntagged && report.verifiedTag === false))
		throw new Error('HTML5 export was not built from the verified version tag - repackage.');
	const actual = digest(path.join(dir, archive));
	if (
		report.sha256 !== actual ||
		readFileSync(path.join(dir, sidecar), 'utf8').trim() !== `${actual}  ${archive}`
	)
		throw new Error('HTML5 archive does not match its report and checksum sidecar - repackage.');
	return report;
}
