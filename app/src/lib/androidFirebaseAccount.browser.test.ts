import { afterEach, expect, it, vi } from 'vitest';
import { deleteApp, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore/lite';
import { IndexedDbProgressJournal } from './indexedDbProgressJournal';
import { ProgressSync } from './progressSync';
import { createAndroidFirebaseAccount } from './androidFirebaseAccount';
const native = vi.hoisted(() => ({
	configuration: vi.fn(),
	begin: vi.fn(),
	confirm: vi.fn(),
	cancel: vi.fn(),
	forget: vi.fn(),
	credential: vi.fn(),
	signOut: vi.fn(),
	open: vi.fn()
}));
vi.mock('./androidAccountBridge', () => ({ androidAccountBridge: native }));
vi.mock('./capacitorProgressJournal', () => ({ createCapacitorProgressJournal: native.open }));
const config = {
	projectId: 'demo-geoclick-sync',
	apiKey: 'fake-emulator-key',
	appId: 'fake-emulator-app',
	authDomain: 'localhost'
};
let initialized = false;
const journals: IndexedDbProgressJournal[] = [];
let saved: string | null = null;
async function dispose() {
	if (!initialized) return;
	const app = getApp('geoclick-game-android-v1');
	await terminate(getFirestore(app));
	await deleteApp(app);
	initialized = false;
}
afterEach(async () => {
	for (const journal of journals.splice(0)) await journal.close();
	await dispose();
});
async function setup() {
	saved = null;
	const run = crypto.randomUUID();
	native.configuration.mockImplementation(async () => ({
		available: true,
		projectId: config.projectId,
		packageId: 'com.geoclick.mobile',
		actorId: 'android-host-actor',
		cachedUid: saved,
		rememberAvailable: true
	}));
	native.begin.mockImplementation(async () => ({
		cachedUid: saved,
		cachedLabel: 'Synthetic player'
	}));
	native.confirm.mockImplementation(async (_id, uid, _label, remember) => {
		saved = remember ? uid : null;
		return remember;
	});
	native.forget.mockImplementation(async () => {
		saved = null;
	});
	native.cancel.mockResolvedValue(undefined);
	native.signOut.mockResolvedValue(undefined);
	native.credential.mockResolvedValue(
		JSON.stringify({ sub: 'android-' + run, email: run + '@example.test', email_verified: true })
	);
	native.open.mockImplementation((owner) => {
		const journal = new IndexedDbProgressJournal(owner, {
			databaseName: 'android-sdk-test-' + run
		});
		journals.push(journal);
		return journal;
	});
	return open();
}
async function open() {
	const runtime = (await createAndroidFirebaseAccount(config))!;
	initialized = true;
	const app = getApp('geoclick-game-android-v1'),
		auth = getAuth(app),
		db = getFirestore(app);
	connectAuthEmulator(auth, 'http://127.0.0.1:19110', { disableWarnings: true });
	connectFirestoreEmulator(db, '127.0.0.1', 18110);
	return { runtime, auth };
}
const emulator = import.meta.env.VITE_GEOCLICK_SYNC_EMULATORS === '1';
it.skipIf(!emulator)(
	'Android native credential reaches real Firebase and cloud; opt-in SDK persistence survives app recreation and sign-out clears it',
	async () => {
		const f = await setup();
		expect(f.runtime.auth.current()).toBeUndefined();
		await f.runtime.auth.signIn(true);
		const identity = f.runtime.auth.current()!;
		expect(saved).toBe(identity.uid);
		const opened = await f.runtime.open(identity);
		expect(native.open).toHaveBeenCalledWith(identity, 'android-host-actor');
		await opened.journal.append(
			{
				kind: 'answer',
				mapId: 'italy-regions',
				targetId: 'one',
				roundId: 'android-sdk-round',
				grade: 'good',
				date: '2026-11-02'
			},
			'android-sdk-answer'
		);
		await new ProgressSync(opened.journal, opened.transport).sync();
		expect(await opened.journal.pending()).toEqual([]);
		await dispose();
		const cold = await open();
		expect(cold.runtime.auth.current()?.uid).toBe(identity.uid);
		const reopened = await cold.runtime.open(identity);
		await reopened.transport.pull(undefined, 100);
		expect(cold.auth.currentUser?.uid).toBe(identity.uid);
		await cold.runtime.auth.signOut();
		expect(saved).toBeNull();
		expect(cold.auth.currentUser).toBeNull();
		await dispose();
		const forgotten = await open();
		await forgotten.auth.authStateReady();
		expect(forgotten.runtime.auth.current()).toBeUndefined();
		expect(forgotten.auth.currentUser).toBeNull();
	}
);
it.skipIf(!emulator)(
	'Android session-only login writes no durable Firebase credential',
	async () => {
		const f = await setup();
		await f.runtime.auth.signIn(false);
		expect(f.runtime.auth.current()).toBeDefined();
		expect(saved).toBeNull();
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('firebaseLocalStorageDb');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			if (database.objectStoreNames.contains('firebaseLocalStorage')) {
				const rows = await new Promise<{ fbase_key?: string }[]>((resolve, reject) => {
					const request = database
						.transaction('firebaseLocalStorage', 'readonly')
						.objectStore('firebaseLocalStorage')
						.getAll();
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
				expect(rows.some((row) => row.fbase_key?.includes('geoclick-game-android-v1'))).toBe(false);
			}
		} finally {
			database.close();
		}
		await f.runtime.auth.signOut();
		expect(f.auth.currentUser).toBeNull();
	}
);
