<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import VersionBadge from '$lib/VersionBadge.svelte';
	import { getLanguage } from '$lib/i18n.svelte';

	let { children } = $props();

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
