#!/usr/bin/env node
// Regenerates the user manual's screenshots (proposal #204, plan #209): it
// starts the dev server, seeds example progress into the browser's
// localStorage, drives Chromium through the screens and writes docs/manual/*.jpg.
// Run it at each milestone so the pictures never go stale again.
//
//   node scripts/manual-shots.mjs                 # every shot
//   node scripts/manual-shots.mjs --only=quiz-start,quiz-done
//
// The progress in the pictures is made-up example data (seed() below).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.SHOTS_OUT ?? join(root, 'docs', 'manual');
const PORT = 5190;
const BASE = `http://localhost:${PORT}`;
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '')
	.slice(7)
	.split(',')
	.filter(Boolean);
const wanted = (name) => only.length === 0 || only.includes(name);

mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- example data
const today = new Date().toISOString().slice(0, 10);
function mapTargets(mapId) {
	const j = JSON.parse(readFileSync(join(root, 'data', 'maps', mapId, 'map.json'), 'utf8'));
	return j.targets.map((t) => t.id);
}
/** Cards for a map: the first targets get the streaks given, the rest none. */
function cards(mapId, streaks) {
	return mapTargets(mapId)
		.slice(0, streaks.length)
		.map((targetId, i) => ({
			targetId,
			easeFactor: 2.5,
			interval: 1,
			repetitions: streaks[i],
			cleanStreak: streaks[i],
			dueDate: today,
			lastReviewedAt: today
		}))
		.filter((c) => c.cleanStreak > 0);
}
function seedFor({ progress = true, tutorialSeen = true, extra = {} } = {}) {
	const store = {
		'geoclick:language:v1': 'en',
		'geoclick:favourite-maps:v1': JSON.stringify(['italy-regions', 'germany-states']),
		'geoclick:recent-maps:v1': JSON.stringify(['italy-regions', 'japan-regions', 'germany-states']),
		...extra
	};
	if (tutorialSeen) store['geoclick:tutorial-seen:v1'] = '1';
	if (progress) {
		// Italy: 14 of 20 known, a spread of lighter and fainter names.
		const italy = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0];
		store['geoclick:progress:v1:italy-regions:cards'] = JSON.stringify(
			cards('italy-regions', italy)
		);
		store['geoclick:progress:v1:italy-regions:lastSession'] = JSON.stringify({
			total: 20,
			perfect: 17,
			totalErrors: 3,
			completedAt: today
		});
	}
	return store;
}

// ---------------------------------------------------------------- the server
async function waitFor(url, ms = 120000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		try {
			if ((await fetch(url)).ok) return;
		} catch {
			/* not up yet */
		}
		await new Promise((r) => setTimeout(r, 1000));
	}
	throw new Error(`${url} did not come up`);
}
const server = spawn(
	process.platform === 'win32' ? 'npm.cmd' : 'npm',
	['run', 'dev', '--workspace=app', '--', '--port', String(PORT), '--strictPort'],
	{ cwd: root, stdio: 'ignore', shell: process.platform === 'win32' }
);
const stopServer = () => {
	if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
	else server.kill();
};
process.on('exit', stopServer);

// ---------------------------------------------------------------- the shots
const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let made = 0;

/** Opens a fresh page (own storage) with the example data, runs `fn`, saves `name`.jpg. */
async function shot(name, { phone = false, seed = {}, path = '/', wait = 3500 }, fn) {
	if (!wanted(name)) return;
	const ctx = await browser.newContext(
		phone
			? {
					viewport: { width: 390, height: 844 },
					deviceScaleFactor: 1.5,
					isMobile: true,
					hasTouch: true
				}
			: { viewport: { width: 1100, height: 720 }, deviceScaleFactor: 1 }
	);
	const store = seedFor(seed);
	await ctx.addInitScript((s) => {
		if (sessionStorage.getItem('gc-seeded')) return;
		sessionStorage.setItem('gc-seeded', '1');
		for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
	}, store);
	const page = await ctx.newPage();
	await page.goto(BASE + path);
	await sleep(wait);
	if (fn) await fn(page);
	const file = join(outDir, `${name}.jpg`);
	await page.screenshot({ path: file, type: 'jpeg', quality: 60 });
	await ctx.close();
	made++;
	console.log(`${name}.jpg  ${Math.round(statSync(file).size / 1024)} KB`);
}

