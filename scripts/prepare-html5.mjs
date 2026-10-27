// A disposable route overlay removes SSR-only exports for the hash-routed build.
// Authored routes stay untouched; both trees use the same library and stylesheet.
import {
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
	copyFileSync,
	existsSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function prepareHtml5Routes(root) {
	const app = path.resolve(root, 'app');
	const source = path.join(app, 'src/routes');
	const target = path.join(app, '.html5-routes');
	const routes = path.join(target, 'routes');
	if (!existsSync(source)) throw new Error('Authored routes missing');
	// Never recurse through a link or delete a target other than this generated directory.
	if (path.dirname(target) !== app || path.basename(target) !== '.html5-routes')
		throw new Error('Unsafe generated route path');
	if (existsSync(target) && lstatSync(target).isSymbolicLink())
		throw new Error('Generated route path is a link');
	rmSync(target, { recursive: true, force: true });
	mkdirSync(routes, { recursive: true });
	function copy(dir, out) {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const input = path.join(dir, entry.name),
				output = path.join(out, entry.name);
			if (entry.isSymbolicLink()) throw new Error('Unexpected link in authored routes');
			if (entry.isDirectory()) {
				mkdirSync(output, { recursive: true });
				copy(input, output);
				continue;
			}
			if (!/\.(?:svelte|[cm]?[jt]s)$/.test(entry.name)) {
				copyFileSync(input, output);
				continue;
			}
			let text = readFileSync(input, 'utf8');
			if (/^\+(?:page|layout)\.[cm]?[jt]s$/.test(entry.name))
				text =
					text.replace(
						/\bexport\s+const\s+(prerender|ssr|csr|trailingSlash|entries|config)\b/g,
						'const $1'
					) + '\nexport {};\n';
			// Preserve imports within the copied route tree, including generated ./$types.
			// Imports outside it must still refer to their authored targets (e.g. app.css).
			text = text.replace(
				/\b(from\s*|import\s*)(['"])(\.[^'"\r\n]+)\2/g,
				(all, keyword, quote, spec) => {
					const absolute = path.resolve(path.dirname(input), spec);
					if (absolute === source || absolute.startsWith(source + path.sep)) return all;
					let relative = path.relative(path.dirname(output), absolute).split(path.sep).join('/');
					if (!relative.startsWith('.')) relative = './' + relative;
					return keyword + quote + relative + quote;
				}
			);
			writeFileSync(output, text);
		}
	}
	copy(source, routes);
	return routes;
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	console.log('Prepared HTML5 routes: ' + prepareHtml5Routes(root));
