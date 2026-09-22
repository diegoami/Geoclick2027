<script lang="ts">
	// A map's standing, drawn as a bar rather than written as "{known} /
	// {total} known" (FT-65, docs/PLAN_V0.10.md). Renders nothing at all when
	// nothing is known: a bar sitting at zero is worse than no bar, and that is
	// exactly the case of a map that has been played but has no name at a
	// clean streak yet - which used to read "0 / 49 known". The count is kept
	// as the bar's accessible name.
	import { t } from './i18n.svelte';

	let {
		known,
		total,
		allKnown = false
	}: { known: number; total: number; allKnown?: boolean } = $props();
</script>

{#if known > 0}
	<span
		class="known-bar"
		class:all-known={allKnown}
		role="progressbar"
		aria-label={t('home.known', { known, total })}
		aria-valuenow={known}
		aria-valuemin={0}
		aria-valuemax={total}
	>
		<span class="known-bar-fill" style="width: {Math.round((known / total) * 100)}%"></span>
	</span>
{/if}

<style>
	.known-bar {
		display: inline-block;
		width: 4.5rem;
		height: 0.4rem;
		vertical-align: middle;
		background: rgba(176, 106, 47, 0.2);
		border-radius: 999px;
		overflow: hidden;
	}
	.known-bar-fill {
		display: block;
		height: 100%;
		background: #b06a2f;
		border-radius: 999px;
	}
	/* A map with nothing left to learn reads as done, not as work to do. */
	.all-known .known-bar-fill {
		background: #4a7c5c;
	}
</style>
