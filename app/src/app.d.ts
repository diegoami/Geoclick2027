// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Injected by vite.config.ts's `define` - the release version (root
	// package.json, kept in sync across shells by scripts/sync-version.mjs)
	// and a best-effort short commit SHA. See VersionBadge.svelte.
	const __APP_VERSION__: string;
	const __BUILD_SHA__: string;
}

export {};
