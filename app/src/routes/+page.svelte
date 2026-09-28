<script lang="ts">
	import { onMount } from 'svelte';
	import mapIndex from '../../../data/maps/index.json';
	import { createProgressRepository, type ProgressRepository } from '$lib/progressRepository';
	import { loadHomeProgress, type Mastery } from '$lib/homeProgress';
	import { countMaps, filterGroups } from '$lib/mapSearch';
	import { t } from '$lib/i18n.svelte';
	import { mapGroups, mapTypeLabel } from '$lib/mapCatalog';
	import { countryNameOf } from '$lib/catalogSections';
	import { favouriteMaps, homeView, recentMaps, setHomeView } from '$lib/mapPrefs.svelte';
	import { isNativeShell } from '$lib/platform';
	import StartBar from '$lib/StartBar.svelte';
	import TutorialNudge from '$lib/TutorialNudge.svelte';
	import WorldPicker from '$lib/WorldPicker.svelte';
	import MapSections from '$lib/MapSections.svelte';
	import { showTutorialNudge } from '$lib/tutorialSeen.svelte';
	import { TUTORIAL_MAP_ID, isTutorialSandboxActive } from '$lib/tutorialSandbox.svelte';
	import { tutorialState } from '$lib/tutorial.svelte';

	// Flat view of every map - onMount's data-loading loop below doesn't
	// care about grouping, only about (id) -> per-map progress data, so it
	// works off this instead of duplicating the id list a second time.
	const demoMaps = mapGroups.flatMap((group) => group.maps);

	// Every map's target ids, bundled at build time from data/maps/index.json
	// (npm run build-map-index). Replaces 44 runtime fetches of whole map.json
	// files (~484 KB) that the due counts below only needed the ids from.
	const targetIdsByMap = new Map(mapIndex.map((entry) => [entry.id, entry.targetIds]));

	// How well each map is known (FT-26), read by loadHomeProgress. A map
	// never played has no mastery at all and says nothing - it is a map to
	// start, not a map at 0.
	let masteries = $state<Record<string, Mastery | undefined>>({});

	// What the player has typed into the search box (FT-31). Sixty maps in
	// twenty-eight countries is too long a list to scroll through for one of
	// them. Not persisted: a search is about this moment, not a setting.
	let query = $state('');
	// Every group with its maps' labels in the player's language.
	const labelledGroups = $derived(
		mapGroups.map((group) => ({
			...group,
			countryAliases: [countryNameOf(group)],
			maps: group.maps.map((map) => ({ ...map, label: mapTypeLabel(map) }))
		}))
	);
	const shownGroups = $derived(filterGroups(labelledGroups, query));
	const targetCount = (mapId: string) => targetIdsByMap.get(mapId)?.length ?? 0;
	const shownCount = $derived(countMaps(shownGroups));

	// The Exit button is the apps' own: a web page cannot close its tab.
	let isApp = $state(false);

	// The Recent list lives in this device's storage, which the prerendered HTML
	// can't see. Showing it only after mount keeps the first client render equal
	// to that HTML (no hydration mismatch).
	let mounted = $state(false);
	// Favourites and Recent, now on My maps (FT-82): the toolbar's icon
	// counts the maps there, each once.
	const myMapsCount = $derived(mounted ? new Set([...favouriteMaps(), ...recentMaps()]).size : 0);
	// The tutorial's first steps are on the map (FT-79), so it shows the map
	// while one runs, without changing the player's choice.
	const tutorialRuns = $derived(tutorialState().status !== 'idle');
	const showMap = $derived(mounted && (homeView() === 'map' || tutorialRuns));

	onMount(() => {
		mounted = true;
		isNativeShell().then((native) => {
			isApp = native;
		});
	});

	// Runs after mount, and again whenever the tutorial's sandbox starts or ends
	// (FT-10): Italy - Regions' line shows the sandbox during the tutorial and
	// real progress again afterwards.
	$effect(() => {
		void isTutorialSandboxActive();
		let stale = false;
		(async () => {
			let repository: ProgressRepository;
			try {
				repository = await createProgressRepository();
			} catch (e) {
				// The home page is a list, not the game: showing it with no
				// progress data beats not showing it at all (FT-57).
				console.error('Could not open saved progress for the home page.', e);
				return;
			}
			const progress = await loadHomeProgress(
				repository,
				demoMaps.map((map) => map.id),
				targetIdsByMap
			);
			if (stale) return;
			masteries = progress.masteries;
		})();
		return () => {
			stale = true;
		};
	});
