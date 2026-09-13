// Adjacency-aware categorical colours for map targets (GC-032).
//
// The old style coloured each target by `name.length % 8`, which put
// same-coloured regions next to each other ~20% of the time (Bolzano/Sondrio/
// Belluno/Brescia/Bergamo, all 7 letters, one olive swath). Instead, each
// target gets a `colorIndex` (0..PALETTE_SIZE-1) chosen by graph colouring so
// that no two ADJACENT targets share one. The style reads it back through
// feature-state (see geoclickMap.ts) - so the committed tiles never need
// rebuilding just to recolour.
//
// Adjacency comes from the committed tiles themselves - the geometry players
// actually see - not from the Natural Earth source (reproducing each map's
// dissolves and fixups from source would be a second pipeline). Polygon targets
// are rasterised onto an ownership grid and two targets are adjacent when their
// cells touch within ADJACENCY_RADIUS_CELLS - which also bridges the hairline
// slivers left where tippecanoe simplified shared borders independently.
// Point targets (towns) use k-nearest-neighbour adjacency instead.

import { openSync, readSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PMTiles, type RangeResponse, type Source } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

export const PALETTE_SIZE = 6; // must match the match-arms in data/styles/base.json
const GRID_CELLS = 2048; // raster resolution along the map's longer side
const ADJACENCY_RADIUS_CELLS = 2;
const POINT_NEIGHBOURS = 3;

interface TargetLike {
	id: string;
	name: string;
	type: string;
	centroid: [number, number];
	colorIndex?: number;
}
interface MapJson {
	id: string;
	targets: TargetLike[];
}
export type Adjacency = Map<string, Set<string>>;

class FileSource implements Source {
	constructor(private readonly file: string) {}
	getKey(): string {
		return this.file;
	}
	async getBytes(offset: number, length: number): Promise<RangeResponse> {
		const buf = Buffer.alloc(length);
		const fd = openSync(this.file, 'r');
		try {
			const n = readSync(fd, buf, 0, length, offset);
			return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + n) as ArrayBuffer };
		} finally {
			closeSync(fd);
		}
	}
}

const addEdge = (adj: Adjacency, a: string, b: string) => {
	if (a === b) return;
	adj.get(a)!.add(b);
	adj.get(b)!.add(a);
};

function lonLatToTile(lon: number, lat: number, z: number): [number, number] {
	const n = 2 ** z;
	const x = ((lon + 180) / 360) * n;
	const latRad = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
	const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
	return [x, y];
}

interface DecodedPolygon {
	name: string;
	rings: [number, number][][]; // world tile-units at the chosen zoom
}

async function decodeTargets(tilesFile: string, names: Set<string>): Promise<DecodedPolygon[]> {
	const pm = new PMTiles(new FileSource(tilesFile));
	const h = await pm.getHeader();
	// The lowest zoom (>= 5, for detail) at which every target is present - tiny
	// targets can be dropped at low zoom, and a missing target would silently get
	// no neighbours at all.
	for (let z = Math.max(5, h.minZoom); z <= h.maxZoom; z++) {
		const [x0, y0] = lonLatToTile(h.minLon, h.maxLat, z);
		const [x1, y1] = lonLatToTile(h.maxLon, h.minLat, z);
		const polys: DecodedPolygon[] = [];
		const seen = new Set<string>();
		for (let tx = Math.floor(x0); tx <= Math.min(2 ** z - 1, Math.floor(x1)); tx++) {
			for (let ty = Math.floor(y0); ty <= Math.min(2 ** z - 1, Math.floor(y1)); ty++) {
				const res = await pm.getZxy(z, tx, ty);
				if (!res) continue;
				const layer = new VectorTile(new PbfReader(new Uint8Array(res.data))).layers['targets'];
				if (!layer) continue;
				for (let i = 0; i < layer.length; i++) {
					const f = layer.feature(i);
					const name = f.properties.name;
					if (typeof name !== 'string' || f.type !== 3) continue; // 3 = polygon
					seen.add(name);
					const e = layer.extent;
					polys.push({
						name,
						rings: f.loadGeometry().map((ring) => ring.map((p) => [tx * e + p.x, ty * e + p.y]))
					});
				}
			}
		}
		if ([...names].every((n) => seen.has(n))) return polys;
		if (z === h.maxZoom) {
			const missing = [...names].filter((n) => !seen.has(n));
			throw new Error(`${tilesFile}: targets missing from every zoom: ${missing.join(', ')}`);
		}
	}
	throw new Error(`${tilesFile}: no usable zoom level`);
}

