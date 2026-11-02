import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import {
	initializeAuth,
	inMemoryPersistence,
	connectAuthEmulator,
	signInWithCredential,
	GoogleAuthProvider,
	signInAnonymously,
	signOut
} from 'firebase/auth';
import {
	getFirestore,
	connectFirestoreEmulator,
	collection,
	doc,
	getDoc,
	getDocs,
	setDoc,
	deleteDoc,
	query,
	limit,
	writeBatch,
	terminate
} from 'firebase/firestore/lite';
import { createSequencedProgressTransport } from '../app/src/lib/sequencedProgressTransport.ts';
import {
	createFirestoreProgressTransport,
	encodeCloudProgressEvent
} from '../app/src/lib/firestoreProgressTransport.ts';
import type { ProgressEvent, ProgressOwner } from '../app/src/lib/progressEvents.ts';
const projectId = 'demo-geoclick-sync';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18110');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:19110');
function client() {
	const app = initializeApp(
		{ projectId, apiKey: 'fake-emulator-key' },
		'delivery-' + crypto.randomUUID()
	);
	const auth = initializeAuth(app, { persistence: inMemoryPersistence });
	connectAuthEmulator(auth, 'http://127.0.0.1:19110', { disableWarnings: true });
	const db = getFirestore(app);
	connectFirestoreEmulator(db, '127.0.0.1', 18110);
	return { app, auth, db };
}
async function login(c: ReturnType<typeof client>, sub: string) {
	return (
		await signInWithCredential(
			c.auth,
			GoogleAuthProvider.credential(
				JSON.stringify({ sub, email: sub + '@example.test', email_verified: true })
			)
		)
	).user;
}
const denied = (operation: Promise<unknown>) =>
	assert.rejects(
		operation,
		(error: unknown) => (error as { code?: string }).code === 'permission-denied'
	);
