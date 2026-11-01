import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, indexedDBLocalPersistence, setPersistence, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { isAndroid, googleCredential, nativeSignOut } from '@proof/native';
import './style.css';
const $=id=>document.getElementById(id);
let auth, working=false, expectedUid, generation=0, preferenceKey, cleanupNeeded=false;
const status=text=>{$('status').textContent=text};
const clear=()=>{$('uid').textContent='Signed out';$('provider').textContent='-'};
function controls(){ $('signin').disabled=!auth||!!auth.currentUser||working; $('remember').disabled=!auth||!!auth.currentUser||working; $('signout').disabled=!auth||(!auth.currentUser&&!cleanupNeeded&&!expectedUid)||working; $('guest').disabled=working; }
function failure(error){const code=typeof error?.code==='string'&&/^[a-zA-Z0-9_/-]{1,80}$/.test(error.code)?error.code:'unknown';return 'Sign-in failed ('+code+'). Guest mode remains available.'}
function showUser(user){$('uid').textContent=user.uid;$('provider').textContent=user.providerData.map(p=>p.providerId).join(', ')}
async function forget(){
  generation++;
  cleanupNeeded=true;
  // Clear the current session before selecting persistent storage: never copy
  // a memory-only user's credentials onto disk as part of signing out.
  if(auth)await signOut(auth);
  expectedUid=undefined;clear();$('remember').checked=false;
  if(preferenceKey)localStorage.removeItem(preferenceKey);
  if(auth){ await setPersistence(auth,indexedDBLocalPersistence); await signOut(auth); await setPersistence(auth,inMemoryPersistence); }
  cleanupNeeded=false;
}
async function initialize(){
  if(!isAndroid()){status('Open the signed Android proof APK. Guest mode remains available.');controls();return;}
  let config;try{config=JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG||'{}')}catch{throw {code:'config/invalid'}}
  if(import.meta.env.VITE_FIREBASE_MODE!=='cloud'||!config.projectId||!config.apiKey||!config.appId||config.projectId!==import.meta.env.VITE_ANDROID_FIREBASE_PROJECT)throw {code:'config/project-mismatch'};
  $('project').textContent='Real Google / project: '+config.projectId;
  preferenceKey='geoclick:android-proof:remember:'+config.projectId;
  let saved;try{saved=JSON.parse(localStorage.getItem(preferenceKey)||'null')}catch{saved=null}
  expectedUid=typeof saved?.uid==='string'?saved.uid:undefined;
  auth=initializeAuth(initializeApp(config,'geoclick-android-proof'),{persistence:expectedUid?indexedDBLocalPersistence:inMemoryPersistence});
  await auth.authStateReady();
  if(auth.currentUser){
    await auth.currentUser.getIdToken(true);
    if(auth.currentUser.uid!==expectedUid){await forget();throw {code:'auth/account-mismatch'}}
    showUser(auth.currentUser);$('remember').checked=true;status('Restored and verified the saved account.');
  }else{if(expectedUid){localStorage.removeItem(preferenceKey);expectedUid=undefined}status('Guest mode. Google sign-in is optional.');}
  controls();
}
$('signin').addEventListener('click',async()=>{
  const epoch=++generation;working=true;controls();status('Choose a Google account in the native Android prompt.');
  try{
    const remember=$('remember').checked;
    await signOut(auth);
    await setPersistence(auth,remember?indexedDBLocalPersistence:inMemoryPersistence);
    await signOut(auth);
    const token=await googleCredential();
    const result=await signInWithCredential(auth,GoogleAuthProvider.credential(token));
    if(epoch!==generation){await forget();return;}
    if(remember){localStorage.setItem(preferenceKey,JSON.stringify({uid:result.user.uid}));expectedUid=result.user.uid;}else{localStorage.removeItem(preferenceKey);expectedUid=undefined;}
    showUser(result.user);status(remember?'Native Google credential verified by Firebase; account remembered in the Android app.':'Native Google credential verified by Firebase; session only.');
  }catch(error){try{await forget()}catch{}status(failure(error));}
  finally{working=false;controls();}
});
$('signout').addEventListener('click',async()=>{
  working=true;controls();
  try{await forget();await nativeSignOut();status('Signed out. Remembered app session removed.');}
  catch(error){cleanupNeeded=true;status('Could not finish forgetting the account ('+(error.code||'storage')+'). Retry sign-out.');}
  finally{working=false;controls();}
});
$('guest').addEventListener('click',async()=>{
  working=true;controls();
  try{await forget();status('Guest mode. Google sign-in is optional.');}catch{status('Guest mode is available, but saved sign-in cleanup failed. Retry forgetting.');}
  finally{working=false;controls();}
});
initialize().catch(error=>{status(failure(error));controls();});
