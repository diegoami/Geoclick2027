import type { BrowserAccountState } from './browserAccountSession';
import {
	setAccountProgressRepository,
	createLocalStorageProgressRepository
} from './progressRepository';
import { isNativeShell } from './platform';
import { browserImportMaps } from './browserAccountCatalog';
let value = $state.raw<BrowserAccountState>({ usingAccount: false, busy: false, sync: 'idle' });
let available = $state(false),
	revision = $state(0),
	progress = $state(0);
let controller: import('./browserAccountSession').BrowserAccountSession | undefined;
let initialized: Promise<void> | undefined;
export const accountState = () => value;
export const accountAvailable = () => available;
export const accountRevision = () => revision;
export const accountProgressRevision = () => progress;
export function initializeBrowserAccount(): Promise<void> {
	return (initialized ??= (async () => {
		if (
			typeof window === 'undefined' ||
			import.meta.env.MODE === 'test' ||
			!import.meta.env.VITE_FIREBASE_CONFIG ||
			(await isNativeShell())
		)
			return;
		try {
			const [
				{ createBrowserFirebaseAccount, parseBrowserFirebaseConfig },
				{ BrowserAccountSession }
			] = await Promise.all([
				import('./browserFirebaseAccount'),
				import('./browserAccountSession')
			]);
			const config = parseBrowserFirebaseConfig(import.meta.env.VITE_FIREBASE_CONFIG);
			if (!config) return;
			const gateway = createBrowserFirebaseAccount(config);
			controller = new BrowserAccountSession({
				auth: gateway.auth,
				open: gateway.open,
				guest: createLocalStorageProgressRepository(),
				canSync: () => document.visibilityState === 'visible' && navigator.onLine,
				maps: browserImportMaps,
				bind(repository) {
					if (setAccountProgressRepository(repository)) revision++;
				},
				changed(state) {
					value = state;
				},
				progressChanged() {
					progress++;
				}
			});
			available = true;
			controller.start();
			window.addEventListener('online', () => {
				void controller?.refresh();
			});
			window.addEventListener('focus', () => controller?.foreground());
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') controller?.foreground();
			});
		} catch {
			available = false;
		}
	})());
}
export const signInToAccount = (remember: boolean) => controller?.signIn(remember);
export const signOutOfAccount = () => controller?.signOut();
export const syncAccount = () => controller?.retry();
export const previewGuestImport = () => controller?.prepareImport();
export const confirmGuestImport = () => controller?.confirmImport();
export const dismissGuestImport = () => controller?.dismissImport();