/** Adjacency of polygon targets, from the committed tiles. Keyed by target name. */
export async function polygonAdjacency(tilesFile: string, names: string[]): Promise<Adjacency> {
	const adj: Adjacency = new Map(names.map((n) => [n, new Set<string>()]));
	const polys = await decodeTargets(tilesFile, new Set(names));

	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; // prettier-ignore
	for (const p of polys)
		for (const ring of p.rings)
			for (const [x, y] of ring) {
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
	const cell = Math.max(maxX - minX, maxY - minY) / GRID_CELLS;
	const w = Math.ceil((maxX - minX) / cell) + 1;
	const hgt = Math.ceil((maxY - minY) / cell) + 1;
	const owner = new Int32Array(w * hgt).fill(-1);
	const index = new Map(names.map((n, i) => [n, i]));

	// Even-odd scanline fill of every ring of a feature (holes come out right).
	for (const p of polys) {
		const id = index.get(p.name);
		if (id === undefined) continue;
		for (let row = 0; row < hgt; row++) {
			const y = minY + (row + 0.5) * cell;
			const xs: number[] = [];
			for (const ring of p.rings) {
				for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
					const [xi, yi] = ring[i];
					const [xj, yj] = ring[j];
					if (yi > y !== yj > y) xs.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
				}
			}
			xs.sort((a, b) => a - b);
			for (let k = 0; k + 1 < xs.length; k += 2) {
				const c0 = Math.max(0, Math.ceil((xs[k] - minX) / cell - 0.5));
				const c1 = Math.min(w - 1, Math.floor((xs[k + 1] - minX) / cell - 0.5));
				for (let c = c0; c <= c1; c++) owner[row * w + c] = id;
			}
		}
	}

	const r = ADJACENCY_RADIUS_CELLS;
	for (let row = 0; row < hgt; row++) {
		for (let c = 0; c < w; c++) {
			const a = owner[row * w + c];
			if (a < 0) continue;
			for (let dr = 0; dr <= r; dr++) {
				for (let dc = -r; dc <= r; dc++) {
					if (dr === 0 && dc <= 0) continue;
					const rr = row + dr;
					const cc = c + dc;
					if (rr >= hgt || cc < 0 || cc >= w) continue;
					const b = owner[rr * w + cc];
					if (b >= 0 && b !== a) addEdge(adj, names[a], names[b]);
				}
			}
		}
	}
	return adj;
}

/** k-nearest-neighbour adjacency for point targets, in Web Mercator (the
 * screen's own geometry at any zoom). Keyed by target name. */
export function pointAdjacency(targets: { name: string; centroid: [number, number] }[]): Adjacency {
	const adj: Adjacency = new Map(targets.map((t) => [t.name, new Set<string>()]));
	const xy = targets.map((t) => lonLatToTile(t.centroid[0], t.centroid[1], 0));
	targets.forEach((t, i) => {
		const nearest = targets
			.map((u, j) => ({ name: u.name, d: Math.hypot(xy[i][0] - xy[j][0], xy[i][1] - xy[j][1]) }))
			.filter((_, j) => j !== i)
			.sort((a, b) => a.d - b.d || a.name.localeCompare(b.name))
			.slice(0, POINT_NEIGHBOURS);
		for (const n of nearest) addEdge(adj, t.name, n.name);
	});
	return adj;
}

/**
 * Proper colouring with at most `paletteSize` colours. Smallest-last ordering
 * (repeatedly peel off a minimum-degree vertex, colour in reverse) needs at
 * most degeneracy + 1 colours - at most 6 for any planar graph, i.e. any real
 * map of polygons. Among the colours still free for a vertex it picks the one
 * used least so far, so all colours get used evenly instead of piling onto 0-3.
 * Deterministic: ties break by name.
 */
export function colourGraph(adj: Adjacency, paletteSize = PALETTE_SIZE): Map<string, number> {
	const degree = new Map([...adj].map(([n, s]) => [n, s.size]));
	const removed = new Set<string>();
	const order: string[] = [];
	while (order.length < adj.size) {
		let pick: string | undefined;
		for (const [n, d] of degree) {
			if (removed.has(n)) continue;
			if (pick === undefined || d < degree.get(pick)! || (d === degree.get(pick)! && n < pick))
				pick = n;
		}
		removed.add(pick!);
		order.push(pick!);
		for (const nb of adj.get(pick!)!) if (!removed.has(nb)) degree.set(nb, degree.get(nb)! - 1);
	}
	const colour = new Map<string, number>();
	const used = new Array<number>(paletteSize).fill(0);
	for (const n of order.reverse()) {
		const taken = new Set(
			[...adj.get(n)!].map((nb) => colour.get(nb)).filter((c) => c !== undefined)
		);
		let best = -1;
		for (let c = 0; c < paletteSize; c++) {
			if (taken.has(c)) continue;
			if (best === -1 || used[c] < used[best]) best = c;
		}
		if (best === -1) throw new Error(`cannot colour "${n}" with ${paletteSize} colours`);
		colour.set(n, best);
		used[best]++;
	}
	return colour;
}

/** Same-colour adjacent pairs - must be empty for a valid colouring. */
export function colourConflicts(
	adj: Adjacency,
	colourOf: (name: string) => number | undefined
): string[] {
	const out: string[] = [];
	for (const [a, nbs] of adj)
		for (const b of nbs) if (a < b && colourOf(a) === colourOf(b)) out.push(`${a} / ${b}`);
	return out;
}

export async function adjacencyForMapDir(mapDir: string): Promise<Adjacency> {
	const map = JSON.parse(readFileSync(path.join(mapDir, 'map.json'), 'utf8')) as MapJson;
	const isPoint = map.targets.every((t) => t.type === 'city');
	return isPoint
		? pointAdjacency(map.targets)
		: polygonAdjacency(
				path.join(mapDir, 'tiles.pmtiles'),
				map.targets.map((t) => t.name)
			);
}

/** Computes and writes `colorIndex` on every target of `<mapDir>/map.json`.
 * Called at the end of build-map.ts / build-points-map.ts, and for every
 * committed map by `npm run build-map-colors`. Only adds/updates colorIndex -
 * the file is otherwise byte-identical. */
export async function colorizeMapDir(mapDir: string): Promise<{ id: string; colours: number }> {
	const file = path.join(mapDir, 'map.json');
	const map = JSON.parse(readFileSync(file, 'utf8')) as MapJson;
	const colours = colourGraph(await adjacencyForMapDir(mapDir));
	for (const t of map.targets) t.colorIndex = colours.get(t.name)!;
	writeFileSync(file, JSON.stringify(map, null, '\t') + '\n');
	return { id: map.id, colours: new Set(colours.values()).size };
}
