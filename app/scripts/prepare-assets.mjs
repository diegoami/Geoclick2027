// Materialises the generated map and style data where the build expects it:
// app/static/maps and app/static/styles. These used to be committed symlinks
// (git mode 120000). A default Git-for-Windows clone turns such a link into a
// small text file containing the target path, and `vite build` then *succeeds*
// while every map.json 404s at runtime - it has shipped that way once
// (ONBOARDING.md, "Gotchas"). Creating the link here, on whatever machine runs
// the build, takes the checkout out of the equation.
//
// A true directory symlink is used where the OS allows one; where it does not,
// the data is copied instead. It is deliberately NOT a Windows junction: Git
// for Windows treats a junction as a directory, so checking out a commit that
// tracked a link at this path recurses through it and deletes data/maps -
// found the hard way, and reproduced. A true symlink is replaced as a link, so
// data/ is safe. check-build-assets.mjs still guards the result, so a
// half-prepared static directory cannot ship.
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
	// A link (symlink, or a junction left by an earlier version of this
	// script) is unlinked, never recursed into, so the data it points at
	// survives.
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
		// A true directory symlink, never a Windows junction (see the header).
		// Creating one needs a privilege Windows may not grant, in which case
		// the data is copied instead.
		symlinkSync(source, dest, 'dir');
	} catch {
		cpSync(source, dest, { recursive: true });
	}
}
console.log('Prepared app/static/maps and app/static/styles.');
