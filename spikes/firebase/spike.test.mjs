import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, connectAuthEmulator,
  signInWithCredential, GoogleAuthProvider, signOut } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc,
  getDocFromServer, disableNetwork, enableNetwork, terminate } from 'firebase/firestore';

// Never accept a real project or external host in the automated experiment.
const projectId = 'demo-geoclick-spike';
let nextClient = 0;
function client() {
  const app = initializeApp({ projectId, apiKey: 'fake-spike-key' }, `client-${nextClient++}`);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, 'http://127.0.0.1:19100', { disableWarnings: true });
  const db = initializeFirestore(app, {});
  connectFirestoreEmulator(db, '127.0.0.1', 18100);
  return { app, auth, db };
}
async function login(client, subject) {
  // Auth Emulator accepts unsigned JSON Google ID tokens. This does NOT
  // exercise Google's account picker, consent, MFA or real credentials.
  const token = JSON.stringify({ sub: subject, email: `${subject}@example.test`, email_verified: true });
  return (await signInWithCredential(client.auth, GoogleAuthProvider.credential(token))).user;
}
const card = (client, uid, target = 'demo-target') =>
  doc(client.db, 'firebaseSpikeUsers', uid, 'cards', target);

const denied = (operation) => assert.rejects(operation, (error) => error.code === 'permission-denied');

test('Google-provider identity, access boundaries and offline conflicts', { timeout: 90000 }, async (t) => {
  const a = client(), b = client(), stranger = client(), guest = client();
  try {
    const userA = await login(a, 'spike-owner');
    const userB = await login(b, 'spike-owner');
    await login(stranger, 'spike-other');
    await t.test('same Google identity has the same UID in independent clients', () => {
      assert.equal(userA.uid, userB.uid);
    });
    await t.test('client B reads synthetic progress written by A', async () => {
      await setDoc(card(a, userA.uid), { level: 1, deviceId: 'A' });
      assert.deepEqual((await getDocFromServer(card(b, userB.uid))).data(), { level: 1, deviceId: 'A' });
    });
    await t.test('another user cannot read or overwrite the owner data', async () => {
      await denied(getDocFromServer(card(stranger, userA.uid)));
      await denied(setDoc(card(stranger, userA.uid), { level: 3, deviceId: 'other' }));
    });
    await t.test('unauthenticated client cannot read or write owner data', async () => {
      await denied(getDocFromServer(card(guest, userA.uid)));
      await denied(setDoc(card(guest, userA.uid), { level: 3, deviceId: 'guest' }));
    });
    await t.test('invalid progress and unrelated paths are denied', async () => {
      await denied(setDoc(card(a, userA.uid), { level: 99, deviceId: 'A' }));
      await denied(setDoc(card(a, userA.uid), { level: 2, deviceId: 'A', unexpected: true }));
      await denied(setDoc(doc(a.db, 'unrelated', 'data'), { level: 1 }));
    });
    await t.test('offline change becomes visible to B after reconnect', async () => {
      await disableNetwork(a.db);
      const queued = setDoc(card(a, userA.uid), { level: 2, deviceId: 'offline-A' });
      assert.equal((await getDocFromServer(card(b, userB.uid))).data().level, 1);
      await enableNetwork(a.db);
      await queued;
      assert.equal((await getDocFromServer(card(b, userB.uid))).data().level, 2);
    });
    await t.test('last arriving offline snapshot overwrites an online reset: NOT a safe merge', async () => {
      await disableNetwork(a.db);
      const stale = setDoc(card(a, userA.uid), { level: 3, deviceId: 'stale-offline-A' });
      await setDoc(card(b, userB.uid), { level: 0, deviceId: 'reset-B' });
      assert.equal((await getDocFromServer(card(b, userB.uid))).data().level, 0);
      await enableNetwork(a.db);
      await stale;
      assert.equal((await getDocFromServer(card(b, userB.uid))).data().level, 3);
    });
    await t.test('sign-out denies further server reads; re-login restores the same identity', async () => {
      await signOut(a.auth);
      assert.equal(a.auth.currentUser, null);
      await denied(getDocFromServer(card(a, userA.uid)));
      assert.equal((await login(a, 'spike-owner')).uid, userA.uid);
    });
  } finally {
    for (const c of [a, b, stranger, guest]) {
      await terminate(c.db);
      await deleteApp(c.app);
    }
  }
});
