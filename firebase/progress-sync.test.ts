import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import {
	initializeAuth,
	inMemoryPersistence,
	connectAuthEmulator,
	signInWithCredential,
	GoogleAuthProvider,
	signOut,
	signInAnonymously
} from 'firebase/auth';
import {
	getFirestore,
	connectFirestoreEmulator,
	collection,
	doc,
	setDoc,
	getDoc,
	getDocs,
	query,
	limit,
	deleteDoc,
	terminate
} from 'firebase/firestore/lite';
import {
	createFirestoreProgressTransport,
	encodeCloudProgressEvent
} from '../app/src/lib/firestoreProgressTransport.ts';
import { ProgressSync, type SyncProgressJournal } from '../app/src/lib/progressSync.ts';
import {
	analyzeProgressEvents,
	parseProgressEvent,
	progressFingerprint,
	projectProgress,
	type ProgressEvent,
	type ProgressOwner,
	type ProgressOperation
} from '../app/src/lib/progressEvents.ts';
// Fail closed before any SDK request. This command is exclusively an emulator test.
const projectId = 'demo-geoclick-sync';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18110');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:19110');
let next = 0;
function client() {
	const app = initializeApp({ projectId, apiKey: 'fake-emulator-key' }, 'sync-test-' + next++);
	const auth = initializeAuth(app, { persistence: inMemoryPersistence });
	connectAuthEmulator(auth, 'http://127.0.0.1:19110', { disableWarnings: true });
	const db = getFirestore(app);
	connectFirestoreEmulator(db, '127.0.0.1', 18110);
	return { app, auth, db };
}
async function login(c: ReturnType<typeof client>, sub: string) {
	const token = JSON.stringify({ sub, email: sub + '@example.test', email_verified: true });
	return (await signInWithCredential(c.auth, GoogleAuthProvider.credential(token))).user;
}
const denied = (operation: Promise<unknown>) =>
	assert.rejects(
		operation,
		(error: unknown) => (error as { code?: string }).code === 'permission-denied'
	);
