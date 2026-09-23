// FT-64 spike: a region's name drawn along the region, not on its centroid.
//
// The spine is a parabola through the middle of the shape along its long
// axis. A parabola segment is exactly a quadratic Bezier, and Web Mercator
// to screen is affine (pan, zoom, bearing), so three points - start, control,
// end - describe the curve at every zoom. The runtime draws `M s Q c e`.
//
// Worked in normalised Web Mercator (0..1, y down), so "longer" and "wider"
// mean what they look like on the map.

type P = [number, number];
type Ring = P[];
export type Geometry =
	{ type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

export interface Spine {
	/** Start, control, end of a quadratic Bezier, [lon, lat]. */
	curve: [P, P, P];
	/** Curve length over the typical width inside the shape. */
	aspect: number;
}

const SLICES = 32;
/** Below this long/short spread, the axis is noise: lay the name level. */
const LEVEL_BELOW = 1.6;
/** A slice narrower than this share of the median is a tip, not the body. */
const TIP = 0.45;
/** The name keeps this share of the spine's length off each end. */
const INSET = 0.06;
/** The curve may bow at most this share of its length. */
const MAX_BOW = 0.12;

const project = ([lon, lat]: P): P => {
	const s = Math.sin((lat * Math.PI) / 180);
	return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
};
const unproject = ([x, y]: P): P => [
	x * 360 - 180,
	(Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI
];

function ringArea(r: Ring): number {
	let a = 0;
	for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
		a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
	}
	return a / 2;
}

function inside(rings: Ring[], [x, y]: P): boolean {
	let odd = false;
	for (const r of rings) {
		for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
			const [xi, yi] = r[i];
			const [xj, yj] = r[j];
			if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
		}
	}
	return odd;
}

/** The largest part of the shape: a name belongs on the mainland. */
function mainPart(g: Geometry): Ring[] {
	const parts = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
	let best = parts[0].map((r) => r.map(project));
	let bestArea = 0;
	for (const part of parts) {
		const rings = part.map((r) => r.map(project));
		const a = Math.abs(ringArea(rings[0]));
		if (a > bestArea) [best, bestArea] = [rings, a];
	}
	return best;
}

export function computeSpine(g: Geometry): Spine | null {
	const rings = mainPart(g);
	const outer = rings[0];
	let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const [x, y] of outer) {
		[x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
	}

	// The shape's own axis, from points spread evenly inside it (vertices
	// alone would weight a wiggly coast over a straight border).
	const samples: P[] = [];
	const n = 48;
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			const p: P = [x0 + ((i + 0.5) / n) * (x1 - x0), y0 + ((j + 0.5) / n) * (y1 - y0)];
			if (inside(rings, p)) samples.push(p);
		}
	}
	if (samples.length < 12) return null;
	const mx = samples.reduce((s, p) => s + p[0], 0) / samples.length;
	const my = samples.reduce((s, p) => s + p[1], 0) / samples.length;
	let [cxx, cyy, cxy] = [0, 0, 0];
	for (const [x, y] of samples) {
		cxx += (x - mx) ** 2;
		cyy += (y - my) ** 2;
		cxy += (x - mx) * (y - my);
	}
	const tr = cxx + cyy;
	const disc = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy ** 2);
	const spread = (tr / 2 + disc) / Math.max(tr / 2 - disc, 1e-18);
	const theta = Math.sqrt(spread) < LEVEL_BELOW ? 0 : 0.5 * Math.atan2(2 * cxy, cxx - cyy);
	const [ux, uy] = [Math.cos(theta), Math.sin(theta)];
	// Into the axis frame: a along the axis, b across it.
	const toAB = ([x, y]: P): P => [(x - mx) * ux + (y - my) * uy, -(x - mx) * uy + (y - my) * ux];
	const fromAB = ([a, b]: P): P => [mx + a * ux - b * uy, my + a * uy + b * ux];
	const abRings = rings.map((r) => r.map(toAB));

	let [aMin, aMax] = [Infinity, -Infinity];
	for (const [a] of abRings[0]) [aMin, aMax] = [Math.min(aMin, a), Math.max(aMax, a)];

	// Across each slice, the widest stretch that is inside the shape.
	const slices: { a: number; mid: number; w: number }[] = [];
	for (let i = 0; i < SLICES; i++) {
		const a = aMin + ((i + 0.5) / SLICES) * (aMax - aMin);
		const hits: number[] = [];
		for (const r of abRings) {
			for (let k = 0, j = r.length - 1; k < r.length; j = k++) {
				const [ak, bk] = r[k];
				const [aj, bj] = r[j];
				if (ak > a !== aj > a) hits.push(bk + ((a - ak) * (bj - bk)) / (aj - ak));
			}
		}
		hits.sort((p, q) => p - q);
		let best = { mid: 0, w: 0 };
		for (let k = 0; k + 1 < hits.length; k += 2) {
			const w = hits[k + 1] - hits[k];
			if (w > best.w) best = { mid: (hits[k] + hits[k + 1]) / 2, w };
		}
		slices.push({ a, ...best });
	}

	// Drop the tips: keep the run of body slices around the widest one.
	const widths = slices.map((s) => s.w).sort((p, q) => p - q);
	const median = widths[Math.floor(widths.length / 2)];
	let widest = 0;
	slices.forEach((s, i) => (s.w > slices[widest].w ? (widest = i) : 0));
	let [lo, hi] = [widest, widest];
	while (lo > 0 && slices[lo - 1].w >= TIP * median) lo--;
	while (hi < SLICES - 1 && slices[hi + 1].w >= TIP * median) hi++;
	const body = slices.slice(lo, hi + 1);
	if (body.length < 3) return null;

	// Weighted least squares b = c0 + c1 a + c2 a^2; wide slices count more.
	const fit = (degree: 1 | 2) => {
		const m = degree + 1;
		const A = Array.from({ length: m }, () => new Array(m + 1).fill(0));
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
		const coef = A.map((row, i) => row[m] / row[i]);
		return [coef[0], coef[1], coef[2] ?? 0];
	};

	const span = body[body.length - 1].a - body[0].a;
	const a0 = body[0].a + INSET * span;
	const a1 = body[body.length - 1].a - INSET * span;
	const len = a1 - a0;
	const thickness = [...body].map((s) => s.w).sort((p, q) => p - q)[Math.floor(body.length / 2)];

	// A gentle bow first; a crescent (Liguria) may bend further before the
	// straight line is tried.
	for (const [degree, maxBow] of [
		[2, MAX_BOW],
		[2, 2.5 * MAX_BOW],
		[1, 0]
	] as const) {
		const [c0, c1, fitted] = fit(degree);
		let c2 = fitted;
		// Bow = sagitta of the parabola over [a0, a1]; a hook reads worse
		// than a straight name.
		const bow = Math.abs(c2) * (len / 2) ** 2;
		if (bow > maxBow * len) c2 *= (maxBow * len) / bow;
		const f = (a: number) => c0 + c1 * a + c2 * a * a;
		const df = (a: number) => c1 + 2 * c2 * a;
		let outside = 0;
		for (let k = 0; k <= 20; k++) {
			const a = a0 + (k / 20) * len;
			if (!inside(abRings, [a, f(a)])) outside++;
		}
		if (outside > 2) continue;
		const am = (a0 + a1) / 2;
		const ctrl: P = [am, f(a0) + df(a0) * (am - a0)];
		const curve = [[a0, f(a0)], ctrl, [a1, f(a1)]].map((p) => unproject(fromAB(p as P))) as [
			P,
			P,
			P
		];
		return { curve, aspect: len / thickness };
	}
	return null;
}
