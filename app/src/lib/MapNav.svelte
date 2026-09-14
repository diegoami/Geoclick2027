<script lang="ts">
	// Shared top nav bar for every map-scoped view - the same buttons everywhere
	// (Maps/Overview/Explore/Quiz/Tour) so you can jump directly between modes,
	// with the current view shown as the active tab. A map opens on its
	// Overview (FT-13); Explore (click a region to see its name) is the bare
	// /map/<id> route, reached from here. Originally only
	// on MapView.svelte; pulled out into its own component once the same
	// markup/CSS needed to be identical across four views - unlike the
	// Tauri/Capacitor SQLite schemas (see DECISIONS.md), there's no reason to
	// hand-duplicate Svelte markup when a shared component is exactly the
	// right tool for it.
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { t } from './i18n.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { recordVisit } from './mapPrefs.svelte';

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
</script>

<div class="nav-overlay">
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
			class:nav-btn--active={active === 'overview'}
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
			class:nav-btn--active={active === 'explore'}
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
			class:nav-btn--active={active === 'quiz'}
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
			href={resolve('/map/[mapId]/tour', { mapId })}
		>
			<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24"
				><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg
			>
			<span class="nav-label">{t('nav.tour')}</span>
		</a>
	</div>
	<span class="map-label">{mapName ?? t('nav.loading')}</span>
	{#if subtitle}
		<span class="subtitle">{@render subtitle()}</span>
	{/if}
	<LanguageSwitcher />
</div>

<style>
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
		max-width: 20rem;
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