function event(owner: ProgressOwner, id: string, operation: ProgressOperation): ProgressEvent {
	return {
		version: 1,
		...owner,
		id,
		deviceId: 'device-' + id,
		sequence: 1,
		logicalTime: 1,
		parents: [],
		operationKey: 'operation/' + id,
		operation
	};
}
const answer: ProgressOperation = {
	kind: 'answer',
	mapId: 'italy-regions',
	targetId: 'one',
	roundId: 'round-one',
	grade: 'good',
	date: '2026-11-02'
};
const score = { total: 1, perfect: 1, totalErrors: 0, completedAt: '2026-11-02T12:00:00.000Z' };
// Server integration uses the same graph/reducer, while Chromium tests separately prove local durability.
function journal(owner: ProgressOwner): SyncProgressJournal {
	const rows = new Map<string, ProgressEvent>(),
		pending = new Map<string, ProgressEvent>();
	return {
		owner,
		snapshot: async () => analyzeProgressEvents([...rows.values()], owner),
		async append(operation, key) {
			const graph = analyzeProgressEvents([...rows.values()], owner);
			const row = event(owner, 'event-' + crypto.randomUUID(), operation);
			row.operationKey = key;
			row.parents = graph.heads;
			row.logicalTime = graph.logicalTime + 1;
			rows.set(row.id, row);
			pending.set(row.id, row);
			return row;
		},
		async ingest(input) {
			const rejected = [];
			let accepted = 0;
			for (const raw of input) {
				const parsed = parseProgressEvent(raw, owner);
				if (parsed.event) {
					rows.set(parsed.event.id, parsed.event);
					accepted++;
				} else rejected.push({ reason: parsed.reason! });
			}
			return { accepted, rejected };
		},
		pending: async () => [...pending.values()],
		async acknowledge(events) {
			for (const e of events) {
				assert.equal(progressFingerprint(rows.get(e.id)), progressFingerprint(e));
				pending.delete(e.id);
			}
		}
	};
}
test(
	'production immutable-event transport and rules (emulators only)',
	{ timeout: 120000 },
	async (t) => {
		const a = client(),
			b = client(),
			other = client(),
			guest = client();
		try {
			const ua = await login(a, 'owner'),
				ub = await login(b, 'owner');
			await login(other, 'stranger');
			assert.equal(ua.uid, ub.uid);
			const owner = { projectId, uid: ua.uid },
				path = (c: ReturnType<typeof client>, id: string) =>
					doc(c.db, 'users', owner.uid, 'progressEventsV1', id);
			const transport = createFirestoreProgressTransport(a.db, a.auth),
				tb = createFirestoreProgressTransport(b.db, b.auth);
			const valid = event(owner, 'valid', answer),
				encoded = encodeCloudProgressEvent(valid, owner);
			await t.test(
				'owner can create/read/exactly retry; mutation and deletion are forbidden',
				async () => {
					await transport.put(valid);
					await transport.put(valid);
					assert.deepEqual((await transport.pull(undefined, 100)).records, [valid]);
					await denied(setDoc(path(a, valid.id), { ...encoded, operationKey: 'changed' }));
					await denied(deleteDoc(path(a, valid.id)));
				}
			);
			await t.test(
				'anonymous and foreign identities cannot read, list, create, retry, mutate or delete',
				async () => {
					for (const c of [other, guest]) {
						await denied(getDoc(path(c, valid.id)));
						await denied(
							getDocs(query(collection(c.db, 'users', owner.uid, 'progressEventsV1'), limit(100)))
						);
						await denied(setDoc(path(c, 'foreign'), { ...encoded, id: 'foreign' }));
						await denied(setDoc(path(c, valid.id), encoded));
						await denied(deleteDoc(path(c, valid.id)));
					}
					await denied(setDoc(doc(a.db, 'unrelated', 'data'), encoded));
					await denied(getDocs(collection(a.db, 'users', owner.uid, 'progressEventsV1')));
					await denied(
						getDocs(query(collection(a.db, 'users', owner.uid, 'progressEventsV1'), limit(101)))
					);
				}
			);
			await t.test(
				'all operation kinds and maximum supported frontiers/confusions pass',
				async () => {
					const operations: ProgressOperation[] = [
						answer,
						{
							kind: 'round',
							mapId: 'italy-regions',
							roundId: 'r',
							summary: score,
							slipped: 0,
							timedMs: 12
						},
						{
							kind: 'import-card',
							mapId: 'italy-regions',
							targetId: 'one',
							state: {
								easeFactor: 2.5,
								interval: 365,
								repetitions: 1000000,
								cleanStreak: 3,
								dueDate: '2026-11-02',
								lastReviewedAt: '2026-11-02'
							}
						},
						{
							kind: 'import-map',
							mapId: 'italy-regions',
							summary: score,
							records: {
								bestTimeMs: 12,
								slipped: 0,
								confusions: Array.from({ length: 20 }, (_, i) => ({
									targetId: 'x'.repeat(256),
									chosenId: 'y'.repeat(253) + String(i).padStart(3, '0'),
									count: 1000000
								}))
							}
						},
						{ kind: 'reset', scope: 'known', mapId: 'italy-regions' },
						{ kind: 'reset', scope: 'map', mapId: 'italy-regions' },
						{ kind: 'reset', scope: 'all' }
					];
					for (let i = 0; i < operations.length; i++) {
						const e = event(owner, 'kind-' + i, operations[i]);
						e.parents = Array.from(
							{ length: 128 },
							(_, j) => 'p'.repeat(125) + String(j).padStart(3, '0')
						);
						await transport.put(e);
					}
					const rows = await tb.pull(undefined, 100);
					assert.equal(rows.records.length, 8);
					assert.deepEqual(
						(rows.records as ProgressEvent[]).find((e) => e.id === 'kind-3')!.operation,
						operations[3]
					);
				}
			);
			await t.test(
				'closed schemas reject invalid envelopes, oversize fields and nested operations',
				async () => {
					const invalid = [
						{ ...encoded, version: 2 },
						{ ...encoded, uid: 'another' },
						{ ...encoded, projectId: 'another-project' },
						{ ...encoded, extra: true },
						{ ...encoded, operationKey: 'x'.repeat(513) },
						{ ...encoded, deviceId: 'bad/slash' },
						{ ...encoded, sequence: 0 },
						{ ...encoded, logicalTime: 1.5 },
						{ ...encoded, parents: Array(129).fill('parent').join(',') },
						{ ...encoded, parents: 'parent,,other' },
						{ ...encoded, parents: ['parent'] },
						{ ...encoded, operation: { ...answer, grade: 'perfect' } },
						{ ...encoded, operation: { ...answer, extra: true } },
						{ ...encoded, operation: { ...answer, date: '2026-99-99' } },
						{ ...encoded, operation: { ...answer, targetId: 'x'.repeat(257) } },
						{ ...encoded, operation: { kind: 'reset', scope: 'all', mapId: 'unexpected' } },
						{
							...encoded,
							operation: {
								kind: 'round',
								mapId: 'm',
								roundId: 'r',
								summary: { ...score, perfect: 2 },
								slipped: 0
							}
						},
						{
							...encoded,
							operation: {
								kind: 'import-card',
								mapId: 'm',
								targetId: 'one',
								state: { easeFactor: 99 }
							}
						},
						{
							...encoded,
							operation: {
								kind: 'import-map',
								mapId: 'm',
								records: { confusions: [{ targetId: 'a', chosenId: 'b', count: -1 }] }
							}
						},
						{
							...encoded,
							operation: {
								kind: 'import-map',
								mapId: 'm',
								records: { confusions: Array(21).fill({ targetId: 'a', chosenId: 'b', count: 1 }) }
							}
						}
					];
					for (let i = 0; i < invalid.length; i++) {
						const id = 'invalid-' + i;
						await denied(setDoc(path(a, id), { ...invalid[i], id }));
					}
					await denied(setDoc(path(a, 'path-id-mismatch'), encoded));
				}
			);
			await t.test('bounded SDK pages preserve all IDs', async () => {
				const ids: string[] = [];
				let cursor: string | undefined;
				do {
					const page = await transport.pull(cursor, 3);
					ids.push(...(page.records as ProgressEvent[]).map((e) => e.id));
					cursor = page.next;
				} while (cursor);
				assert.equal(ids.length, 8);
				assert.equal(new Set(ids).size, 8);
			});
			await t.test(
				'two authenticated clients converge on actual scheduler operations and stale-reset behavior',
				async () => {
					// Separate identity keeps the preceding rules fixtures out of the graph.
					await login(a, 'sync-owner');
					await login(b, 'sync-owner');
					const ta = createFirestoreProgressTransport(a.db, a.auth),
						tbb = createFirestoreProgressTransport(b.db, b.auth);
					const ja = journal(ta.owner),
						jb = journal(tbb.owner),
						sa = new ProgressSync(ja, ta),
						sb = new ProgressSync(jb, tbb);
					await ja.append(answer, 'first');
					await sa.sync();
					await sb.sync();
					await ja.append({ ...answer, roundId: 'offline' }, 'offline');
					await jb.append({ kind: 'reset', scope: 'known', mapId: 'italy-regions' }, 'reset');
					await sb.sync();
					await sa.sync();
					await sb.sync();
					const project = async (j: SyncProgressJournal) =>
						projectProgress(await j.snapshot(), 'italy-regions', new Set(['one']));
					assert.deepEqual((await project(ja)).cards, []);
					assert.deepEqual(await project(ja), await project(jb));
					await ja.append({ ...answer, roundId: 'after-reset' }, 'after-reset');
					await sa.sync();
					await sb.sync();
					assert.equal((await project(jb)).cards[0].cleanStreak, 1);
					assert.deepEqual(await project(ja), await project(jb));
				}
			);
			await t.test(
				'Firebase anonymous users cannot access even their own event namespace',
				async () => {
					const anonymous = await signInAnonymously(guest.auth);
					const e = event({ projectId, uid: anonymous.user.uid }, 'anonymous', answer);
					await denied(
						setDoc(
							doc(guest.db, 'users', e.uid, 'progressEventsV1', e.id),
							encodeCloudProgressEvent(e, e)
						)
					);
					await denied(
						getDocs(query(collection(guest.db, 'users', e.uid, 'progressEventsV1'), limit(100)))
					);
				}
			);
			await t.test(
				'old transports stop on sign-out and stay invalid after signing in again',
				async () => {
					const old = createFirestoreProgressTransport(a.db, a.auth);
					await signOut(a.auth);
					await assert.rejects(old.pull(undefined, 100), { code: 'account-changed' });
					await login(a, 'sync-owner');
					assert.equal(old.currentOwner(), undefined);
					await assert.rejects(old.put(event(old.owner, 'stale', answer)), {
						code: 'account-changed'
					});
					assert.throws(() => createFirestoreProgressTransport(other.db, a.auth), {
						code: 'auth-project-mismatch'
					});
				}
			);
		} finally {
			for (const c of [a, b, other, guest]) {
				await terminate(c.db);
				await deleteApp(c.app);
			}
		}
	}
);
