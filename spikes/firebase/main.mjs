import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup,
  signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer } from 'firebase/firestore';

const cloud = import.meta.env.VITE_FIREBASE_MODE === 'cloud';
const config = cloud ? JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}') : {
  apiKey: 'fake-spike-key', projectId: 'demo-geoclick-spike', authDomain: 'demo-geoclick-spike.firebaseapp.com'
};
if (cloud && (!config.apiKey || !config.projectId || !config.authDomain)) {
  throw new Error('Cloud mode requires VITE_FIREBASE_CONFIG from a dedicated Firebase test project.');
}
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
if (!cloud) {
  connectAuthEmulator(auth, 'http://127.0.0.1:19100', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 18100);
}
const el = (id) => document.getElementById(id);
el('mode').textContent = cloud
  ? `REAL GOOGLE LOGIN — test project ${config.projectId}. Writes only to firebaseSpikeUsers.`
  : 'LOCAL EMULATORS — simulated Google login, not a real Google authentication test.';
const result = (value) => { el('result').textContent = value; };
const act = (fn) => async () => {
  try { await fn(); } catch (error) { result(`${error.code || 'error'}: ${error.message}`); }
};
onAuthStateChanged(auth, (user) => {
  el('identity').textContent = user ? `Signed in: ${user.email} · UID ${user.uid}` : 'Signed out';
  el('signin').disabled = !!user;
  for (const id of ['signout', 'save', 'read']) el(id).disabled = !user;
  result(user ? 'Ready to save or read synthetic progress.' : 'Signed out. Sample display cleared.');
});
const sample = () => doc(db, 'firebaseSpikeUsers', auth.currentUser.uid, 'cards', 'demo-target');
el('signin').onclick = act(() => signInWithPopup(auth, new GoogleAuthProvider()));
el('signout').onclick = act(() => signOut(auth));
el('save').onclick = act(async () => {
  await setDoc(sample(), { level: 2, deviceId: 'browser-spike' });
  result('Saved synthetic level 2. Sign in with the same account in another browser profile and click Read.');
});
el('read').onclick = act(async () => {
  const snapshot = await getDocFromServer(sample());
  result(snapshot.exists() ? JSON.stringify(snapshot.data(), null, 2) : 'No sample saved for this account.');
});
