<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { pickerGoUp } from '$lib/mapPrefs.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import VersionBadge from '$lib/VersionBadge.svelte';
	import TutorialOverlay from '$lib/TutorialOverlay.svelte';
	import { tutorialRouteChanged } from '$lib/tutorial.svelte';
	import { getLanguage } from '$lib/i18n.svelte';
	import { parentRoute } from '$lib/backNavigation';

	let { children } = $props();

	// The tutorial follows every navigation: its steps move on, or pause, on
	// route changes (FT-11).
	afterNavigate(({ to }) => tutorialRouteChanged(to?.url.pathname ?? location.pathname));

	// Android's hardware back button goes up the app's hierarchy, not back
	// through history (FT-14, backNavigation.ts). Registering a listener
	// replaces Capacitor's default (history back, then exit), so every case,
	// exiting included, is handled here. Only inside the Android app: the web
	// and desktop keep their normal back behaviour. replaceState keeps these
	// "up" moves from piling up history entries.
	onMount(() => {
		let removeListener: (() => void) | undefined;
		let destroyed = false;
		(async () => {
			const { Capacitor } = await import('@capacitor/core');
			if (!Capacitor.isNativePlatform()) return;
			const { App } = await import('@capacitor/app');
			const handle = await App.addListener('backButton', () => {
				const target = parentRoute(location.pathname, resolve('/').replace(/\/$/, ''));
				// On the start screen, a continent's view goes up to the world first.
				if (target.kind === 'exit') {
					if (!pickerGoUp()) App.exitApp();
				}
				else if (target.kind === 'home') goto(resolve('/'), { replaceState: true });
				else goto(resolve('/map/[mapId]', { mapId: target.mapId }), { replaceState: true });
			});
			if (destroyed) handle.remove();
			else removeListener = () => handle.remove();
		})();
		return () => {
			destroyed = true;
			removeListener?.();
		};
	});

	// Keep <html lang> in step with the UI language, so screen readers use the
	// right voice and :lang()/hyphenation follow a switch to DE/IT. app.html
	// ships lang="en" as the prerender default; this takes over on hydration
	// and re-runs on every switch (getLanguage() reads $state). $effect never
	// runs during prerender - the guard mirrors i18n.svelte.ts's localStorage one.
	$effect(() => {
		if (typeof document === 'undefined') return;
		document.documentElement.lang = getLanguage();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
<VersionBadge />
<TutorialOverlay />