</script>

<StartBar {showMap} switchDisabled={tutorialRuns} onView={setHomeView} {isApp} {myMapsCount} />

<main>
	<!-- First visit only, and never while a tutorial is running; after mount,
	     since only the device knows (FT-12). -->
	{#if mounted && showTutorialNudge() && tutorialState().status === 'idle'}
		<TutorialNudge />
	{/if}

	<!-- The map or the list (FT-78, #58), switched in the toolbar and kept on
	     the device. The prerendered page is the list; the map takes its place
	     after mount when it is the choice. While a tutorial runs the map
	     shows, since its first steps are on it (FT-79), and the switch waits. -->
	{#if showMap}
		<!-- The world, then a continent, then a country's maps (FT-77). -->
		<section class="picker-section">
			<WorldPicker groups={labelledGroups} {masteries} {targetCount} />
		</section>
	{:else}
		<!-- Searching is about the full list (FT-31); Favourites and Recent are
		     on My maps (FT-82). -->
		<div class="search">
			<label class="visually-hidden" for="map-search">{t('home.search')}</label>
			<input
				id="map-search"
				type="search"
				autocomplete="off"
				placeholder={t('home.search')}
				bind:value={query}
				onkeydown={(e) => {
					if (e.key === 'Escape') query = '';
				}}
			/>
			{#if query}
				<button class="clear" onclick={() => (query = '')}>{t('home.searchClear')}</button>
			{/if}
		</div>
		{#if query}
			<p class="search-count" aria-live="polite">
				{shownCount === 1
					? t('home.searchOneResult')
					: t('home.searchResults', { count: shownCount })}
			</p>
		{/if}

		<!-- The same sections as the map's panel (#58): the continents' own maps,
		     then each continent's countries, one row each with a listbox of its
		     maps (FT-78). -->
		<MapSections groups={shownGroups} {masteries} {targetCount} tutorialMapId={TUTORIAL_MAP_ID} />
	{/if}
</main>

<style>
	/* A flat white page read as "meh" (direct user feedback) - a soft,
	   low-saturation gradient drawn from the same muted-earthy family as
	   the map's own categorical target palette (base.json), just barely
	   tinted so body text/borders keep their existing contrast. Fixed
	   (not scrolling with content) so it reads as the page's backdrop
	   rather than a decoration that scrolls away. */
	:global(body) {
		min-height: 100vh;
		background: linear-gradient(160deg, #e3f0e6 0%, #dce6f2 45%, #f7ecd9 100%) fixed;
	}
	main {
		max-width: 32rem;
		margin: 1.25rem auto 4rem;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	/* Wider than the column of cards: a map of the world wants the width. */
	.picker-section {
		position: relative;
		left: 50%;
		width: min(calc(100vw - 2rem), 64rem);
		transform: translateX(-50%);
		margin: 1.5rem 0 2rem;
	}
	/* The search box (FT-31): full width on a phone, comfortable to tap, and
	   visually part of the "All maps" list rather than the page header. */
	.search {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin: 0 0 0.75rem;
	}
	.search input {
		flex: 1;
		min-width: 0;
		padding: 0.6rem 0.8rem;
		font: inherit;
		font-size: 1rem;
		color: #1c2b22;
		background: rgba(255, 255, 255, 0.9);
		border: 1px solid rgba(17, 24, 21, 0.18);
		border-radius: 0.6rem;
	}
	.search input:focus-visible {
		outline: 2px solid #5a9c6f;
		outline-offset: 1px;
	}
	.search .clear {
		padding: 0.6rem 0.8rem;
		font: inherit;
		color: #2f6b45;
		background: transparent;
		border: 1px solid rgba(17, 24, 21, 0.18);
		border-radius: 0.6rem;
		cursor: pointer;
	}
	.search-count {
		margin: -0.4rem 0 0.75rem;
		font-size: 0.85rem;
		opacity: 0.75;
	}
	/* Present for screen readers, invisible on screen - the box's own
	   placeholder is what a sighted player reads. */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	@media (min-width: 640px) {
		main {
			max-width: 46rem;
		}
	}
</style>
