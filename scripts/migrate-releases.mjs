// Copy historical downloads into the public source repository.
// Dry run by default. --backup-only downloads without changing GitHub.
// --confirm copies missing releases/assets; --verify-only checks every byte.
// Retirement is a separate owner-approved step after link updates have landed.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SOURCE = 'diegoami/geoclick-releases';
export const DESTINATION = 'diegoami/Geoclick2027';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function safeName(name) {
	if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
		throw new Error('Unsafe release tag or asset filename: ' + JSON.stringify(name));
	return name;
}

export function sha256(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

export function migratedBody(release, discrepancies = []) {
	const body = (release.body ?? '').replaceAll(SOURCE, DESTINATION);
	// GitHub does not accept created_at/published_at when creating releases.
	// Keep the original timestamp explicitly, and in the unmodified backup.
	const warning = discrepancies.length
		? "\n\n**Historical checksum discrepancy:** the original SHA256SUMS.txt is preserved verbatim but does not match the following original assets. Their downloaded bytes match GitHub's source asset digests. Verified SHA-256 values:\n\n" +
			discrepancies.map((d) => '- ' + d.name + ': ' + d.actual).join('\n')
		: '';
	return (
		body +
		warning +
		'\n\n---\nOriginally published: ' +
		(release.published_at ?? 'unpublished draft') +
		'. Migrated to this repository.\n'
	);
}

export function checksums(text) {
	const result = new Map();
	for (const line of text.trim().split(/\r?\n/)) {
		const match = /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line);
		if (!match) throw new Error('Invalid SHA256SUMS.txt line');
		const name = safeName(match[2]);
		if (result.has(name)) throw new Error('Duplicate checksum: ' + name);
		result.set(name, match[1].toLowerCase());
	}
	return result;
}

export function checkBytes(asset, bytes, sums) {
	if (bytes.length !== asset.size) throw new Error('Wrong size: ' + asset.name);
	const actual = sha256(bytes);
	if (asset.digest && asset.digest !== 'sha256:' + actual)
		throw new Error('GitHub digest mismatch: ' + asset.name);
	if (sums?.has(asset.name) && sums.get(asset.name) !== actual)
		throw new Error('Checksum mismatch: ' + asset.name);
	return actual;
}

export function verifyMetadata(source, destination, discrepancies = []) {
	for (const key of ['tag_name', 'name', 'draft', 'prerelease'])
		if (source[key] !== destination[key])
			throw new Error('Metadata mismatch: ' + source.tag_name + ' / ' + key);
	if (destination.body !== migratedBody(source, discrepancies))
		throw new Error('Release notes differ: ' + source.tag_name);
	const expected = source.assets.map((a) => a.name).sort();
	const actual = destination.assets.map((a) => a.name).sort();
	if (JSON.stringify(expected) !== JSON.stringify(actual))
		throw new Error('Asset inventory differs: ' + source.tag_name);
}

export function auditChecksums(assets, load, sums, preserveStale = false) {
	const hashes = {},
		discrepancies = [];
	for (const asset of assets) {
		const bytes = load(asset.name);
		const actual = checkBytes(asset, bytes);
		if (asset.name !== 'SHA256SUMS.txt' && !sums.has(asset.name))
			throw new Error('Asset has no source checksum: ' + asset.name);
		if (sums.has(asset.name) && sums.get(asset.name) !== actual) {
			if (!preserveStale || asset.digest !== 'sha256:' + actual)
				throw new Error(
					'Checksum mismatch: ' +
						asset.name +
						'; preserve only with a matching GitHub digest and --preserve-stale-checksums'
				);
			discrepancies.push({ name: asset.name, published: sums.get(asset.name), actual });
		}
		hashes[asset.name] = actual;
	}
	return { hashes, discrepancies };
}

