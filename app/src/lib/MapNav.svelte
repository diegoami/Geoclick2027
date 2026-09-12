<script lang="ts">
	// Shared top nav bar for every map-scoped view (explore, overview, quiz,
	// tour) - same 4 buttons everywhere (Maps/Overview/Quiz/Tour) so you can
	// jump directly between modes without going back to the map landing page
	// first, with the current view shown as the active tab. Originally only
	// on MapView.svelte; pulled out into its own component once the same
	// markup/CSS needed to be identical across four views - unlike the
	// Tauri/Capacitor SQLite schemas (see DECISIONS.md), there's no reason to
	// hand-duplicate Svelte markup when a shared component is exactly the
	// right tool for it.
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	let {
		mapId,
		mapName,
		active,
		subtitle
	}: {
		mapId: string;
		mapName: string | undefined;
		active?: 'overview' | 'quiz' | 'tour';
		// Optional view-specific line under the map-name tag (e.g. QuizView's
		// "drag each name..." progress count) - a snippet rather than a
		// second absolutely-positioned overlay, so it stacks naturally under
		// the nav row instead of needing a guessed pixel offset to clear it.
		subtitle?: Snippet;
	} = $props();
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
			<span class="nav-label">Maps</span>
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
			<span class="nav-label">Overview</span>
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
			<span class="nav-label">Quiz</span>
		</a>
		<a
			class="nav-btn nav-btn--action"
			class:nav-btn--active={active === 'tour'}
			href={resolve('/map/[mapId]/tour', { mapId })}
		>
			<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24"
				><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg
			>
			<span class="nav-label">Tour</span>
		</a>
	</div>
	<span class="map-label">{mapName ?? 'Loading…'}</span>
	{#if subtitle}
		<span class="subtitle">{@render subtitle()}</span>
	{/if}
</div>

<style>
	.nav-overlay {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		right: 0.75rem;
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
		background: rgba(255, 255, 255, 0.96);
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
	@media (min-width: 640px) {
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
