// Generates every platform icon from design/logo/geoclick-logo.svg (FT-05).
//   node design/logo/generate-icons.mjs
// Renders with Playwright's Chromium (already installed for the test suite),
// so there's no image library to add. Then:
//   - desktop: writes a rounded 1024px PNG and runs `tauri icon` on it
//     (desktop/src-tauri/icons: .ico, .icns, Windows Store tiles...);
//   - Android: adaptive-icon foreground + background layers, legacy square and
//     round launcher icons at every density, and splash screens at the sizes
//     already in the project;
//   - web: app/src/lib/assets/favicon.svg becomes the rounded logo.
// Idempotent - rerun after editing the master SVG.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOGO = path.join(ROOT, 'design/logo/geoclick-logo.svg');
const RES = path.join(ROOT, 'mobile/android/app/src/main/res');
const TAURI_ICONS = path.join(ROOT, 'desktop/src-tauri/icons');
const FAVICON = path.join(ROOT, 'app/src/lib/assets/favicon.svg');

const master = readFileSync(LOGO, 'utf8');
const inner = master
	.replace(/^[\s\S]*?<svg[^>]*>/, '')
	.replace(/<\/svg>\s*$/, '')
	.replace(/<title>[\s\S]*?<\/title>/, '');
// The first element is the full-bleed ground; the rest is the motif.
const groundMatch = /<rect width="512" height="512" fill="(#[0-9a-fA-F]{6})"\/>/.exec(inner);
if (!groundMatch) throw new Error('master SVG must start with its 512x512 ground <rect>');
const GROUND = groundMatch[1];
const motif = inner.replace(groundMatch[0], '');
// The faint map shapes, and the pin (with its shadow) without them.
const shapes = /<path d="M0 300[^>]*\/>/.exec(motif)?.[0] ?? '';
const pinOnly = motif.replace(shapes, '');

const svg = (body, viewBox = '0 0 512 512') =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

/** Rounded tile: the look used on desktop, the web and legacy Android. */
const rounded = svg(
	`<defs><clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath></defs>` +
		`<g clip-path="url(#r)">${inner}</g>`
);
/** Circle crop, for Android's legacy round launcher icon. */
const round = svg(
	`<defs><clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath></defs>` +
		`<g clip-path="url(#c)">${inner}</g>`
);
/** Adaptive icon, two layers on a 108dp canvas. Launchers show the middle
 * 72dp but animate (parallax, pulse) into the outer 18dp, so:
 * - foreground: just the pin, scaled by 72/108 into the centre, where the
 *   full-size design has it and well inside the 66dp safe circle;
 * - background: the ground plus the faint map shapes at full canvas size, so
 *   the texture runs to every edge and no animation reveals where it stops. */
const foreground = svg(
	`<g transform="translate(${512 * (18 / 108)} ${512 * (18 / 108)}) scale(${72 / 108})">${pinOnly}</g>`
);
const background = svg(`<rect width="512" height="512" fill="${GROUND}"/>${shapes}`);

const browser = await chromium.launch();
const page = await browser.newPage();

async function renderPng(svgText, width, height, outFile, background = 'transparent') {
	await page.setViewportSize({ width, height });
	await page.setContent(
		`<html><body style="margin:0;background:${background}">` +
			svgText.replace('<svg ', `<svg width="${width}" height="${height}" `) +
			`</body></html>`
	);
	await page.locator('svg').screenshot({ path: outFile, omitBackground: background === 'transparent' });
}

/** Width x height from a PNG's IHDR chunk. */
const pngSize = (file) => {
	const b = readFileSync(file);
	return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

// --- desktop: rounded 1024px source, then `tauri icon` does every format ---
const tmpDir = path.join(ROOT, 'desktop/src-tauri/target/icon-source');
mkdirSync(tmpDir, { recursive: true });
const desktopSource = path.join(tmpDir, 'geoclick-rounded-1024.png');
await renderPng(rounded, 1024, 1024, desktopSource);

// --- Android launcher icons ---
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(DENSITIES)) {
	const dir = path.join(RES, `mipmap-${density}`);
	await renderPng(rounded, 48 * scale, 48 * scale, path.join(dir, 'ic_launcher.png'));
	await renderPng(round, 48 * scale, 48 * scale, path.join(dir, 'ic_launcher_round.png'));
	await renderPng(foreground, 108 * scale, 108 * scale, path.join(dir, 'ic_launcher_foreground.png'));
	await renderPng(background, 108 * scale, 108 * scale, path.join(dir, 'ic_launcher_background.png'));
}
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
for (const name of ['ic_launcher', 'ic_launcher_round'])
	writeFileSync(path.join(RES, 'mipmap-anydpi-v26', `${name}.xml`), adaptive);
writeFileSync(
	path.join(RES, 'values/ic_launcher_background.xml'),
	`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${GROUND.toUpperCase()}</color>\n</resources>\n`
);

// --- Android splash screens: the pin centred on the ground colour, at the
// sizes the project already ships (drawable, drawable-land-*, drawable-port-*) ---
const splashFiles = readdirSync(RES)
	.filter((d) => d === 'drawable' || d.startsWith('drawable-land') || d.startsWith('drawable-port'))
	.map((d) => path.join(RES, d, 'splash.png'))
	.filter((f) => existsSync(f));
for (const file of splashFiles) {
	const [w, h] = pngSize(file);
	const s = Math.round(Math.min(w, h) * 0.42); // the pin's 512 box, at 42% of the short side
	const splash =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
		`<rect width="${w}" height="${h}" fill="${GROUND}"/>` +
		`<g transform="translate(${(w - s) / 2} ${(h - s) / 2}) scale(${s / 512})">${pinOnly}</g></svg>`;
	await renderPng(splash, w, h, file, GROUND);
}

await browser.close();

// --- web favicon: the rounded logo as SVG ---
writeFileSync(FAVICON, rounded.replace('<svg ', '<svg width="512" height="512" ') + '\n');

// --- desktop icon set ---
execFileSync('npx', ['tauri', 'icon', desktopSource, '--output', TAURI_ICONS], {
	cwd: path.join(ROOT, 'desktop'),
	stdio: 'inherit',
	shell: process.platform === 'win32'
});
// `tauri icon` also writes Tauri-mobile sets we don't use (Android/iOS are Capacitor here).
for (const extra of ['android', 'ios']) rmSync(path.join(TAURI_ICONS, extra), { recursive: true, force: true });
rmSync(tmpDir, { recursive: true, force: true });

console.log(`Icons generated from ${path.relative(ROOT, LOGO)}:`);
console.log(`  desktop  ${path.relative(ROOT, TAURI_ICONS)}`);
console.log(`  android  ${Object.keys(DENSITIES).length} densities x 4 launcher PNGs, ${splashFiles.length} splash screens, background ${GROUND}`);
console.log(`  web      ${path.relative(ROOT, FAVICON)}`);
