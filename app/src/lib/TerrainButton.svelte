<script lang="ts">
	// Switches the Terrain layer on and off (FT-33, docs/PLAN_V0.8.md): sea,
	// rivers and named ranges behind the map. In the map bar's prefs row
	// beside the language pills and the tutorial button, styled like them -
	// the tab row above is already full at phone width, and this is a
	// setting, not a place to go.
	//
	// The preference is one flag for all 63 maps (mapPrefs.svelte.ts), so
	// pressing this once is enough; refreshTerrain() applies it to whatever
	// map is currently open.
	import { t } from './i18n.svelte';
	import { setTerrainShown, terrainShown } from './mapPrefs.svelte';
	import { refreshTerrain } from './geoclickMap';

	const shown = $derived(terrainShown());

	function toggle() {
		setTerrainShown(!terrainShown());
		refreshTerrain();
	}
</script>

<button
	type="button"
	class="terrain-btn"
	class:terrain-btn--on={shown}
	data-testid="terrain-toggle"
	aria-pressed={shown}
	onclick={toggle}
>
	<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"
		><path
			d="M2 18l6-9 4 5.5 3-4L22 18z"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linejoin="round"
		/></svg
	>
	{t('nav.terrain')}
</button>

<style>
	.terrain-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: system-ui, sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.2;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		border: 1px solid rgba(181, 105, 31, 0.45);
		background: #ffffff;
		color: #b5691f;
		cursor: pointer;
	}
	/* A finger-sized target around a pill that stays small (FT-32). */
	.terrain-btn::after {
		content: '';
		position: absolute;
		inset: -0.5rem -0.3rem;
	}
	.terrain-btn {
		position: relative;
	}
	.terrain-btn--on {
		background: #b5691f;
		border-color: #b5691f;
		color: #ffffff;
	}
	.terrain-btn:hover:not(.terrain-btn--on) {
		background: #fbf4ec;
	}
	.terrain-btn:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 2px;
	}
</style>
