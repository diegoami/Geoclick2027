<script lang="ts">
	// About (FT-82, #91): what used to sit under the start screen's title -
	// the line saying what Geoclick is and the web's download link - with the
	// version and the credits, behind the toolbar's (i), as in the card games.
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import PageBar from '$lib/PageBar.svelte';
	import { RELEASES_REPO_URL, RELEASES_URL, SOURCE_URL, isNativeShell } from '$lib/platform';

	// For web visitors only - pointless inside the desktop or Android app.
	// Off until checked, so the apps never flash it.
	let showDownload = $state(false);
	onMount(() => {
		isNativeShell().then((native) => (showDownload = !native));
	});
</script>

<svelte:head><title>{t('home.about')} · Geoclick</title></svelte:head>

<PageBar title={t('home.about')} />

<main>
	<h2>Geoclick</h2>
	<p class="tagline">{t('about.tagline')}</p>
	{#if showDownload}
		<p>
			{t('home.download.lead')}
			<a href={RELEASES_URL} target="_blank" rel="external noopener">{t('home.download.link')}</a>
		</p>
	{/if}
	<p class="version">{t('about.version', { version: __APP_VERSION__, build: __BUILD_SHA__ })}</p>
	<p class="author">{t('about.author')}</p>
	<p class="repos">
		<a href={SOURCE_URL} target="_blank" rel="external noopener">{t('about.sourceLink')}</a>
		·
		<a href={RELEASES_REPO_URL} target="_blank" rel="external noopener">{t('about.releasesLink')}</a
		>
	</p>
	<p class="credits">{t('about.credits')}</p>
</main>

<style>
	:global(body) {
		min-height: 100vh;
		background: linear-gradient(160deg, #e3f0e6 0%, #dce6f2 45%, #f7ecd9 100%) fixed;
	}
	main {
		max-width: 32rem;
		margin: 2rem auto 4rem;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
		text-align: center;
		color: #1c2b22;
	}
	h2 {
		margin: 0 0 0.25rem;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.8rem;
	}
	.tagline {
		margin-top: 0;
		font-size: 1.05rem;
	}
	a {
		color: #b5691f;
		text-underline-offset: 2px;
	}
	.version {
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
		color: #4a5650;
	}
	.author {
		font-size: 1rem;
	}
	.repos {
		font-size: 0.95rem;
	}
	.credits {
		font-size: 0.85rem;
		color: #4a5650;
	}
</style>
