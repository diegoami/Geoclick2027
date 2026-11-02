import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	BrowserAccountSession,
	type BrowserAccountAuth,
	type BrowserAccountIdentity
} from './browserAccountSession';
import { IndexedDbProgressJournal } from './indexedDbProgressJournal';
import {
	createLocalStorageProgressRepository,
	createProgressRepository,
	setAccountProgressRepository,
	setProgressSandbox,
	createInMemoryProgressRepository,
	type ProgressRepository
} from './progressRepository';
import { progressOwnerKey, type ProgressEvent } from './progressEvents';
import type { ProgressTransport } from './progressSync';
import { parseBrowserFirebaseConfig } from './browserFirebaseAccount';
const A = { projectId: 'test-project', uid: 'A', label: 'Account A' },
	B = { ...A, uid: 'B', label: 'Account B' };
const answer = {
	kind: 'answer' as const,
	mapId: 'browser-account-test-' + crypto.randomUUID(),
	targetId: 'one',
	roundId: 'round-one',
	grade: 'good' as const,
	date: '2026-11-02'
};
const card = {
	targetId: 'one',
	cleanStreak: 2,
	easeFactor: 2.5,
	interval: 1,
	repetitions: 2,
	dueDate: '2026-11-03',
	lastReviewedAt: '2026-11-02'
};
const cleanup: (() => Promise<void>)[] = [];
function fixture(initial?: BrowserAccountIdentity) {
	const databaseName = 'account-session-test-' + crypto.randomUUID(),
		journals: IndexedDbProgressJournal[] = [];
	let identity = initial,
		listener: ((user: BrowserAccountIdentity | undefined) => void) | undefined;
	const emit = (next: BrowserAccountIdentity | undefined) => {
		identity = next;
		listener?.(next);
	};
	const auth: BrowserAccountAuth = {
		current: () => identity,
		observe: (callback) => {
			listener = callback;
			callback(identity);
			return () => {
				listener = undefined;
			};
		},
		signIn: vi.fn(async () => {
			emit(A);
		}),
		signOut: vi.fn(async () => {
			emit(undefined);
		})
	};
	const cloud = new Map<string, Map<string, ProgressEvent>>();
	let offline = false;
	const open = vi.fn(async (user: BrowserAccountIdentity) => {
		const journal = new IndexedDbProgressJournal(user, { databaseName });
		journals.push(journal);
		const key = progressOwnerKey(user);
		if (!cloud.has(key)) cloud.set(key, new Map());
		const events = cloud.get(key)!;
		const transport: ProgressTransport = {
			owner: user,
			currentOwner: () => identity,
			async pull() {
				if (offline) throw new Error('offline');
				return { records: [...events.values()] };
			},
			async put(event) {
				if (offline) throw new Error('offline');
				events.set(event.id, structuredClone(event));
			}
		};
		return { journal, transport };
	});
	const guest = createLocalStorageProgressRepository();
	const bind = vi.fn((repository: ProgressRepository | undefined) => {
		setAccountProgressRepository(repository);
	});
	const session = new BrowserAccountSession({
		auth,
		open,
		guest,
		bind,
		maps: [{ mapId: answer.mapId, targetIds: new Set(['one']) }],
		changed: () => {},
		progressChanged: () => {},
		automatic: false
	});
	cleanup.push(async () => {
		session.dispose();
		for (const j of journals) await j.close().catch(() => {});
		await new Promise<void>((resolve, reject) => {
			const r = indexedDB.deleteDatabase(databaseName);
			r.onsuccess = () => resolve();
			r.onerror = () => reject(r.error);
		});
	});
	return {
		session,
		auth,
		emit,
		open,
		guest,
		bind,
		cloud,
		offline: (value: boolean) => {
			offline = value;
		}
	};
}
afterEach(async () => {
	for (const close of cleanup.splice(0)) await close();
	setAccountProgressRepository(undefined);
	setProgressSandbox(undefined);
	await createLocalStorageProgressRepository().clearMap(answer.mapId);
});
async function ready(f: ReturnType<typeof fixture>, uid = 'A') {
	await expect.poll(() => f.session.state.identity?.uid).toBe(uid);
	await expect.poll(() => f.session.state.usingAccount).toBe(true);
	await expect.poll(() => f.session.state.busy).toBe(false);
}
describe('optional browser account lifecycle', () => {
	it('starts as guest, switches repositories only on login, and imports only an explicit reviewed confirmation', async () => {
		const f = fixture();
		await f.guest.saveCardState(answer.mapId, card);
		f.session.start();
		expect(f.session.state.usingAccount).toBe(false);
		expect(await (await createProgressRepository()).getCardStates(answer.mapId)).toEqual([card]);
		await f.session.signIn(false);
		await ready(f);
		expect(f.auth.signIn).toHaveBeenCalledWith(false);
		const account = await createProgressRepository();
		expect(account.progressScope?.(answer.mapId)).toContain('account:');
		expect(await account.getCardStates(answer.mapId)).toEqual([]);
		await f.session.prepareImport();
		expect(f.session.state.preview?.rows).toHaveLength(1);
		expect(await account.getCardStates(answer.mapId)).toEqual([]);
		f.session.dismissImport();
		expect(await account.getCardStates(answer.mapId)).toEqual([]);
		await f.session.prepareImport();
		await f.session.confirmImport();
		expect(f.session.state.imported).toBe(1);
		expect((await account.getCardStates(answer.mapId))[0].cleanStreak).toBe(2);
		expect(await f.guest.getCardStates(answer.mapId)).toEqual([card]);
		await f.session.signOut();
		expect((await createProgressRepository()).progressScope).toBeUndefined();
		expect(await f.guest.getCardStates(answer.mapId)).toEqual([card]);
	});
	it('keeps account history on conflicts and refuses import while cloud history is unavailable', async () => {
		const f = fixture();
		await f.guest.saveCardState(answer.mapId, card);
		f.session.start();
		f.emit(A);
		await ready(f);
		await (await createProgressRepository()).quizOperations!(answer.mapId)!.answer(answer);
		await f.session.prepareImport();
		expect(f.session.state.preview?.rows[0].disposition).toBe('account-wins');
		f.session.dismissImport();
		f.offline(true);
		await f.session.prepareImport();
		expect(f.session.state.preview).toBeUndefined();
		expect(f.session.state.error).toBe('import');
		expect(f.session.state.usingAccount).toBe(true);
		expect(await f.guest.getCardStates(answer.mapId)).toEqual([card]);
	});
	it('restores a remembered identity from local journal while offline and retries after reconnect', async () => {
		const f = fixture(A),
			stored = await f.open(A);
		await stored.journal.append(answer, 'offline');
		await stored.journal.close();
		f.offline(true);
		f.session.start();
		await ready(f);
		await expect.poll(() => f.session.state.sync).toBe('error');
		expect(
			(await (await createProgressRepository()).getCardStates(answer.mapId))[0].cleanStreak
		).toBe(1);
		f.offline(false);
		expect(await f.session.refresh()).toBe(true);
		expect(f.session.state.sync).toBe('synced');
		expect(f.cloud.get(progressOwnerKey(A))?.size).toBe(1);
	});
	it('reports denied account storage while keeping guest progress and sign-out available', async () => {
		const f = fixture();
		await f.guest.saveCardState(answer.mapId, card);
		f.open.mockRejectedValue(new Error('storage denied'));
		f.session.start();
		f.emit(A);
		await expect.poll(() => f.session.state.error).toBe('storage');
		expect(f.session.state.usingAccount).toBe(false);
		expect(await (await createProgressRepository()).getCardStates(answer.mapId)).toEqual([card]);
		await f.session.signOut();
		expect(f.session.state.identity).toBeUndefined();
	});
	it('does not activate a late old-account open, and old quiz callbacks stay in their original namespace', async () => {
		const f = fixture();
		f.session.start();
		f.emit(A);
		await ready(f);
		const old = await createProgressRepository();
		f.emit(B);
		await ready(f, 'B');
		await old.quizOperations!(answer.mapId)!.answer(answer);
		expect(await (await createProgressRepository()).getCardStates(answer.mapId)).toEqual([]);
		expect(f.cloud.get(progressOwnerKey(B))?.size ?? 0).toBe(0);
		f.emit(A);
		await ready(f);
		await f.session.refresh();
		expect(
			(await (await createProgressRepository()).getCardStates(answer.mapId))[0].cleanStreak
		).toBe(1);
		expect(f.cloud.get(progressOwnerKey(A))?.size).toBe(1);
	});
	it('discards an open resolving after another identity has become active', async () => {
		const f = fixture();
		const original = f.open.getMockImplementation()!;
		let release!: () => void;
		f.open.mockImplementation(async (identity) => {
			if (identity.uid === 'A')
				await new Promise<void>((resolve) => {
					release = resolve;
				});
			return original(identity);
		});
		f.session.start();
		f.emit(A);
		f.emit(B);
		await ready(f, 'B');
		release();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect((await createProgressRepository()).progressScope?.(answer.mapId)).toContain('B');
		expect(f.session.state.identity?.uid).toBe('B');
	});
	it('prevents a popup finishing after explicit sign-out from restoring the account', async () => {
		const f = fixture();
		let finish!: () => void;
		f.auth.signIn = vi.fn(async () => {
			await new Promise<void>((resolve) => {
				finish = resolve;
			});
			f.emit(A);
		});
		f.session.start();
		const pending = f.session.signIn(true);
		await f.session.signOut();
		finish();
		await pending;
		await expect.poll(() => f.session.state.identity).toBeUndefined();
		expect(f.session.state.usingAccount).toBe(false);
		expect(f.open).not.toHaveBeenCalled();
	});
	it('detaches immediately on failed sign-out and allows forgetting the saved identity on retry', async () => {
		const f = fixture(A);
		f.session.start();
		await ready(f);
		f.auth.signOut = vi.fn(async () => {
			throw new Error('failed');
		});
		await f.session.signOut();
		expect(f.session.state.error).toBe('signout');
		expect((await createProgressRepository()).progressScope).toBeUndefined();
		f.auth.signOut = async () => {
			f.emit(undefined);
		};
		await f.session.signOut();
		expect(f.session.state.identity).toBeUndefined();
	});
	it('keeps tutorial operations out of an active account and retains the captured sandbox after it ends', async () => {
		const f = fixture(A);
		f.session.start();
		await ready(f);
		const memory = createInMemoryProgressRepository();
		setProgressSandbox({ mapId: answer.mapId, memory });
		const tutorial = await createProgressRepository();
		expect(tutorial.quizOperations?.(answer.mapId)).toBeUndefined();
		await tutorial.saveCardState(answer.mapId, card);
		setProgressSandbox(undefined);
		expect(await (await createProgressRepository()).getCardStates(answer.mapId)).toEqual([]);
		expect(await tutorial.getCardStates(answer.mapId)).toEqual([card]);
	});
	it('validates only the public browser config without loading a default project', () => {
		expect(parseBrowserFirebaseConfig(undefined)).toBeUndefined();
		expect(parseBrowserFirebaseConfig('{bad')).toBeUndefined();
		expect(parseBrowserFirebaseConfig('{}')).toBeUndefined();
		expect(
			parseBrowserFirebaseConfig(
				JSON.stringify({
					apiKey: 'fake',
					authDomain: 'example.test',
					projectId: 'test',
					appId: 'app',
					extra: 'ignored'
				})
			)
		).toEqual({ apiKey: 'fake', authDomain: 'example.test', projectId: 'test', appId: 'app' });
	});
});