function event(owner: ProgressOwner, id: string): ProgressEvent {
	return {
		version: 1,
		id,
		...owner,
		deviceId: 'device-' + id,
		sequence: 1,
		logicalTime: 1,
		parents: [],
		operationKey: 'answer/' + id,
		operation: {
			kind: 'answer',
			mapId: 'italy-regions',
			targetId: 'one',
			roundId: 'round-' + id,
			grade: 'good',
			date: '2026-11-03'
		}
	};
}
test(
	'sequenced immutable delivery and legacy cutover (emulators only)',
	{ timeout: 180000 },
	async (t) => {
		const a = client(),
			b = client(),
			foreign = client(),
			anonymous = client();
		const clients = [a, b, foreign, anonymous];
		try {
			const sub = 'delivery-' + crypto.randomUUID();
			const user = await login(a, sub);
			assert.equal((await login(b, sub)).uid, user.uid);
			await login(foreign, 'foreign-' + crypto.randomUUID());
			await signInAnonymously(anonymous.auth);
			const owner = { projectId, uid: user.uid };
			const head = (c = a) => doc(c.db, 'users', owner.uid, 'progressSyncV2', 'head');
			const row = (id: string, c = a) => doc(c.db, 'users', owner.uid, 'progressEventsV2', id);
			const oldRow = (id: string, c = a) => doc(c.db, 'users', owner.uid, 'progressEventsV1', id);
			const ta = createSequencedProgressTransport(a.db, a.auth),
				tb = createSequencedProgressTransport(b.db, b.auth);
			const legacy = createFirestoreProgressTransport(a.db, a.auth);
			const old = event(owner, 'legacy');
			await t.test(
				'constructing a transport makes no cutover; explicit concurrent open freezes V1 once',
				async () => {
					await assert.rejects(ta.head(), { code: 'delivery-not-open' });
					assert.equal((await getDoc(head())).exists(), false);
					await legacy.put(old);
					const initial = { version: 2, sequence: 0, lastEventId: null };
					assert.deepEqual(await Promise.all([ta.open(), tb.open()]), [initial, initial]);
					await denied(legacy.put(event(owner, 'late-legacy')));
					await legacy.put(old); // An exact pre-cutover retry cannot change the frozen set.
					assert.deepEqual((await ta.pullLegacy(undefined, 100)).records, [old]);
				}
			);
			const first = event(owner, 'first');
			await t.test(
				'exact retry consumes no sequence and conflicting IDs cannot replace an event',
				async () => {
					assert.equal(await ta.put(first), 1);
					assert.equal(await ta.put(first), 1);
					await assert.rejects(ta.put({ ...first, operationKey: 'different' }), {
						code: 'conflicting-delivery-event'
					});
					assert.deepEqual(await ta.head(), { version: 2, sequence: 1, lastEventId: first.id });
				}
			);
			await t.test(
				'concurrent equal-ID and distinct-ID transactions preserve a contiguous unique sequence',
				async () => {
					const duplicate = event(owner, 'duplicate');
					assert.deepEqual(await Promise.all([ta.put(duplicate), tb.put(duplicate)]), [2, 2]);
					const positions = await Promise.all([
						ta.put(event(owner, 'concurrent-a')),
						tb.put(event(owner, 'concurrent-b'))
					]);
					assert.deepEqual(positions.sort(), [3, 4]);
					const records = await ta.pull(0, 4, 100);
					assert.equal(records.sequence, 4);
					assert.equal(new Set(records.records.map((raw) => (raw as ProgressEvent).id)).size, 4);
				}
			);
			await t.test(
				'head-only writes, gaps, reused sequences, altered payloads and deletion are denied atomically',
				async () => {
					const previous = await ta.head();
					await denied(setDoc(head(), { version: 2, sequence: 5, lastEventId: 'missing' }));
					await denied(
						setDoc(row('alone'), {
							sequence: 5,
							event: encodeCloudProgressEvent(event(owner, 'alone'), owner)
						})
					);
					for (const jump of [0, 2]) {
						const batch = writeBatch(a.db),
							id = 'bad-jump-' + jump;
						batch.set(head(), { version: 2, sequence: previous.sequence + jump, lastEventId: id });
						batch.set(row(id), {
							sequence: previous.sequence + jump,
							event: encodeCloudProgressEvent(event(owner, id), owner)
						});
						await denied(batch.commit());
					}
					const batch = writeBatch(a.db);
					batch.set(head(), { version: 2, sequence: 5, lastEventId: 'double-b' });
					for (const id of ['double-a', 'double-b'])
						batch.set(row(id), {
							sequence: 5,
							event: encodeCloudProgressEvent(event(owner, id), owner)
						});
					await denied(batch.commit());
					await denied(
						setDoc(row(first.id), {
							sequence: 1,
							event: encodeCloudProgressEvent({ ...first, operationKey: 'changed' }, owner)
						})
					);
					await denied(deleteDoc(row(first.id)));
					await denied(deleteDoc(head()));
					await denied(deleteDoc(oldRow(old.id)));
					assert.deepEqual(await ta.head(), previous);
					assert.equal((await getDoc(row('double-b'))).exists(), false);
				}
			);
			await t.test('wrapper, owner, project, envelope and head schemas stay closed', async () => {
				const previous = await ta.head();
				const id = 'invalid';
				const wire = encodeCloudProgressEvent(event(owner, id), owner);
				for (const data of [
					{ sequence: 5, event: wire, extra: true },
					{ sequence: 5, event: { ...wire, projectId: 'other' } },
					{ sequence: 5, event: { ...wire, uid: 'other' } },
					{ sequence: 5, event: { ...wire, id: 'substitution' } },
					{ sequence: 5, event: { ...wire, parents: Array(129).fill('parent').join(',') } },
					{ sequence: 5, event: { ...wire, operation: { kind: 'unknown' } } }
				]) {
					const batch = writeBatch(a.db);
					batch.set(head(), { version: 2, sequence: 5, lastEventId: id });
					batch.set(row(id), data);
					await denied(batch.commit());
				}
				const extraHead = writeBatch(a.db);
				extraHead.set(head(), { version: 2, sequence: 5, lastEventId: id, extra: true });
				extraHead.set(row(id), { sequence: 5, event: wire });
				await denied(extraHead.commit());
				assert.deepEqual(await ta.head(), previous);
			});
			await t.test(
				'foreign and anonymous users cannot get, list, create, exactly retry or delete protocol data',
				async () => {
					for (const c of [foreign, anonymous]) {
						await denied(getDoc(head(c)));
						await denied(getDoc(row(first.id, c)));
						await denied(
							getDocs(query(collection(c.db, 'users', owner.uid, 'progressEventsV2'), limit(100)))
						);
						await denied(setDoc(row(first.id, c), (await getDoc(row(first.id))).data()!));
						await denied(setDoc(head(c), { version: 2, sequence: 0, lastEventId: null }));
						await denied(deleteDoc(row(first.id, c)));
						await denied(getDoc(oldRow(old.id, c)));
					}
					await denied(getDocs(collection(a.db, 'users', owner.uid, 'progressEventsV2')));
					await denied(
						getDocs(query(collection(a.db, 'users', owner.uid, 'progressEventsV2'), limit(101)))
					);
				}
			);
			await t.test(
				'bounded pages and a captured fence exclude later inserts even when their IDs sort earlier',
				async () => {
					// Seed valid server-rule transactions without SDK read retries, one head/event pair per commit.
					for (let i = 1; i <= 205; i++) {
						const id = 'page-' + String(i).padStart(3, '0'),
							batch = writeBatch(a.db);
						batch.set(head(), { version: 2, sequence: 4 + i, lastEventId: id });
						const candidate = event(owner, id);
						if (i === 205) {
							candidate.parents = Array.from({ length: 128 }, (_, n) =>
								String(n).padStart(128, 'p')
							);
							candidate.operation = {
								kind: 'import-map',
								mapId: 'italy-regions',
								records: {
									confusions: Array.from({ length: 20 }, (_, n) => ({
										targetId: String(n).padStart(256, 't'),
										chosenId: 'c'.repeat(256),
										count: 1000000
									}))
								}
							};
						}
						batch.set(row(id), {
							sequence: 4 + i,
							event: encodeCloudProgressEvent(candidate, owner)
						});
						await batch.commit();
					}
					const fence = (await ta.head()).sequence;
					assert.equal(fence, 209);
					const late = event(owner, '000-sorts-before-old-ids');
					assert.equal(await tb.put(late), 210);
					const seen: unknown[] = [];
					let after = 0,
						queries = 0;
					while (after < fence) {
						const page = await ta.pull(after, fence, 100);
						assert.ok(page.records.length <= 100);
						seen.push(...page.records);
						after = page.sequence;
						queries++;
					}
					assert.equal(queries, 3);
					assert.equal(seen.length, 209);
					assert.equal(
						seen.some((raw) => (raw as ProgressEvent).id === late.id),
						false
					);
					assert.deepEqual(await ta.pull(fence, 210, 100), { records: [late], sequence: 210 });
					assert.deepEqual(await ta.pull(210, 210, 100), { records: [], sequence: 210 });
					await assert.rejects(ta.pull(210, 211, 100), { code: 'incomplete-delivery' });
				}
			);
			await t.test(
				'malformed cursors are rejected before querying and same-UID re-login cannot revive a lifetime',
				async () => {
					for (const count of [0, 101, 1.5])
						await assert.rejects(ta.pull(0, 1, count), { code: 'invalid-page-size' });
					for (const after of [-1, NaN, Number.MAX_SAFE_INTEGER + 1])
						await assert.rejects(ta.pull(after, 1, 100), { code: 'invalid-delivery-cursor' });
					await assert.rejects(ta.pull(2, 1, 100), { code: 'invalid-delivery-cursor' });
					await signOut(a.auth);
					await login(a, sub);
					assert.equal(ta.currentOwner(), undefined);
					await assert.rejects(ta.open(), { code: 'account-changed' });
					await assert.rejects(ta.put(first), { code: 'account-changed' });
					await assert.rejects(ta.pullLegacy(undefined, 100), { code: 'account-changed' });
				}
			);
			await t.test(
				'a legacy write racing cutover either freezes into the bootstrap or is denied',
				async () => {
					for (let i = 0; i < 3; i++) {
						const c = client(),
							d = client();
						clients.push(c, d);
						const who = 'cutover-' + crypto.randomUUID();
						const uid = (await login(c, who)).uid;
						await login(d, who);
						const oldTransport = createFirestoreProgressTransport(c.db, c.auth);
						const newTransport = createSequencedProgressTransport(d.db, d.auth);
						const racing = event({ projectId, uid }, 'racing');
						const writeResult = oldTransport.put(racing).then(
							() => ({ status: 'fulfilled' as const }),
							(reason: { code?: string }) => ({ status: 'rejected' as const, reason })
						);
						await newTransport.open();
						const atFreeze = await newTransport.pullLegacy(undefined, 100);
						const write = await writeResult;
						const frozen = await newTransport.pullLegacy(undefined, 100);
						assert.deepEqual(
							frozen,
							atFreeze,
							'an in-flight old write cannot appear behind a frozen bootstrap cursor'
						);
						if (write.status === 'fulfilled') assert.deepEqual(frozen.records, [racing]);
						else {
							assert.equal(write.reason.code, 'permission-denied');
							assert.deepEqual(frozen.records, []);
						}
						await denied(oldTransport.put(event({ projectId, uid }, 'after-freeze')));
					}
				}
			);
		} finally {
			for (const c of clients) {
				await terminate(c.db);
				await deleteApp(c.app);
			}
		}
	}
);
