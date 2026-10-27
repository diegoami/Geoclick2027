import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	existsSync,
	rmSync,
	lstatSync
} from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { planHtml5Files, portableHtml } from './package-html5.mjs';
import { prepareHtml5Routes } from './prepare-html5.mjs';
const roots = [];
const write = (file, data) => {
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, data);
};
function fixture(id = 'example') {
	const root = mkdtempSync(path.join(tmpdir(), 'geoclick-html5-test-'));
	roots.push(root);
	const build = path.join(root, 'app/build-html5'),
		stage = path.join(root, 'rendered/stage');
	write(path.join(root, 'data/maps/index.json'), JSON.stringify([{ id }]));
	write(path.join(build, 'maps/index.json'), JSON.stringify([{ id }]));
	write(path.join(build, 'index.html'), '<script type="module" src="/_app/start.js"></script>');
	write(path.join(build, '_app/start.js'), 'export {};');
	write(
		path.join(build, 'manual/en.html'),
		'<img src="/manual/images/a.jpg"><a href="#topic">Topic</a>'
	);
	write(path.join(build, 'manual/images/a.jpg'), 'image');
	for (const file of ['picker.json', 'tiles.pmtiles'])
		write(path.join(build, 'maps/world-picker', file), '{}');
	if (!id.includes('/')) {
		const dir = path.join(build, 'maps', id);
		write(path.join(dir, 'map.json'), JSON.stringify({ id, targets: [{ id: 'one' }] }));
		write(path.join(dir, 'facts.json'), JSON.stringify({ one: { hooks: { en: ['one'] } } }));
		write(path.join(dir, 'tour.json'), JSON.stringify({ mapId: id, steps: [{ targetId: 'one' }] }));
		for (const f of ['tiles.pmtiles', 'terrain.pmtiles']) write(path.join(dir, f), 'tile');
	}
	return { root, build, stage };
}
afterEach(() => {
	for (const root of roots.splice(0)) {
		assert.equal(path.dirname(root), path.resolve(tmpdir()));
		assert.match(path.basename(root), /^geoclick-html5-test-/);
		assert.equal(lstatSync(root).isSymbolicLink(), false);
		rmSync(root, { recursive: true, force: true });
	}
});
test('portable plan preserves all three metadata objects without changing original files', () => {
	const { root, build, stage } = fixture();
	const p = planHtml5Files(root, build, stage, { version: '1.0.0', draft: true });
	const entry = p.entries.find((e) => e.path === 'maps/example/bundle.json');
	assert.ok(entry);
	const bundle = JSON.parse(readFileSync(entry.source, 'utf8'));
	for (const [part, file] of [
		['map', 'map.json'],
		['facts', 'facts.json'],
		['tour', 'tour.json']
	]) {
		assert.deepEqual(
			bundle[part],
			JSON.parse(readFileSync(path.join(build, 'maps/example', file), 'utf8'))
		);
		assert.equal(
			p.entries.some((e) => e.path === 'maps/example/' + file),
			false
		);
		assert.equal(existsSync(path.join(build, 'maps/example', file)), true);
	}
	assert.equal(p.manifest.mapCount, 1);
	assert.ok(p.entries.length < 1000);
	assert.equal(
		readFileSync(p.entries.find((e) => e.path === 'index.html').source, 'utf8').includes(
			'"./_app/'
		),
		true
	);
	assert.equal(
		readFileSync(p.entries.find((e) => e.path === 'manual/en.html').source, 'utf8'),
		'<img src="manual/images/a.jpg"><a href="#topic">Topic</a>'
	);
});
test('unsafe map IDs and mismatched bundle identities cannot be exported', () => {
	const unsafe = fixture('../escape');
	assert.throws(
		() => planHtml5Files(unsafe.root, unsafe.build, unsafe.stage, { version: '1.0.0' }),
		/Unsafe map ID/
	);
	const f = fixture();
	write(path.join(f.build, 'maps/example/tour.json'), '{"mapId":"wrong"}');
	assert.throws(
		() => planHtml5Files(f.root, f.build, f.stage, { version: '1.0.0' }),
		/identity mismatch/
	);
});
test('file budget is enforced on the actual ZIP plan', () => {
	const f = fixture();
	for (let i = 0; i < 1000; i++) write(path.join(f.build, 'assets', i + '.txt'), 'a');
	assert.throws(
		() => planHtml5Files(f.root, f.build, f.stage, { version: '1.0.0' }),
		/1000-file portability budget/
	);
});
test('route overlay strips hash-incompatible options while preserving authored routes and external imports', () => {
	const f = fixture();
	const source = path.join(f.root, 'app/src/routes');
	const content = 'export const prerender = true;\nexport const load = () => ({});\n';
	write(path.join(source, '+layout.ts'), content);
	write(path.join(source, '+layout.svelte'), "<script>import '../app.css';</script><slot />");
	write(path.join(f.root, 'app/src/app.css'), 'body{}');
	const target = prepareHtml5Routes(f.root);
	assert.equal(readFileSync(path.join(source, '+layout.ts'), 'utf8'), content);
	const result = readFileSync(path.join(target, '+layout.ts'), 'utf8');
	assert.equal(result.includes('export const prerender'), false);
	assert.equal(result.includes('export const load'), true);
	assert.equal(
		readFileSync(path.join(target, '+layout.svelte'), 'utf8').includes("'../../src/app.css'"),
		true
	);
});
test('HTML rewrite affects only local entry/assets and leaves external URLs alone', () => {
	assert.equal(
		portableHtml('<a href="https://example.test/_app/a">x</a><script src="/_app/a.js"></script>'),
		'<a href="https://example.test/_app/a">x</a><script src="./_app/a.js"></script>'
	);
});

test('manual screenshot URLs stay inside the physical game folder', () => {
	assert.equal(
		portableHtml('<img src="/manual/img/windows-app.jpg">'),
		'<img src="manual/img/windows-app.jpg">'
	);
});
