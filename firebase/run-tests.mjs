import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18110');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:19110');
const root = fileURLToPath(new URL('..', import.meta.url));
for (const run of [
	{
		args: ['--import', 'tsx', '--test', '--test-reporter=dot', 'firebase/progress-sync.test.ts'],
		cwd: root
	},
	{
		args: [
			path.join(root, 'node_modules/vitest/vitest.mjs'),
			'--run',
			'src/lib/firestoreProgressTransport.browser.test.ts',
			'--reporter=dot'
		],
		cwd: path.join(root, 'app')
	}
]) {
	const result = spawnSync(process.execPath, run.args, {
		cwd: run.cwd,
		stdio: 'inherit',
		env: { ...process.env, VITE_GEOCLICK_SYNC_EMULATORS: '1' }
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
