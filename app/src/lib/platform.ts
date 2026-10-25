// Which shell the app is running in. Same checks as createProgressRepository
// (progressRepository.ts): Tauri for desktop, Capacitor for Android.

/** True inside the desktop (Tauri) or Android (Capacitor) app, false on the web. */
export async function isNativeShell(): Promise<boolean> {
	const { isTauri } = await import('@tauri-apps/api/core');
	if (isTauri()) return true;
	const { Capacitor } = await import('@capacitor/core');
	return Capacitor.isNativePlatform();
}

/** Public source, downloads and itch.io page. */
export const SOURCE_URL = 'https://github.com/diegoami/Geoclick2027';
export const RELEASES_REPO_URL = SOURCE_URL + '/releases';
/** Latest installers. */
export const RELEASES_URL = SOURCE_URL + '/releases/latest';
export const ITCH_URL = 'https://diegoami.itch.io/geoclick';

/**
 * Leaves the app, from the start screen's Exit button: Android's own exit,
 * or the desktop app's one window closed, which ends it. A web page cannot
 * close its own tab, so the button is only shown in the apps.
 */
export async function exitApp(): Promise<void> {
	const { isTauri } = await import('@tauri-apps/api/core');
	if (isTauri()) {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		await getCurrentWindow().close();
		return;
	}
	const { Capacitor } = await import('@capacitor/core');
	if (Capacitor.isNativePlatform()) {
		const { App } = await import('@capacitor/app');
		await App.exitApp();
	}
}
