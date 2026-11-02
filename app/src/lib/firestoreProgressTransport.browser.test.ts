import { expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import {
	initializeAuth,
	inMemoryPersistence,
	connectAuthEmulator,
	signInWithCredential,
	GoogleAuthProvider,
	signOut
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore/lite';
import { IndexedDbProgressJournal } from './indexedDbProgressJournal';
import { ProgressSync } from './progressSync';
import { createFirestoreProgressTransport } from './firestoreProgressTransport';
import { projectProgress } from './progressEvents';
// Opt in only through npm run test:firebase. No real project/config/credentials are read.
it.skipIf(import.meta.env.VITE_GEOCLICK_SYNC_EMULATORS !== '1')(
	'shares actual IndexedDB events through the SDK/rules and preserves pending work across reopen',
	async () => {
		const projectId = 'demo-geoclick-sync',
			run = crypto.randomUUID();
		const clients = [0, 1].map((i) => {
			const app = initializeApp(
				{ projectId, apiKey: 'fake-emulator-key' },
				`browser-sync-${run}-${i}`
			);
			const auth = initializeAuth(app, { persistence: inMemoryPersistence });
			connectAuthEmulator(auth, 'http://127.0.0.1:19110', { disableWarnings: true });
			const db = getFirestore(app);
			connectFirestoreEmulator(db, '127.0.0.1', 18110);
			return { app, auth, db };
		});
		const databases = [`browser-sync-${run}-a`, `browser-sync-${run}-b`],
			journals: IndexedDbProgressJournal[] = [];
		const guestKey = `geoclick:progress:v1:sync-test-${run}`;
		localStorage.setItem(guestKey, 'guest-original');
		try {
			for (const c of clients)
				await signInWithCredential(
					c.auth,
					GoogleAuthProvider.credential(
						JSON.stringify({
							sub: 'browser-sync-' + run,
							email: `${run}@example.test`,
							email_verified: true
						})
					)
				);
			const [ca, cb] = clients,
				owner = { projectId, uid: ca.auth.currentUser!.uid };
			expect(cb.auth.currentUser!.uid).toBe(owner.uid);
			const open = (index: number) => {
				const j = new IndexedDbProgressJournal(owner, { databaseName: databases[index] });
				journals.push(j);
				return j;
			};
			let a = open(0);
			const b = open(1);
			const answer = {
				kind: 'answer' as const,
				mapId: 'italy-regions',
				targetId: 'one',
				roundId: 'round-one',
				grade: 'good' as const,
				date: '2026-11-02'
			};
			const ta = createFirestoreProgressTransport(ca.db, ca.auth),
				tb = createFirestoreProgressTransport(cb.db, cb.auth);
			await a.append(answer, 'first');
			await new ProgressSync(a, ta).sync();
			await new ProgressSync(b, tb).sync();
			// Device A practices offline then closes. Device B resets before A returns.
			await a.append({ ...answer, roundId: 'offline' }, 'offline');
			await a.close();
			a = open(0);
			expect(await a.pending()).toHaveLength(1);
			await b.append({ kind: 'reset', scope: 'known', mapId: 'italy-regions' }, 'reset');
			await new ProgressSync(b, tb).sync();
			await new ProgressSync(a, ta).sync();
			await new ProgressSync(b, tb).sync();
			const cards = async (j: IndexedDbProgressJournal) =>
				projectProgress(await j.snapshot(), answer.mapId, new Set(['one'])).cards;
			expect(await cards(a)).toEqual([]);
			expect(await cards(b)).toEqual([]);
			expect(await a.pending()).toEqual([]);
			await a.append({ ...answer, roundId: 'after-reset' }, 'after-reset');
			await new ProgressSync(a, ta).sync();
			await new ProgressSync(b, tb).sync();
			expect(await cards(a)).toEqual(await cards(b));
			expect((await cards(b))[0].cleanStreak).toBe(1);
			await signOut(ca.auth);
			expect(ta.currentOwner()).toBeUndefined();
			expect(localStorage.getItem(guestKey)).toBe('guest-original');
		} finally {
			for (const j of journals) await j.close().catch(() => undefined);
			for (const c of clients) {
				await terminate(c.db);
				await deleteApp(c.app);
			}
			localStorage.removeItem(guestKey);
			for (const name of databases)
				await new Promise<void>((resolve, reject) => {
					const r = indexedDB.deleteDatabase(name);
					r.onsuccess = () => resolve();
					r.onerror = () => reject(r.error);
				});
		}
	}
);

// Real Auth observer -> session -> game repository, with production popup interaction
// replaced only by a synthetic credential at the emulator boundary.
it.skipIf(import.meta.env.VITE_GEOCLICK_SYNC_EMULATORS !== '1')(
	'connects browser account lifetimes, explicit guest import and sign-out through the actual SDK',
	async () => {
		const [
			{ BrowserAccountSession },
			{ createBrowserAccountAuth },
			{
				createLocalStorageProgressRepository,
				createProgressRepository,
				setAccountProgressRepository
			}
		] = await Promise.all([
			import('./browserAccountSession'),
			import('./browserFirebaseAccount'),
			import('./progressRepository')
		]);
		const projectId = 'demo-geoclick-sync',
			run = crypto.randomUUID(),
			databaseName = 'account-lifetime-' + run;
		const app = initializeApp(
			{ projectId, apiKey: 'fake-emulator-key' },
			'account-lifetime-' + run
		);
		const auth = initializeAuth(app, { persistence: inMemoryPersistence });
		connectAuthEmulator(auth, 'http://127.0.0.1:19110', { disableWarnings: true });
		const db = getFirestore(app);
		connectFirestoreEmulator(db, '127.0.0.1', 18110);
		const journals: IndexedDbProgressJournal[] = [],
			guest = createLocalStorageProgressRepository(),
			mapId = 'browser-account-emulator-' + run;
		const card = {
			targetId: 'one',
			cleanStreak: 2,
			easeFactor: 2.5,
			interval: 1,
			repetitions: 2,
			dueDate: '2026-11-03',
			lastReviewedAt: '2026-11-02'
		};
		const session = new BrowserAccountSession({
			auth: createBrowserAccountAuth(auth, projectId),
			guest,
			maps: [{ mapId, targetIds: new Set(['one']) }],
			automatic: false,
			async open(identity) {
				const journal = new IndexedDbProgressJournal(identity, { databaseName });
				journals.push(journal);
				return { journal, transport: createFirestoreProgressTransport(db, auth) };
			},
			bind: setAccountProgressRepository,
			changed: () => {},
			progressChanged: () => {}
		});
		try {
			await guest.saveCardState(mapId, card);
			session.start();
			expect((await createProgressRepository()).progressScope).toBeUndefined();
			await signInWithCredential(
				auth,
				GoogleAuthProvider.credential(
					JSON.stringify({
						sub: 'session-' + run,
						email: run + '@example.test',
						email_verified: true
					})
				)
			);
			await expect.poll(() => session.state.usingAccount).toBe(true);
			expect(await (await createProgressRepository()).getCardStates(mapId)).toEqual([]);
			await session.prepareImport();
			expect(session.state.preview?.rows).toHaveLength(1);
			expect(await (await createProgressRepository()).getCardStates(mapId)).toEqual([]);
			await session.confirmImport();
			expect(session.state.imported).toBe(1);
			expect(session.state.sync).toBe('synced');
			expect((await (await createProgressRepository()).getCardStates(mapId))[0].cleanStreak).toBe(
				2
			);
			const page = await createFirestoreProgressTransport(db, auth).pull(undefined, 100);
			expect(page.records).toHaveLength(1);
			await session.signOut();
			expect((await createProgressRepository()).progressScope).toBeUndefined();
			expect(await guest.getCardStates(mapId)).toEqual([card]);
		} finally {
			session.dispose();
			setAccountProgressRepository(undefined);
			await guest.clearMap(mapId);
			for (const journal of journals) await journal.close().catch(() => {});
			await terminate(db);
			await deleteApp(app);
			await new Promise<void>((resolve, reject) => {
				const r = indexedDB.deleteDatabase(databaseName);
				r.onsuccess = () => resolve();
				r.onerror = () => reject(r.error);
			});
		}
	}
);
