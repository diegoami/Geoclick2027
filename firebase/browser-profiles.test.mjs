import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { createServer } from 'vite';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18110');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:19110');
const root = fileURLToPath(new URL('..', import.meta.url));
const card = (targetId, cleanStreak) => ({
	targetId,
	cleanStreak,
	easeFactor: 2.5,
	interval: 1,
	repetitions: cleanStreak,
	dueDate: '2026-11-03',
	lastReviewedAt: '2026-11-02'
});
const score = (perfect = 2, errors = 0) => ({
	total: 2,
	perfect,
	totalErrors: errors,
	completedAt: '2026-11-02T12:00:00.000Z'
});
async function call(profile, method, ...args) {
	return profile.page.evaluate(
		async ({ method, args }) => {
			const api = window.profileProof;
			return await api[method](...args);
		},
		{ method, args }
	);
}
test(
	'separate persistent browser profiles against production account code and local emulators',
	{ timeout: 180000 },
	async (t) => {
		const server = await createServer({
			configFile: false,
			envDir: false,
			root,
			publicDir: false,
			logLevel: 'error',
			clearScreen: false,
			server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: null },
			optimizeDeps: {
				entries: ['firebase/fixtures/browser-profiles.html'],
				include: [
					'firebase/app',
					'firebase/auth',
					'firebase/firestore/lite',
					'@tauri-apps/api/core',
					'@capacitor/core'
				]
			}
		});
		await server.listen();
		const address = server.httpServer.address();
		assert.equal(typeof address, 'object');
		const origin = `http://127.0.0.1:${address.port}`,
			allowed = new Set([origin, 'http://127.0.0.1:19110', 'http://127.0.0.1:18110']);
		const forbidden = [];
		async function pair(runTest) {
			const temporary = await mkdtemp(path.join(os.tmpdir(), 'geoclick-profile-proof-')),
				run = randomUUID(),
				profiles = [];
			async function profile(name) {
				const directory = path.join(temporary, name);
				await mkdir(directory);
				const value = { context: undefined, page: undefined, backendOffline: false };
				value.restart = async () => {
					await value.context?.close();
					value.context = await chromium.launchPersistentContext(directory, { headless: true });
					await value.context.route('**/*', async (route) => {
						const url = new URL(route.request().url());
						if (!allowed.has(url.origin)) {
							forbidden.push(url.origin);
							await route.abort();
							return;
						}
						if (value.backendOffline && (url.port === '18110' || url.port === '19110')) {
							await route.abort('internetdisconnected');
							return;
						}
						await route.continue();
					});
					value.page = value.context.pages()[0] ?? (await value.context.newPage());
					await value.page.goto(`${origin}/firebase/fixtures/browser-profiles.html?run=${run}`);
					await value.page.waitForFunction(() => !!window.profileProof, undefined, {
						timeout: 30000
					});
				};
				profiles.push(value);
				await value.restart();
				return value;
			}
			try {
				const a = await profile('a'),
					b = await profile('b');
				await runTest(a, b);
			} finally {
				for (const profile of profiles) await profile.context?.close();
				// Only this suite's newly created temporary root is eligible for removal.
				const resolved = await realpath(temporary),
					parent = await realpath(os.tmpdir());
				assert.equal(path.dirname(resolved), parent);
				assert.match(path.basename(resolved), /^geoclick-profile-proof-/);
				await rm(resolved, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
			}
		}
		try {
			await t.test(
				'explicit import/account conflicts, real SRS fading, completed scores and records converge',
				async () =>
					pair(async (a, b) => {
						await call(a, 'seed', [card('one', 2)], score(), {
							bestTimeMs: 5000,
							confusions: [{ targetId: 'one', chosenId: 'two', count: 2 }],
							slipped: 0
						});
						await call(b, 'seed', [card('one', 3), card('two', 1)], score(), { bestTimeMs: 1000 });
						const guestA = await call(a, 'guest'),
							guestB = await call(b, 'guest');
						assert.notDeepEqual(guestA, guestB);
						await call(a, 'login', false);
						assert.deepEqual((await call(a, 'snapshot')).cards, []);
						assert.equal(
							(await call(a, 'preview')).preview.filter((row) => row.disposition === 'add').length,
							2
						);
						await call(a, 'dismiss');
						assert.equal((await call(a, 'snapshot')).events, 0);
						await call(a, 'preview');
						assert.equal((await call(a, 'confirm')).imported, 2);
						await call(b, 'login', false);
						const preview = await call(b, 'preview');
						assert.equal(
							preview.preview.filter((row) => row.disposition === 'account-wins').length,
							2
						);
						assert.equal(preview.preview.filter((row) => row.disposition === 'add').length, 1);
						assert.equal((await call(b, 'confirm')).imported, 1);
						await call(a, 'sync');
						let state = await call(a, 'snapshot');
						assert.equal(state.records.bestTimeMs, 5000);
						assert.equal(state.cards.find((c) => c.targetId === 'one').cleanStreak, 2);
						assert.equal(state.cards.find((c) => c.targetId === 'two').cleanStreak, 1);
						await call(a, 'answer', 'learn-one', 'one', 'good');
						await call(a, 'answer', 'learn-two-1', 'two', 'good');
						await call(a, 'answer', 'learn-two-2', 'two', 'good');
						await call(a, 'answer', 'timed', 'one', 'good');
						await call(a, 'answer', 'timed', 'two', 'good');
						await call(a, 'round', 'timed', score(), 0, 4000);
						await call(a, 'sync');
						await call(b, 'sync');
						assert.deepEqual(await call(a, 'snapshot'), await call(b, 'snapshot'));
						assert.equal((await call(b, 'snapshot')).records.bestTimeMs, 4000);
						await call(a, 'answer', 'mistake', 'one', 'hard', 'two');
						await call(a, 'round', 'mistake', score(1, 1), 1);
						await call(a, 'sync');
						await call(a, 'sync');
						await call(b, 'sync');
						state = await call(b, 'snapshot');
						assert.equal(state.cards.find((c) => c.targetId === 'one').cleanStreak, 2);
						assert.equal(state.summary.perfect, 1);
						assert.equal(state.records.confusions[0].count, 1);
						assert.deepEqual(await call(a, 'snapshot'), state);
						assert.deepEqual(await call(a, 'guest'), guestA);
						assert.deepEqual(await call(b, 'guest'), guestB);
					})
			);
			await t.test(
				'remembered browser-process restart with backend unavailable retains pending mistakes and reset-wins',
				async () =>
					pair(async (a, b) => {
						await call(a, 'login', true);
						await call(b, 'login', true);
						for (let i = 0; i < 3; i++) await call(a, 'answer', 'known-' + i, 'one', 'good');
						await call(a, 'sync');
						await call(b, 'sync');
						a.backendOffline = true;
						await call(a, 'answer', 'offline-mistake', 'one', 'hard', 'two');
						assert.equal((await call(a, 'snapshot')).pending, 1);
						await a.restart();
						assert.equal((await call(a, 'status')).usingAccount, true);
						let state = await call(a, 'snapshot');
						assert.equal(state.pending, 1);
						assert.equal(state.cards[0].cleanStreak, 2);
						await call(b, 'reset');
						await call(b, 'sync');
						a.backendOffline = false;
						await call(a, 'sync');
						await call(b, 'sync');
						assert.deepEqual((await call(a, 'snapshot')).cards, []);
						assert.deepEqual(await call(a, 'snapshot'), await call(b, 'snapshot'));
						await call(a, 'answer', 'after-reset', 'one', 'good');
						await call(a, 'sync');
						await call(b, 'sync');
						assert.equal((await call(b, 'snapshot')).cards[0].cleanStreak, 1);
						await call(a, 'signOut');
						await a.restart();
						assert.equal((await call(a, 'status')).usingAccount, false);
					})
			);
			await t.test(
				'session-only credentials expire on browser restart while journals/guest copies stay isolated across accounts',
				async () =>
					pair(async (a) => {
						await call(a, 'seed', [card('one', 1)]);
						const original = await call(a, 'guest');
						await call(a, 'login', false);
						a.backendOffline = true;
						await call(a, 'answer', 'pending-owner', 'two', 'good');
						await a.restart();
						assert.equal((await call(a, 'status')).usingAccount, false);
						assert.deepEqual(await call(a, 'guest'), original);
						a.backendOffline = false;
						await call(a, 'login', true, 'other');
						assert.deepEqual((await call(a, 'snapshot')).cards, []);
						assert.equal((await call(a, 'snapshot')).events, 0);
						await call(a, 'preview');
						await call(a, 'signOut');
						await call(a, 'login', true, 'owner');
						assert.equal((await call(a, 'status')).preview, undefined);
						let state = await call(a, 'snapshot');
						assert.equal(state.cards[0].targetId, 'two');
						assert.equal(state.cards[0].cleanStreak, 1);
						assert.equal(state.pending, 0);
						await a.restart();
						assert.equal((await call(a, 'status')).usingAccount, true);
						await call(a, 'sync');
						state = await call(a, 'snapshot');
						assert.equal(state.events, 1);
						assert.deepEqual(await call(a, 'guest'), original);
						await call(a, 'signOut');
						await a.restart();
						assert.equal((await call(a, 'status')).usingAccount, false);
					})
			);
			assert.deepEqual(forbidden, [], 'fixture attempted a non-loopback request');
		} finally {
			await server.close();
		}
	}
);
