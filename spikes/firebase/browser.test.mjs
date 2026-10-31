import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:5194';
const cwd = fileURLToPath(new URL('.', import.meta.url));
const vite = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));
// Force emulator mode even when an owner has added a cloud .env.local.
// Refuse an occupied port before starting, so an unrelated server cannot
// satisfy the HTTP readiness probe while our Vite process is still starting.
const portCheck = createServer();
const listening = once(portCheck, 'listening');
portCheck.listen(5194, '127.0.0.1');
await listening;
await new Promise((resolve, reject) => portCheck.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5194', '--strictPort', '--logLevel', 'error'], {
  cwd, env: { ...process.env, VITE_FIREBASE_MODE: 'emulator' }, stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });
let browser;
try {
  const deadline = Date.now() + 30_000;
  let lastProbe = 'no HTTP response';
  for (;;) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`Private test server failed: ${serverOutput}`);
    }
    if (Date.now() >= deadline) {
      throw new Error(`Private test server timed out (${lastProbe}): ${serverOutput}`);
    }
    let ready = false;
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      lastProbe = `HTTP ${response.status}`;
      ready = response.ok && (await response.text()).includes('<title>Geoclick Firebase spike</title>');
      if (response.ok && !ready) lastProbe += ', unexpected page';
    } catch (error) {
      lastProbe = error.message;
    }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch();
  const errors = [];
  const account = `browser-${Date.now()}@example.test`;
  async function page() {
    const context = await browser.newContext();
    const p = await context.newPage();
    p.on('pageerror', error => errors.push(error.message));
    await p.goto(base);
    await p.getByText('LOCAL EMULATORS', { exact: false }).waitFor();
    return p;
  }
  async function login(p) {
    const opened = p.waitForEvent('popup');
    await p.getByRole('button', { name: 'Sign in with Google', exact: true }).click();
    const popup = await opened;
    await popup.waitForLoadState('load');
    await popup.getByText('Add new account', { exact: true }).waitFor();
    const existing = popup.getByText(account, { exact: true });
    if (await existing.isVisible()) {
      await existing.click();
    } else {
      await popup.getByText('Add new account', { exact: true }).click();
      await popup.locator('#email-input').fill(account);
      await popup.locator('#display-name-input').fill('Synthetic spike player');
      await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
    }
    await p.locator('#identity').filter({ hasText: account }).waitFor();
    return (await p.locator('#identity').innerText()).split('UID ')[1];
  }
  const a = await page();
  const uid = await login(a);
  await a.getByRole('button', { name: 'Save sample level 2', exact: true }).click();
  await a.locator('#result').filter({ hasText: 'Saved synthetic level 2' }).waitFor();
  const b = await page();
  assert.equal(await login(b), uid);
  await b.getByRole('button', { name: 'Read sample progress', exact: true }).click();
  await b.locator('#result').filter({ hasText: '"level": 2' }).waitFor();
  await b.reload();
  await b.locator('#identity').filter({ hasText: uid }).waitFor();
  await b.getByRole('button', { name: 'Read sample progress', exact: true }).click();
  await b.locator('#result').filter({ hasText: '"level": 2' }).waitFor();
  await b.screenshot({ path: fileURLToPath(new URL('../../rendered/firebase-browser-spike.png', import.meta.url)) });
  await b.getByRole('button', { name: 'Sign out', exact: true }).click();
  await b.locator('#identity').filter({ hasText: /^Signed out$/ }).waitFor();
  assert.equal(await b.getByRole('button', { name: 'Read sample progress', exact: true }).isDisabled(), true);
  assert.match(await b.locator('#result').innerText(), /display cleared/);
  await b.reload();
  await b.locator('#identity').filter({ hasText: /^Signed out$/ }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS browser: simulated Google popup, two profiles, shared sample, reload persistence and sign-out');
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill();
    await stopped;
  }
}
