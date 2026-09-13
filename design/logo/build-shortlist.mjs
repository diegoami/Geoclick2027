// Builds icon-shortlist.html from the candidate SVGs in this folder, so the
// review page always shows exactly the files that would ship (FT-04).
//   node design/logo/build-shortlist.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(path.join(dir, f), 'utf8');

// <svg ... viewBox="…">…</svg>  ->  <symbol id="…" viewBox="…">…</symbol>
const toSymbol = (svg, id) => {
	const viewBox = /viewBox="([^"]+)"/.exec(svg)[1];
	const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
	return `<symbol id="${id}" viewBox="${viewBox}">${inner.replace(/<title>[\s\S]*?<\/title>/, '')}</symbol>`;
};

const candidates = [
	{
		id: 'a',
		file: 'candidate-a-pin.svg',
		name: 'Pin',
		idea: 'A cream map pin on the app’s deep green, with an amber centre. The most literal “geo” mark, and the easiest to read at 16 px.'
	},
	{
		id: 'b',
		file: 'candidate-b-patchwork.svg',
		name: 'Patchwork',
		idea: 'Four regions in the map’s own palette, and the green one is solved. It says what you do in the game: learn a map region by region.'
	},
	{
		id: 'c',
		file: 'candidate-c-click.svg',
		name: 'Click',
		idea: 'A pointer clicking a country, on the amber of the app’s active buttons. The “click” in Geoclick; the warmest of the three.'
	}
];

const symbols = [
	...candidates.map((c) => toSymbol(read(c.file), `icon-${c.id}`)),
	toSymbol(read('../../app/src/lib/assets/favicon.svg'), 'icon-current')
].join('\n');

const use = (id, px, extra = '') =>
	`<svg class="mark ${extra}" width="${px}" height="${px}" aria-hidden="true"><use href="#icon-${id}"/></svg>`;

const sizes = [16, 24, 32, 48, 64, 128];

const band = (c) => `
<section class="band" aria-labelledby="h-${c.id}">
	<header class="band-head">
		<p class="letter">${c.id.toUpperCase()}</p>
		<div>
			<h2 id="h-${c.id}">${c.name}</h2>
			<p class="idea">${c.idea}</p>
		</div>
	</header>

	<div class="panels">
		<figure class="panel sizes">
			<figcaption>Actual pixel sizes</figcaption>
			<div class="size-row">
				${sizes.map((px) => `<div class="size"><div class="tile" style="--r:${px <= 24 ? 3 : Math.round(px * 0.22)}px">${use(c.id, px)}</div><span class="px">${px}</span></div>`).join('')}
			</div>
		</figure>

		<figure class="panel tabs">
			<figcaption>Browser tab, 16 px</figcaption>
			<div class="tab-strip">
				<div class="tab active"><span class="favicon">${use(c.id, 16)}</span>Geoclick</div>
				<div class="tab"><span class="favicon blank"></span>Inbox (3)</div>
			</div>
		</figure>

		<figure class="panel desktops">
			<figcaption>Desktop, light and dark, 32 px</figcaption>
			<div class="desk light"><div class="tile" style="--r:7px">${use(c.id, 32)}</div><span>Geoclick</span></div>
			<div class="desk dark"><div class="tile" style="--r:7px">${use(c.id, 32)}</div><span>Geoclick</span></div>
		</figure>

		<figure class="panel launcher">
			<figcaption>Android launcher shapes, 72 px</figcaption>
			<div class="shape-row">
				<div class="shape circle">${use(c.id, 72)}</div>
				<div class="shape squircle">${use(c.id, 72)}</div>
				<div class="shape rounded">${use(c.id, 72)}</div>
				<div class="shape safe" title="Dashed circle: the 66% zone every launcher keeps">${use(c.id, 72)}</div>
			</div>
		</figure>
	</div>
</section>`;

