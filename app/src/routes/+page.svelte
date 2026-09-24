<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import mapIndex from '../../../data/maps/index.json';
	import {
		createProgressRepository,
		type ProgressRepository,
		type SessionSummary
	} from '$lib/progressRepository';
	import { handSize } from '$lib/difficulty';
	import { loadHomeProgress, type Mastery } from '$lib/homeProgress';
	import { countMaps, filterGroups } from '$lib/mapSearch';
	import { t, tPlural } from '$lib/i18n.svelte';
	import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';
	import KnownProgress from '$lib/KnownProgress.svelte';
	import { mapDisplayName, mapGroups, mapTypeLabel } from '$lib/mapCatalog';
	import { favouriteMaps, recentMaps } from '$lib/mapPrefs.svelte';
	import FavouriteStar from '$lib/FavouriteStar.svelte';
	import { RELEASES_URL, isNativeShell } from '$lib/platform';
	import TutorialButton from '$lib/TutorialButton.svelte';
	import TutorialNudge from '$lib/TutorialNudge.svelte';
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

	// Last-session summaries and due state live in localStorage (Iteration
	// 5/6), which isn't available during the prerendered build - read them
	// after mount, same pattern as the rest of the app's client-only data
	// fetching.
	let lastSessions = $state<Record<string, SessionSummary | undefined>>({});

	// How well each map is known (FT-26), read by loadHomeProgress. A map
	// never played has no mastery at all and says nothing - it is a map to
	// start, not a map at 0.
	let masteries = $state<Record<string, Mastery | undefined>>({});

	// What the player has typed into the search box (FT-31). Sixty maps in
	// twenty-eight countries is too long a list to scroll through for one of
	// them. Not persisted: a search is about this moment, not a setting.
	let query = $state('');
	const shownGroups = $derived(
		filterGroups(
			mapGroups.map((group) => ({
				...group,
				maps: group.maps.map((map) => ({ ...map, label: mapTypeLabel(map) }))
			})),
			query
		)
	);
	const shownCount = $derived(countMaps(shownGroups));

	// The download link is for web visitors only - pointless inside the desktop
	// or Android app itself. Off until checked, so the apps never flash it.
	let showDownload = $state(false);

	// The Recent list lives in this device's storage, which the prerendered HTML
	// can't see. Showing it only after mount keeps the first client render equal
	// to that HTML (no hydration mismatch).
	let mounted = $state(false);
	const hasShortcuts = $derived(mounted && (favouriteMaps().length > 0 || recentMaps().length > 0));

	onMount(() => {
		mounted = true;
		isNativeShell().then((native) => (showDownload = !native));
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
			lastSessions = progress.summaries;
			masteries = progress.masteries;
		})();
		return () => {
			stale = true;
		};
	});
</script>

