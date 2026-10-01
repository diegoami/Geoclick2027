// Adjacency-aware map colours (GC-032). The committed colorIndex values are
// checked against adjacency recomputed from the committed tiles - so a map
// rebuilt without re-running `npm run build-map-colors` fails here instead of
// quietly shipping same-coloured neighbours.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPS_DIR, listMapIds } from '../../../data/scripts/build-map-index';
import {
	PALETTE_SIZE,
	adjacencyForMapDir,
	colourConflicts,
	colourGraph,
	pointAdjacency,
	type Adjacency
} from '../../../data/scripts/mapColors';
import { CITY_CONTEXT_FILL, CITY_CONTEXT_OUTLINE, styleForMapFamily } from './mapFamilyStyle';
import type { StyleSpecification } from 'maplibre-gl';

interface TargetLike {
	name: string;
	colorIndex?: unknown;
}
const loadTargets = (id: string): TargetLike[] =>
	JSON.parse(readFileSync(path.join(DEFAULT_MAPS_DIR, id, 'map.json'), 'utf8')).targets;

const graph = (edges: [string, string][], extra: string[] = []): Adjacency => {
	const adj: Adjacency = new Map();
	for (const n of [...edges.flat(), ...extra]) if (!adj.has(n)) adj.set(n, new Set());
	for (const [a, b] of edges) {
		adj.get(a)!.add(b);
		adj.get(b)!.add(a);
	}
	return adj;
};

describe('committed map colours', () => {
	const mapIds = listMapIds();

	it.each(mapIds)('%s: every target has a colorIndex slot in the palette', (id) => {
		const bad = loadTargets(id).filter(
			(t) =>
				!Number.isInteger(t.colorIndex) ||
				(t.colorIndex as number) < 0 ||
				(t.colorIndex as number) >= PALETTE_SIZE
		);
		expect(bad.map((t) => t.name)).toEqual([]);
	});

	it.each(mapIds)('%s: no two adjacent targets share a colour', async (id) => {
		const colourOf = new Map(loadTargets(id).map((t) => [t.name, t.colorIndex as number]));
		const adj = await adjacencyForMapDir(path.join(DEFAULT_MAPS_DIR, id));
		expect(colourConflicts(adj, (n) => colourOf.get(n))).toEqual([]);
	});

	// The conflict check above is only meaningful if adjacency really finds
	// neighbours - these are borders anyone can check on an atlas.
	it.each([
		[
			'italy-provinces',
			[
				['Bergamo', 'Brescia'],
				['Bolzano', 'Belluno'],
				['Roma', 'Latina'],
				['Palermo', 'Trapani']
			]
		],
		[
			'usa-states',
			[
				['North Dakota', 'South Dakota'],
				['Texas', 'Oklahoma'],
				['Maryland', 'District of Columbia']
			]
		],
		[
			'japan-regions',
			[
				['Tokyo', 'Kanagawa'],
				['Kyōto', 'Ōsaka'],
				['Fukuoka', 'Saga']
			]
		],
		[
			'china-regions',
			[
				['Beijing', 'Hebei'],
				['Tianjin', 'Hebei'],
				['Sichuan', 'Chongqing']
			]
		],
		[
			'great-britain-regions',
			[
				['Greater London', 'East'],
				['East Wales', 'West Wales and the Valleys'],
				['North West', 'Yorkshire and the Humber']
			]
		]
	] as [string, [string, string][]][])('%s: adjacency finds real borders', async (id, pairs) => {
		const adj = await adjacencyForMapDir(path.join(DEFAULT_MAPS_DIR, id));
		for (const [a, b] of pairs) expect(adj.get(a)?.has(b), `${a} / ${b}`).toBe(true);
		// ...and not everything: far-apart targets stay unconnected.
		const names = [...adj.keys()];
		const edges = names.reduce((sum, n) => sum + adj.get(n)!.size, 0) / 2;
		expect(edges).toBeLessThan((names.length * (names.length - 1)) / 4);
	});

	it('the style has one colour per palette slot', () => {
		const style = JSON.parse(
			readFileSync(path.join(DEFAULT_MAPS_DIR, '..', 'styles', 'base.json'), 'utf8')
		);
		const expectedPalette = ['#5b9fc8', '#8b86d4', '#b87dc4', '#de7fa6', '#e58a73', '#97a3b2'];
		for (const layerId of ['targets-fill', 'targets-circle']) {
			const layer = style.layers.find((l: { id: string }) => l.id === layerId);
			const colour = layer.paint[layerId === 'targets-fill' ? 'fill-color' : 'circle-color'];
			const match = colour[colour.length - 1]; // the case's fallback branch
			expect(match[0]).toBe('match');
			expect(match[1]).toEqual(['coalesce', ['feature-state', 'colorIndex'], -1]);
			const slots = match.slice(2, -1).filter((_: unknown, i: number) => i % 2 === 0);
			expect(slots).toEqual([...Array(PALETTE_SIZE).keys()]);
			const colours = match.slice(2, -1).filter((_: unknown, i: number) => i % 2 === 1);
			expect(colours).toEqual(expectedPalette);
		}
	});

	it('gives towns maps distinct sea, land, and admin-border colors', () => {
		const style = JSON.parse(
			readFileSync(path.join(DEFAULT_MAPS_DIR, '..', 'styles', 'base.json'), 'utf8')
		);
		const layer = (id: string) => style.layers.find((l: { id: string }) => l.id === id);
		expect(layer('background').paint['background-color']).toBe('#d3e5eb');
		expect(layer('context-fill').paint['fill-color']).toBe('#f2eddf');
		expect(layer('context-fill').paint['fill-opacity']).toBe(1);
		expect(layer('context-outline').paint['line-color']).toBe('#81958d');
		expect(layer('context-outline').paint['line-width']).toBe(0.8);
		expect(layer('land-fill').paint['fill-color']).toBe('#e2ddd1');
		expect(layer('land-outline').paint['line-color']).toBe('#a5a094');
		expect(layer('targets-fill').paint['fill-opacity']).toContain(1);
	});

	it('uses a brighter mapped-country context only for city maps, leaving sea and surrounding land alone', () => {
		const base = JSON.parse(
			readFileSync(path.join(DEFAULT_MAPS_DIR, '..', 'styles', 'base.json'), 'utf8')
		) as StyleSpecification;
		const city = styleForMapFamily(base, { targets: [{ type: 'city' }] });
		const cityLayer = (id: string) =>
			city.layers.find((l) => l.id === id) as { paint: Record<string, unknown> };
		expect(cityLayer('context-fill').paint['fill-color']).toBe(CITY_CONTEXT_FILL);
		expect(cityLayer('context-outline').paint['line-color']).toBe(CITY_CONTEXT_OUTLINE);
		expect(cityLayer('land-fill').paint['fill-color']).toBe('#e2ddd1');
		expect(city.layers.find((l) => l.id === 'background')).toEqual(
			base.layers.find((l) => l.id === 'background')
		);
		expect(styleForMapFamily(base, { targets: [{ type: 'province' }] })).toBe(base);
		expect(styleForMapFamily(base, { targets: [{ type: 'city' }, { type: 'province' }] })).toBe(
			base
		);
		expect(styleForMapFamily(base, { targets: [] })).toBe(base);
	});
});