function gh(args, binary = false) {
	const result = spawnSync('gh', args, {
		cwd: ROOT,
		encoding: binary ? undefined : 'utf8',
		maxBuffer: 512 * 1024 * 1024
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error('gh ' + args.slice(0, 3).join(' ') + ': ' + String(result.stderr).slice(-1500));
	return result.stdout;
}
const api = (endpoint) => JSON.parse(gh(['api', endpoint]));
const releases = (repo) =>
	JSON.parse(
		gh(['api', '--paginate', '--slurp', 'repos/' + repo + '/releases?per_page=100'])
	).flat();
const releaseAt = (repo, tag) => api('repos/' + repo + '/releases/tags/' + encodeURIComponent(tag));
const download = (repo, asset) =>
	gh(
		[
			'api',
			'repos/' + repo + '/releases/assets/' + asset.id,
			'-H',
			'Accept: application/octet-stream'
		],
		true
	);
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

export async function main(argv = process.argv.slice(2)) {
	const modes = ['--confirm', '--backup-only', '--verify-only'].filter((flag) =>
		argv.includes(flag)
	);
	if (modes.length > 1)
		throw new Error('Choose only one of --confirm, --backup-only, --verify-only');
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--backup-dir') {
			if (!argv[++i]) throw new Error('--backup-dir needs a path');
		} else if (
			!['--confirm', '--backup-only', '--verify-only', '--preserve-stale-checksums'].includes(
				argv[i]
			)
		)
			throw new Error('Unknown option: ' + argv[i]);
	}
	const mode = modes[0];
	const preserveStale = argv.includes('--preserve-stale-checksums');
	const backupIndex = argv.indexOf('--backup-dir');
	const backup = path.resolve(
		backupIndex < 0 ? path.join(ROOT, 'dist-release', 'migration-backup') : argv[backupIndex + 1]
	);
	const source = releases(SOURCE);
	if (!source.length)
		throw new Error('Source inventory is empty; refusing to call this a successful migration');
	const destination = releases(DESTINATION);
	const sourceTags = new Set();
	for (const release of source) {
		safeName(release.tag_name);
		if (sourceTags.has(release.tag_name)) throw new Error('Duplicate source tag');
		sourceTags.add(release.tag_name);
		const names = new Set();
		for (const asset of release.assets) {
			safeName(asset.name);
			if (names.has(asset.name)) throw new Error('Duplicate source asset');
			names.add(asset.name);
		}
		// All releases must use the existing canonical source tag, never a tag
		// GitHub creates against today's default branch during migration.
		const local = spawnSync(
			'git',
			['rev-parse', '--verify', 'refs/tags/' + release.tag_name + '^{commit}'],
			{ cwd: ROOT, encoding: 'utf8' }
		);
		if (local.status !== 0) throw new Error('Fetch the missing canonical tag: ' + release.tag_name);
		const remote = api(
			'repos/' + DESTINATION + '/commits/' + encodeURIComponent(release.tag_name)
		).sha;
		if (local.stdout.trim() !== remote)
			throw new Error('Canonical tag differs locally and on GitHub: ' + release.tag_name);
	}
	const latest = api('repos/' + SOURCE + '/releases/latest').tag_name;
	console.log(
		source.length +
			' releases, ' +
			source.reduce((n, r) => n + r.assets.length, 0) +
			' assets, ' +
			(source.reduce((n, r) => n + r.assets.reduce((s, a) => s + a.size, 0), 0) / 1e9).toFixed(2) +
			' GB; latest ' +
			latest
	);
	console.log('Destination currently has ' + destination.length + ' releases. Backup: ' + backup);
	if (!mode) {
		console.log('Dry run; no files downloaded or GitHub changes made.');
		return;
	}

	mkdirSync(backup, { recursive: true });
	const inventoryPath = path.join(backup, 'source-releases.json');
	if (existsSync(inventoryPath)) {
		const previous = JSON.parse(readFileSync(inventoryPath, 'utf8'));
		// Download counters change during copying; the archived identity must not.
		const identity = (rows) =>
			rows.map((r) => [
				r.id,
				r.tag_name,
				r.name,
				r.body,
				r.draft,
				r.prerelease,
				r.published_at,
				r.assets.map((a) => [a.id, a.name, a.size, a.digest])
			]);
		if (JSON.stringify(identity(previous)) !== JSON.stringify(identity(source)))
			throw new Error(
				'Source changed since backup; retain this backup and choose a new --backup-dir'
			);
	} else save(inventoryPath, source);
	const repoPath = path.join(backup, 'source-repository.json');
	if (!existsSync(repoPath)) save(repoPath, api('repos/' + SOURCE));
	const report = {
		source: SOURCE,
		destination: DESTINATION,
		latest,
		releases: [],
		verifiedAt: null
	};
	for (const release of [...source].reverse()) {
		const tag = release.tag_name;
		const dir = path.join(backup, tag);
		mkdirSync(dir, { recursive: true });
		for (const asset of release.assets) {
			const file = path.join(dir, asset.name);
			if (!existsSync(file)) {
				if (mode === '--verify-only') throw new Error('Missing backup asset: ' + file);
				const bytes = download(SOURCE, asset);
				checkBytes(asset, bytes);
				writeFileSync(file, bytes, { flag: 'wx' });
			}
			checkBytes(asset, readFileSync(file));
		}
		const checksumAsset = release.assets.find((a) => a.name === 'SHA256SUMS.txt');
		if (!checksumAsset) throw new Error('Missing source SHA256SUMS.txt: ' + tag);
		const sums = checksums(readFileSync(path.join(dir, checksumAsset.name), 'utf8'));
		for (const name of sums.keys())
			if (!release.assets.some((a) => a.name === name))
				throw new Error('Checksum names a missing source asset: ' + name);
		const { hashes, discrepancies } = auditChecksums(
			release.assets,
			(name) => readFileSync(path.join(dir, name)),
			sums,
			mode === '--backup-only' || preserveStale
		);
		if (discrepancies.length)
			console.log('Historical checksum discrepancies in ' + tag + ': ' + discrepancies.length);
		if (mode === '--backup-only') {
			report.releases.push({ tag, hashes, discrepancies });
			save(path.join(backup, 'backup-verification.json'), report);
			console.log('Backed up ' + tag);
			continue;
		}
		let copied = destination.find((r) => r.tag_name === tag);
		if (!copied && mode === '--verify-only') throw new Error('Missing destination release: ' + tag);
		if (!copied) {
			const notes = path.join(dir, 'migrated-notes.md');
			writeFileSync(notes, migratedBody(release, discrepancies));
			gh([
				'release',
				'create',
				tag,
				'--repo',
				DESTINATION,
				'--verify-tag',
				'--title',
				release.name ?? '',
				'--notes-file',
				notes,
				'--latest=false',
				...(release.prerelease ? ['--prerelease'] : []),
				...(release.draft ? ['--draft'] : [])
			]);
			copied = releaseAt(DESTINATION, tag);
		}
		// Never overwrite or delete an existing release or asset. Resuming only
		// uploads missing assets after checking the release's identity.
		if (
			copied.body !== migratedBody(release, discrepancies) ||
			copied.name !== release.name ||
			copied.draft !== release.draft ||
			copied.prerelease !== release.prerelease
		)
			throw new Error('Existing destination metadata conflicts: ' + tag);
		for (const asset of release.assets) {
			if (!copied.assets.some((a) => a.name === asset.name)) {
				if (mode === '--verify-only') throw new Error('Missing destination asset: ' + asset.name);
				gh(['release', 'upload', tag, path.join(dir, asset.name), '--repo', DESTINATION]);
			}
		}
		copied = releaseAt(DESTINATION, tag);
		verifyMetadata(release, copied, discrepancies);
		for (const asset of copied.assets) {
			const hash = checkBytes(asset, download(DESTINATION, asset));
			if (hash !== hashes[asset.name])
				throw new Error('Copied bytes differ: ' + tag + '/' + asset.name);
		}
		report.releases.push({
			tag,
			canonicalCommit: api('repos/' + DESTINATION + '/commits/' + encodeURIComponent(tag)).sha,
			hashes,
			discrepancies
		});
		save(path.join(backup, 'verification.json'), report);
		console.log('Verified ' + tag);
	}
	if (mode === '--backup-only') {
		console.log('Backup complete. GitHub was not changed.');
		return;
	}
	// Do not steal latest from a new release published after this migration began.
	const refreshed = releases(DESTINATION);
	const unexpected = refreshed.filter(
		(r) => !sourceTags.has(r.tag_name) && !r.prerelease && !r.draft
	);
	if (mode === '--confirm' && !unexpected.length)
		gh(['release', 'edit', latest, '--repo', DESTINATION, '--latest']);
	if (!unexpected.length && api('repos/' + DESTINATION + '/releases/latest').tag_name !== latest)
		throw new Error('Latest release does not match source');
	report.verifiedAt = new Date().toISOString();
	save(path.join(backup, 'verification.json'), report);
	console.log('Verified all historical releases and their bytes. Old repository remains intact.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
	main().catch((error) => {
		console.error('migrate-releases: ' + error.message);
		process.exitCode = 1;
	});
