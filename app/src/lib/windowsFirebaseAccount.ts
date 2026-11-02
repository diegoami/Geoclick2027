import { invoke } from '@tauri-apps/api/core';
import { initializeApp } from 'firebase/app';
import {
	initializeAuth,
	inMemoryPersistence,
	GoogleAuthProvider,
	signInWithCredential,
	signOut
} from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore/lite';
import type { BrowserAccountIdentity } from './browserAccountSession';
import type { BrowserFirebaseConfig } from './browserFirebaseAccount';
import { createFirestoreProgressTransport } from './firestoreProgressTransport';
import { createTauriProgressJournal } from './tauriProgressJournal';
import {
	createWindowsAccountGateway,
	WindowsAccountError,
	type WindowsAccountConfiguration,
	type WindowsCredential,
	type WindowsRestore
} from './windowsAccountGateway';
export async function createWindowsFirebaseAccount(configuration: BrowserFirebaseConfig) {
	const native = await invoke<WindowsAccountConfiguration | null>('windows_account_configuration');
	if (!native) return;
	if (native.projectId !== configuration.projectId)
		throw new WindowsAccountError('project-mismatch');
	setLogLevel('silent');
	const app = initializeApp(configuration, 'geoclick-game-windows-v1'),
		auth = initializeAuth(app, { persistence: inMemoryPersistence }),
		db = getFirestore(app);
	let verifiedUid: string | undefined;
	const gateway = createWindowsAccountGateway(
		native,
		{
			login: async (requestId, remember) => {
				await invoke<void>('windows_account_begin', { requestId });
				return invoke<WindowsCredential>('windows_account_login', { requestId, remember });
			},
			restore: async (requestId) => {
				await invoke<void>('windows_account_begin', { requestId });
				return invoke<WindowsRestore>('windows_account_restore', { requestId });
			},
			confirm: (requestId, attemptId, uid, label) =>
				invoke<boolean>('windows_account_confirm', { requestId, attemptId, uid, label }),
			cancel: (requestId) => invoke<void>('windows_account_cancel', { requestId }),
			forget: () => invoke<void>('windows_account_forget')
		},
		{
			async consumeGoogle(idToken) {
				const result = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
				const token = await result.user.getIdTokenResult(true),
					firebase = token.claims.firebase;
				if (
					token.claims.aud !== configuration.projectId ||
					token.claims.iss !== `https://securetoken.google.com/${configuration.projectId}` ||
					!firebase ||
					typeof firebase !== 'object' ||
					!('sign_in_provider' in firebase) ||
					firebase.sign_in_provider !== 'google.com' ||
					!result.user.providerData.some((provider) => provider.providerId === 'google.com')
				)
					throw new WindowsAccountError('invalid-credential');
				verifiedUid = result.user.uid;
				return {
					projectId: configuration.projectId,
					uid: result.user.uid,
					label: result.user.email ?? result.user.displayName ?? ''
				};
			},
			matches: (owner) =>
				verifiedUid === owner.uid &&
				auth.currentUser?.uid === owner.uid &&
				owner.projectId === configuration.projectId,
			async clear() {
				verifiedUid = undefined;
				await signOut(auth);
			},
			transport: (owner) => {
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
			const journal = await createTauriProgressJournal(identity, native.actorId);
			return { journal, transport: gateway.transport(identity) };
		}
	};
}
