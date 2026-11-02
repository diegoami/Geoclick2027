<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from './i18n.svelte';
	import AccountPanel from './AccountPanel.svelte';
	import { accountOpen, setAccountOpen } from './accountDialogState.svelte';
	import { initializeBrowserAccount } from './account.svelte';
	let dialog: HTMLDialogElement;
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
		void initializeBrowserAccount();
	});
	$effect(() => {
		if (!mounted || !dialog) return;
		if (accountOpen() && !dialog.open) dialog.showModal();
		else if (!accountOpen() && dialog.open) dialog.close();
	});
</script>

<dialog
	class="account-dialog"
	id="account-dialog"
	bind:this={dialog}
	aria-labelledby="account-title"
	onclose={() => setAccountOpen(false)}
	onkeydown={(event) => event.stopPropagation()}
>
	<header>
		<h2 id="account-title">{t('account.title')}</h2>
		<button type="button" onclick={() => dialog.close()} aria-label={t('account.close')}>×</button>
	</header>
	<AccountPanel />
</dialog>

<style>
	dialog {
		box-sizing: border-box;
		width: min(32rem, calc(100vw - 16px));
		max-width: calc(100vw - 16px);
		max-height: calc(100dvh - 16px);
		overflow-y: auto;
		overflow-wrap: anywhere;
		padding: 12px;
		border: 2px solid var(--gc-border, #c9d3cc);
		border-radius: 12px;
		background: var(--gc-surface, white);
		color: var(--gc-text, #1c2b22);
		font-family: system-ui, sans-serif;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 55%);
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}
	h2 {
		flex: 1;
		margin: 0 0 1rem;
		font-size: 1.25rem;
		overflow-wrap: anywhere;
	}
	header button {
		font: inherit;
		min-width: 44px;
		min-height: 44px;
		border: 1px solid var(--gc-border, #c9d3cc);
		border-radius: 8px;
		background: var(--gc-surface, white);
		color: var(--gc-text, #1c2b22);
		cursor: pointer;
	}
	dialog.account-dialog :global(.account) {
		border: 0;
		padding: 0;
		margin: 0;
	}
	dialog.account-dialog :global(.account > legend) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
