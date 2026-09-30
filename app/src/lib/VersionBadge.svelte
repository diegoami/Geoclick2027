<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	let topOffset = $state(8);
	let observer: ResizeObserver | undefined;
	let frame: number | undefined;
	let observedChrome: HTMLElement[] = [];

	function measureTopChrome() {
		const chrome = [
			...document.querySelectorAll<HTMLElement>(
				'[data-map-overlay="top"]:not(.hidden), .gc-bar, .maplibregl-ctrl-top-right, .picker .where'
			)
		];
		if (
			observer &&
			(chrome.length !== observedChrome.length || chrome.some((el, i) => el !== observedChrome[i]))
		) {
			observer.disconnect();
			observedChrome = chrome;
			for (const element of chrome) observer.observe(element);
		}
		let bottom = 0;
		for (const element of chrome) {
			bottom = Math.max(bottom, element.getBoundingClientRect().bottom);
		}
		topOffset = Math.ceil(bottom + 8);
	}

	function scheduleMeasure() {
		if (frame !== undefined) cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			frame = undefined;
			measureTopChrome();
		});
	}

	afterNavigate(scheduleMeasure);

	onMount(() => {
		observer = new ResizeObserver(scheduleMeasure);
		window.addEventListener('resize', scheduleMeasure);
		scheduleMeasure();
		return () => {
			if (frame !== undefined) cancelAnimationFrame(frame);
			observer?.disconnect();
			window.removeEventListener('resize', scheduleMeasure);
		};
	});
</script>

<!--
  Shown on every route via +layout.svelte, per the product owner's request
  (2026-09-13) that the release version/build be prominent in the app, not
  buried in a settings screen nobody opens. __APP_VERSION__/__BUILD_SHA__
  are injected at build time by vite.config.ts from the root package.json
  (kept in sync across all three shells by scripts/sync-version.mjs) and
  `git rev-parse --short HEAD`.
-->
<div
	class="version-badge"
	style="top: calc(env(safe-area-inset-top, 0px) + {topOffset}px)"
	title="Geoclick v{__APP_VERSION__}, build {__BUILD_SHA__}"
>
	v{__APP_VERSION__} · {__BUILD_SHA__}
</div>

<style>
	.version-badge {
		position: fixed;
		/* Top-left, below the measured toolbar/map controls and the device's
		 * safe area. */
		left: 0.5rem;
		bottom: auto;
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