<main>
	<div class="header-row">
		<h1>Geoclick</h1>
		<LanguageSwitcher />
		<TutorialButton />
	</div>
	<p>{t('home.subtitle')}</p>
	{#if showDownload}
		<p class="download">
			{t('home.download.lead')}
			<a href={RELEASES_URL} target="_blank" rel="external noopener">{t('home.download.link')}</a>
		</p>
	{/if}
	<!-- First visit only, and never while a tutorial is running; after mount,
	     since only the device knows (FT-12). -->
	{#if mounted && showTutorialNudge() && tutorialState().status === 'idle'}
		<TutorialNudge />
	{/if}

	{#snippet mapCard(mapId: string, label: string, anchor?: string)}
		{@const summary = lastSessions[mapId]}
		{@const mastery = masteries[mapId]}
		<li class="map-card" data-tutorial={anchor}>
			<!-- A map opens on Known (FT-39): the map you build by tapping names
		     onto it. Overview, which labels everything at once, is a tab away. -->
			<a href={resolve('/map/[mapId]', { mapId })}>
				<span class="map-name">{label}</span>
				{#if mastery}
					<span class="mastery" class:all-known={mastery.known === mastery.total}>
						<!-- A bar, not the number (FT-65); it renders nothing until the
						     first name is known. -->
						<KnownProgress
							known={mastery.known}
							total={mastery.total}
							allKnown={mastery.known === mastery.total}
						/>
						<!-- The ladder, but only once the hand has started shrinking
						     (FT-21): level 0's hand of ten is the default and there is
						     nothing to explain (FT-60). -->
						{#if mastery.level > 0}
							· {tPlural('quiz.namesAtATime', handSize(mastery.level), {
								count: handSize(mastery.level)
							})}
						{/if}
					</span>
				{/if}
				{#if summary}
					<span class="last-result">
						{t('home.lastResult', { perfect: summary.perfect, total: summary.total })}
						{#if summary.totalErrors > 0}
							{tPlural('home.mistakeCount', summary.totalErrors, {
								count: summary.totalErrors
							})}
						{/if}
					</span>
				{/if}
			</a>
			<!-- A sibling of the link, not inside it: two separate controls for
			     keyboard and screen readers (FT-16). -->
			<span class="card-star"><FavouriteStar {mapId} /></span>
		</li>
	{/snippet}

	<!-- Favourites and Recent share one panel, set apart from the full list by
	     its background and the "All maps" heading below (FT-17): as plain
	     sections they read like two more countries. -->
	{#if hasShortcuts}
		<div class="shortcuts">
			{#if favouriteMaps().length > 0}
				<section class="shortcut-group">
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
						{#each favouriteMaps() as mapId (mapId)}
							{@render mapCard(mapId, mapDisplayName(mapId) ?? mapId)}
						{/each}
					</ul>
				</section>
			{/if}

			{#if recentMaps().length > 0}
				<section class="shortcut-group">
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
						{#each recentMaps() as mapId (mapId)}
							{@render mapCard(mapId, mapDisplayName(mapId) ?? mapId)}
						{/each}
					</ul>
				</section>
			{/if}
		</div>
		<h2 class="all-maps">{t('home.allMaps')}</h2>
	{/if}

	<!-- Searching is about the full list; Favourites and Recent are short by
	     definition and stay where they are (FT-31). -->
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

	<div class="groups">
		{#each shownGroups as group (group.country)}
			<section class="country-group">
				<h3>{group.country}</h3>
				<ul>
					{#each group.maps as map (map.id)}
						<!-- The tutorial's first step points at this card, not at a copy of it in
						     Favourites or Recent, which not everyone has (docs/TUTORIAL.md). -->
						{@render mapCard(
							map.id,
							map.label,
							map.id === TUTORIAL_MAP_ID ? 'home-map-card' : undefined
						)}
					{/each}
				</ul>
			</section>
		{/each}
	</div>
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
		margin: 4rem auto;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	.header-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.header-row h1 {
		margin: 0;
	}
	.download {
		margin-top: -0.5rem;
		font-size: 0.9rem;
		color: #4a5650;
	}
	/* Overrides the page's map-card link style below. */
	.download a {
		display: inline;
		padding: 0;
		border: none;
		color: #b5691f;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.download a:hover {
		background: none;
		text-decoration-thickness: 2px;
	}
	/* Favourites (FT-16) and Recent (FT-15): full-width sections above the
	   country list, cards labelled with the full map name. */
	.map-card {
		position: relative;
	}
	/* Room on the right of every card for its favourite star. */
	.map-card a {
		padding-right: 3rem;
	}
	.card-star {
		position: absolute;
		top: 0.3rem;
		right: 0.35rem;
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
	.shortcuts {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 2rem;
		padding: 1rem 1rem 1.1rem;
		text-align: left;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(181, 105, 31, 0.28);
		border-radius: 1rem;
		box-shadow: 0 2px 10px rgba(17, 24, 21, 0.06);
	}
	.shortcut-group h2 {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0 0 0.6rem;
		font-size: 1rem;
		font-weight: 700;
		color: #b5691f;
	}
	.shortcut-group h2 svg {
		width: 1.1rem;
		height: 1.1rem;
	}
	/* Opaque on the panel's lighter ground, so these cards stand out from the
	   list's. */
	.shortcut-group .map-card a {
		background: #ffffff;
	}
	.shortcut-group .map-card a:hover {
		background: #fbf4ec;
	}
	.all-maps {
		margin: 0 0 1rem;
		padding-bottom: 0.4rem;
		border-bottom: 2px solid rgba(44, 58, 51, 0.25);
		font-size: 1.15rem;
		font-weight: 700;
		color: #2c3a33;
		text-align: left;
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		text-align: left;
	}
	.country-group h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		font-weight: 700;
		color: #2c3a33;
		border-bottom: 1px solid #e0e0e0;
		padding-bottom: 0.25rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	a {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.6rem 1rem;
		border: 1px solid #ccc;
		border-radius: 0.5rem;
		text-decoration: none;
		color: inherit;
	}
	a:hover {
		background: #f4f4f4;
	}
	.mastery {
		font-size: 0.8rem;
		font-weight: 600;
		color: #b06a2f;
	}
	/* A map with nothing left to learn reads as done, not as work to do. */
	.mastery.all-known {
		color: #4a7c5c;
	}
	.last-result {
		font-size: 0.8rem;
		opacity: 0.7;
	}
	@media (min-width: 640px) {
		main {
			max-width: 46rem;
		}
		.shortcut-group ul {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			column-gap: 2rem;
		}
		.groups {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			column-gap: 2rem;
			row-gap: 1.5rem;
			align-items: start;
		}
	}
</style>