const html = `<title>Geoclick Icon Shortlist</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
	:root {
		--ground: #f4eedf;
		--surface: #fffdf8;
		--ink: #2c3a33;
		--muted: #5f6b63;
		--rule: #ddd3bd;
		--accent: #b5691f;
		--tab-bar: #e4ddcc;
		--tab-active: #fffdf8;
		color-scheme: light;
	}
	@media (prefers-color-scheme: dark) {
		:root:not([data-theme='light']) {
			--ground: #1b2420;
			--surface: #232e29;
			--ink: #ece6d6;
			--muted: #a7ae9f;
			--rule: #36433c;
			--accent: #e0914a;
			--tab-bar: #151c19;
			--tab-active: #2b3731;
			color-scheme: dark;
		}
	}
	:root[data-theme='dark'] {
		--ground: #1b2420;
		--surface: #232e29;
		--ink: #ece6d6;
		--muted: #a7ae9f;
		--rule: #36433c;
		--accent: #e0914a;
		--tab-bar: #151c19;
		--tab-active: #2b3731;
		color-scheme: dark;
	}

	* { box-sizing: border-box; }
	body {
		background: var(--ground);
		color: var(--ink);
		font: 400 1rem/1.55 'Atkinson Hyperlegible', system-ui, sans-serif;
		padding-inline: clamp(16px, 4vw, 48px);
		padding-block: 40px 64px;
		margin: 0;
	}
	main { max-width: 1120px; margin-inline: auto; display: grid; gap: 28px; }
	h1, h2 { font-family: 'Bricolage Grotesque', system-ui, sans-serif; text-wrap: balance; margin: 0; }
	h1 { font-size: clamp(1.9rem, 4vw, 2.6rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; }
	h2 { font-size: 1.5rem; font-weight: 600; }
	p { margin: 0; }

	.intro { display: grid; gap: 14px; max-width: 68ch; }
	.eyebrow { font: 500 0.75rem/1 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
	.intro p { color: var(--muted); }
	.intro strong { color: var(--ink); }

	.decide {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
	}
	.decide div { border-left: 3px solid var(--accent); padding: 4px 0 4px 14px; }
	.decide b { display: block; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 600; font-size: 1.05rem; }
	.decide span { color: var(--muted); font-size: 0.95rem; }

	.band {
		background: var(--surface);
		border: 1px solid var(--rule);
		border-radius: 14px;
		padding: 24px;
		display: grid;
		gap: 20px;
	}
	.band.baseline { background: transparent; border-style: dashed; }
	.band-head { display: flex; gap: 18px; align-items: start; }
	.letter {
		font: 800 2.4rem/1 'Bricolage Grotesque', system-ui, sans-serif;
		color: var(--accent);
		min-width: 1.4ch;
	}
	.idea { color: var(--muted); max-width: 62ch; margin-top: 4px; }

	.panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 14px;
	}
	.panel { margin: 0; display: grid; gap: 10px; align-content: start; }
	.panel.sizes { grid-column: 1 / -1; }
	figcaption { font: 500 0.72rem/1 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }

	.mark { display: block; }
	.tile { border-radius: var(--r); overflow: hidden; line-height: 0; }
	.size-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 22px; }
	.size { display: grid; justify-items: center; gap: 8px; }
	.px { font: 500 0.75rem/1 'IBM Plex Mono', ui-monospace, monospace; color: var(--muted); font-variant-numeric: tabular-nums; }

	.tab-strip { display: flex; gap: 2px; background: var(--tab-bar); padding: 8px 8px 0; border-radius: 10px 10px 0 0; }
	.tab { display: flex; align-items: center; gap: 8px; padding: 8px 14px; font: 400 0.8rem/1 system-ui, sans-serif; color: var(--muted); border-radius: 8px 8px 0 0; min-width: 0; white-space: nowrap; }
	.tab.active { background: var(--tab-active); color: var(--ink); }
	.favicon { width: 16px; height: 16px; flex: none; line-height: 0; border-radius: 3px; overflow: hidden; }
	.favicon.blank { background: var(--rule); }

	.desktops { grid-template-columns: 1fr 1fr; }
	.desktops figcaption { grid-column: 1 / -1; }
	.desk { display: grid; justify-items: center; gap: 6px; padding: 14px 8px; border-radius: 8px; font: 400 0.72rem/1.2 system-ui, sans-serif; }
	.desk.light { background: #e9eef2; color: #1f2328; }
	.desk.dark { background: #1f2024; color: #e8e8ea; }

	.shape-row { display: flex; flex-wrap: wrap; gap: 10px; }
	.shape { width: 72px; height: 72px; overflow: hidden; line-height: 0; position: relative; }
	.shape.circle { border-radius: 50%; }
	.shape.squircle { border-radius: 34%; }
	.shape.rounded { border-radius: 16%; }
	.shape.safe { border-radius: 16%; }
	.shape.safe::after {
		content: '';
		position: absolute;
		inset: 17%;
		border-radius: 50%;
		border: 1.5px dashed rgba(255, 255, 255, 0.85);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
	}

	.baseline .band-head .letter { color: var(--muted); }
	.baseline-row { display: flex; flex-wrap: wrap; align-items: center; gap: 22px; }
	.footnote { color: var(--muted); font-size: 0.9rem; max-width: 72ch; }
	.footnote code { font: 500 0.85em 'IBM Plex Mono', ui-monospace, monospace; }

	@media (max-width: 480px) {
		.band { padding: 18px; }
		.band-head { gap: 12px; }
		.letter { font-size: 1.9rem; }
		.tab:not(.active) { display: none; }
	}
</style>

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${symbols}
</defs></svg>

<main>
	<header class="intro">
		<p class="eyebrow">Geoclick · FT-04 · icon review</p>
		<h1>Three candidate icons for the desktop and Android apps</h1>
		<p>Each band shows one mark the way players would actually meet it: at real pixel sizes, in a browser tab, on a desktop and inside Android’s launcher shapes. <strong>Right now the app ships Tauri’s and Capacitor’s scaffold icons, and the web favicon is the Svelte framework logo.</strong></p>
	</header>

	<div class="decide">
		<div><b>Pick one</b><span>A, B or C, or say what to change for another round.</span></div>
		<div><b>Favicon</b><span>By default the web favicon switches to the chosen icon so all three shells match. Say if it shouldn’t.</span></div>
	</div>

	<section class="band baseline" aria-labelledby="h-current">
		<header class="band-head">
			<p class="letter">–</p>
			<div>
				<h2 id="h-current">Today’s favicon</h2>
				<p class="idea">The Svelte framework logo, left over from the project template. It’s what the browser tab shows today.</p>
			</div>
		</header>
		<div class="baseline-row">
			${[16, 32, 48].map((px) => `<div class="size">${use('current', px)}<span class="px">${px}</span></div>`).join('')}
		</div>
	</section>

	${candidates.map(band).join('\n')}

	<p class="footnote">The dashed circle in the last launcher shape is Android’s safe zone. Launchers can crop anything outside it, so each mark keeps its motif inside. Sources: <code>design/logo/candidate-*.svg</code>. The chosen one becomes <code>geoclick-logo.svg</code>, and FT-05 generates every platform size from it.</p>
</main>
`;

writeFileSync(path.join(dir, 'icon-shortlist.html'), html);
console.log('wrote icon-shortlist.html');
