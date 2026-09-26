// Region names drawn along the region (FT-66), the way an atlas - or Europa
// Universalis - writes them: spaced out along the shape's long axis, so the
// name reads as a territory rather than a pin. See DECISIONS.md, "Region
// names along the region".
//
// Each region carries a spine in map.json (data/scripts/spine.ts): three
// points of a quadratic Bezier. Web Mercator to screen is affine, so the three
// points projected are the curve on screen, at any zoom. The names are SVG
// `textPath`s in one overlay above the map canvas - DOM popups cannot follow a
// curve, and a MapLibre symbol layer would need a vendored glyph stack.
//
// A stretched name is sized by its region: it is only drawn where it fits at
// a readable size. Everywhere else - a small region, a zoomed-out phone, a
// region with no spine - the name stays the ordinary popup, which the view
// creates as always. This module hides that popup (STRETCHED_CLASS) while the
// stretched name is drawn and gives it back the moment it no longer fits.
// Stretched names are fixed obstacles to the collision pass, and register a
// hit shape so hover and tap magnify them like any other name.

import type * as maplibregl from 'maplibre-gl';
import type { LabelRect } from './labelCollision';
import { setLabelObstacles } from './labelCollision';
import { STRETCHED_CLASS, registerHitShape, unregisterHitShape } from './labelMagnify';
import type { Spine } from './mapDefinition';

export type Point = [number, number];

/** The name fills at most this share of its spine; the rest is margin. */
const FILL = 0.86;
/** Font size over the region's width along the spine. */
const THICK = 0.7;
/** Letters spread at most this many font sizes apart: further, and a name
 * falls apart into letters. */
const MAX_SPACING = 1.2;
/** A near-upright name (rise over run above this) reads bottom to top. */
const UPRIGHT = 2.7;
/** Points sampled along the drawn name, for hit tests and the collision pass. */
const SAMPLES = 9;
const SVG = 'http://www.w3.org/2000/svg';
export const STRETCHED_FONT = 'Georgia, "Times New Roman", serif';

export interface StretchedLayout {
	/** SVG path data, start to end in reading order. */
	d: string;
	/** Font size, px. */
	size: number;
	/** Extra space after each letter, px. */
	spacing: number;
	/** Where along the path the name's middle sits, as a share of it. */
	middle: number;
	/** Points along the drawn name, in reading order. */
	along: Point[];
}

/** The browser's own font size (FT-02): names follow it, like all text. */
const rootSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

const bezier = ([s, c, e]: Point[], t: number): Point => [
	(1 - t) ** 2 * s[0] + 2 * (1 - t) * t * c[0] + t * t * e[0],
	(1 - t) ** 2 * s[1] + 2 * (1 - t) * t * c[1] + t * t * e[1]
];

/**
 * Where and how big one name goes, from its spine already projected to the
 * screen - or null if it does not fit at `minSize` px. `widthAt1px` is the
 * name's width at a 1 px font with no spacing; `letters` its length. Pure, so
 * the rules are testable without a map.
 */
export function layoutStretched(
	projected: [Point, Point, Point],
	aspect: number,
	widthAt1px: number,
	letters: number,
	{ minSize, maxSize }: { minSize: number; maxSize: number }
): StretchedLayout | null {
	const c = projected[1];
	let [s, e] = [projected[0], projected[2]];
	// Never upside down: left to right, or bottom to top when near upright,
	// so a hair's change of slope cannot flip a name.
	const upright = Math.abs(e[1] - s[1]) > UPRIGHT * Math.abs(e[0] - s[0]);
	if (upright ? s[1] < e[1] : s[0] > e[0]) [s, e] = [e, s];
	const chord = Math.hypot(e[0] - s[0], e[1] - s[1]);
	// A quadratic Bezier's length, closely enough: between chord and polygon.
	const length =
		(2 * chord + Math.hypot(c[0] - s[0], c[1] - s[1]) + Math.hypot(e[0] - c[0], e[1] - c[1])) / 3;
	if (!(length > 0 && aspect > 0 && widthAt1px > 0)) return null;
	let size = Math.min(maxSize, (length / aspect) * THICK);
	if (size * widthAt1px > FILL * length) size = (FILL * length) / widthAt1px;
	if (size < minSize) return null;
	// The stretch: the spare length goes between the letters.
	const natural = size * widthAt1px;
	const spacing =
		letters > 1
			? Math.max(0, Math.min((FILL * length - natural) / (letters - 1), MAX_SPACING * size))
			: 0;
	const drawn = natural + spacing * (letters - 1);
	// SVG adds the spacing after the last letter too; shift by half of it so
	// the letters themselves sit in the middle.
	const middle = 0.5 + spacing / 2 / length;
	const from = middle - drawn / 2 / length - spacing / 2 / length;
	const along = Array.from({ length: SAMPLES }, (_, i) =>
		bezier([s, c, e], from + (i / (SAMPLES - 1)) * (drawn / length))
	);
	return { d: `M ${s[0]} ${s[1]} Q ${c[0]} ${c[1]} ${e[0]} ${e[1]}`, size, spacing, middle, along };
}

/** Squares down the drawn name, for the collision pass to keep popups off. */
export function obstacleRects({ along, size }: StretchedLayout): LabelRect[] {
	const half = size * 0.55;
	return along.map(([x, y]) => ({
		left: x - half,
		right: x + half,
		top: y - half,
		bottom: y + half
	}));
}

/** Whether a point is on the drawn name: near its line, within its height. */
export function hitsLayout({ along, size }: StretchedLayout, x: number, y: number): boolean {
	for (let i = 1; i < along.length; i++) {
		const [ax, ay] = along[i - 1];
		const [bx, by] = along[i];
		const dx = bx - ax;
		const dy = by - ay;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
		if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= size * 0.6) return true;
	}
	return false;
}

