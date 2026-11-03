import { initializeApp } from 'firebase/app';
import {
	initializeAuth,
	inMemoryPersistence,
	indexedDBLocalPersistence,
	setPersistence,
	GoogleAuthProvider,
	signInWithCredential,
	signOut,
	type User
} from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore/lite';
import type { BrowserFirebaseConfig } from './browserFirebaseAccount';
import type { BrowserAccountIdentity } from './browserAccountSession';
import { androidAccountBridge as bridge } from './androidAccountBridge';
import { createCapacitorProgressJournal } from './capacitorProgressJournal';
import { createFirestoreProgressTransport } from './firestoreProgressTransport';
import { createWindowsAccountGateway, WindowsAccountError } from './windowsAccountGateway';

/** Android shares the epoch/UID guards with Windows, but obtains Google credentials
 * from the native picker and remembers Firebase sessions only by explicit opt-in. */
export async function createAndroidFirebaseAccount(configuration: BrowserFirebaseConfig) {
	const native = await bridge.configuration();
	if (!native.available) return;
	if (
		native.projectId !== configuration.projectId ||
		native.packageId !== 'com.geoclick.mobile' ||
		!native.actorId
	)
		throw new WindowsAccountError('project-mismatch');
	setLogLevel('silent');
	const app = initializeApp(configuration, 'geoclick-game-android-v1');
	const auth = initializeAuth(app, {
		persistence: native.cachedUid ? indexedDBLocalPersistence : inMemoryPersistence
	});
	const db = getFirestore(app);
	let verifiedUid: string | undefined;
	const choices = new Map<string, boolean>();
	async function verify(user: User, refresh: boolean): Promise<BrowserAccountIdentity> {
		const token = await user.getIdTokenResult(refresh),
			firebase = token.claims.firebase;
		if (
			token.claims.aud !== configuration.projectId ||
			token.claims.iss !== `https://securetoken.google.com/${configuration.projectId}` ||
			!firebase ||
			typeof firebase !== 'object' ||
			!('sign_in_provider' in firebase) ||
			firebase.sign_in_provider !== 'google.com' ||
			!user.providerData.some((provider) => provider.providerId === 'google.com')
		)
			throw new WindowsAccountError('invalid-credential');
		verifiedUid = user.uid;
		return {
			projectId: configuration.projectId,
			uid: user.uid,
			label: user.email ?? user.displayName ?? ''
		};
	}
	async function clear() {
		verifiedUid = undefined;
		await auth.authStateReady();
		// Clear before changing persistence: never copy a session-only user to disk.
		await signOut(auth);
		await setPersistence(auth, indexedDBLocalPersistence);
		await signOut(auth);
		await setPersistence(auth, inMemoryPersistence);
	}
	const gateway = createWindowsAccountGateway(
		{
			projectId: configuration.projectId,
			actorId: native.actorId,
			cachedUid: native.cachedUid ?? null,
			cachedLabel: native.cachedLabel,
			rememberAvailable: native.rememberAvailable ?? false,
			storageWarning: native.storageWarning ?? false
		},
		{
			async login(requestId, remember) {
				await bridge.begin(requestId, false);
				choices.set(requestId, remember);
				return { id_token: await bridge.credential(), attempt_id: requestId, expected_uid: null };
			},
			async restore(requestId) {
				const cached = await bridge.begin(requestId, true);
				choices.set(requestId, true);
				return cached.cachedUid
					? { status: 'sdk', expectedUid: cached.cachedUid }
					: { status: 'none' };
			},
			async confirm(requestId, _attempt, uid, label) {
				return bridge.confirm(requestId, uid, label, choices.get(requestId) ?? false);
			},
			async cancel(requestId) {
				choices.delete(requestId);
				await bridge.cancel(requestId);
			},
			async forget(requestId) {
				await bridge.forget(requestId);
				if (!requestId) {
					choices.clear();
					await bridge.signOut();
				}
			}
		},
		{
			async consumeGoogle(idToken, remember) {
				await clear();
				await setPersistence(auth, remember ? indexedDBLocalPersistence : inMemoryPersistence);
				const result = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
				return verify(result.user, true);
			},
			async restoreIdentity() {
				await auth.authStateReady();
				return auth.currentUser ? verify(auth.currentUser, false) : undefined;
			},
			matches: (owner) =>
				verifiedUid === owner.uid &&
				auth.currentUser?.uid === owner.uid &&
				owner.projectId === configuration.projectId,
			clear,
			transport(owner) {
				if (verifiedUid !== owner.uid || auth.currentUser?.uid !== owner.uid)
					throw new WindowsAccountError('account-changed');
				return createFirestoreProgressTransport(db, auth);
			}
		}
	);
	return {
		auth: gateway.auth,
		rememberAvailable: gateway.rememberAvailable,
		async open(identity: BrowserAccountIdentity) {
			if (
				gateway.auth.current()?.uid !== identity.uid ||
				identity.projectId !== configuration.projectId
			)
				throw new WindowsAccountError('account-changed');
			const journal = await createCapacitorProgressJournal(identity, native.actorId!);
			return { journal, transport: gateway.transport(identity) };
		}
	};
}
