// Iteration 8+ (optional Supabase sign-in / cross-device sync): creates a
// Supabase client from PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY, or
// returns undefined if either is unset - same "feature not configured,
// degrade gracefully" style as progressRepository.ts's createProgressRepository
// backend detection. Every call site must treat undefined as "sync not
// available" and fall back to the existing local-only behavior; sign-in is
// strictly additive, never required to play a map.
//
// $env/dynamic/public rather than $env/static/public on purpose: a static
// import of an unset PUBLIC_* var from $env/static/public is a build/
// type-check error (svelte-check fails with "no exported member"), which
// would break `npm run build`/`npm run check` for every contributor who
// hasn't set up Supabase - unacceptable for a feature that's supposed to be
// optional. $env/dynamic/public just reads an object whose keys may be
// undefined, so an absent config is a normal runtime branch, not a build
// failure. See app/.env.example for the two values a real Supabase
// project's dashboard provides, and ONBOARDING.md's "Enabling cross-device
// sync" section for full setup steps.

import { env } from '$env/dynamic/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | undefined;
let computed = false;

// Lazy + memoized so an unconfigured environment never even attempts
// createClient() more than once, and a plain-browser/Tauri/Capacitor build
// with no Supabase project pays no cost beyond one undefined check.
export function getSupabaseClient(): SupabaseClient | undefined {
	if (!computed) {
		const url = env.PUBLIC_SUPABASE_URL;
		const anonKey = env.PUBLIC_SUPABASE_ANON_KEY;
		cached = url && anonKey ? createClient(url, anonKey) : undefined;
		computed = true;
	}
	return cached;
}

export function isSupabaseConfigured(): boolean {
	return getSupabaseClient() !== undefined;
}
