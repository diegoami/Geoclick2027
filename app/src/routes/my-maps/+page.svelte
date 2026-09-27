<script lang="ts">
	// My maps (FT-82, #91): Favourites first, then Recent, off the start
	// screen and behind the toolbar's star, as the card games keep History
	// behind an icon. A returning player's own choices come first.
	import { onMount } from 'svelte';
	import mapIndex from '../../../../data/maps/index.json';
	import { loadHomeProgress, type Mastery } from '$lib/homeProgress';
	import { t } from '$lib/i18n.svelte';
	import MapCard from '$lib/MapCard.svelte';
	import { mapDisplayName } from '$lib/mapCatalog';
	import { favouriteMaps, recentMaps } from '$lib/mapPrefs.svelte';
	import PageBar from '$lib/PageBar.svelte';
	import { createProgressRepository, type SessionSummary } from '$lib/progressRepository';

	const targetIdsByMap = new Map(mapIndex.map((entry) => [entry.id, entry.targetIds]));

	let lastSessions = $state<Record<string, SessionSummary | undefined>>({});
	let masteries = $state<Record<string, Mastery | undefined>>({});
	// Both lists live in this device's storage, which the prerendered HTML
	// can't see: shown after mount, so the first render matches it.
	let mounted = $state(false);
	const favourites = $derived(mounted ? favouriteMaps() : []);
	const recent = $derived(mounted ? recentMaps() : []);

	onMount(() => {
		mounted = true;
		(async () => {
			try {
				const repository = await createProgressRepository();
				const ids = [...new Set([...favouriteMaps(), ...recentMaps()])];
				const progress = await loadHomeProgress(repository, ids, targetIdsByMap);
				lastSessions = progress.summaries;
				masteries = progress.masteries;
			} catch (e) {
				// The cards still open their maps without it (FT-57).
				console.error('Could not open saved progress for My maps.', e);
			}
		})();
	});
</script>

<svelte:head><title>{t('home.myMaps')} · Geoclick</title></svelte:head>

<PageBar title={t('home.myMaps')} />

<main>
	{#if favourites.length > 0}
		<section>
			<h2>
				<svg viewBox="0 0 24 24" aria-hidden="true"
					><path
						d="M12 3.6l2.55 5.2 5.75.84-4.16 4.05.98 5.72L12 16.72l-5.12 2.69.98-5.72L3.7 9.64l5.75-.84z"
						fill="currentColor"
					/></svg
				>
				{t('home.favourites')}
			</h2>
			<ul>
				{#each favourites as mapId (mapId)}
					<MapCard
						{mapId}
						label={mapDisplayName(mapId) ?? mapId}
						summary={lastSessions[mapId]}
						mastery={masteries[mapId]}
					/>
				{/each}
			</ul>
		</section>
	{/if}
	{#if recent.length > 0}
		<section>
			<h2>
				<svg viewBox="0 0 24 24" aria-hidden="true"
					><circle
						cx="12"
						cy="12"
						r="8.5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/><path
						d="M12 7.5V12l3 2"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/></svg
				>
				{t('home.recent')}
			</h2>
			<ul>
				{#each recent as mapId (mapId)}
					<MapCard
						{mapId}
						label={mapDisplayName(mapId) ?? mapId}
						summary={lastSessions[mapId]}
						mastery={masteries[mapId]}
					/>
				{/each}
			</ul>
		</section>
	{/if}
	{#if mounted && favourites.length === 0 && recent.length === 0}
		<p class="empty">{t('myMaps.empty')}</p>
	{/if}
</main>

<style>
	:global(body) {
		min-height: 100vh;
		background: linear-gradient(160deg, #e3f0e6 0%, #dce6f2 45%, #f7ecd9 100%) fixed;
	}
	main {
		max-width: 46rem;
		margin: 1.25rem auto 4rem;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0 0 0.6rem;
		font-size: 1rem;
		font-weight: 700;
		color: #b5691f;
	}
	h2 svg {
		width: 1.1rem;
		height: 1.1rem;
	}
	ul {
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.empty {
		margin: 2rem 0;
		text-align: center;
		color: #4a5650;
	}
	@media (min-width: 640px) {
		ul {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			column-gap: 1.5rem;
		}
	}
</style>