/** How strongly a name is drawn: the same four steps as the popups (FT-22). */
export type StretchedTier = 'known' | 'nearly' | 'seen' | 'asked';

export interface StretchedName {
	name: string;
	spine: Spine;
	tier: StretchedTier;
	/** The popup to hide while the stretched name is drawn. */
	popup: { getElement(): HTMLElement | undefined };
}

interface Drawn extends StretchedName {
	path: SVGPathElement;
	text: SVGTextElement;
	textPath: SVGTextPathElement;
	layout: StretchedLayout | null;
	widthAt1px: number;
}

/** The stretched names of one map view. */
export class StretchedNames {
	private readonly svg: SVGSVGElement;
	private readonly defs: SVGDefsElement;
	private readonly names = new Map<string, Drawn>();
	private readonly measure = document.createElement('canvas').getContext('2d');
	private readonly draw = () => this.layoutAll();

	constructor(private readonly map: maplibregl.Map) {
		this.svg = document.createElementNS(SVG, 'svg');
		this.svg.classList.add('geoclick-stretched');
		this.defs = document.createElementNS(SVG, 'defs');
		this.svg.appendChild(this.defs);
		// Under the popups (they come later in the container), over the canvas.
		map.getCanvasContainer().after(this.svg);
		map.on('render', this.draw);
		setLabelObstacles(map.getContainer(), () =>
			[...this.names.values()].flatMap((n) => (n.layout ? obstacleRects(n.layout) : []))
		);
	}

	/** Draws a name along its region, or updates its tier. */
	set(id: string, name: StretchedName): void {
		let drawn = this.names.get(id);
		if (!drawn) {
			const path = document.createElementNS(SVG, 'path');
			path.id = `geoclick-spine-${id}`;
			const text = document.createElementNS(SVG, 'text');
			const textPath = document.createElementNS(SVG, 'textPath');
			textPath.setAttribute('href', `#${path.id}`);
			textPath.setAttribute('text-anchor', 'middle');
			// Capitals, as an atlas sets a region's name - in the text itself,
			// so what is measured is what is drawn (German ß becomes SS).
			textPath.textContent = name.name.toUpperCase();
			text.appendChild(textPath);
			this.defs.appendChild(path);
			this.svg.appendChild(text);
			drawn = {
				...name,
				path,
				text,
				textPath,
				layout: null,
				widthAt1px: this.widthAt1px(name.name)
			};
			text.setAttribute('aria-hidden', 'true');
			this.names.set(id, drawn);
		} else {
			// A new language renames it in place (#71), and it is measured again.
			if (name.name !== drawn.name) {
				drawn.textPath.textContent = name.name.toUpperCase();
				drawn.widthAt1px = this.widthAt1px(name.name);
			}
			Object.assign(drawn, name);
		}
		for (const tier of ['known', 'nearly', 'seen', 'asked'] as const) {
			drawn.text.classList.toggle(`retention-${tier}`, tier === name.tier);
		}
		this.layoutOne(drawn, rootSize());
	}

	/** Stops drawing a name; its popup, if the view keeps it, shows again. */
	delete(id: string): void {
		const drawn = this.names.get(id);
		if (!drawn) return;
		this.setStretched(drawn, false);
		unregisterHitShape(drawn.text);
		drawn.path.remove();
		drawn.text.remove();
		this.names.delete(id);
	}

	destroy(): void {
		for (const id of [...this.names.keys()]) this.delete(id);
		this.map.off('render', this.draw);
		setLabelObstacles(this.map.getContainer());
		this.svg.remove();
	}

	private widthAt1px(name: string): number {
		if (!this.measure) return 0;
		// Measured once, big, then scaled: a font's width is linear in its size.
		this.measure.font = `600 100px ${STRETCHED_FONT}`;
		return this.measure.measureText(name.toUpperCase()).width / 100;
	}

	private layoutAll(): void {
		if (this.names.size === 0) return;
		const rem = rootSize();
		for (const drawn of this.names.values()) this.layoutOne(drawn, rem);
	}

	private layoutOne(drawn: Drawn, rem: number): void {
		const projected = drawn.spine.curve.map((p) => {
			const { x, y } = this.map.project(p);
			return [x, y] as Point;
		}) as [Point, Point, Point];
		// Never smaller than the popup it replaces would be, in rem like it (FT-02).
		const letters = drawn.textPath.textContent?.length ?? 0;
		const layout = layoutStretched(projected, drawn.spine.aspect, drawn.widthAt1px, letters, {
			minSize: 0.8125 * rem,
			maxSize: 1.75 * rem
		});
		drawn.layout = layout;
		if (!layout) {
			drawn.text.style.display = 'none';
			unregisterHitShape(drawn.text);
			this.setStretched(drawn, false);
			return;
		}
		drawn.path.setAttribute('d', layout.d);
		drawn.textPath.setAttribute('startOffset', `${layout.middle * 100}%`);
		drawn.text.style.display = '';
		drawn.text.style.fontSize = `${layout.size}px`;
		drawn.text.style.letterSpacing = `${layout.spacing}px`;
		const container = this.map.getContainer();
		registerHitShape(drawn.text, (x, y) => {
			const r = container.getBoundingClientRect();
			return drawn.layout ? hitsLayout(drawn.layout, x - r.left, y - r.top) : false;
		});
		this.setStretched(drawn, true);
	}

	private setStretched(drawn: Drawn, stretched: boolean): void {
		const content = drawn.popup.getElement()?.querySelector('.maplibregl-popup-content');
		if (content && content.classList.contains(STRETCHED_CLASS) !== stretched) {
			content.classList.toggle(STRETCHED_CLASS, stretched);
		}
	}
}
