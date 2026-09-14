<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import mapIndex from '../../../data/maps/index.json';
	import {
		createProgressRepository,
		todayLocalDate,
		type SessionSummary
	} from '$lib/progressRepository';
	import { isDue } from '@geoclick/srs';
	import { t, tPlural } from '$lib/i18n.svelte';
	import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';
	import { mapDisplayName, mapGroups } from '$lib/mapCatalog';
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

	// "Not started" (no card state at all - map never played) is a distinct
	// state from "up to date" (played, but everything's graduated past
	// today) - don't conflate the two, see ROADMAP.md's Iteration 6 design.
	type DueStatus = { kind: 'notStarted' } | { kind: 'upToDate' } | { kind: 'due'; count: number };
	let dueStatuses = $state<Record<string, DueStatus | undefined>>({});

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
			const repository = await createProgressRepository();
			const summaryEntries = await Promise.all(
				demoMaps.map(
					async (map) => [map.id, await repository.getLastSessionSummary(map.id)] as const
				)
			);
			if (stale) return;
			lastSessions = Object.fromEntries(summaryEntries);

			const today = todayLocalDate();
			const dueEntries = await Promise.all(
				demoMaps.map(async (map) => {
					const cardStates = await repository.getCardStates(map.id);
					if (cardStates.length === 0)
						return [map.id, { kind: 'notStarted' } as DueStatus] as const;
					const byId = new Map(cardStates.map((c) => [c.targetId, c]));
					// Over the map's CURRENT target ids: unseen targets count as due
					// (isDue(undefined) is true) and progress for a since-renamed or
					// removed target is ignored - same semantics as before GC-071.
					const targetIds = targetIdsByMap.get(map.id) ?? [];
					const dueCount = targetIds.filter((id) => isDue(byId.get(id), today)).length;
					const status: DueStatus =
						dueCount === 0 ? { kind: 'upToDate' } : { kind: 'due', count: dueCount };
					return [map.id, status] as const;
				})
			);
			if (stale) return;
			dueStatuses = Object.fromEntries(dueEntries);
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
		{@const due = dueStatuses[mapId]}
		<li class="map-card" data-tutorial={anchor}>
			<a href={resolve('/map/[mapId]/overview', { mapId })}>
				<span class="map-name">{label}</span>
				{#if due && due.kind !== 'notStarted'}
					<span class="due-status" class:up-to-date={due.kind === 'upToDate'}>
						{due.kind === 'upToDate'
							? t('home.due.upToDate')
							: t('home.due.toReview', { count: due.count })}
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

	<div class="groups">
		{#each mapGroups as group (group.country)}
			<section class="country-group">
				<h3>{group.country}</h3>
				<ul>
					{#each group.maps as map (map.id)}
						<!-- The tutorial's first step points at this card, not at a copy of it in
						     Favourites or Recent, which not everyone has (docs/TUTORIAL.md). -->
						{@render mapCard(
							map.id,
							t(map.labelKey),
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
	.due-status {
		font-size: 0.8rem;
		font-weight: 600;
		color: #b06a2f;
	}
	.due-status.up-to-date {
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
