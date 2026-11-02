// Isolated interactive Windows account test. Never uses the production app ID.
import { readFileSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { loadEnv } from 'vite';
const root = fileURLToPath(new URL('..', import.meta.url));
const options = new Map();
for (let i = 2; i < process.argv.length; i++) {
	const key = process.argv[i];
	if (key === '--check') {
		options.set(key, true);
		continue;
	}
	if (!['--client-file', '--firebase-env-file', '--port'].includes(key) || !process.argv[i + 1])
		throw new Error(
			'Use --client-file <external Desktop JSON> --firebase-env-file <public .env.local> [--port 5197] [--check].'
		);
	options.set(key, process.argv[++i]);
}
if (process.platform !== 'win32') throw new Error('This interactive account test is for Windows.');
if (!options.has('--client-file') || !options.has('--firebase-env-file'))
	throw new Error('Provide external Desktop client JSON and public Firebase env paths.');
const client = realpathSync(options.get('--client-file')),
	envFile = realpathSync(options.get('--firebase-env-file'));
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
	cwd: root,
	encoding: 'utf8'
}).trim();
const main = path.dirname(common);
function inside(parent, target) {
	const relative = path.relative(parent, target);
	return (
		relative === '' ||
		(!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
	);
}
if (inside(root, client) || inside(main, client))
	throw new Error('Keep the downloaded OAuth JSON outside the repository/worktree.');
if (path.basename(envFile) !== '.env.local')
	throw new Error('The public config file must be named .env.local.');
let desktop, configuration;
try {
	desktop = JSON.parse(readFileSync(client, 'utf8'));
	configuration = JSON.parse(
		loadEnv('development', path.dirname(envFile), 'VITE_FIREBASE_').VITE_FIREBASE_CONFIG
	);
} catch {
	throw new Error('Could not parse the external account configuration.');
}
if (
	!desktop.installed ||
	typeof desktop.installed.client_id !== 'string' ||
	!desktop.installed.client_id.endsWith('.apps.googleusercontent.com') ||
	desktop.installed.project_id !== configuration.projectId ||
	!['apiKey', 'authDomain', 'projectId', 'appId'].every(
		(key) => typeof configuration[key] === 'string' && configuration[key]
	)
)
	throw new Error('Desktop and public Firebase configurations must match.');
const port = Number(options.get('--port') ?? 5197);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.');
const identifier = 'com.geoclick.windows-account-test',
	title = 'Geoclick Windows Account Test',
	url = `http://localhost:${port}`;
const directory = path.join(root, 'rendered', 'windows-account');
mkdirSync(directory, { recursive: true });
const overlay = path.join(directory, 'tauri-test.json');
writeFileSync(
	overlay,
	JSON.stringify(
		{
			identifier,
			productName: title,
			build: { devUrl: url },
			app: {
				windows: [
					{ label: 'main', title, width: 1280, height: 800, minWidth: 1024, minHeight: 640 }
				]
			}
		},
		null,
		2
	) + '\n',
	'utf8'
);
if (options.get('--check')) {
	console.log('Account configurations match; isolated Windows app identifier: ' + identifier);
	process.exit(0);
}
const environment = {
	...process.env,
	VITE_FIREBASE_CONFIG: JSON.stringify(configuration),
	GEOCLICK_GOOGLE_DESKTOP_CLIENT_FILE: client
};
for (const script of ['scripts/prepare-assets.mjs', 'scripts/build-manual.mjs']) {
	const result = spawnSync(process.execPath, [script], {
		cwd: path.join(root, 'app'),
		env: environment,
		stdio: 'ignore'
	});
	if (result.status !== 0) throw new Error('Could not prepare the local game assets.');
}
const vite = spawn(
	process.execPath,
	[path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port)],
	{ cwd: path.join(root, 'app'), env: environment, stdio: 'inherit', windowsHide: true }
);
let cli;
let ending = false;
function stop(child) {
	if (!child?.pid || child.exitCode !== null) return;
	spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
		stdio: 'ignore',
		windowsHide: true
	});
}
function finish(code) {
	if (ending) return;
	ending = true;
	stop(cli);
	stop(vite);
	process.exit(code);
}
process.on('SIGINT', () => finish(0));
process.on('SIGTERM', () => finish(0));
vite.on('error', () => finish(1));
vite.on('exit', (code) => {
	if (!ending) finish(code ?? 1);
});
let ready = false;
for (let attempt = 0; attempt < 40; attempt++) {
	try {
		const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) });
		if (response.ok) {
			ready = true;
			break;
		}
	} catch {}
	await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!ready) {
	finish(1);
} else {
	console.log('Open the ' + title + ' desktop window; Google will open in the system browser.');
	cli = spawn(
		process.execPath,
		[
			path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'),
			'dev',
			'--config',
			overlay,
			'--no-watch'
		],
		{ cwd: path.join(root, 'desktop'), env: environment, stdio: 'inherit', windowsHide: true }
	);
	cli.on('error', () => finish(1));
	cli.on('exit', (code) => finish(code ?? 1));
}