describe('colourGraph', () => {
	it('colours a planar worst case - a wheel with an odd rim needs 4 colours', () => {
		const rim = ['a', 'b', 'c', 'd', 'e'];
		const adj = graph([
			...rim.map((r, i): [string, string] => [r, rim[(i + 1) % rim.length]]),
			...rim.map((r): [string, string] => ['hub', r])
		]);
		const colours = colourGraph(adj);
		expect(colourConflicts(adj, (n) => colours.get(n))).toEqual([]);
		expect(new Set(colours.values()).size).toBeGreaterThanOrEqual(4);
	});

	it('spreads colours evenly instead of piling onto the first slots', () => {
		const isolated = [...'abcdefghijkl'];
		const colours = colourGraph(graph([], isolated));
		const counts = [...Array(PALETTE_SIZE).keys()].map(
			(c) => [...colours.values()].filter((v) => v === c).length
		);
		expect(counts).toEqual(Array(PALETTE_SIZE).fill(isolated.length / PALETTE_SIZE));
	});

	it('is deterministic', () => {
		const adj = graph([
			['a', 'b'],
			['b', 'c'],
			['c', 'a'],
			['c', 'd']
		]);
		expect([...colourGraph(adj)]).toEqual([...colourGraph(adj)]);
	});

	it('throws rather than emit a clash when the palette is too small', () => {
		const k4 = graph([
			['a', 'b'],
			['a', 'c'],
			['a', 'd'],
			['b', 'c'],
			['b', 'd'],
			['c', 'd']
		]);
		expect(() => colourGraph(k4, 3)).toThrow(/cannot colour/);
	});
});

describe('colourConflicts and pointAdjacency', () => {
	it('reports a same-coloured adjacent pair once', () => {
		const adj = graph([
			['a', 'b'],
			['b', 'c']
		]);
		const colours: Record<string, number> = { a: 0, b: 1, c: 1 };
		expect(colourConflicts(adj, (n) => colours[n])).toEqual(['b / c']);
	});

	it('links each point to its nearest neighbours, not distant ones', () => {
		// Two tight clusters of four, far apart.
		const west = [0, 0.1, 0.2, 0.3].map((d, i) => ({
			name: `w${i}`,
			centroid: [d, 0] as [number, number]
		}));
		const east = [0, 0.1, 0.2, 0.3].map((d, i) => ({
			name: `e${i}`,
			centroid: [40 + d, 0] as [number, number]
		}));
		const adj = pointAdjacency([...west, ...east]);
		for (const w of west) expect([...adj.get(w.name)!].every((n) => n.startsWith('w'))).toBe(true);
		expect(adj.get('w0')!.has('w1')).toBe(true);
	});
});
