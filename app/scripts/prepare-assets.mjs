// Materialises the generated map and style data where the build expects it:
// app/static/maps and app/static/styles. These used to be committed symlinks
// (git mode 120000). A default Git-for-Windows clone turns such a link into a
// small text file containing the target path, and `vite build` then *succeeds*
// while every map.json 404s at runtime - it has shipped that way once
// (ONBOARDING.md, "Gotchas"). Creating the link here, on whatever machine runs
// the build, takes the checkout out of the equation.
//
// A directory junction is used on Windows (it needs no Developer Mode, unlike
// a true symlink); a plain directory symlink elsewhere. If the filesystem
// refuses to link, the data is copied instead. check-build-assets.mjs still
// guards the result, so a half-prepared static directory cannot ship.
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The repo root: app/scripts/ -> app/ -> repo. An argument overrides it, for
// the test that drives this script in a scratch tree.
const repoDir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const appDir = join(repoDir, 'app');

/** Removes whatever is at `path`, never following a link to its target. */
function remove(path) {
	let stats;
	try {
		stats = lstatSync(path);
	} catch (e) {
		if (e.code === 'ENOENT') return;
		throw e;
	}
	// A Windows junction reports as a symlink too, so this unlinks the link
	// and never recurses into the data it points at.
	if (stats.isSymbolicLink()) unlinkSync(path);
	else rmSync(path, { recursive: true, force: true });
}

for (const name of ['maps', 'styles']) {
	const source = join(repoDir, 'data', name);
	if (!existsSync(source)) {
		console.error(`Missing ${source}: the map and style data must exist before building.`);
		process.exit(1);
	}
	const dest = join(appDir, 'static', name);
	mkdirSync(join(appDir, 'static'), { recursive: true });
	remove(dest);
	try {
		symlinkSync(source, dest, process.platform === 'win32' ? 'junction' : 'dir');
	} catch {
		cpSync(source, dest, { recursive: true });
	}
}
console.log('Prepared app/static/maps and app/static/styles.');
