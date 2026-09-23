// A region's spine (FT-66): the curve its name is drawn along, so the name
// reads as a territory rather than a pin. See DECISIONS.md, "Region names
// along the region".
//
// The spine is a parabola through the middle of the shape along its long
// axis. A parabola segment is exactly a quadratic Bezier, and Web Mercator to
// screen is affine (pan, zoom, bearing), so three points - start, control,
// end - draw the curve at every zoom. The app draws `M s Q c e`.
//
// The shape comes from the committed tiles (mapSpines.ts), where a region
// crossing a tile edge arrives as several clipped pieces that overlap by the
// tile buffer. Rasterising every piece into one mask stitches them without a
// polygon union; the mask is also all the rest of the work needs.
//
// Everything here is normalised Web Mercator (0..1, y down), so "longer" and
// "wider" mean what they look like on the map.

export type Point = [number, number];
export type Ring = Point[];

export interface Spine {
	/** Start, control and end of a quadratic Bezier, [lon, lat]. */
	curve: [Point, Point, Point];
	/** The curve's length over the region's typical width along it. */
	aspect: number;
}

/** Mask cells along the shape's longer side. */
const GRID = 160;
/** Slices across the long axis, to find the middle of the shape. */
const SLICES = 32;
/** Below this long/short ratio the axis is noise: the name lies level. */
const LEVEL_BELOW = 1.6;
/** A slice narrower than this share of the median is a tip, not the body. */
const TIP = 0.45;
/** The curve keeps this share of its length off each end of the body. */
const INSET = 0.06;
/** The curve bows at most this share of its length... */
const MAX_BOW = 0.12;
/** ...unless the shape is a crescent (Liguria) and needs this much. */
const CRESCENT_BOW = 0.3;
/** Sample points along the curve that may fall outside the shape. */
const OUTSIDE_ALLOWED = 2;

export const unproject = ([x, y]: Point): Point => [
	x * 360 - 180,
	(Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI
];

class Mask {
	readonly cells: Uint8Array;
	constructor(
		readonly x0: number,
		readonly y0: number,
		readonly cell: number,
		readonly cols: number,
		readonly rows: number
	) {
		this.cells = new Uint8Array(cols * rows);
	}
	has(x: number, y: number): boolean {
		const c = Math.floor((x - this.x0) / this.cell);
		const r = Math.floor((y - this.y0) / this.cell);
		return (
			c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.cells[r * this.cols + c] === 1
		);
	}
	centre(i: number): Point {
		return [
			this.x0 + ((i % this.cols) + 0.5) * this.cell,
			this.y0 + (Math.floor(i / this.cols) + 0.5) * this.cell
		];
	}
}

/** Every piece filled even-odd on its own, then all of them OR-ed together. */
function rasterise(pieces: Ring[][]): Mask | null {
	let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const piece of pieces) {
		for (const ring of piece) {
			for (const [x, y] of ring) {
				[x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
			}
		}
	}
	const cell = Math.max(x1 - x0, y1 - y0) / GRID;
	if (!(cell > 0)) return null;
	const mask = new Mask(
		x0,
		y0,
		cell,
		Math.ceil((x1 - x0) / cell) + 1,
		Math.ceil((y1 - y0) / cell) + 1
	);
	for (const piece of pieces) {
		for (let r = 0; r < mask.rows; r++) {
			const y = y0 + (r + 0.5) * cell;
			const xs: number[] = [];
			for (const ring of piece) {
				for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
					const [xi, yi] = ring[i];
					const [xj, yj] = ring[j];
					if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
				}
			}
			xs.sort((a, b) => a - b);
			for (let k = 0; k + 1 < xs.length; k += 2) {
				const from = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5));
				const to = Math.min(mask.cols - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5));
				for (let c = from; c <= to; c++) mask.cells[r * mask.cols + c] = 1;
			}
		}
	}
	return mask;
}

/**
 * A cell's share of the ground, relative to one at the equator: Web Mercator
 * inflates area by 1/cos^2(latitude), and cos(latitude) is 1/cosh of the
 * Mercator y below.
 */
