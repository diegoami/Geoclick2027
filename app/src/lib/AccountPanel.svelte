<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { appearanceOpen } from './appearance.svelte';
	import AccountControls from './AccountControls.svelte';
	import {
		accountAvailable,
		accountState,
		initializeBrowserAccount,
		signInToAccount,
		signOutOfAccount,
		syncAccount,
		previewGuestImport,
		confirmGuestImport,
		dismissGuestImport
	} from './account.svelte';
	onMount(() => {
		void initializeBrowserAccount();
	});
	$effect(() => {
		if (appearanceOpen() && accountAvailable())
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
