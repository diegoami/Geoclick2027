// Portable static export: hash routing, folder-relative assets and one JSON bundle per map.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareHtml5Routes } from './prepare-html5.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (data) => createHash('sha256').update(data).digest('hex');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function portableHtml(text) {
	return text
		.replace(/(["'])\/_app\//g, '$1./_app/')
		.replace(/(src=["'])\/(manual\/(?:img|images)\/)/g, '$1$2');
}
export function planHtml5Files(root, build, stage, provenance) {
	root = path.resolve(root);
	build = path.resolve(build);
	stage = path.resolve(stage);
	mkdirSync(stage, { recursive: true });
	const canonical = json(path.join(root, 'data/maps/index.json'));
	const index = json(path.join(build, 'maps/index.json'));
	const ids = index.map((row) => row.id);
	if (
		new Set(ids).size !== ids.length ||
		JSON.stringify([...ids].sort()) !== JSON.stringify(canonical.map((row) => row.id).sort())
	)
		throw new Error('Built catalogue differs from canonical map IDs');
	const entries = [];
	const paths = new Set();
	function add(name, source) {
		if (name.startsWith('/') || name.split('/').some((p) => p === '..' || !p) || paths.has(name))
			throw new Error('Invalid/duplicate ZIP entry: ' + name);
		if (name.length > 240) throw new Error('ZIP entry path exceeds portability budget: ' + name);
		paths.add(name);
		entries.push({ path: name, source });
	}
	function generated(name, text) {
		const output = path.join(stage, ...name.split('/'));
		mkdirSync(path.dirname(output), { recursive: true });
		writeFileSync(output, text);
		add(name, output);
	}
	function walk(dir, relative = '') {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name.startsWith('.')) continue;
			const name = relative ? relative + '/' + entry.name : entry.name;
			if (name === 'maps') continue;
			const source = path.join(dir, entry.name);
			if (entry.isSymbolicLink()) throw new Error('Unexpected link in build output: ' + name);
			if (entry.isDirectory()) {
				walk(source, name);
				continue;
			}
			if (
				name === '_redirects' ||
				name === 'robots.txt' ||
				(name.endsWith('.html') &&
					!['index.html', 'manual/en.html', 'manual/de.html', 'manual/it.html'].includes(name))
			)
				continue;
			if (name.endsWith('.html')) generated(name, portableHtml(readFileSync(source, 'utf8')));
			else add(name, source);
		}
	}
	walk(build);
	if (!paths.has('index.html')) throw new Error('HTML5 entry index.html missing');
	add('maps/index.json', path.join(build, 'maps/index.json'));
	for (const id of ids) {
		if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id) || id === 'world-picker')
			throw new Error('Unsafe map ID: ' + id);
		const dir = path.join(build, 'maps', id);
		const bundle = {
			map: json(path.join(dir, 'map.json')),
			facts: json(path.join(dir, 'facts.json')),
			tour: json(path.join(dir, 'tour.json'))
		};
		if (
			bundle.map.id !== id ||
			bundle.tour.mapId !== id ||
			!bundle.facts ||
			typeof bundle.facts !== 'object'
		)
			throw new Error('Map bundle identity mismatch: ' + id);
		generated('maps/' + id + '/bundle.json', JSON.stringify(bundle));
		for (const file of ['tiles.pmtiles', 'terrain.pmtiles'])
			add('maps/' + id + '/' + file, path.join(dir, file));
	}
	// The country selector is not a playable map and has its own two-file format.
	for (const file of ['picker.json', 'tiles.pmtiles'])
		add('maps/world-picker/' + file, path.join(build, 'maps/world-picker', file));
	if (existsSync(path.join(root, 'LICENSE'))) add('LICENSE.txt', path.join(root, 'LICENSE'));
	generated(
		'README-upload.txt',
		`Geoclick ${provenance.version}\n\nUpload this ZIP as an HTML5 browser game with index.html as entry.\nRecommended frame: 1280 x 800; fullscreen stays player-controlled.\nFor local testing, extract and serve this directory over HTTP with byte-range support.\nOpening index.html directly as a file is not supported.\n\nSource: https://github.com/diegoami/Geoclick2027\nListing: https://diegoami.itch.io/geoclick\n\n${provenance.draft ? 'DRAFT: development export; not a published release.\n' : ''}`
	);
	for (const entry of entries) {
		const data = readFileSync(entry.source);
		entry.bytes = data.length;
		entry.sha256 = sha(data);
	}
	const manifest = {
		...provenance,
		entry: 'index.html',
		routing: 'hash',
		recommendedFrame: { width: 1280, height: 800 },
		mapCount: ids.length,
		files: entries.map(({ source, ...row }) => row)
	};
	generated('html5-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
	if (entries.length > 1000)
		throw new Error('HTML5 export exceeds the 1000-file portability budget: ' + entries.length);
	return { entries, manifest };
}
function run(command, args, options = {}) {
	const npmCli =
		process.env.npm_execpath ??
		path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
	const directNpm = command === 'npm' && existsSync(npmCli);
	const result = spawnSync(
		directNpm ? process.execPath : command,
		directNpm ? [npmCli, ...args] : args,
		{
			cwd: ROOT,
			encoding: 'utf8',
			shell: process.platform === 'win32' && command === 'npm' && !directNpm,
			...options
		}
	);
	if (result.status !== 0)
		throw new Error(
			command + ' failed: ' + (result.stderr || result.stdout || result.error || '').slice(-1800)
		);
	return result.stdout;
}
export function packageHtml5() {
	const draft = process.argv.includes('--draft');
	const allowUntagged = process.argv.includes('--allow-untagged');
	const version = json(path.join(ROOT, 'package.json')).version;
	const head = run('git', ['rev-parse', 'HEAD']).trim();
	const dirty = !!run('git', ['status', '--porcelain']).trim();
	let verifiedTag = false;
	const tag = spawnSync('git', ['rev-parse', `v${version}^{commit}`], {
		cwd: ROOT,
		encoding: 'utf8'
	});
	verifiedTag = tag.status === 0 && tag.stdout.trim() === head;
	if (!draft) {
		if (dirty) throw new Error('Package HTML5 from a clean commit');
		if (!verifiedTag && !allowUntagged)
			throw new Error('HEAD must match the version tag, or use --allow-untagged for a candidate');
		run('node', ['--import', 'tsx', 'data/scripts/audit-authored-facts.ts', '--strict']);
	}
	run('npm', ['run', 'prebuild', '--workspace=app']);
	prepareHtml5Routes(ROOT);
	run('npm', ['exec', '--workspace=app', '--', 'vite', 'build'], {
		env: { ...process.env, VITE_GEOCLICK_HTML5: '1' }
	});
	const build = path.join(ROOT, 'app/build-html5');
	run('node', ['app/scripts/check-build-assets.mjs', build]);
	run('node', ['app/scripts/copy-maplibre-worker.mjs', build]);
	const output = path.join(ROOT, 'dist-release', 'v' + version);
	mkdirSync(output, { recursive: true });
	const stage = path.join(ROOT, 'rendered', 'html5-stage');
	const planned = planHtml5Files(ROOT, build, stage, {
		version,
		commit: head,
		verifiedTag,
		draft,
		dirty,
		authoredCoverageVerified: !draft,
		builtAt: new Date().toISOString()
	});
	const archive = path.join(output, `Geoclick-${version}-html5.zip`);
	const list = path.join(stage, 'zip-entries.json');
	writeFileSync(list, JSON.stringify(planned.entries));
	const python = `import json,sys,zipfile\nfrom pathlib import Path\nrows=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))\nwith zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as out:\n for row in rows:out.write(row['source'],row['path'])\nwith zipfile.ZipFile(sys.argv[2]) as out:\n assert out.testzip() is None\n assert len(out.namelist())==len(rows)\n assert 'index.html' in out.namelist()\n`;
	run(process.platform === 'win32' ? 'python' : 'python3', ['-c', python, list, archive]);
	const digest = sha(readFileSync(archive));
	writeFileSync(archive + '.sha256', digest + '  ' + path.basename(archive) + '\n');
	const report = {
		archive: path.basename(archive),
		sha256: digest,
		fileCount: planned.entries.length,
		uncompressedBytes: planned.entries.reduce(
			(sum, r) => sum + (r.bytes ?? readFileSync(r.source).length),
			0
		),
		...planned.manifest
	};
	writeFileSync(path.join(output, 'html5-report.json'), JSON.stringify(report, null, 2) + '\n');
	console.log(
		`HTML5 ZIP: ${archive}\n${planned.entries.length} files; ${planned.manifest.mapCount} maps; SHA256 ${digest}`
	);
	return archive;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		packageHtml5();
	} catch (error) {
		console.error('package-html5: ' + error.message);
		process.exitCode = 1;
	}
}
