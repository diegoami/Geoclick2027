<script lang="ts">
	// Iteration 8+ (optional cross-device sync): a small, unobtrusive
	// sign-in control. Placed on the home page, above the map list (see
	// +page.svelte) - deliberately not touching the map list itself or its
	// ordering. Renders nothing but a barely-there "sign in to sync" line
	// when Supabase isn't configured (the default for every existing
	// checkout/deploy until the user does the manual Supabase setup in
	// ONBOARDING.md), so a plain local build looks exactly as it does today
	// aside from that one line - no error, no broken button.
	import { onMount } from 'svelte';
	import { isSupabaseConfigured } from './supabaseClient';
	import { authState, initAuth, signInWithGoogle, signOut } from './authStore.svelte';

	onMount(() => {
		initAuth();
	});

	const configured = isSupabaseConfigured();
</script>

{#if configured}
	<div class="account-status">
		{#if !authState.initialized}
			<span class="muted">Checking sign-in…</span>
		{:else if authState.session}
			<span class="signed-in">
				Signed in as {authState.session.user.email ?? 'Google account'}
			</span>
			<button type="button" onclick={signOut}>Sign out</button>
		{:else}
			<button type="button" class="sign-in-btn" onclick={signInWithGoogle}>
				Sign in with Google to sync progress across devices
			</button>
		{/if}
	</div>
{:else}
	<p class="muted not-configured">
		Cross-device sync isn't set up on this deployment yet - progress stays on this device.
	</p>
{/if}

<style>
	.account-status {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
		font-family: system-ui, sans-serif;
		font-size: 0.85rem;
	}
	.signed-in {
		opacity: 0.8;
	}
	.muted {
		opacity: 0.6;
	}
	.not-configured {
		font-size: 0.75rem;
		margin: 0 0 1rem;
	}
	button {
		font: inherit;
		cursor: pointer;
		border: 1px solid #ccc;
		border-radius: 0.4rem;
		background: #fff;
		padding: 0.35rem 0.7rem;
	}
	button:hover {
		background: #f4f4f4;
	}
	.sign-in-btn {
		color: #1a1a1a;
	}
</style>