const groundArea = (y: number) => 1 / Math.cosh(Math.PI * (1 - 2 * y)) ** 2;

/**
 * Keeps only the largest connected part: a name belongs on the mainland.
 * Largest on the ground, not on the map - counted in Mercator cells, Nunavut's
 * Ellesmere Island (80 N) outweighed its mainland (63 N), and the name went
 * off the top of the screen.
 */
function keepLargestPart(mask: Mask): number[] {
	const label = new Int32Array(mask.cells.length);
	let best: number[] = [];
	let bestArea = 0;
	const stack: number[] = [];
	for (let start = 0; start < mask.cells.length; start++) {
		if (!mask.cells[start] || label[start]) continue;
		const part: number[] = [];
		label[start] = 1;
		stack.push(start);
		while (stack.length) {
			const i = stack.pop()!;
			part.push(i);
			const c = i % mask.cols;
			const next = [
				c > 0 ? i - 1 : -1,
				c < mask.cols - 1 ? i + 1 : -1,
				i - mask.cols,
				i + mask.cols
			];
			for (const n of next) {
				if (n < 0 || n >= mask.cells.length || !mask.cells[n] || label[n]) continue;
				label[n] = 1;
				stack.push(n);
			}
		}
		const area = part.reduce((sum, i) => sum + groundArea(mask.centre(i)[1]), 0);
		if (area > bestArea) [best, bestArea] = [part, area];
	}
	mask.cells.fill(0);
	for (const i of best) mask.cells[i] = 1;
	return best;
}

/** Weighted least squares for b = c0 + c1 a (+ c2 a^2). */
function fit(body: { a: number; mid: number; w: number }[], degree: 1 | 2): number[] {
	const m = degree + 1;
	const A = Array.from({ length: m }, () => new Array<number>(m + 1).fill(0));
	for (const { a, mid, w } of body) {
		const row = [1, a, a * a].slice(0, m);
		for (let r = 0; r < m; r++) {
			for (let c = 0; c < m; c++) A[r][c] += w * row[r] * row[c];
			A[r][m] += w * row[r] * mid;
		}
	}
	for (let c = 0; c < m; c++) {
		let p = c;
		for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
		[A[c], A[p]] = [A[p], A[c]];
		for (let r = 0; r < m; r++) {
			if (r === c || A[c][c] === 0) continue;
			const f = A[r][c] / A[c][c];
			for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
		}
	}
	const coef = A.map((row, i) => (row[i] === 0 ? 0 : row[m] / row[i]));
	return [coef[0], coef[1], coef[2] ?? 0];
}

const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;

/**
 * The spine of one region, from its polygon pieces (each a list of rings,
 * filled even-odd, in normalised Web Mercator). Null for a shape too small or
 * too twisted to carry a curve - the app then keeps the name on its centroid.
 */
