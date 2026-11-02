import { initializeApp } from 'firebase/app';
import {
	type Auth,
	initializeAuth,
	indexedDBLocalPersistence,
	inMemoryPersistence,
	browserPopupRedirectResolver,
	onAuthStateChanged,
	setPersistence,
	GoogleAuthProvider,
	signInWithPopup,
	signOut
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore/lite';
import { IndexedDbProgressJournal } from './indexedDbProgressJournal';
import { createFirestoreProgressTransport } from './firestoreProgressTransport';
import type { BrowserAccountAuth, BrowserAccountIdentity } from './browserAccountSession';
export interface BrowserFirebaseConfig {
	apiKey: string;
	authDomain: string;
	projectId: string;
	appId: string;
}
export function parseBrowserFirebaseConfig(input: unknown): BrowserFirebaseConfig | undefined {
	try {
		const value = typeof input === 'string' ? JSON.parse(input) : undefined;
		if (
			!value ||
			typeof value !== 'object' ||
			!['apiKey', 'authDomain', 'projectId', 'appId'].every(
				(k) => typeof value[k] === 'string' && value[k].length > 0 && value[k].length <= 256
			)
		)
			return;
		return {
			apiKey: value.apiKey,
			authDomain: value.authDomain,
			projectId: value.projectId,
			appId: value.appId
		};
	} catch {
		return;
	}
}
export function createBrowserFirebaseAccount(config: BrowserFirebaseConfig) {
	const app = initializeApp(config, 'geoclick-game-account-v1');
	// A previous explicit Remember choice may restore. New sign-ins always set
	// their selected persistence before the popup; unchecked uses memory only.
	const auth = initializeAuth(app, {
		persistence: [indexedDBLocalPersistence, inMemoryPersistence],
		popupRedirectResolver: browserPopupRedirectResolver
	});
	const db = getFirestore(app);
	const gateway = createBrowserAccountAuth(auth, config.projectId);
	return {
		auth: gateway,
		async open(identity: BrowserAccountIdentity) {
			const currentIdentity = gateway.current();
			if (
				!currentIdentity ||
				currentIdentity.uid !== identity.uid ||
				identity.projectId !== config.projectId
			)
				throw new Error('account-changed');
			return {
				journal: new IndexedDbProgressJournal(identity),
				transport: createFirestoreProgressTransport(db, auth)
			};
		}
	};
}

export function createBrowserAccountAuth(auth: Auth, projectId: string): BrowserAccountAuth {
	function current(): BrowserAccountIdentity | undefined {
		const user = auth.currentUser;
		if (!user || !user.providerData.some((provider) => provider.providerId === 'google.com'))
			return;
		return {
			projectId: projectId,
			uid: user.uid,
			label: user.email ?? user.displayName ?? ''
		};
	}
	const gateway: BrowserAccountAuth = {
		current,
		observe: (listener) => onAuthStateChanged(auth, () => listener(current())),
		async signIn(remember) {
			await setPersistence(auth, remember ? indexedDBLocalPersistence : inMemoryPersistence);
			const provider = new GoogleAuthProvider();
			provider.setCustomParameters({ prompt: 'select_account' });
			await signInWithPopup(auth, provider);
		},
		signOut: () => signOut(auth)
	};
	return gateway;
}
