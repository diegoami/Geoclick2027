// Native IPC and Firebase HTTP are mocked; this test makes no real cloud calls.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
const here=path.dirname(fileURLToPath(import.meta.url));
const project='demo-geoclick-native-ui';
const server=spawn(process.execPath,[path.resolve(here,'../../../node_modules/vite/bin/vite.js'),'--config','vite.config.mjs','--host','127.0.0.1','--port','5197','--strictPort'],{
  cwd:here,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,VITE_FIREBASE_MODE:'cloud',VITE_FIREBASE_CONFIG:JSON.stringify({apiKey:'fake-key',projectId:project,appId:'1:123:web:test'})}
});
let output='';server.stdout.on('data',chunk=>{output+=chunk});server.stderr.on('data',chunk=>{output+=chunk});
let browser;
try {
  const base='http://127.0.0.1:5197';
  for(let n=0;;n++){try{if((await fetch(base)).ok)break}catch{}if(n===80||server.exitCode!==null)throw Error('Test server failed: '+output.slice(-1000));await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true});
  const unsupported=await browser.newPage();await unsupported.goto(base);await unsupported.getByRole('status').filter({hasText:'not in a browser tab'}).waitFor();assert.equal(await unsupported.locator('#login').isDisabled(),true);await unsupported.close();
  const context=await browser.newContext();
  let outcome='deny',savedUid=null,candidate=null,lastCommit=false,rejectPending;
  let counter=0,saveFails=false,deleteFails=false,readFails=false,wrongProject=false,restoreFailure=null;
  let holdConfirm=false,releaseConfirm,confirmStarted;
  const uid='native-proof-ui-test';
  const attempt=(expected,remember)=>{lastCommit=false;candidate={id:'attempt-'+(++counter),expected,remember};return{id_token:'synthetic-google-token',attempt_id:candidate.id,expected_uid:expected}};
  await context.exposeBinding('__nativeCommand',async(_source,command,args={})=>{
    if(command==='configuration_ready')return{project_id:wrongProject?'other-project':project,remember_available:!readFails,has_saved:readFails?false:!!savedUid,storage_warning:readFails?'Windows could not read the saved sign-in.':null};
    if(command==='google_login'){
      lastCommit=false;
      if(outcome==='deny')throw 'Google sign-in was declined or cancelled.';
      if(outcome==='pending')return new Promise((_resolve,reject)=>{rejectPending=reject});
      return attempt(null,args.remember);
    }
    if(command==='restore_login'){
      lastCommit=false;
      if(restoreFailure==='network')throw 'Could not contact Google. The saved sign-in was retained; retry when online.';
      if(restoreFailure==='revoked'){savedUid=null;throw 'Saved sign-in expired or was revoked. Sign in again.';}
      return savedUid?attempt(savedUid,true):null;
    }
    if(command==='confirm_login'){
      assert.equal(args.attemptId,candidate.id);
      if(candidate.expected&&candidate.expected!==args.uid){savedUid=null;throw 'The saved account changed. Sign in again.';}
      if(candidate.remember&&saveFails)throw 'Windows could not save this sign-in. Nothing was saved as plaintext.';
      savedUid=candidate.remember?args.uid:null;lastCommit=!!savedUid;
      const remembered=candidate.remember;candidate=null;
      if(holdConfirm){confirmStarted();await new Promise(resolve=>{releaseConfirm=resolve})}
      return remembered;
    }
    if(command==='cancel_login'){rejectPending?.('Sign-in cancelled.');rejectPending=undefined;candidate=null;if(lastCommit)savedUid=null;lastCommit=false;return;}
    if(command==='forget_session'){candidate=null;lastCommit=false;if(deleteFails)throw 'Windows could not remove the saved sign-in. Retry forgetting this device.';savedUid=null;return;}
    throw Error('Unexpected native command: '+command);
  });
  await context.addInitScript(()=>{window.isTauri=true;window.__TAURI_INTERNALS__={invoke:(command,args)=>window.__nativeCommand(command,args)}});
  let responseUid=uid,requests=0,delayExchange=false,releaseExchange,exchangeStarted;
  const failures=[];
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
    if(url.hostname!=='identitytoolkit.googleapis.com'){failures.push('Unexpected external host: '+url.hostname);return route.abort();}
    requests++;
    const user={localId:responseUid,email:'test@example.invalid',emailVerified:true,displayName:'Native proof test',providerUserInfo:[{providerId:'google.com',rawId:'synthetic-google-user',email:'test@example.invalid'}]};
    if(url.pathname.endsWith('accounts:signInWithIdp')){
      if(delayExchange){exchangeStarted();await new Promise(resolve=>{releaseExchange=resolve})}
      const now=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
      const token=encode({alg:'none'})+'.'+encode({sub:responseUid,aud:project,iss:'https://securetoken.google.com/'+project,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}})+'.test';
      return route.fulfill({json:{...user,idToken:token,refreshToken:'synthetic-firebase-refresh',expiresIn:'3600',providerId:'google.com',federatedId:'synthetic-google-user'}});
    }
    if(url.pathname.endsWith('accounts:lookup'))return route.fulfill({json:{users:[user]}});
    failures.push('Unexpected Firebase path: '+url.pathname);return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
  const status=text=>page.getByRole('status').filter({hasText:text}).waitFor();
  await page.goto(base);await status('Ready.');assert.equal(await page.locator('#remember').isChecked(),false);
  await page.locator('#login').click();await status('declined or cancelled');assert.equal(requests,0);
  outcome='pending';await page.locator('#login').click();await page.locator('#cancel').click();await status('Sign-in cancelled.');assert.equal(requests,0);
  outcome='success';await page.locator('#login').click();await status('only for this session');assert.equal(await page.locator('#uid').innerText(),uid);assert.equal(savedUid,null);
  await page.reload();await status('Ready.');assert.equal(await page.locator('#uid').innerText(),'Signed out');
  delayExchange=true;const exchange=new Promise(resolve=>{exchangeStarted=resolve});await page.locator('#login').click();await exchange;await page.locator('#cancel').click();releaseExchange();await status('Sign-in cancelled.');assert.equal(savedUid,null);delayExchange=false;
  await page.locator('#remember').check();await page.locator('#login').click();await status('saved in Windows Credential Manager');assert.equal(savedUid,uid);
  await page.reload();await status('Restored verified');assert.equal(await page.locator('#uid').innerText(),uid);assert.equal(await page.locator('#provider').innerText(),'google.com');assert.equal(await page.locator('#remember').isChecked(),true);
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.includes('firebase:authUser'))),false);
  assert.equal((await page.locator('body').innerText()).includes('synthetic-firebase-refresh'),false);
  restoreFailure='network';await page.reload();await status('retained; retry');assert.equal(savedUid,uid);assert.equal(await page.locator('#uid').innerText(),'Signed out');assert.equal(await page.locator('#retry').isEnabled(),true);
  restoreFailure=null;await page.locator('#retry').click();await status('Restored verified');
  responseUid='different-firebase-user';await page.reload();await status('saved account changed');assert.equal(savedUid,null);assert.equal(await page.locator('#uid').innerText(),'Signed out');responseUid=uid;
  saveFails=true;await page.locator('#remember').check();await page.locator('#login').click();await status('could not save');assert.equal(savedUid,null);assert.equal(await page.locator('#uid').innerText(),'Signed out');saveFails=false;
  holdConfirm=true;const committed=new Promise(resolve=>{confirmStarted=resolve});await page.locator('#login').click();await committed;await page.locator('#cancel').click();releaseConfirm();await status('Sign-in cancelled.');assert.equal(savedUid,null);holdConfirm=false;
  await page.locator('#login').click();await status('saved in Windows Credential Manager');deleteFails=true;await page.locator('#logout').click();await status('could not remove');assert.equal(savedUid,uid);assert.equal(await page.locator('#uid').innerText(),'Signed out');assert.equal(await page.locator('#logout').isEnabled(),true);
  deleteFails=false;await page.locator('#logout').click();await status('removed from Windows');assert.equal(savedUid,null);await page.reload();await status('Ready.');assert.equal(await page.locator('#uid').innerText(),'Signed out');
  await page.locator('#remember').check();await page.locator('#login').click();await status('saved in Windows Credential Manager');restoreFailure='revoked';await page.reload();await status('expired or was revoked');assert.equal(savedUid,null);assert.equal(await page.locator('#retry').isDisabled(),true);restoreFailure=null;
  wrongProject=true;const before=requests;await page.reload();await status('different projects');assert.equal(await page.locator('#login').isDisabled(),true);assert.equal(requests,before);wrongProject=false;
  readFails=true;await page.reload();await status('could not read');assert.equal(await page.locator('#remember').isDisabled(),true);assert.equal(await page.locator('#remember').isChecked(),false);await page.locator('#login').click();await status('only for this session');assert.equal(savedUid,null);
  assert.deepEqual(failures,[]);
  console.log('PASS: mocked opt-in persistence/restore, no WebView credential cache, cancellation races, UID/config isolation, offline/revoked/storage failures and sign-out; no live cloud calls');
} finally {await browser?.close();server.kill();}
