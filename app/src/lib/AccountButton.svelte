<script lang="ts">
	import { t, type TranslationKey } from './i18n.svelte';
	import { accountOpen, setAccountOpen } from './accountDialogState.svelte';
	import { accountState } from './account.svelte';
	const model = $derived(accountState());
	const status = $derived(model.usingAccount ? model.sync : 'guest');
</script>

<button
	type="button"
	class="gc-tool account-button"
	aria-label={t('account.title')}
	title={t('account.title') +
		' · ' +
		(model.usingAccount ? t(`account.sync.${model.sync}` as TranslationKey) : t('account.guest'))}
	aria-haspopup="dialog"
	aria-controls="account-dialog"
	aria-expanded={accountOpen()}
	onclick={() => setAccountOpen(true)}
>
	<svg viewBox="0 0 24 24" aria-hidden="true"
		><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" /></svg
	>
	<span class="label">{t('account.title')}</span><span
		class="status"
		data-status={status}
		aria-hidden="true"
	></span>
</button>

<style>
	.account-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		flex: none;
		width: auto;
		height: auto;
		min-width: 44px;
		min-height: 44px;
		max-width: 100%;
		padding: 2px 0.55rem;
		font: inherit;
		font-size: 0.8rem;
		line-height: 1.3;
		overflow-wrap: anywhere;
		border: 1px solid var(--gc-border, #c9d3cc);
		background: var(--gc-surface, white);
		color: var(--gc-text, #2c3a33);
	}
	svg {
		width: 22px;
		height: 22px;
		flex: none;
	}
	.label {
		min-width: 0;
	}
	.status {
		width: 7px;
		height: 7px;
		flex: none;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.45;
	}
	.status[data-status='synced'] {
		background: var(--gc-success, #237a47);
		opacity: 1;
	}
	.status[data-status='error'] {
		background: var(--gc-error, #a63824);
		opacity: 1;
	}
</style>
