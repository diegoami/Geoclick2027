import { afterEach, expect, it, vi } from 'vitest';
import { deleteApp, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore/lite';
import { IndexedDbProgressJournal } from './indexedDbProgressJournal';
import { ProgressSync } from './progressSync';
import { createWindowsFirebaseAccount } from './windowsFirebaseAccount';
const native = vi.hoisted(() => ({ invoke: vi.fn(), open: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke, isTauri: () => true }));
vi.mock('./tauriProgressJournal', () => ({ createTauriProgressJournal: native.open }));
const projectId = 'demo-geoclick-sync',
	configuration = {
		projectId,
		apiKey: 'fake-emulator-key',
		authDomain: 'localhost',
		appId: 'fake-emulator-app'
	};
const journals: IndexedDbProgressJournal[] = [],
	names = new Set<string>();
let initialized = false;
afterEach(async () => {
	for (const journal of journals.splice(0)) await journal.close().catch(() => {});
	for (const name of names)
		await new Promise<void>((resolve, reject) => {
			const r = indexedDB.deleteDatabase(name);
			r.onsuccess = () => resolve();
			r.onerror = () => reject(r.error);
		});
	names.clear();
	if (initialized) {
		const app = getApp('geoclick-game-windows-v1');
		await terminate(getFirestore(app));
		await deleteApp(app);
		initialized = false;
	}
});
async function setup(run: string) {
	let savedUid: string | null = null,
		selectedRemember = false,
		currentRequest = '',
		mismatch = false;
	native.open.mockImplementation((owner) => {
		const name = 'native-sdk-test-' + run;
		names.add(name);
		const journal = new IndexedDbProgressJournal(owner, { databaseName: name });
		journals.push(journal);
		return journal;
	});
	native.invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
		if (command === 'windows_account_configuration')
			return {
				projectId,
				actorId: 'host-actor',
				cachedUid: savedUid,
				cachedLabel: 'Synthetic player',
				rememberAvailable: true,
				storageWarning: false
			};
		if (command === 'windows_account_begin') {
			currentRequest = String(args?.requestId);
			return;
		}
		if (command === 'windows_account_login') {
			selectedRemember = Boolean(args?.remember);
			return {
				id_token: JSON.stringify({
					sub: 'windows-' + run,
					email: run + '@example.test',
					email_verified: true
				}),
				attempt_id: 'attempt-' + run,
				expected_uid: null
			};
		}
		if (command === 'windows_account_restore')
			return {
				status: 'credential',
				credential: {
					id_token: JSON.stringify({
						sub: (mismatch ? 'other-' : 'windows-') + run,
						email: (mismatch ? 'other-' : '') + run + '@example.test',
						email_verified: true
					}),
					attempt_id: 'restore-' + run,
					expected_uid: savedUid
				}
			};
		if (command === 'windows_account_confirm') {
			if (args?.requestId !== currentRequest) throw new Error('stale-request');
			if (mismatch && savedUid && args?.uid !== savedUid) {
				savedUid = null;
				throw new Error('uid-mismatch');
			}
			savedUid = selectedRemember ? String(args?.uid) : null;
			return selectedRemember;
		}
		if (command === 'windows_account_forget') {
			savedUid = null;
			currentRequest = '';
			return;
		}
		if (command === 'windows_account_cancel') {
			if (args?.requestId === currentRequest) currentRequest = '';
			return;
		}
		throw new Error('unexpected-native-command');
	});
	const runtime = await createWindowsFirebaseAccount(configuration);
	initialized = true;
	const app = getApp('geoclick-game-windows-v1'),
		auth = getAuth(app),
		db = getFirestore(app);
	connectAuthEmulator(auth, 'http://127.0.0.1:19110', { disableWarnings: true });
	connectFirestoreEmulator(db, '127.0.0.1', 18110);
	return {
		runtime: runtime!,
		auth,
		db,
		saved: () => savedUid,
		async restored() {
			const cached = await createWindowsFirebaseAccount(configuration);
			return cached!;
		},
		mismatch: () => {
			mismatch = true;
			selectedRemember = true;
		}
	};
}
it.skipIf(import.meta.env.VITE_GEOCLICK_SYNC_EMULATORS !== '1')(
	'native DTO → real Firebase verification → durable queue/cloud; JS credentials stay memory-only',
	async () => {
		const run = crypto.randomUUID(),
			f = await setup(run);
		await f.runtime.auth.signIn(true);
		const identity = f.runtime.auth.current()!;
		expect(identity.projectId).toBe(projectId);
		expect(f.saved()).toBe(identity.uid);
		const opened = await f.runtime.open(identity);
		expect(native.open).toHaveBeenCalledWith(identity, 'host-actor');
		await opened.journal.append(
			{
				kind: 'answer',
				mapId: 'italy-regions',
				targetId: 'one',
				roundId: 'native-sdk-round',
				grade: 'good',
				date: '2026-11-02'
			},
			'native-sdk-answer'
		);
		await new ProgressSync(opened.journal, opened.transport).sync();
		expect(await opened.journal.pending()).toEqual([]);
		const refresh = f.auth.currentUser!.refreshToken;
		expect(Object.values(localStorage).some((value) => value.includes(refresh))).toBe(false);
		expect(Object.values(sessionStorage).some((value) => value.includes(refresh))).toBe(false);
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const r = indexedDB.open('firebaseLocalStorageDb');
			r.onsuccess = () => resolve(r.result);
			r.onerror = () => reject(r.error);
		});
		try {
			if (database.objectStoreNames.contains('firebaseLocalStorage')) {
				const rows = await new Promise<{ fbase_key?: string }[]>((resolve, reject) => {
					const r = database
						.transaction('firebaseLocalStorage', 'readonly')
						.objectStore('firebaseLocalStorage')
						.getAll();
					r.onsuccess = () => resolve(r.result);
					r.onerror = () => reject(r.error);
				});
				expect(rows.some((row) => row.fbase_key?.includes('geoclick-game-windows-v1'))).toBe(false);
			}
		} finally {
			database.close();
		}
		await f.runtime.auth.signOut();
		expect(f.saved()).toBeNull();
		expect(f.runtime.auth.current()).toBeUndefined();
		expect(f.auth.currentUser).toBeNull();
	}
);
it.skipIf(import.meta.env.VITE_GEOCLICK_SYNC_EMULATORS !== '1')(
	'a changed saved Google identity cannot expose or upload under the protected previous UID',
	async () => {
		const f = await setup(crypto.randomUUID());
		await f.runtime.auth.signIn(true);
		const identity = f.runtime.auth.current()!,
			oldUid = identity.uid;
		// Clear only volatile SDK state, retaining the mock native protected record.
		await (await import('firebase/auth')).signOut(f.auth);
		const restored = await f.restored();
		f.mismatch();
		expect(restored.auth.current()?.uid).toBe(oldUid);
		const opened = await restored.open(identity);
		await expect(opened.transport.pull(undefined, 100)).rejects.toMatchObject({
			code: 'identity-changed'
		});
		expect(restored.auth.current()).toBeUndefined();
		expect(f.auth.currentUser).toBeNull();
		expect(f.saved()).toBeNull();
	}
);
