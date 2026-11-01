// UI contract tests with mocked native IPC and mocked Firebase HTTP responses.
// No Google page is opened and no live cloud endpoint is contacted.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = 'demo-geoclick-native-ui';
const server = spawn(process.execPath, [path.resolve(here, '../../../node_modules/vite/bin/vite.js'), '--config', 'vite.config.mjs', '--host', '127.0.0.1', '--port', '5197', '--strictPort'], {
  cwd: here, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, VITE_FIREBASE_MODE: 'cloud', VITE_FIREBASE_CONFIG: JSON.stringify({ apiKey: 'fake-key', projectId: project, appId: '1:123:web:test' }) }
});
let output = ''; server.stdout.on('data', chunk => { output += chunk; }); server.stderr.on('data', chunk => { output += chunk; });
let browser;
try {
  const base = 'http://127.0.0.1:5197';
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (attempt === 80 || server.exitCode !== null) throw Error('Proof test server failed: ' + output.slice(-1200));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true });
  const unsupported = await browser.newPage();
  await unsupported.goto(base);
  await unsupported.getByRole('status').filter({ hasText: 'not in a browser tab' }).waitFor();
  assert.equal(await unsupported.locator('#login').isDisabled(), true);
  await unsupported.close();

  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.isTauri = true;
    window.__nativeOutcome = 'deny';
    let rejectAttempt;
    window.__TAURI_INTERNALS__ = { invoke: async command => {
      if (command === 'configuration_ready') return true;
      if (command === 'cancel_login') { rejectAttempt?.('Sign-in cancelled.'); return; }
      if (command === 'google_login') {
        if (window.__nativeOutcome === 'deny') throw 'Google sign-in was declined or cancelled.';
        if (window.__nativeOutcome === 'pending') return new Promise((resolve, reject) => { rejectAttempt = reject; });
        return { id_token: 'synthetic-google-token' };
      }
      throw Error('Unexpected native command: ' + command);
    }};
  });
  const uid = 'native-proof-ui-test';
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = encode({ alg: 'none' }) + '.' + encode({ sub: uid, aud: project, iss: 'https://securetoken.google.com/' + project, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'google.com' } }) + '.test';
  let authRequests = 0;
  let delayExchange = false;
  let releaseExchange;
  let exchangeStarted;
  const failures = [];
  const page = await context.newPage();
  page.on('pageerror', error => failures.push(error.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'identitytoolkit.googleapis.com') {
      failures.push('Unexpected external request: ' + url.hostname); return route.abort();
    }
    authRequests++;
    const user = { localId: uid, email: 'test@example.invalid', emailVerified: true, displayName: 'Native proof test', providerUserInfo: [{ providerId: 'google.com', rawId: 'synthetic-google-user', email: 'test@example.invalid', displayName: 'Native proof test' }] };
    if (url.pathname.endsWith('accounts:signInWithIdp')) {
      if (delayExchange) { exchangeStarted(); await new Promise(resolve => { releaseExchange = resolve; }); }
      return route.fulfill({ contentType: 'application/json', json: { ...user, idToken: token, refreshToken: 'synthetic-refresh-token', expiresIn: '3600', providerId: 'google.com', federatedId: 'synthetic-google-user' } });
    }
    if (url.pathname.endsWith('accounts:lookup')) return route.fulfill({ contentType: 'application/json', json: { users: [user] } });
    failures.push('Unexpected Firebase request: ' + url.pathname); return route.abort();
  });
  await page.goto(base);
  await page.getByRole('status').filter({ hasText: 'Ready.' }).waitFor();
  await page.locator('#login').click();
  await page.getByRole('status').filter({ hasText: 'declined or cancelled' }).waitFor();
  assert.equal(authRequests, 0);

  await page.evaluate(() => { window.__nativeOutcome = 'pending'; });
  await page.locator('#login').click();
  await page.locator('#cancel').click();
  await page.getByRole('status').filter({ hasText: 'Sign-in cancelled.' }).waitFor();
  assert.equal(authRequests, 0);
  assert.equal(await page.locator('#uid').innerText(), 'Signed out');

  await page.evaluate(() => { window.__nativeOutcome = 'success'; });
  await page.locator('#login').click();
  await page.getByRole('status').filter({ hasText: 'Firebase accepted' }).waitFor();
  assert.equal(await page.locator('#uid').innerText(), uid);
  assert.equal(await page.locator('#provider').innerText(), 'google.com');
  assert.equal(await page.locator('#login').isDisabled(), true);
  await page.locator('#logout').click();
  assert.equal(await page.locator('#uid').innerText(), 'Signed out');

  delayExchange = true;
  const started = new Promise(resolve => { exchangeStarted = resolve; });
  await page.locator('#login').click(); await started;
  await page.locator('#cancel').click(); releaseExchange();
  await page.getByRole('status').filter({ hasText: 'Sign-in cancelled.' }).waitFor();
  assert.equal(await page.locator('#uid').innerText(), 'Signed out');
  assert.equal(await page.locator('#logout').isDisabled(), true);
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Ready.' }).waitFor();
  assert.equal(await page.locator('#uid').innerText(), 'Signed out');
  assert.deepEqual(failures, []);
  console.log('PASS: mocked native UI denial, cancellation before/during Firebase exchange, UID/provider, sign-out and memory-only reload; no real Google/cloud call');
} finally {
  await browser?.close();
  server.kill();
}