try {
	await waitFor(BASE + '/');

	// The home page.
	await shot('home-map', {}, null);
	await shot('home-list', {}, async (p) => {
		await p
			.getByRole('button', { name: 'List' })
			.click()
			.catch(() => p.getByRole('link', { name: 'List' }).click());
		await sleep(1200);
	});
	await shot('home-search', {}, async (p) => {
		await p
			.getByRole('button', { name: 'List' })
			.click()
			.catch(() => p.getByRole('link', { name: 'List' }).click());
		await sleep(800);
		await p.getByPlaceholder('Search maps').fill('towns');
		await sleep(800);
	});
	await shot('home-first-visit', { seed: { tutorialSeen: false, progress: false } }, null);
	await shot('my-maps', { path: '/my-maps' }, null);
	await shot('about', { path: '/about' }, null);

	// A map screen: Known (the opening screen), Overview, Tour.
	await shot('known', { path: '/map/italy-regions' }, null);
	await shot('overview', { path: '/map/italy-regions/overview' }, null);
	await shot('tour', { path: '/map/italy-regions/tour', wait: 9000 }, null);
	await shot('towns-overview', { path: '/map/italy-towns-100k/overview' }, null);

	// The quiz, on Denmark's five regions: start, dragging, wrong, done.
	await shot('quiz-start', { path: '/map/denmark-regions/quiz', seed: { progress: false } }, null);
	await shot('quiz-hand', { path: '/map/italy-regions/quiz' }, null);

	// Known: tap a place to read its name and a fact.
	await shot('known-fact', { path: '/map/italy-regions' }, async (p) => {
		await p.mouse.click(600, 625);
		await sleep(1500);
	});
	await shot('overview-magnified', { path: '/map/italy-regions/overview' }, async (p) => {
		await p.mouse.move(495, 361);
		await sleep(800);
	});

	// The quiz on Denmark's five regions, drop by drop.
	const spots = {
		Nordjylland: [380, 300],
		Midtjylland: [370, 385],
		Syddanmark: [320, 540],
		Sjælland: [545, 540],
		Hovedstaden: [605, 445]
	};
	const slip = (p, name) => p.locator('.tray-slips button', { hasText: name }).first();
	async function grab(p, name) {
		const box = await slip(p, name).boundingBox();
		await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await p.mouse.down();
		return box;
	}
	async function dragTo(p, name, [x, y], release = true) {
		await grab(p, name);
		await p.mouse.move(x, y, { steps: 12 });
		await sleep(250);
		if (release) {
			await p.mouse.up();
			await sleep(300);
		}
	}
	const denmark = {
		path: '/map/denmark-regions/quiz',
		seed: { progress: false }
	};
	await shot('quiz-dragging', denmark, async (p) => {
		await dragTo(p, 'Midtjylland', spots.Midtjylland, false);
	});
	await shot('quiz-progress', denmark, async (p) => {
		await dragTo(p, 'Midtjylland', spots.Midtjylland);
		await dragTo(p, 'Nordjylland', spots.Nordjylland);
		await sleep(900);
	});
	await shot('quiz-wrong', denmark, async (p) => {
		await dragTo(p, 'Midtjylland', spots.Midtjylland);
		await dragTo(p, 'Syddanmark', spots.Nordjylland);
		await sleep(400);
	});
	await shot('quiz-done', denmark, async (p) => {
		for (const name of ['Nordjylland', 'Midtjylland', 'Syddanmark', 'Sjælland', 'Hovedstaden']) {
			await dragTo(p, name, spots[name]);
		}
		await sleep(1800);
	});

	// The map bar: the type row, the tick, the red X, the language menu, Terrain, the eye.
	await shot('type-bar', { path: '/map/germany-states' }, async (p) => {
		await p.getByLabel('Show detailed maps').check();
		await sleep(900);
	});
	await shot(
		'type-bar-x',
		{
			path: '/map/germany-states',
			seed: {
				extra: {
					'geoclick:seen-detailed:v1': JSON.stringify(['germany-towns-50k'])
				}
			}
		},
		null
	);
	await shot('language-menu', { path: '/map/italy-regions' }, async (p) => {
		await p.locator('.lang-button').first().click();
		await sleep(600);
	});
	await shot('terrain-off', { path: '/map/italy-regions' }, async (p) => {
		await p.getByRole('button', { name: 'Terrain' }).click();
		await sleep(1500);
	});
	await shot('buttons-hidden', { path: '/map/italy-regions' }, async (p) => {
		await p.getByRole('button', { name: 'Hide the buttons' }).click();
		await sleep(900);
	});
	await shot(
		'tutorial',
		{ path: '/', seed: { tutorialSeen: false, progress: false } },
		async (p) => {
			await p.getByRole('button', { name: /Start the tutorial/i }).click();
			await sleep(2500);
		}
	);

	// Phone.
	await shot('phone-home', { phone: true }, null);
	await shot('phone-known', { phone: true, path: '/map/italy-regions' }, null);
	await shot(
		'phone-quiz',
		{
			phone: true,
			path: '/map/denmark-regions/quiz',
			seed: { progress: false }
		},
		null
	);
} finally {
	await browser.close();
	stopServer();
}
console.log(`${made} shots in ${outDir}`);
