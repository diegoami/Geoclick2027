// Which shell the app is running in. Same checks as createProgressRepository
// (progressRepository.ts): Tauri for desktop, Capacitor for Android.

/** True inside the desktop (Tauri) or Android (Capacitor) app, false on the web. */
export async function isNativeShell(): Promise<boolean> {
	const { isTauri } = await import('@tauri-apps/api/core');
	if (isTauri()) return true;
	const { Capacitor } = await import('@capacitor/core');
	return Capacitor.isNativePlatform();
}

/** Latest installers, on the public releases-only repo (FT-08). */
export const RELEASES_URL = 'https://github.com/diegoami/geoclick-releases/releases/latest';
