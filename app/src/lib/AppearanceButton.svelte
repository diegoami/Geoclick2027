<script lang="ts">
	import { t } from './i18n.svelte';
	import { setAppearanceOpen } from './appearance.svelte';
</script>

<button
	type="button"
	class="gc-tool appearance-button"
	aria-label={t('appearance.title')}
	title={t('appearance.title')}
	aria-haspopup="dialog"
	onclick={() => setAppearanceOpen(true)}
>
	<svg viewBox="0 0 24 24" aria-hidden="true"
		><path d="m3 19 6-14 6 14M5 14h8M18 8h3M19.5 6.5v3M18 16h3" /></svg
	>
</button>

<style>
	.appearance-button {
		flex: none;
		background: var(--gc-surface, white);
		color: var(--gc-text, #2c3a33);
		border: 1px solid var(--gc-border, #c9d3cc);
	}
</style>
