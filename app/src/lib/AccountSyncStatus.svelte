<script lang="ts">
	import { accountState } from './account.svelte';
	import { t, type TranslationKey } from './i18n.svelte';
	const model = $derived(accountState());
</script>

{#if model.usingAccount}
	<span class="sync-status" role="status" title={t(`account.sync.${model.sync}` as TranslationKey)}
		>{t(`account.status.${model.sync}` as TranslationKey)}</span
	>
{/if}

<style>
	.sync-status {
		max-width: 100%;
		font-size: 0.75rem;
		overflow-wrap: anywhere;
	}
</style>
