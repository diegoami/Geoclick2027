import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, initializeAuth, inMemoryPersistence, signInWithCredential, signOut } from 'firebase/auth';
import { invoke, isTauri } from '@tauri-apps/api/core';
import './style.css';
const $ = id => document.getElementById(id);
let auth;
let working = false;
let cancelRequested = false;
let cancelFailure;
let hasSaved = false;
let rememberAvailable = false;
let configuration;
function controls() {
  $('login').disabled = !auth || !!auth.currentUser || working;
  $('remember').disabled = !rememberAvailable || !!auth?.currentUser || working;
  $('retry').disabled = !auth || !hasSaved || !!auth.currentUser || working;
  $('cancel').disabled = !working;
  $('logout').disabled = !auth || (!auth.currentUser && !hasSaved) || working;
}
function clearIdentity() { $('uid').textContent = 'Signed out'; $('provider').textContent = '-'; }
function errorText(error) {
  return typeof error === 'string' ? error : 'Firebase sign-in failed (' + (error.code || 'unknown') + ').';
}
async function storageStatus() {
  const status = await invoke('configuration_ready');
  if (status.project_id !== configuration.projectId) throw 'The Desktop and Firebase configurations point at different projects.';
  hasSaved = status.has_saved;
  rememberAvailable = status.remember_available;
  if (!rememberAvailable) $('remember').checked = false;
  return status;
}
async function finishCredential(credential) {
  if (cancelRequested) throw 'Sign-in cancelled.';
  const result = await signInWithCredential(auth, GoogleAuthProvider.credential(credential.id_token));
  if (credential.expected_uid && result.user.uid !== credential.expected_uid) {
    await invoke('forget_session'); await signOut(auth);
    throw 'The saved account changed. Sign in again.';
  }
  if (cancelRequested) { await signOut(auth); throw 'Sign-in cancelled.'; }
  const remembered = await invoke('confirm_login', { attemptId: credential.attempt_id, uid: result.user.uid });
  if (cancelRequested) { await invoke('forget_session'); await signOut(auth); throw 'Sign-in cancelled.'; }
  hasSaved = remembered;
  $('remember').checked = remembered;
  $('uid').textContent = result.user.uid;
  $('provider').textContent = result.user.providerData.map(p => p.providerId).join(', ');
  return remembered;
}
async function authenticate(restore) {
  working = true; cancelRequested = false; cancelFailure = undefined; controls();
  $('status').textContent = restore ? 'Restoring saved sign-in...' : 'Complete sign-in in your system browser within three minutes.';
  try {
    const credential = await invoke(restore ? 'restore_login' : 'google_login', restore ? {} : { remember: $('remember').checked });
    if (!credential) { hasSaved = false; $('status').textContent = 'No saved sign-in. Google opens in your system browser.'; return; }
    const remembered = await finishCredential(credential);
    $('status').textContent = restore ? 'Restored verified sign-in from Windows Credential Manager.' : remembered
      ? 'Firebase accepted the credential. Sign-in saved in Windows Credential Manager.'
      : 'Firebase accepted the credential. This sign-in lasts only for this session.';
  } catch (error) {
    // Cancel native pending credentials too, including a finalization that just committed.
    try { await invoke('cancel_login'); } catch (cleanup) { cancelFailure = cleanup; }
    if (auth?.currentUser) await signOut(auth);
    clearIdentity();
    try { await storageStatus(); } catch { /* Retain previous state; never claim saved data was removed. */ }
    $('status').textContent = cancelFailure ? errorText(cancelFailure) : errorText(error);
  } finally { working = false; controls(); }
}
async function initialize() {
  if (!isTauri()) throw 'Open this experiment through native:dev or native:build, not in a browser tab.';
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!raw || import.meta.env.VITE_FIREBASE_MODE !== 'cloud') throw 'Provide the dedicated test project cloud configuration in spikes/firebase/.env.local.';
  try { configuration = JSON.parse(raw); } catch { throw 'The test project configuration is unreadable.'; }
  if (!configuration.projectId || !configuration.apiKey || !configuration.appId) throw 'The test project configuration is incomplete.';
  $('configuration').textContent = 'Real Google / test project: ' + configuration.projectId;
  const status = await storageStatus();
  auth = initializeAuth(initializeApp(configuration), { persistence: inMemoryPersistence });
  if (hasSaved) await authenticate(true);
  else $('status').textContent = status.storage_warning || 'Ready. Google opens in your system browser.';
  controls();
}
$('login').addEventListener('click', () => authenticate(false));
$('retry').addEventListener('click', () => authenticate(true));
$('cancel').addEventListener('click', async () => {
  cancelRequested = true;
  try { await invoke('cancel_login'); } catch (error) { cancelFailure = error; }
});
$('logout').addEventListener('click', async () => {
  working = true; controls();
  let failure;
  try { await invoke('forget_session'); } catch (error) { failure = error; }
  try { await signOut(auth); clearIdentity(); $('remember').checked = false; } catch (error) { failure ||= error; }
  try { await storageStatus(); } catch (error) { failure ||= error; }
  $('status').textContent = failure ? errorText(failure) : 'Signed out. The saved sign-in was removed from Windows.';
  working = false; controls();
});
initialize().catch(error => { $('status').textContent = errorText(error); controls(); });
