import { Capacitor, registerPlugin } from '@capacitor/core';
export interface AndroidAccountConfiguration {
	available: boolean;
	projectId?: string;
	packageId?: string;
	actorId?: string;
	cachedUid?: string | null;
	cachedLabel?: string | null;
	rememberAvailable?: boolean;
	storageWarning?: boolean;
}
interface Metadata {
	configuration(): Promise<AndroidAccountConfiguration>;
	begin(options: {
		requestId: string;
		restoring: boolean;
	}): Promise<{ cachedUid: string | null; cachedLabel: string | null }>;
	confirm(options: {
		requestId: string;
		uid: string;
		label: string;
		remember: boolean;
	}): Promise<{ remembered: boolean }>;
	cancel(options: { requestId: string }): Promise<void>;
	forget(options?: { requestId: string }): Promise<void>;
}
interface NativeGoogle {
	signInWithGoogle(options: {
		skipNativeAuth: true;
		useCredentialManager: true;
	}): Promise<{ credential?: { idToken?: string } }>;
	signOut(): Promise<void>;
}
const metadata = registerPlugin<Metadata>('GeoclickAccount');
// Native registration only. The mobile workspace satisfies the bridge's own
// Firebase 12 web peer; the shared game never imports that web implementation.
const google = registerPlugin<NativeGoogle>('FirebaseAuthentication');
export const androidAccountBridge = {
	async configuration() {
		if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android')
			return { available: false };
		return metadata.configuration();
	},
	async begin(requestId: string, restoring: boolean) {
		return metadata.begin({ requestId, restoring });
	},
	async confirm(requestId: string, uid: string, label: string, remember: boolean) {
		return (await metadata.confirm({ requestId, uid, label, remember })).remembered;
	},
	cancel: (requestId: string) => metadata.cancel({ requestId }),
	forget: (requestId?: string) => metadata.forget(requestId ? { requestId } : undefined),
	async credential() {
		const result = await google.signInWithGoogle({
			skipNativeAuth: true,
			useCredentialManager: true
		});
		const token = result.credential?.idToken;
		if (!token) throw new Error('native-credential-missing');
		return token;
	},
	signOut: () => google.signOut()
};
