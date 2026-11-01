import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, initializeAuth, inMemoryPersistence, signInWithCredential, signOut } from 'firebase/auth';
import { invoke, isTauri } from '@tauri-apps/api/core';
import './style.css';
const $ = (id) => document.getElementById(id);
let auth;
let working = false;
let cancelRequested = false;
function controls() {
  $('login').disabled = !auth || !!auth.currentUser || working;
  $('cancel').disabled = !working;
  $('logout').disabled = !auth?.currentUser || working;
}
async function initialize() {
  if (!isTauri()) throw new Error('Open this experiment through native:dev or native:build, not in a browser tab.');
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!raw || import.meta.env.VITE_FIREBASE_MODE !== 'cloud') throw new Error('Provide the dedicated test project’s cloud configuration in spikes/firebase/.env.local.');
  const configuration = JSON.parse(raw);
  if (!configuration.projectId || !configuration.apiKey || !configuration.appId) throw new Error('The test project configuration is incomplete.');
  $('configuration').textContent = 'Real Google / test project: ' + configuration.projectId;
  auth = initializeAuth(initializeApp(configuration), { persistence: inMemoryPersistence });
  const ready = await invoke('configuration_ready');
  $('status').textContent = ready ? 'Ready. Google opens in your system browser.' : 'Set GEOCLICK_GOOGLE_DESKTOP_CLIENT_FILE to the downloaded Desktop-app OAuth JSON, then restart.';
  if (!ready) auth = undefined;
  controls();
}
$('login').addEventListener('click', async () => {
  working = true; cancelRequested = false; controls();
  $('status').textContent = 'Complete sign-in in your system browser. This attempt expires after three minutes.';
  try {
    const { id_token } = await invoke('google_login');
    if (cancelRequested) throw 'Sign-in cancelled.';
    $('status').textContent = 'Google returned. Checking the credential with Firebase…';
    const result = await signInWithCredential(auth, GoogleAuthProvider.credential(id_token));
    if (cancelRequested) { await signOut(auth); throw 'Sign-in cancelled.'; }
    $('uid').textContent = result.user.uid;
    $('provider').textContent = result.user.providerData.map(p => p.providerId).join(', ');
    $('status').textContent = 'Firebase accepted the native Google credential. Compare this UID with the browser spike.';
  } catch (error) {
    // Firebase codes and the native command's fixed messages carry no token bodies.
    $('status').textContent = typeof error === 'string' ? error : 'Firebase sign-in failed (' + (error.code || 'unknown') + '). No native success is claimed.';
  } finally { working = false; controls(); }
});
$('cancel').addEventListener('click', async () => { cancelRequested = true; await invoke('cancel_login'); });
$('logout').addEventListener('click', async () => {
  await signOut(auth); $('uid').textContent = 'Signed out'; $('provider').textContent = '—';
  $('status').textContent = 'Signed out. No credential was saved to disk.'; controls();
});
initialize().catch(error => { $('status').textContent = error.message; controls(); });
