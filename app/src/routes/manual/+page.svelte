<script lang="ts">
	// The user manual (proposal #204): docs/USER_MANUAL.md rendered at build time
	// by scripts/build-manual.mjs into static/manual/en.html, fetched here like a
	// map's data. English only for now; German and Italian follow.
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import { getLanguage, t } from '$lib/i18n.svelte';
	import PageBar from '$lib/PageBar.svelte';

	let html = $state('');
	let failed = $state(false);

	onMount(async () => {
		try {
			const res = await fetch(asset('/manual/en.html'));
			if (!res.ok) throw new Error(String(res.status));
			html = await res.text();
		} catch {
			failed = true;
		}
	});
</script>

<svelte:head><title>{t('about.manual')} · Geoclick</title></svelte:head>

<PageBar title={t('about.manual')} />

<main>
	{#if getLanguage() !== 'en'}
		<p class="note">{t('manual.englishOnly')}</p>
	{/if}
	{#if failed}
		<p class="note">{t('manual.loadFailed')}</p>
	{:else}
		<article class="manual">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- our own manual, rendered at build time -->
			{@html html}
		</article>
	{/if}
</main>

<style>
	:global(body) {
		min-height: 100vh;
		background: linear-gradient(160deg, #e3f0e6 0%, #dce6f2 45%, #f7ecd9 100%) fixed;
	}
	main {
		max-width: 46rem;
		margin: 1.5rem auto 4rem;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
		color: #1c2b22;
		line-height: 1.55;
	}
	.note {
		background: #fff;
		border-radius: 0.5rem;
		padding: 0.6rem 0.9rem;
		font-size: 0.9rem;
	}
	.manual :global(h1),
	.manual :global(h2),
	.manual :global(h3) {
		font-family: Georgia, 'Times New Roman', serif;
		line-height: 1.25;
		scroll-margin-top: 4.5rem;
	}
	.manual :global(h1) {
		font-size: 1.8rem;
	}
	.manual :global(h2) {
		margin-top: 2.2rem;
		font-size: 1.4rem;
	}
	.manual :global(h3) {
		font-size: 1.1rem;
	}
	.manual :global(a) {
		color: #b5691f;
		text-underline-offset: 2px;
	}
	.manual :global(img) {
		display: block;
		max-width: 100%;
		height: auto;
		margin: 0.8rem auto;
		border-radius: 0.5rem;
		box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
	}
	.manual :global(table) {
		display: block;
		overflow-x: auto;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	.manual :global(th),
	.manual :global(td) {
		border: 1px solid #c9d3cc;
		padding: 0.3rem 0.55rem;
		text-align: left;
		vertical-align: top;
	}
	.manual :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.9em;
		background: rgba(255, 255, 255, 0.7);
		padding: 0 0.2em;
		border-radius: 0.2em;
	}
	.manual :global(blockquote) {
		margin: 1rem 0;
		padding: 0.1rem 1rem;
		border-left: 4px solid #b5691f;
		background: rgba(255, 255, 255, 0.6);
	}
</style>
