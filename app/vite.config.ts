import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

const pkg = JSON.parse(
	readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
);

// Best-effort short commit SHA for the version badge (VersionBadge.svelte) -
// falls back to "unknown" rather than failing the build on a checkout with
// no git history (a zip export, a shallow clone missing HEAD, etc.).
let buildSha = 'unknown';
try {
	buildSha = execSync('git rev-parse --short HEAD', {
		cwd: fileURLToPath(new URL('.', import.meta.url))
	})
		.toString()
		.trim();
} catch {
	// leave as 'unknown'
}

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		__BUILD_SHA__: JSON.stringify(buildSha)
	},
	// maplibre-gl spawns its tile-parsing worker from a sibling file
	// (maplibre-gl-worker.mjs) resolved relative to its own module URL. Vite's
	// dependency pre-bundling relocates the main module without that sibling,
	// breaking the worker at runtime (tiles fetch fine, nothing renders).
	// Excluding it from pre-bundling serves it straight from node_modules,
	// where the relative path still resolves.
	optimizeDeps: { exclude: ['maplibre-gl'] },
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Fully static build (see ARCHITECTURE.md's Hosting section - the
			// app is local-first with no backend). /map/[mapId] and its /tour
			// route are ssr=false and not prerendered (we don't enumerate map
			// ids at build time), so they're served via the SPA fallback -
			// 200.html is the filename Cloudflare Pages (and Netlify) look for
			// to serve unmatched routes with a 200 instead of a 404.
			adapter: adapter({ fallback: '200.html' }),

			// Prerendered/fallback HTML must use absolute asset paths, not
			// relative ones - the fallback (200.html) gets served for whatever
			// nested URL the user actually requested (e.g. /map/italy-regions),
			// and the browser resolves relative paths against that URL, not
			// against the site root. Confirmed by testing the built output
			// directly: relative paths broke with "expected a JS module but
			// got text/html" once served two levels deep.
			paths: { relative: false }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				// Component tests (`*.svelte.test.ts`) in a real headless Chromium
				// via Playwright - the SvelteKit template's `client` project, which
				// had been removed, leaving those files silently unrun. One-time
				// per machine: `npx playwright install chromium`.
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					// Plus plain-TS tests that need a real DOM: `*.browser.test.ts`.
					include: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.browser.{test,spec}.{js,ts}']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.browser.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
