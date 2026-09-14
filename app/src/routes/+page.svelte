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
	import { mapGroups } from '$lib/mapCatalog';
	import { RELEASES_URL, isNativeShell } from '$lib/platform';

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

	onMount(() => {
		isNativeShell().then((native) => (showDownload = !native));
		(async () => {
			const repository = await createProgressRepository();
			const summaryEntries = await Promise.all(
				demoMaps.map(
					async (map) => [map.id, await repository.getLastSessionSummary(map.id)] as const
				)
			);
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
			dueStatuses = Object.fromEntries(dueEntries);
		})();
	});
</script>

<main>
	<div class="header-row">
		<h1>Geoclick</h1>
		<LanguageSwitcher />
	</div>
	<p>{t('home.subtitle')}</p>
	{#if showDownload}
		<p class="download">
			{t('home.download.lead')}
			<a href={RELEASES_URL} target="_blank" rel="external noopener">{t('home.download.link')}</a>
		</p>
	{/if}
	<div class="groups">
		{#each mapGroups as group (group.country)}
			<section class="country-group">
				<h2>{group.country}</h2>
				<ul>
					{#each group.maps as map (map.id)}
						{@const summary = lastSessions[map.id]}
						{@const due = dueStatuses[map.id]}
						<li>
							<a href={resolve('/map/[mapId]/overview', { mapId: map.id })}>
								<span class="map-name">{t(map.labelKey)}</span>
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
						</li>
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
	.groups {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		text-align: left;
	}
	.country-group h2 {
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
		.groups {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			column-gap: 2rem;
			row-gap: 1.5rem;
			align-items: start;
		}
	}
</style>
