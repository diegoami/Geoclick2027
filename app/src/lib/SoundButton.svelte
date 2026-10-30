<script lang="ts">
	// Switches the quiz's answer sounds on and off (#268). In the map bar's
	// prefs row beside Terrain, styled like it, and only on the Quiz, the one
	// screen that makes a sound. One flag for every map (mapPrefs.svelte.ts).
	import { t } from './i18n.svelte';
	import { setSoundOn, soundOn } from './mapPrefs.svelte';

	const on = $derived(soundOn());
</script>

<button
	type="button"
	class="terrain-btn"
	class:terrain-btn--on={on}
	data-testid="sound-toggle"
	aria-pressed={on}
	onclick={() => setSoundOn(!soundOn())}
>
	<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"
		><path
			d="M4 9h4l5-4v14l-5-4H4z{on ? 'M16.5 8.5a5 5 0 0 1 0 7' : ''}"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
		/></svg
	>
	{t('nav.sound')}
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
		border: 1px solid var(--gc-accent, rgba(181, 105, 31, 0.45));
		background: var(--gc-surface, #ffffff);
		color: var(--gc-accent, #b5691f);
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
		background: var(--gc-accent, #b5691f);
		border-color: var(--gc-accent, #b5691f);
		color: var(--gc-on-strong, #ffffff);
	}
	.terrain-btn:hover:not(.terrain-btn--on) {
		background: var(--gc-accent-soft, #fbf4ec);
	}
	.terrain-btn:focus-visible {
		outline: 2px solid var(--gc-accent, #b5691f);
		outline-offset: 2px;
	}
</style>
