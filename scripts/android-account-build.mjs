// Build the production Android game with external public Firebase configuration.
import {
	readFileSync,
	readdirSync,
	realpathSync,
	copyFileSync,
	mkdirSync,
	writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { loadEnv } from 'vite';
const root = fileURLToPath(new URL('..', import.meta.url));
const options = new Map();
for (let i = 2; i < process.argv.length; i++) {
	const key = process.argv[i];
	if (key === '--check') {
		options.set(key, true);
		continue;
	}
	if (
		!['--google-services-file', '--firebase-env-file', '--signing-properties-file'].includes(key) ||
		!process.argv[i + 1]
	)
		throw Error(
			'Provide external --google-services-file, --firebase-env-file and --signing-properties-file paths; optionally --check.'
		);
	options.set(key, process.argv[++i]);
}
function external(option) {
	if (!options.has(option)) throw Error('Missing ' + option);
	const file = realpathSync(options.get(option));
	const main = path.dirname(
		execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
			cwd: root,
			encoding: 'utf8'
		}).trim()
	);
	for (const parent of [root, main]) {
		const rel = path.relative(parent, file);
		// Existing main-checkout signing properties are supported; Firebase inputs stay external.
		if (
			(!rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))) &&
			option !== '--signing-properties-file'
		)
			throw Error('Keep Firebase configuration outside every checkout.');
	}
	return file;
}
const source = external('--google-services-file'),
	envFile = external('--firebase-env-file'),
	signing = external('--signing-properties-file');
let android, configuration;
try {
	android = JSON.parse(readFileSync(source, 'utf8').replace(/^\uFEFF/, ''));
	configuration = JSON.parse(
		loadEnv('production', path.dirname(envFile), 'VITE_FIREBASE_').VITE_FIREBASE_CONFIG
	);
} catch {
	throw Error('Could not parse the external public Firebase configuration.');
}
if (
	path.basename(envFile) !== '.env.local' ||
	!['projectId', 'apiKey', 'authDomain', 'appId'].every(
		(key) => typeof configuration[key] === 'string' && configuration[key]
	)
)
	throw Error('Invalid public Firebase configuration.');
const clients = (android.client ?? []).filter(
	(client) => client.client_info?.android_client_info?.package_name === 'com.geoclick.mobile'
);
if (
	android.project_info?.project_id !== configuration.projectId ||
	clients.length !== 1 ||
	!clients[0].client_info?.mobilesdk_app_id ||
	!clients[0].api_key?.some((key) => typeof key.current_key === 'string' && key.current_key) ||
	!clients[0].oauth_client?.some(
		(client) => client.client_type === 3 && typeof client.client_id === 'string'
	)
)
	throw Error(
		'Android configuration must match the web project, com.geoclick.mobile and a Google web OAuth client.'
	);
if (options.has('--check')) {
	console.log(
		'Android/public configuration matches; external signing file exists. No files copied.'
	);
	process.exit(0);
}
if (process.platform !== 'win32' || !process.env.npm_execpath)
	throw Error('Run this Windows build helper through npm run build:android-account.');
copyFileSync(source, path.join(root, 'mobile/android/app/google-services.json'));
const env = {
	...process.env,
	VITE_FIREBASE_CONFIG: JSON.stringify(configuration),
	GEOCLICK_ANDROID_SIGNING_PROPERTIES: signing
};
const logs = path.join(root, 'rendered/android-account');
mkdirSync(logs, { recursive: true });
function run(name, command, args, cwd = root) {
	const result = spawnSync(command, args, {
		cwd,
		env,
		encoding: 'utf8',
		windowsHide: true,
		maxBuffer: 16 * 1024 * 1024
	});
	writeFileSync(
		path.join(logs, name + '.log'),
		(result.stdout ?? '') + (result.stderr ?? ''),
		'utf8'
	);
	if (result.error || result.status !== 0)
		throw Error(name + ' failed; see rendered/android-account/' + name + '.log.');
	console.log(name + ' PASS');
}
run('web-build', process.execPath, [process.env.npm_execpath, 'run', 'build', '--workspace=app']);
run('capacitor-sync', process.execPath, [
	process.env.npm_execpath,
	'exec',
	'--workspace=mobile',
	'--',
	'cap',
	'sync',
	'android'
]);
run(
	'signed-apk',
	process.env.ComSpec ?? 'cmd.exe',
	['/d', '/s', '/c', 'gradlew.bat :app:assembleRelease --console=plain'],
	path.join(root, 'mobile/android')
);
console.log(
	'APK: ' + path.join(root, 'mobile/android/app/build/outputs/apk/release/app-release.apk')
);
console.log('Build only. No device install or deploy was triggered.');
const sdk =
	process.env.ANDROID_HOME ??
	process.env.ANDROID_SDK_ROOT ??
	path.join(process.env.LOCALAPPDATA ?? '', 'Android/Sdk');
const toolVersions = readdirSync(path.join(sdk, 'build-tools'))
	.filter((name) => /^\d+\.\d+\.\d+$/.test(name))
	.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const signer = path.join(sdk, 'build-tools', toolVersions.at(-1) ?? '', 'lib/apksigner.jar');
const verification = spawnSync(
	path.join(process.env.JAVA_HOME ?? '', 'bin/java.exe'),
	[
		'-jar',
		signer,
		'verify',
		'--print-certs',
		path.join(root, 'mobile/android/app/build/outputs/apk/release/app-release.apk')
	],
	{ encoding: 'utf8', windowsHide: true }
);
if (
	verification.status !== 0 ||
	!/certificate SHA-1 digest:\s*445a7de73d75a352b8f87ba158317053bf7571fb/i.test(
		verification.stdout ?? ''
	)
)
	throw Error('APK must be signed with the registered Geoclick release certificate.');
console.log('Release certificate verification PASS');
