<!--
  Shown on every route via +layout.svelte, per the product owner's request
  (2026-09-13) that the release version/build be prominent in the app, not
  buried in a settings screen nobody opens. __APP_VERSION__/__BUILD_SHA__
  are injected at build time by vite.config.ts from the root package.json
  (kept in sync across all three shells by scripts/sync-version.mjs) and
  `git rev-parse --short HEAD`.
-->
<div class="version-badge" title="Geoclick v{__APP_VERSION__}, build {__BUILD_SHA__}">
	v{__APP_VERSION__} · {__BUILD_SHA__}
</div>

<style>
	.version-badge {
		position: fixed;
		right: 0.5rem;
		bottom: 0.4rem;
		z-index: 20;
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		color: #8a8578;
		background: rgba(255, 255, 255, 0.6);
		padding: 0.1rem 0.4rem;
		border-radius: 0.3rem;
		pointer-events: none;
		user-select: none;
	}
</style>
