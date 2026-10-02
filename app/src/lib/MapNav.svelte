<script lang="ts">
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
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { t } from './i18n.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { mapNavHidden, recordVisit } from './mapPrefs.svelte';
	import { mapGroups, mapTypeLabel } from './mapCatalog';
	import FavouriteStar from './FavouriteStar.svelte';
	import TutorialButton from './TutorialButton.svelte';
	import TerrainButton from './TerrainButton.svelte';
	import { tutorialState } from './tutorial.svelte';

	let {
		mapId,
		mapName,
		active,
		subtitle
	}: {
		mapId: string;
		mapName: string | undefined;
		active?: 'overview' | 'explore' | 'quiz' | 'tour';
		// Optional view-specific line under the map-name tag (e.g. QuizView's
		// "drag each name..." progress count) - a snippet rather than a
		// second absolutely-positioned overlay, so it stacks naturally under
		// the nav row instead of needing a guessed pixel offset to clear it.
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
	const hidden = $derived(mapNavHidden() && tutorialState().status === 'idle');
	const currentGroup = $derived(
		mapGroups.find((group) => group.maps.some((map) => map.id === mapId))
	);
	// Small divisions and slices stay on the start screen's list; the row here
	// shows the standard maps, plus the open map if it is one of the others.
	const groupMaps = $derived(
		(currentGroup?.maps ?? []).filter((map) => !map.advanced || map.id === mapId)
	);
	const showMapSwitcher = $derived(groupMaps.length > 1);
	let mapTypeScroller = $state<HTMLDivElement | undefined>(undefined);

	// Long map-type rows scroll on phones. Keep the current type in view when
	// opening a map directly or switching to a type near the end of the list.
	$effect(() => {
		if (hidden || !mapTypeScroller) return;
		const selectedMapId = mapId;
		const selectedButton = [
			...mapTypeScroller.querySelectorAll<HTMLButtonElement>('.map-type-btn')
		].find((button) => button.dataset.mapId === selectedMapId);
		selectedButton?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	});
</script>

<!-- Hidden by the button under the zoom control (hideButtonsControl). -->
<div class="nav-overlay" class:hidden data-map-overlay="top">
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
					bind:this={mapTypeScroller}
					class="map-type-scroll"
					role="group"
					aria-label={t('home.mapTypeFor', { name: currentGroup?.country ?? '' })}
				>
					{#each groupMaps as countryMap (countryMap.id)}
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
					{/each}
				</div>
				<FavouriteStar {mapId} size="bar" />
			</div>
		{:else}
			<span class="map-label">{mapName ?? t('nav.loading')}</span>
			<FavouriteStar {mapId} size="bar" />
		{/if}
	</div>
	{#if subtitle}
		<span class="subtitle">{@render subtitle()}</span>
	{/if}
	<div class="prefs-row">
		<LanguageSwitcher />
		<TerrainButton />
		<TutorialButton />
	</div>
</div>

<style>
	.nav-overlay.hidden {
		display: none;
	}
	.nav-overlay {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		/* Stop short of MapLibre's zoom control (top-right, ~40px wide): the
		   row used to run under it on phones, hiding half of the last tab. */
		right: 3.5rem;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
	}
	.nav-row {
		display: flex;
		gap: 0.5rem;
		width: 100%;
	}
	.nav-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-height: 2.75rem;
		box-sizing: border-box;
		padding: 0.65rem 0.25rem 0.6rem;
		/* Opaque: maps now open on the labelled overview (FT-13), and names near
		   the top edge used to show through a 96%-white tab. */
		background: #ffffff;
		border: 1px solid rgba(17, 24, 21, 0.08);
		border-radius: 0.625rem;
		box-shadow: 0 1px 3px rgba(17, 24, 21, 0.12);
		text-decoration: none;
		font-family: system-ui, sans-serif;
	}
	.nav-icon {
		display: block;
	}
	.nav-label {
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
	}
	.nav-btn--back {
		color: #4a5650;
	}
	.nav-btn--action {
		color: #b5691f;
	}
	.nav-btn--active {
		background: #b5691f;
		border-color: #b5691f;
		color: #ffffff;
	}
	.prefs-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.map-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.map-type-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		max-width: min(42rem, calc(100vw - 4.5rem));
		min-width: 0;
	}
	.map-type-scroll {
		display: flex;
		flex: 1;
		gap: 0.4rem;
		min-width: 0;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
	}
	.map-type-btn {
		flex: none;
		min-height: 2rem;
		box-sizing: border-box;
		padding: 0.3rem 0.6rem;
		font: inherit;
		font-size: 0.75rem;
		color: #2e4037;
		white-space: nowrap;
		background: #ffffff;
		border: 1px solid rgba(17, 24, 21, 0.16);
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.map-type-btn--active {
		color: #ffffff;
		background: #b5691f;
		border-color: #b5691f;
	}
	.map-type-btn:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 2px;
	}
	.map-label {
		font-size: 0.75rem;
		color: rgba(30, 40, 36, 0.6);
		background: rgba(255, 255, 255, 0.75);
		padding: 0.2rem 0.55rem;
		border-radius: 0.4rem;
		font-family: system-ui, sans-serif;
	}
	.subtitle {
		font-size: 0.75rem;
		color: rgba(30, 40, 36, 0.7);
		background: rgba(255, 255, 255, 0.85);
		padding: 0.2rem 0.55rem;
		border-radius: 0.4rem;
		font-family: system-ui, sans-serif;
		/* Wide enough for the progress count plus the difficulty note (FT-21). */
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
			gap: 0.5rem;
			padding: 0.6rem 1.1rem;
		}
		.nav-label {
			font-size: 0.875rem;
		}
	}
</style>
