<script lang="ts">
	import AppearanceButton from './AppearanceButton.svelte';
	// Shared top nav bar for every map-scoped view - the same buttons everywhere
	// (Maps/Known/Overview/Quiz/Tour) so you can jump directly between modes,
	// with the current view shown as the active tab. The bare /map/<id> route is
	// the Known screen (v0.15, proposal #110) and is where a map pick lands;
	// Overview is a separate mode beside it. Originally only
	// on MapView.svelte; pulled out into its own component once the same
	// markup/CSS needed to be identical across four views - unlike the
	// Tauri/Capacitor SQLite schemas (see DECISIONS.md), there's no reason to
	// hand-duplicate Svelte markup when a shared component is exactly the
	// right tool for it.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$lib/appPaths';
	import type { Snippet } from 'svelte';
	import { t } from './i18n.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import {
		detailedMapsShown,
		forgetDetailed,
		isSeenDetailed,
		mapNavHidden,
		recordVisit,
		setDetailedMapsShown
	} from './mapPrefs.svelte';
	import { mapGroups, mapTypeLabel } from './mapCatalog';
	import FavouriteStar from './FavouriteStar.svelte';
	import TutorialButton from './TutorialButton.svelte';
	import TerrainButton from './TerrainButton.svelte';
	import SoundButton from './SoundButton.svelte';
	import { tutorialState } from './tutorial.svelte';

	let {
		mapId,
		mapName,
		active,
		controls,
		subtitle
	}: {
		mapId: string;
		mapName: string | undefined;
		active?: 'overview' | 'explore' | 'quiz' | 'tour';
		// Primary gameplay actions stay visible above the Settings disclosure.
		controls?: Snippet;
		// Secondary view status belongs with preferences inside Settings.
		subtitle?: Snippet;
	} = $props();

	// Every map view shows this bar, so opening any of them counts as a visit
	// for the home page's Recent list (FT-15). The views are keyed by map id,
	// so each map gets a fresh mount. onMount rather than $effect, because
	// recordVisit reads the list it writes, and an effect would re-run on its
	// own write.
	onMount(() => recordVisit(mapId));

	// The tutorial points at the tabs and the pills, so they show while it
	// runs even if the player had hidden them.
	let languageMenuOpen = $state(false);
	let settingsOpen = $state(false);
	// Tutorial targets inside Settings must be available while it runs.
	$effect(() => {
		if (tutorialState().status !== 'idle') settingsOpen = true;
	});
	$effect(() => {
		if (!settingsOpen) languageMenuOpen = false;
	});
	const hidden = $derived(mapNavHidden() && tutorialState().status === 'idle');
	const currentGroup = $derived(
		mapGroups.find((group) => group.maps.some((map) => map.id === mapId))
	);
	// Small divisions and slices are in the row only when the player ticks
	// "Show detailed maps" - or when the player has opened it before.
	const hasDetailed = $derived((currentGroup?.maps ?? []).some((map) => map.advanced));
	const groupMaps = $derived(
		(currentGroup?.maps ?? []).filter(
			(map) => !map.advanced || detailedMapsShown() || isSeenDetailed(map.id) || map.id === mapId
		)
	);
	// A hidden detail map still needs its checkbox to become discoverable.
	const showMapSwitcher = $derived((currentGroup?.maps.length ?? 0) > 1);
	const pageTitle = $derived(
		[mapName, active ? t(`nav.${active}`) : undefined, 'Geoclick'].filter(Boolean).join(' · ')
	);
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<!-- Hidden by the button under the zoom control (hideButtonsControl). -->
<div
	class="nav-overlay"
	class:hidden
	class:language-menu-open={languageMenuOpen}
	data-map-overlay="top"
