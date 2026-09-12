// Iteration 8+ (optional Supabase sign-in): a small shared reactive store
// (Svelte 5 runes in a .svelte.ts module, same pattern the rest of the app
// uses $state/$derived for component-local state) so both the home page and
// AccountStatus.svelte see the same sign-in state without prop-drilling a
// Supabase session through the map list. Every export here is a safe no-op
// when Supabase isn't configured (getSupabaseClient() returns undefined) -
// callers never need to check isSupabaseConfigured() themselves first.

import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export const authState = $state<{ session: Session | null; initialized: boolean }>({
	session: null,
	initialized: false
});

let subscribed = false;

// Idempotent - safe to call from every component that wants to read
// authState (AccountStatus.svelte, the home page) without worrying about
// double-subscribing. No-ops entirely when Supabase isn't configured, so an
// unconfigured build never touches the network.
export function initAuth(): void {
	if (subscribed) return;
	const client = getSupabaseClient();
	if (!client) {
		authState.initialized = true;
		return;
	}
	subscribed = true;
	client.auth.getSession().then(({ data }) => {
		authState.session = data.session;
		authState.initialized = true;
	});
	client.auth.onAuthStateChange((_event, session) => {
		authState.session = session;
	});
}

export async function signInWithGoogle(): Promise<void> {
	const client = getSupabaseClient();
	if (!client) return;
	await client.auth.signInWithOAuth({
		provider: 'google',
		options: { redirectTo: window.location.origin }
	});
}

export async function signOut(): Promise<void> {
	const client = getSupabaseClient();
	if (!client) return;
	await client.auth.signOut();
}
