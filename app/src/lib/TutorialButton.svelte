<script lang="ts">
	// Starts the tutorial (FT-11), or brings back a paused one. On the home page
	// header and in the map bar, next to the language pills and styled like
	// them: the tab row is already full at phone width (docs/TUTORIAL.md).
	import { t } from './i18n.svelte';
	import { dispatch } from './tutorial.svelte';
</script>

<button
	type="button"
	class="tutorial-btn"
	data-tutorial="tutorial-button"
	onclick={() => dispatch({ type: 'start' })}
>
	<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"
		><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2" /><path
			d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.8v.4"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/><circle cx="12" cy="17.3" r="1.2" fill="currentColor" /></svg
	>
	{t('tutorial.button')}
</button>

<style>
	.tutorial-btn {
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
	.tutorial-btn:hover {
		background: #fbf4ec;
	}
	.tutorial-btn:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 2px;
	}
</style>
