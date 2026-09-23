// FT-64 spike: every region's name drawn along its spine, as an SVG textPath
// overlay above the map canvas. Opened with ?spine on the Explore map
// (?spine=debug also strokes the spine). Not wired into anything else.
import type * as maplibregl from 'maplibre-gl';
import type { MapDefinition } from './mapDefinition';

type P = [number, number];
interface Spine {
	curve: [P, P, P];
	aspect: number;
}

const SVG = 'http://www.w3.org/2000/svg';
/** Text fills this share of the spine; the rest is breathing room. */
const FILL = 0.86;
/** The name's cap height stays under this share of the region's width. */
const THICK = 0.5;
const MIN_PX = 9;
const MAX_PX = 30;
const FONT = '600 {px}px Georgia, "Times New Roman", serif';

export async function drawSpineLabels(
	map: maplibregl.Map,
	def: MapDefinition,
	spinesUrl: string,
	debug: boolean
): Promise<() => void> {
	const spines: Record<string, Spine | null> = await (await fetch(spinesUrl)).json();
	const svg = document.createElementNS(SVG, 'svg');
	svg.setAttribute('class', 'geoclick-spines');
	svg.style.cssText =
		'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
	const style = document.createElementNS(SVG, 'style');
	style.textContent = `
		.spine-name { font: 600 13px Georgia, "Times New Roman", serif; fill: rgba(28,34,30,.78);
			stroke: rgba(255,255,255,.75); stroke-width: 3px; paint-order: stroke; stroke-linejoin: round; }
		.spine-fallback { fill: rgba(140,40,20,.85); }`;
	svg.appendChild(style);
	map.getContainer().appendChild(svg);
	const measure = document.createElement('canvas').getContext('2d')!;

	const items = def.targets.flatMap((t) => {
		const spine = spines[t.id];
		const label = t.name.toUpperCase();
		const path = document.createElementNS(SVG, 'path');
		path.id = `spine-${t.id}`;
		path.setAttribute('fill', 'none');
		if (debug) path.setAttribute('stroke', 'rgba(200,0,0,.5)');
		const text = document.createElementNS(SVG, 'text');
		const tp = document.createElementNS(SVG, 'textPath');
		tp.setAttribute('href', `#spine-${t.id}`);
		tp.setAttribute('startOffset', '50%');
		tp.setAttribute('text-anchor', 'middle');
		tp.textContent = label;
		text.appendChild(tp);
		text.setAttribute('class', spine ? 'spine-name' : 'spine-name spine-fallback');
		svg.append(path, text);
		return [{ t, spine, label, path, text, tp }];
	});

	const draw = () => {
		for (const { t, spine, label, path, text, tp } of items) {
			const projected = (spine?.curve ?? [t.centroid, t.centroid, t.centroid]).map((p) => {
				const q = map.project(p as P);
				return [q.x, q.y] as P;
			});
			let [s, e] = [projected[0], projected[2]];
			const c = projected[1];
			// Never upside down: the name reads left to right, and a near-upright
			// one bottom to top (the map convention), so a hair's change of
			// slope cannot flip it.
			const steep = Math.abs(e[1] - s[1]) > 2.7 * Math.abs(e[0] - s[0]);
			if (steep ? s[1] < e[1] : s[0] > e[0]) [s, e] = [e, s];
			const chord = Math.hypot(e[0] - s[0], e[1] - s[1]);
			// Quadratic Bezier length, close enough: between chord and polygon.
			const len = spine
				? (2 * chord +
						Math.hypot(c[0] - s[0], c[1] - s[1]) +
						Math.hypot(e[0] - c[0], e[1] - c[1])) /
					3
				: 0;
			if (!spine) {
				// No spine: a level name on the centroid, as today.
				path.setAttribute('d', `M ${s[0] - 200} ${s[1]} L ${s[0] + 200} ${s[1]}`);
				text.style.fontSize = '13px';
				tp.style.letterSpacing = '0.08em';
				text.style.display = '';
				continue;
			}
			path.setAttribute('d', `M ${s[0]} ${s[1]} Q ${c[0]} ${c[1]} ${e[0]} ${e[1]}`);
			const thick = len / spine.aspect;
			let px = Math.min(MAX_PX, thick * THICK * 1.4);
			measure.font = FONT.replace('{px}', String(px));
			const w = measure.measureText(label).width;
			if (w > FILL * len) px *= (FILL * len) / w;
			if (px < MIN_PX) {
				text.style.display = 'none';
				continue;
			}
			text.style.display = '';
			measure.font = FONT.replace('{px}', String(px));
			const natural = measure.measureText(label).width;
			// The stretch: spare length goes between the letters, up to a limit
			// past which a name falls apart into letters.
			const gap = Math.max(
				0,
				Math.min((FILL * len - natural) / Math.max(1, label.length - 1), px * 1.6)
			);
			text.style.fontSize = `${px}px`;
			tp.style.letterSpacing = `${gap}px`;
		}
	};
	map.on('render', draw);
	draw();
	return () => {
		map.off('render', draw);
		svg.remove();
	};
}
