// maplibre-gl computes its worker URL as
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)` relative to
// whichever bundled chunk contains its code. Vite's static asset analysis
// can't follow that - the filename is chosen at runtime via a template
// literal - so `vite build` never emits the worker file on its own (tiles
// fetch fine, nothing renders, no error, since the failure happens inside
// the worker's own context where page-level error listeners don't see it).
// Copy it in manually, into the one directory every chunk in this build
// lives in, so the relative URL resolves correctly regardless of which
// specific chunk maplibre-gl's code ends up bundled into. The worker file
// itself has one further relative import (maplibre-gl-shared.mjs) that
// needs to land alongside it for the same reason.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const outDir = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'build',
	'_app',
	'immutable',
	'chunks'
);
mkdirSync(outDir, { recursive: true });

for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
	const src = require.resolve(`maplibre-gl/dist/${file}`);
	const dest = join(outDir, file);
	copyFileSync(src, dest);
	console.log(`Copied ${file} -> ${dest}`);
}
