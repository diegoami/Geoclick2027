<script lang="ts">
	// The bar of a page the start screen's toolbar opens (FT-82): My maps and
	// About. Back leads to the start screen, as the card games' views lead to
	// the table; Escape does the same, and Android's back button already does
	// (backNavigation.ts sends any other route home).
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from './i18n.svelte';

	let { title }: { title: string } = $props();

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && !e.defaultPrevented) goto(resolve('/'));
	}
</script>

<svelte:window onkeydown={onKey} />

<header class="gc-bar">
	<a class="gc-tool" href={resolve('/')} aria-label={t('home.back')} title={t('home.back')}>
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
	</a>
	<h1 class="gc-wordmark">{title}</h1>
</header>
