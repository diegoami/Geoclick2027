import test from 'node:test';
import assert from 'node:assert/strict';
import {
	safeName,
	sha256,
	checksums,
	auditChecksums,
	checkBytes,
	migratedBody,
	verifyMetadata
} from './migrate-releases.mjs';

const bytes = Buffer.from('original installer');
const hash = sha256(bytes);
const asset = { name: 'Geoclick-0.20.0-android.apk', size: bytes.length, digest: 'sha256:' + hash };
const original = {
	tag_name: 'v0.20.0',
	name: 'Geoclick 0.20.0',
	draft: false,
	prerelease: false,
	published_at: '2026-10-16T17:45:42Z',
	body: 'Download https://github.com/diegoami/geoclick-releases/releases/latest',
	assets: [asset]
};

test('unsafe asset names cannot escape the backup or become download glob patterns', () => {
	for (const value of [
		'../asset.exe',
		'a/b',
		'a\\b',
		'a*',
		'a?',
		'a[0]',
		'--help',
		'',
		'.',
		'..',
		'a\nb'
	])
		assert.throws(() => safeName(value));
	assert.equal(safeName(asset.name), asset.name);
	assert.equal(safeName('v0.14.0-beta.1'), 'v0.14.0-beta.1');
});
test('original checksums detect bytes changed without changing file length', () => {
	const sums = checksums(hash + '  ' + asset.name + '\r\n');
	assert.equal(checkBytes(asset, bytes, sums), hash);
	const corrupted = Buffer.from(bytes);
	corrupted[0] ^= 1;
	assert.throws(() => checkBytes({ ...asset, digest: null }, corrupted, sums), /Checksum mismatch/);
	assert.throws(() => checkBytes(asset, corrupted), /digest mismatch/);
	assert.throws(() => checkBytes(asset, Buffer.from('short')), /Wrong size/);
});
test('checksum filenames and duplicates are checked before reading files', () => {
	assert.throws(() => checksums(hash + '  ../installer.exe'), /Unsafe/);
	assert.throws(() => checksums(hash + '  app.apk\n' + hash + '  app.apk'), /Duplicate/);
	assert.throws(() => checksums('not a checksum'), /Invalid/);
	assert.equal(checksums(hash + ' *app.apk').get('app.apk'), hash);
});
test('copied notes retain provenance and replace old download URLs', () => {
	const body = migratedBody(original);
	assert.ok(body.includes('diegoami/Geoclick2027/releases/latest'));
	assert.ok(body.includes(original.published_at));
	assert.ok(!body.includes('diegoami/geoclick-releases'));
	assert.ok(
		migratedBody({ ...original, body: null, published_at: null }).includes('unpublished draft')
	);
});
test('a resumable copy refuses missing, extra, or conflicting release metadata', () => {
	const copy = { ...original, body: migratedBody(original) };
	assert.doesNotThrow(() => verifyMetadata(original, copy));
	for (const patch of [
		{ assets: [] },
		{ assets: [asset, { ...asset, name: 'extra.exe' }] },
		{ prerelease: true },
		{ draft: true },
		{ tag_name: 'v0.19.0' },
		{ name: 'other' },
		{ body: 'changed' }
	])
		assert.throws(() => verifyMetadata(original, { ...copy, ...patch }));
});

test('stale historical checksums require explicit preservation and a matching GitHub digest', () => {
	const sums = new Map([[asset.name, '0'.repeat(64)]]);
	assert.throws(() => auditChecksums([asset], () => bytes, sums), /Checksum mismatch/);
	assert.throws(
		() => auditChecksums([{ ...asset, digest: null }], () => bytes, sums, true),
		/Checksum mismatch/
	);
	const result = auditChecksums([asset], () => bytes, sums, true);
	assert.equal(result.discrepancies.length, 1);
	assert.equal(result.hashes[asset.name], hash);
	assert.ok(migratedBody(original, result.discrepancies).includes(hash));
	assert.ok(migratedBody(original, result.discrepancies).includes('preserved verbatim'));
	assert.doesNotThrow(() =>
		verifyMetadata(
			original,
			{ ...original, body: migratedBody(original, result.discrepancies) },
			result.discrepancies
		)
	);
});
