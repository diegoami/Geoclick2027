// The home page's "New here?" nudge (FT-12): shown until the player
// dismisses it or starts the tutorial once, then never again on this device.
// It only ever offers the tutorial; nothing starts by itself (FEATURE_PLAN.md,
// decision 6). Stored like the language setting: same key scheme, same
// guards for the prerendered build and for storage that throws.

const SEEN_KEY = 'geoclick:tutorial-seen:v1';

function readSeen(): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		return localStorage.getItem(SEEN_KEY) === '1';
	} catch {
		return false;
	}
}

let seen = $state(readSeen());

/** Whether the home page should show the nudge. Read it only after mount:
 * the prerendered page can't know. */
export function showTutorialNudge(): boolean {
	return !seen;
}

/** Dismissed, or the tutorial was started: don't offer it again. */
export function markTutorialSeen(): void {
	seen = true;
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SEEN_KEY, '1');
	} catch {
		// Blocked storage: hidden for this session, offered again next time.
	}
}
