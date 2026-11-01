// Mocked Capacitor bridge and Firebase HTTP. No native Google/cloud success claim.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const here=path.dirname(fileURLToPath(import.meta.url)),project='demo-geoclick-android-ui',base='http://127.0.0.1:5199';
const server=spawn(process.execPath,[path.resolve(here,'../../../node_modules/vite/bin/vite.js'),'--config','vite.config.mjs','--mode','test','--host','127.0.0.1','--port','5199','--strictPort'],{cwd:here,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,GEOCLICK_ANDROID_UI_TEST:'1',VITE_FIREBASE_MODE:'cloud',VITE_ANDROID_FIREBASE_PROJECT:project,VITE_FIREBASE_CONFIG:JSON.stringify({apiKey:'fake-key',projectId:project,appId:'1:123:web:test'})}});
let output='';server.stdout.on('data',c=>{output+=c});server.stderr.on('data',c=>{output+=c});let browser;
try{
 for(let n=0;;n++){try{if((await fetch(base)).ok)break}catch{}if(n===80||server.exitCode!==null)throw Error(output.slice(-1200));await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext();let nativeCalls=0,outcome='success',uid='android-proof-ui-user',refreshCalls=0,denyRefresh=false;
 await context.exposeBinding('__nativeCommand',async(_source,command)=>{if(command==='signout')return;if(command==='google'){nativeCalls++;if(outcome==='cancel')throw {code:'native/cancelled'};return 'synthetic-google-token'}throw Error('Unexpected native command')});
 await context.addInitScript(()=>{
  window.__androidPlatform=true;window.__credentialDiskWrites=0;
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){if(JSON.stringify(args).includes('synthetic-android-refresh'))window.__credentialDiskWrites++;return put.apply(this,args)};
 });
 const now=Math.floor(Date.now()/1000),encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const idToken=()=>encode({alg:'none'})+'.'+encode({sub:uid,aud:project,iss:'https://securetoken.google.com/'+project,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}})+'.test';
 const failures=[];
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname==='securetoken.googleapis.com'){
   refreshCalls++;if(denyRefresh)return route.fulfill({status:400,json:{error:{code:400,message:'INVALID_REFRESH_TOKEN'}}});
   return route.fulfill({json:{access_token:idToken(),id_token:idToken(),refresh_token:'synthetic-android-refresh',expires_in:'3600',token_type:'Bearer',user_id:uid,project_id:'123'}});
  }
  if(url.hostname!=='identitytoolkit.googleapis.com'){failures.push('External request: '+url.hostname);return route.abort();}
  const user={localId:uid,email:'test@example.invalid',emailVerified:true,providerUserInfo:[{providerId:'google.com',rawId:'synthetic-google',email:'test@example.invalid'}]};
  if(url.pathname.endsWith('accounts:signInWithIdp'))return route.fulfill({json:{...user,idToken:idToken(),refreshToken:'synthetic-android-refresh',expiresIn:'3600',providerId:'google.com',federatedId:'synthetic-google'}});
  if(url.pathname.endsWith('accounts:lookup'))return route.fulfill({json:{users:[user]}});
  failures.push('Unexpected auth route: '+url.pathname);return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));const status=text=>page.getByRole('status').filter({hasText:text}).waitFor();
 await page.goto(base);await status('Guest mode.');assert.equal(nativeCalls,0);assert.equal(await page.locator('#remember').isChecked(),false);
 await page.locator('#guest').click();await status('Guest mode.');assert.equal(nativeCalls,0);
 outcome='cancel';await page.locator('#signin').click();await status('native/cancelled');assert.equal(await page.locator('#guest').isEnabled(),true);outcome='success';
 await page.locator('#signin').click();await status('session only');assert.equal(await page.locator('#uid').innerText(),uid);
 await page.locator('#guest').click();await status('Guest mode.');assert.equal(await page.evaluate(()=>window.__credentialDiskWrites),0,'Forgetting a memory-only user must not persist that credential');
 await page.reload();await status('Guest mode.');assert.equal(await page.locator('#uid').innerText(),'Signed out');
 await page.locator('#remember').check();await page.locator('#signin').click();await status('account remembered');
 const before=refreshCalls;await page.reload();await status('Restored and verified');assert.equal(refreshCalls>before,true);assert.equal(await page.locator('#uid').innerText(),uid);assert.equal(await page.locator('#provider').innerText(),'google.com');
 const key='geoclick:android-proof:remember:'+project;
 await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({uid:'other-account'})),key);
 await page.reload();await status('auth/account-mismatch');assert.equal(await page.locator('#uid').innerText(),'Signed out');assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
 await page.locator('#remember').check();await page.locator('#signin').click();await status('account remembered');await page.locator('#signout').click();await status('Remembered app session removed');
 await page.reload();await status('Guest mode.');assert.equal(await page.locator('#uid').innerText(),'Signed out');
 await page.locator('#remember').check();await page.locator('#signin').click();await status('account remembered');denyRefresh=true;await page.reload();await status('Sign-in failed');assert.equal(await page.locator('#uid').innerText(),'Signed out');assert.equal(await page.locator('#guest').isEnabled(),true);await page.locator('#guest').click();await status('Guest mode.');denyRefresh=false;
 // A separate web-only context proves that the guest action remains reachable without a native bridge.
 const unsupported=await browser.newContext();await unsupported.addInitScript(()=>{window.__androidPlatform=false});const web=await unsupported.newPage();await web.goto(base);await web.getByRole('status').filter({hasText:'signed Android proof APK'}).waitFor();await web.locator('#guest').click();await web.getByRole('status').filter({hasText:'Guest mode.'}).waitFor();await unsupported.close();
 assert.deepEqual(failures,[]);console.log('PASS: mocked Android guest/optional sign-in, cancellation, session-only default, remembered restore/refresh, UID mismatch and sign-out; no live cloud calls');
}finally{await browser?.close();server.kill()}
