<script lang="ts">
	import { t } from './i18n.svelte';
	import { accountOpen, setAccountOpen } from './accountDialogState.svelte';
</script>

<button
	type="button"
	class="account-button"
	aria-haspopup="dialog"
	aria-controls="account-dialog"
	aria-expanded={accountOpen()}
	onclick={() => setAccountOpen(true)}>{t('account.experimentalTitle')}</button
>

<style>
	.account-button {
		max-width: 100%;
		min-width: 44px;
		min-height: 44px;
		padding: 0.25rem 0.5rem;
		border: 0;
		background: transparent;
		color: var(--gc-text, #2c3a33);
		font: inherit;
		font-size: 0.8rem;
		text-decoration: underline;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
</style>
