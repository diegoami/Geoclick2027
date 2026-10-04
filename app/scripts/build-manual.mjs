// Renders the user manual (docs/USER_MANUAL.md) into app/static/manual/en.html,
// the fragment the /manual page fetches (proposal #204). Runs before dev and
// build, like prepare-assets.mjs, so the app never carries a hand-copied
// manual: the one Markdown file serves GitHub and the app alike.
//
// What it does beyond Markdown to HTML:
//   - headings get GitHub-style ids, so the manual's own contents list works;
//   - images (manual/x.jpg) are copied to static/manual/img/ and pointed there;
//   - a link to another file of the repository becomes a link to it on GitHub,
//     since inside the app there is nothing to open.
//
//   node scripts/build-manual.mjs                       # the normal run
//   node scripts/build-manual.mjs --src=a.md --out=dir --images=dir   # the test
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const here = dirname(fileURLToPath(import.meta.url));
const repoDir = join(here, '..', '..');
const args = Object.fromEntries(
	process.argv
		.slice(2)
		.filter((a) => a.startsWith('--'))
		.map((a) => a.slice(2).split('='))
);
const src = resolve(args.src ?? join(repoDir, 'docs', 'USER_MANUAL.md'));
const outDir = resolve(args.out ?? join(here, '..', 'static', 'manual'));
const imagesDir = resolve(args.images ?? join(repoDir, 'docs'));

const GITHUB_BLOB = 'https://github.com/diegoami/Geoclick2027/blob/main/';
const srcRepoPath = posix.relative(repoDir.split('\\').join('/'), src.split('\\').join('/'));

/** GitHub's heading id: lower case, punctuation dropped, spaces to hyphens. */
export function slug(text) {
	return text
		.toLowerCase()
		.replace(/<[^>]*>/g, '')
		.replace(/[^\p{L}\p{N}\s_-]/gu, '')
		.trim()
		.replace(/\s/g, '-');
}

/** Escapes a value for use inside a double-quoted HTML attribute. */
function esc(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

const images = new Set();

const marked = new Marked({
	gfm: true,
	renderer: {
		heading({ tokens, depth }) {
			const inner = this.parser.parseInline(tokens);
			return `<h${depth} id="${slug(inner)}">${inner}</h${depth}>\n`;
		},
		image({ href, title, text }) {
			const file = basename(href);
			images.add(href);
			const t = title ? ` title="${esc(title)}"` : '';
			return `<img src="/manual/img/${file}" alt="${esc(text)}"${t} loading="lazy" />`;
		},
		link({ href, title, tokens }) {
			const inner = this.parser.parseInline(tokens);
			const t = title ? ` title="${esc(title)}"` : '';
			if (href.startsWith('#')) return `<a href="${href}"${t}>${inner}</a>`;
			if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
				return `<a href="${href}"${t} target="_blank" rel="external noopener">${inner}</a>`;
			}
			// A path inside the repository, relative to the manual's own file.
			const [path, hash] = href.split('#');
			const target = posix.normalize(posix.join(posix.dirname(srcRepoPath), path));
			const url = GITHUB_BLOB + target + (hash ? `#${hash}` : '');
			return `<a href="${url}"${t} target="_blank" rel="external noopener">${inner}</a>`;
		}
	}
});

const html = marked.parse(readFileSync(src, 'utf8'));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'img'), { recursive: true });
writeFileSync(join(outDir, 'en.html'), html);
let copied = 0;
for (const href of images) {
	const from = join(imagesDir, href);
	if (!existsSync(from)) {
		console.error(`The manual shows ${href}, which is not in ${imagesDir}.`);
		process.exit(1);
	}
	copyFileSync(from, join(outDir, 'img', basename(href)));
	copied++;
}
console.log(`manual: ${src} -> ${join(outDir, 'en.html')} (${copied} images)`);
