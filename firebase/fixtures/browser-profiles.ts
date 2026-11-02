// Test server only; not a game route or production auth bypass.
import { getApp } from 'firebase/app';
import {
	getAuth,
	connectAuthEmulator,
	setPersistence,
	indexedDBLocalPersistence,
	inMemoryPersistence,
	GoogleAuthProvider,
	signInWithCredential
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore/lite';
import { createBrowserFirebaseAccount } from '../../app/src/lib/browserFirebaseAccount';
import { BrowserAccountSession } from '../../app/src/lib/browserAccountSession';
import {
	createLocalStorageProgressRepository,
	createProgressRepository,
	setAccountProgressRepository,
	type CardState,
	type SessionSummary,
	type MapRecords
} from '../../app/src/lib/progressRepository';
import type { IndexedDbProgressJournal } from '../../app/src/lib/indexedDbProgressJournal';
const run = new URL(location.href).searchParams.get('run');
if (location.hostname !== '127.0.0.1' || !run || !/^[a-f0-9-]{36}$/.test(run))
	throw new Error('invalid-emulator-fixture');
const runtime = createBrowserFirebaseAccount({
	projectId: 'demo-geoclick-sync',
	apiKey: 'fake-emulator-key',
	authDomain: 'localhost',
	appId: 'fake-emulator-app'
});
const app = getApp('geoclick-game-account-v1'),
	auth = getAuth(app),
	db = getFirestore(app);
connectAuthEmulator(auth, 'http://127.0.0.1:19110', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 18110);
const mapId = 'profile-map',
	guest = createLocalStorageProgressRepository();
let journal: IndexedDbProgressJournal | undefined,
	observed = false;
let loginSubject: 'owner' | 'other' = 'owner';
async function authenticate(remember: boolean) {
	await setPersistence(auth, remember ? indexedDBLocalPersistence : inMemoryPersistence);
	await signInWithCredential(
		auth,
		GoogleAuthProvider.credential(
			JSON.stringify({
				sub: `profile-${run}-${loginSubject}`,
				email: `${loginSubject}-${run}@example.test`,
				email_verified: true
			})
		)
	);
}

const session = new BrowserAccountSession({
	auth: {
		...runtime.auth,
		signIn: authenticate,
		observe: (listener) =>
			runtime.auth.observe((identity) => {
				observed = true;
				listener(identity);
			})
	},
	guest,
	maps: [{ mapId, targetIds: new Set(['one', 'two']) }],
	automatic: false,
	async open(identity) {
		const opened = await runtime.open(identity);
		journal = opened.journal;
		return opened;
	},
	bind: setAccountProgressRepository,
	changed: () => {},
	progressChanged: () => {}
});
async function wait(predicate: () => boolean) {
	const deadline = Date.now() + 20000;
	while (!predicate()) {
		if (Date.now() > deadline) throw new Error('profile-state-timeout');
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}
function status() {
	const value = session.state;
	return {
		usingAccount: value.usingAccount,
		busy: value.busy,
		sync: value.sync,
		error: value.error,
		imported: value.imported,
		preview: value.preview?.rows
	};
}
await auth.authStateReady();
session.start();
await wait(() => observed && !session.state.busy);
const api = {
	status,
	async login(remember: boolean, subject: 'owner' | 'other' = 'owner') {
		if (!['owner', 'other'].includes(subject)) throw new Error('invalid-subject');
		// Enter through the same explicit session action as the game's button.
		// Only the popup/provider adapter above is replaced by an emulator credential.
		loginSubject = subject;
		await session.signIn(remember);
		await wait(
			() =>
				session.state.usingAccount &&
				session.state.identity?.uid === auth.currentUser?.uid &&
				!session.state.busy
		);
		await session.refresh();
		return status();
	},
	async seed(cards: CardState[], summary?: SessionSummary, records?: MapRecords) {
		for (const card of cards) await guest.saveCardState(mapId, card);
		if (summary) await guest.saveLastSessionSummary(mapId, summary);
		if (records) await guest.saveMapRecords(mapId, records);
	},
	async guest() {
		return {
			cards: await guest.getCardStates(mapId),
			summary: await guest.getLastSessionSummary(mapId),
			records: await guest.getMapRecords(mapId)
		};
	},
	async preview() {
		await session.prepareImport();
		return status();
	},
	dismiss() {
		session.dismissImport();
		return status();
	},
	async confirm() {
		await session.confirmImport();
		return status();
	},
	async sync() {
		await session.refresh();
		return status();
	},
	async answer(
		roundId: string,
		targetId: string,
		grade: 'good' | 'hard' | 'again',
		chosenId?: string
	) {
		const repository = await createProgressRepository(),
			writer = repository.quizOperations?.(mapId);
		if (!writer) throw new Error('not-account');
		await writer.answer({
			roundId,
			targetId,
			grade,
			date: '2026-11-02',
			...(chosenId ? { chosenId } : {})
		});
	},
	async round(roundId: string, summary: SessionSummary, slipped: number, timedMs?: number) {
		const writer = (await createProgressRepository()).quizOperations?.(mapId);
		if (!writer) throw new Error('not-account');
		await writer.round({
			roundId,
			summary,
			slipped,
			...(timedMs === undefined ? {} : { timedMs })
		});
	},
	async reset() {
		await (await createProgressRepository()).resetKnown(mapId);
	},
	async snapshot() {
		const repository = await createProgressRepository();
		return {
			cards: await repository.getCardStates(mapId),
			summary: await repository.getLastSessionSummary(mapId),
			records: await repository.getMapRecords(mapId),
			events: session.state.usingAccount ? (await journal!.snapshot()).events.length : 0,
			pending: session.state.usingAccount ? (await journal!.pending()).length : 0
		};
	},
	async signOut() {
		await session.signOut();
		return status();
	}
};
Object.assign(window, { profileProof: api });