>
	<div class="nav-row">
		<a class="nav-btn nav-btn--back" href={resolve('/')}>
			<svg
				class="nav-icon"
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg
			>
			<span class="nav-label">{t('nav.maps')}</span>
		</a>
		<a
			class="nav-btn nav-btn--action"
			class:nav-btn--active={active === 'explore'}
			data-tutorial="nav-explore"
			href={resolve('/map/[mapId]', { mapId })}
		>
			<svg
				class="nav-icon"
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg
			>
			<span class="nav-label">{t('nav.explore')}</span>
		</a>
		<a
			class="nav-btn nav-btn--action"
			class:nav-btn--active={active === 'overview'}
			data-tutorial="nav-overview"
			href={resolve('/map/[mapId]/overview', { mapId })}
		>
			<svg
				class="nav-icon"
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle
					cx="12"
					cy="12"
					r="3"
				/></svg
			>
			<span class="nav-label">{t('nav.overview')}</span>
		</a>
		<a
			class="nav-btn nav-btn--action"
			class:nav-btn--active={active === 'quiz'}
			data-tutorial="nav-quiz"
			href={resolve('/map/[mapId]/quiz', { mapId })}
		>
			<svg
				class="nav-icon"
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5 5.5-6" /></svg
			>
			<span class="nav-label">{t('nav.quiz')}</span>
		</a>
		<a
			class="nav-btn nav-btn--action"
			class:nav-btn--active={active === 'tour'}
			data-tutorial="nav-tour"
			href={resolve('/map/[mapId]/tour', { mapId })}
		>
			<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24"
				><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg
			>
			<span class="nav-label">{t('nav.tour')}</span>
		</a>
	</div>
	<!-- Keep the favourite star beside the map-type row/title, not in the tab
	     row, which is already full at phone width (FT-13, FT-16). -->
	<div class="map-title">
		{#if showMapSwitcher}
			<div class="map-type-row">
				<div
					class="map-type-scroll"
					role="group"
					aria-label={t('home.mapTypeFor', { name: currentGroup?.country ?? '' })}
				>
					{#each groupMaps as countryMap (countryMap.id)}
						<span class="map-type-chip">
							<button
								type="button"
								class="map-type-btn"
								data-map-id={countryMap.id}
								class:map-type-btn--active={countryMap.id === mapId}
								aria-pressed={countryMap.id === mapId}
								onclick={() => {
									if (countryMap.id !== mapId) {
										goto(resolve('/map/[mapId]', { mapId: countryMap.id }));
									}
								}}
							>
								{mapTypeLabel(countryMap)}
							</button>
							<!-- A detailed map there because it was opened can be put away again
						     (v0.18). Not on the open map, nor when the tick shows them all. -->
							{#if countryMap.advanced && isSeenDetailed(countryMap.id) && !detailedMapsShown() && countryMap.id !== mapId}
								<button
									type="button"
									class="map-type-x"
									data-forget-id={countryMap.id}
									aria-label={t('nav.hideDetailedMap', { name: mapTypeLabel(countryMap) })}
									title={t('nav.hideDetailedMap', { name: mapTypeLabel(countryMap) })}
									onclick={() => forgetDetailed(countryMap.id)}>✕</button
								>
							{/if}
						</span>
					{/each}
				</div>
				<FavouriteStar {mapId} size="bar" />
			</div>
		{:else}
			<span class="map-label">{mapName ?? t('nav.loading')}</span>
			<FavouriteStar {mapId} size="bar" />
		{/if}
	</div>
	{#if controls}{@render controls()}{/if}
	<details class="settings-panel" bind:open={settingsOpen}>
		<summary>{t('nav.settings')}</summary>
		<div class="settings-content">
			{#if hasDetailed}
				<label class="detailed-toggle">
					<input
						type="checkbox"
						checked={detailedMapsShown()}
						onchange={(event) => setDetailedMapsShown(event.currentTarget.checked)}
					/>
					{t('nav.detailedMaps')}
				</label>
			{/if}
			{#if subtitle}<div class="subtitle">{@render subtitle()}</div>{/if}
			<div class="prefs-row">
				<LanguageSwitcher bind:open={languageMenuOpen} />
				<TerrainButton />
				{#if active === 'quiz'}<SoundButton />{/if}
				<AppearanceButton />
				<TutorialButton />
			</div>
		</div>
	</details>
</div>

<style>
	/* Menus must escape the badge's stacking level while open; keep the
	 * ordinary toolbar below quiz trays and other overlays otherwise. */
	.nav-overlay.language-menu-open {
		z-index: 21;
	}
	.nav-overlay.hidden {
		display: none;
	}
	.nav-overlay {
		position: absolute;
		top: 8px;
		left: 8px;
		/* Stop short of MapLibre's zoom control (top-right, ~40px wide): the
		   row used to run under it on phones, hiding half of the last tab. */
		right: 64px;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.nav-row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		width: 100%;
	}
	.nav-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: 28px;
		box-sizing: border-box;
		padding: 1px 0.25rem;
		/* Opaque: maps now open on the labelled overview (FT-13), and names near
		   the top edge used to show through a 96%-white tab. */
		background: var(--gc-surface, #ffffff);
		border: 1px solid var(--gc-border, rgba(17, 24, 21, 0.08));
		border-radius: 0.625rem;
		box-shadow: 0 1px 3px rgba(17, 24, 21, 0.12);
		text-decoration: none;
		font-family: system-ui, sans-serif;
	}
	.nav-icon {
		display: block;
		width: 16px;
		height: 16px;
	}
	.nav-label {
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
	}
	.nav-btn--back {
		color: var(--gc-muted, #4a5650);
	}
	.nav-btn--action {
		color: var(--gc-accent, #b5691f);
	}
	.nav-btn--active {
		background: var(--gc-accent, #b5691f);
		border-color: var(--gc-accent, #b5691f);
		color: var(--gc-on-strong, #ffffff);
	}
	.settings-panel {
		max-width: 100%;
		min-width: 0;
		font-family: system-ui, sans-serif;
	}
	summary {
		overflow-wrap: anywhere;
		padding: 2px 6px;
		border: 1px solid var(--gc-border, #c9d3cc);
		border-radius: 6px;
		background: var(--gc-surface, white);
		color: var(--gc-text, #1c2b22);
		font-size: 0.75rem;
		cursor: pointer;
		position: sticky;
		top: 0;
		z-index: 1;
	}
	.settings-content {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		padding-top: 4px;
	}
	.prefs-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.map-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.map-type-row {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		max-width: min(60rem, calc(100vw - 64px));
		min-width: 0;
	}
	.map-type-scroll {
		display: flex;
		flex: 1;
		gap: 4px;
		min-width: 0;
		/* Wraps rather than scrolls: a row that fits the screen never gets a
		   scrollbar, and a long one takes a second line. */
		flex-wrap: wrap;
	}
	.detailed-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: system-ui, sans-serif;
		font-size: 0.75rem;
		color: var(--gc-text, #2e4037);
		background: var(--gc-surface, rgba(255, 255, 255, 0.85));
		padding: 2px 5px;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.map-type-chip {
		display: inline-flex;
		flex: none;
		align-items: stretch;
	}
	/* Big and red on purpose: putting a detailed map away must be easy to find. */
	.map-type-x {
		min-width: 28px;
		min-height: 28px;
		margin-left: 0.15rem;
		padding: 2px 5px;
		font: inherit;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1;
		color: var(--gc-on-strong, #ffffff);
		background: var(--gc-danger-strong, #b3261e);
		border: 1px solid var(--gc-danger-strong, #b3261e);
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.map-type-x:focus-visible {
		outline: 2px solid var(--gc-danger-strong, #b3261e);
		outline-offset: 2px;
	}
	.map-type-btn {
		flex: none;
		min-height: 28px;
		box-sizing: border-box;
		padding: 2px 5px;
		font: inherit;
		font-size: 0.75rem;
		color: var(--gc-text, #2e4037);
		white-space: nowrap;
		background: var(--gc-surface, #ffffff);
		border: 1px solid var(--gc-border, rgba(17, 24, 21, 0.16));
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.map-type-btn--active {
		color: var(--gc-on-strong, #ffffff);
		background: var(--gc-accent, #b5691f);
		border-color: var(--gc-accent, #b5691f);
	}
	.map-type-btn:focus-visible {
		outline: 2px solid var(--gc-accent, #b5691f);
		outline-offset: 2px;
	}
	.map-label {
		font-size: 0.75rem;
		color: var(--gc-muted, rgba(30, 40, 36, 0.6));
		background: var(--gc-surface, rgba(255, 255, 255, 0.75));
		padding: 2px 5px;
		border-radius: 0.4rem;
		font-family: system-ui, sans-serif;
	}
	.subtitle {
		font-size: 0.75rem;
		color: var(--gc-muted, rgba(30, 40, 36, 0.7));
		background: var(--gc-surface, rgba(255, 255, 255, 0.85));
		padding: 2px 5px;
		border-radius: 0.4rem;
		font-family: system-ui, sans-serif;
		/* Secondary view status can wrap without widening the toolbar. */
		max-width: 28rem;
	}
	/* 720px, not the app's usual 640: five wide tabs (FT-13) in German or
	   Italian need ~610px and must end before the zoom control. */
	@media (min-width: 720px) {
		.nav-overlay {
			right: auto;
		}
		.nav-row {
			width: auto;
		}
		.nav-btn {
			flex: none;
			flex-direction: row;
			gap: 4px;
			padding: 1px 1.1rem;
		}
		.nav-label {
			font-size: 0.875rem;
		}
	}
</style>
