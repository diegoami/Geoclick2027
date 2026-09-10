import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
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
			//
			// GitHub Pages-only wrinkle: a project repo is served from a
			// subpath (https://user.github.io/repo/), not the domain root, so
			// every absolute path needs that prefix too - both the ones
			// SvelteKit generates itself (handled by `base` below) and the
			// ones this app's own code builds by hand for fetching map data
			// (app/src/lib/geoclickMap.ts, tour.ts - both import `base` from
			// $app/paths and prefix their fetch URLs with it). BASE_PATH is
			// set by .github/workflows/deploy-pages.yml; empty everywhere
			// else (local dev, every other hosting candidate), so this is a
			// no-op off of this branch.
			paths: {
				relative: false,
				base: (process.env.BASE_PATH ?? '') as '' | `/${string}`
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