export function computeSpine(pieces: Ring[][]): Spine | null {
	const mask = rasterise(pieces);
	if (!mask) return null;
	const cells = keepLargestPart(mask);
	if (cells.length < 12) return null;

	// The shape's own axis, from its area rather than its outline, so a
	// wiggly coast does not outweigh a straight border.
	const pts = cells.map((i) => mask.centre(i));
	const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
	const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
	let [cxx, cyy, cxy] = [0, 0, 0];
	for (const [x, y] of pts) {
		cxx += (x - mx) ** 2;
		cyy += (y - my) ** 2;
		cxy += (x - mx) * (y - my);
	}
	const half = (cxx + cyy) / 2;
	const disc = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy ** 2);
	const ratio = Math.sqrt((half + disc) / Math.max(half - disc, 1e-30));
	const theta = ratio < LEVEL_BELOW ? 0 : 0.5 * Math.atan2(2 * cxy, cxx - cyy);
	const [ux, uy] = [Math.cos(theta), Math.sin(theta)];
	// The axis frame: a along the axis, b across it.
	const toAB = ([x, y]: Point): Point => [
		(x - mx) * ux + (y - my) * uy,
		-(x - mx) * uy + (y - my) * ux
	];
	const fromAB = ([a, b]: Point): Point => [mx + a * ux - b * uy, my + a * uy + b * ux];
	const inside = (p: Point) => mask.has(...fromAB(p));

	let [aMin, aMax, bMin, bMax] = [Infinity, -Infinity, Infinity, -Infinity];
	for (const p of pts) {
		const [a, b] = toAB(p);
		[aMin, aMax, bMin, bMax] = [
			Math.min(aMin, a),
			Math.max(aMax, a),
			Math.min(bMin, b),
			Math.max(bMax, b)
		];
	}
	const step = mask.cell / 2;

	// Across each slice, the longest stretch inside the shape.
	const slices: { a: number; mid: number; w: number }[] = [];
	for (let i = 0; i < SLICES; i++) {
		const a = aMin + ((i + 0.5) / SLICES) * (aMax - aMin);
		let best = { mid: 0, w: 0 };
		let runStart: number | undefined;
		// Counted in steps, and two past the last cell, so every run closes:
		// a float `b <= bMax + step` can stop inside the last cell and leave
		// a full-height slice (any rectangle) with no run at all.
		const steps = Math.ceil((bMax - bMin) / step) + 4;
		for (let k = 0; k <= steps; k++) {
			const b = bMin - 2 * step + k * step;
			const on = k < steps && inside([a, b]);
			if (on && runStart === undefined) runStart = b;
			if (!on && runStart !== undefined) {
				if (b - runStart > best.w) best = { mid: (runStart + b - step) / 2, w: b - runStart };
				runStart = undefined;
			}
		}
		slices.push({ a, ...best });
	}

	// Drop the tips: the run of body slices around the widest one.
	const widths = slices.map((s) => s.w).sort((p, q) => p - q);
	const median = widths[Math.floor(widths.length / 2)];
	let widest = 0;
	slices.forEach((s, i) => {
		if (s.w > slices[widest].w) widest = i;
	});
	let [lo, hi] = [widest, widest];
	while (lo > 0 && slices[lo - 1].w >= TIP * median) lo--;
	while (hi < SLICES - 1 && slices[hi + 1].w >= TIP * median) hi++;
	const body = slices.slice(lo, hi + 1);
	if (body.length < 3) return null;

	const span = body[body.length - 1].a - body[0].a;
	const a0 = body[0].a + INSET * span;
	const a1 = body[body.length - 1].a - INSET * span;
	const len = a1 - a0;
	const thickness = body.map((s) => s.w).sort((p, q) => p - q)[Math.floor(body.length / 2)];
	if (!(len > 0 && thickness > 0)) return null;

	// A gentle bow first, then a crescent's, then straight.
	for (const [degree, maxBow] of [
		[2, MAX_BOW],
		[2, CRESCENT_BOW],
		[1, 0]
	] as const) {
		const [c0, c1, fitted] = fit(body, degree);
		let c2 = fitted;
		// The bow is the parabola's sagitta over [a0, a1].
		const bow = Math.abs(c2) * (len / 2) ** 2;
		if (bow > maxBow * len) c2 *= (maxBow * len) / bow;
		const f = (a: number) => c0 + c1 * a + c2 * a * a;
		let outside = 0;
		for (let k = 0; k <= 20; k++) {
			const a = a0 + (k / 20) * len;
			if (!inside([a, f(a)])) outside++;
		}
		if (outside > OUTSIDE_ALLOWED) continue;
		const am = (a0 + a1) / 2;
		// A parabola's Bezier control point: where the end tangents meet.
		const control: Point = [am, f(a0) + (c1 + 2 * c2 * a0) * (am - a0)];
		const curve = ([[a0, f(a0)], control, [a1, f(a1)]] as Point[]).map((p) => {
			const [lon, lat] = unproject(fromAB(p));
			return [round(lon, 4), round(lat, 4)] as Point;
		}) as [Point, Point, Point];
		return { curve, aspect: round(len / thickness, 2) };
	}
	return null;
}
