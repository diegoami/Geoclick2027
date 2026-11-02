<script lang="ts">
	import { untrack } from 'svelte';
	import { accountOpen } from './accountDialogState.svelte';
	import AccountControls from './AccountControls.svelte';
	import {
		accountAvailable,
		accountState,
		signInToAccount,
		signOutOfAccount,
		syncAccount,
		previewGuestImport,
		confirmGuestImport,
		dismissGuestImport
	} from './account.svelte';
	$effect(() => {
		if (accountOpen() && accountAvailable())
			untrack(() => {
				void syncAccount();
			});
	});
</script>

{#if accountAvailable()}
	<AccountControls
		model={accountState()}
		onSignIn={signInToAccount}
		onSignOut={signOutOfAccount}
		onSync={syncAccount}
		onPreview={previewGuestImport}
		onConfirm={confirmGuestImport}
		onDismiss={dismissGuestImport}
	/>
{/if}
