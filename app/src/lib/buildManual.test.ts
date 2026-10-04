// The manual page (proposal #204): scripts/build-manual.mjs turns the manual's
// Markdown into the fragment the /manual page fetches. The tests drive the
// script on a scratch manual, as buildAssets.test.ts does for the map assets.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../scripts/build-manual.mjs', import.meta.url));
const realManual = fileURLToPath(new URL('../../../docs/USER_MANUAL.md', import.meta.url));
const dirs: string[] = [];

function build(markdown: string, images: string[] = []) {
	const dir = mkdtempSync(join(tmpdir(), 'gc-manual-'));
	dirs.push(dir);
	mkdirSync(join(dir, 'manual'));
	for (const name of images) writeFileSync(join(dir, 'manual', name), 'x');
	writeFileSync(join(dir, 'm.md'), markdown);
	const out = join(dir, 'out');
	execFileSync(
		process.execPath,
		[script, `--src=${join(dir, 'm.md')}`, `--out=${out}`, `--images=${dir}`],
		{ stdio: 'pipe' }
	);
	return { out, html: readFileSync(join(out, 'en.html'), 'utf8') };
}

afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('build-manual', () => {
	it('gives headings the ids GitHub gives, so the contents list works', () => {
		const { html } = build('# Geoclick — User manual\n\n## 4. The home page\n');
		expect(html).toContain('id="geoclick--user-manual"');
		expect(html).toContain('id="4-the-home-page"');
	});

	it('points images at the app and copies them', () => {
		const { out, html } = build('![A shot](manual/home.jpg)\n', ['home.jpg']);
		expect(html).toContain('src="/manual/img/home.jpg"');
		expect(existsSync(join(out, 'img', 'home.jpg'))).toBe(true);
	});

	it('fails when an image the manual shows is missing', () => {
		expect(() => build('![A shot](manual/nope.jpg)\n')).toThrow();
	});

	it('sends a link to another repository file to GitHub and opens outside links outside', () => {
		const { html } = build('[a](https://example.org/x) and [b](#top)\n');
		expect(html).toContain('href="https://example.org/x" target="_blank"');
		expect(html).toContain('href="#top"');
	});

	it('keeps quotes in alt text and titles from breaking the attribute', () => {
		const { html } = build('![Searching for "cities"](manual/home.jpg "A tip")\n', ['home.jpg']);
		expect(html).toContain('alt="Searching for &quot;cities&quot;"');
		expect(html).toContain('title="A tip"');
	});

	it('sends a link to a repository file to GitHub, relative to the manual', () => {
		const { html } = build('[the readme](../README.md#top)\n');
		expect(html).toMatch(
			/href="https:\/\/github\.com\/diegoami\/Geoclick2027\/blob\/main\/[^"]*README\.md#top"/
		);
	});

	it('leaves no broken anchor in the real manual', () => {
		const dir = mkdtempSync(join(tmpdir(), 'gc-manual-real-'));
		dirs.push(dir);
		execFileSync(process.execPath, [script, `--src=${realManual}`, `--out=${dir}`], {
			stdio: 'pipe'
		});
		const html = readFileSync(join(dir, 'en.html'), 'utf8');
		const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
		const broken = [...html.matchAll(/href="#([^"]+)"/g)]
			.map((m) => m[1])
			.filter((a) => !ids.has(a));
		expect(broken).toEqual([]);
	});
});
