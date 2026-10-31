import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:5194';
const cwd = fileURLToPath(new URL('.', import.meta.url));
const vite = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));
// Force emulator mode even when an owner has added a cloud .env.local.
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5194', '--strictPort'], {
  cwd, env: { ...process.env, VITE_FIREBASE_MODE: 'emulator' }, stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });
let browser;
try {
  for (let i = 0; ; i++) {
    if (server.exitCode !== null) throw new Error(`Private test server failed: ${serverOutput}`);
    if (i > 150) throw new Error(`Private test server timed out: ${serverOutput}`);
    if (serverOutput.includes('Local:')) break;
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
