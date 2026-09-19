// The Terrain layer's pure build decisions (FT-33, docs/PLAN_V0.8.md):
// how far out the physical data is clipped, how far in its tiles are worth
// building, and which named features become labels. Imported from
// data/scripts the same way placeSelection.test.ts does - the build script
// itself needs ogr2ogr and tippecanoe, these parts don't.
import { describe, expect, it } from 'vitest';
import {
	boxCentre,
	labelPointsFrom,
	padBbox,
	terrainMaxZoom,
	type NamedFeature
} from '../../../data/scripts/mapBuildUtils';

const polygon = (
	name: string,
	ring: [number, number][],
	extra: Record<string, string | number | null> = {}
): NamedFeature => ({
	properties: { name, ...extra },
	geometry: { coordinates: [ring] }
});

describe('padBbox', () => {
	it('grows a box by a quarter of its own span, so the sea reaches the screen edge', () => {
		// The app fits to the targets and then pads that fit in pixels
		// (mapFit.ts), so the visible area is always wider than the targets.
		expect(padBbox([0, 0, 10, 20])).toEqual([-2.5, -5, 12.5, 25]);
	});

	it('keeps a floor, so a tiny map still gets usable surroundings', () => {
		// A quarter of nothing is nothing: Vatican-scale extents would come
		// back with no margin at all.
		expect(padBbox([10, 40, 10.4, 40.4])).toEqual([9.5, 39.5, 10.9, 40.9]);
	});

	it('takes a fraction, for the tighter box the labels use', () => {
		expect(padBbox([0, 0, 100, 40], 0.05)).toEqual([-5, -2, 105, 42]);
	});

	it('never leaves the world', () => {
		expect(padBbox([-175, -85, 175, 85])).toEqual([-180, -90, 180, 90]);
	});
});

describe('terrainMaxZoom', () => {
	// The cost of this layer is driven by extent, not detail: Russia is
	// 850 KB at zoom 6 and 385 KB at zoom 4. A map opens at roughly
	// log2(360 / span) - the whole country in view - and gets three levels
	// of headroom above that.
	it('gives a small country the full detail', () => {
		// The Netherlands, about 3 degrees across: opens at ~z7, clamped to 6.
		expect(terrainMaxZoom([3.3, 50.7, 7.2, 53.6])).toBe(6);
	});

	it('gives Italy the full detail too', () => {
		expect(terrainMaxZoom([3.6, 32.6, 21.5, 50.0])).toBe(6);
	});

	it('spends fewer levels on a country that opens zoomed far out', () => {
		// Russia, about 130 degrees of usable span: opens at ~z1.5.
		expect(terrainMaxZoom([19, 41, 150, 78])).toBe(4);
	});

	it('never goes below 4, however wide the map', () => {
		expect(terrainMaxZoom([-180, -90, 180, 90])).toBe(4);
	});
});

describe('boxCentre', () => {
	it('is the middle of the shape, not of its first point', () => {
		expect(
			boxCentre({
				coordinates: [
					[
						[10, 40],
						[12, 40],
						[12, 44],
						[10, 44]
					]
				]
			})
		).toEqual([11, 42]);
	});

	it('rounds, so an unchanged map rebuilds to an identical file', () => {
		expect(
			boxCentre({
				coordinates: [
					[
						[10.123456, 40.111111],
						[10.234567, 40.222222]
					]
				]
			})
		).toEqual([10.179, 40.1667]);
	});
});

describe('labelPointsFrom', () => {
	const alps = polygon(
		'ALPS',
		[
			[6, 44],
			[14, 44],
			[14, 48],
			[6, 48]
		],
		{ name_de: 'Alpen', name_it: 'Alpi', kind: 'Range/mtn', rank: 1 }
	);
	// Real case: Italy's clipped box reaches Algeria, and labelling the
	// Atlas Saharien on a map of Italian regions helps nobody.
	const atlas = polygon(
		'ATLAS SAHARIEN',
		[
			[4, 33],
			[8, 33],
			[8, 34],
			[4, 34]
		],
		{ kind: 'Range/mtn', rank: 4 }
	);
	const italy: [number, number, number, number] = [6.6, 35.5, 18.5, 47.1];

	it('keeps a feature whose middle is within reach of the targets', () => {
		const points = labelPointsFrom([{ features: [alps] }], italy);
		expect(points.map((p) => p.properties.name)).toEqual(['ALPS']);
		expect(points[0].geometry.coordinates).toEqual([10, 46]);
	});

	it('drops one that is only there because the sea had to be padded out', () => {
		expect(labelPointsFrom([{ features: [atlas] }], italy)).toEqual([]);
	});

	it('carries the German and Italian names through', () => {
		const [point] = labelPointsFrom([{ features: [alps] }], italy);
		expect(point.properties.name_de).toBe('Alpen');
		expect(point.properties.name_it).toBe('Alpi');
	});

	it('carries the rank, which decides who wins a collision', () => {
		const [point] = labelPointsFrom([{ features: [alps] }], italy);
		expect(point.properties.rank).toBe(1);
	});

	it('leaves the missing translations null rather than undefined', () => {
		// JSON.stringify drops an undefined property entirely, which would
		// make the file depend on which fields the source happened to have.
		const [point] = labelPointsFrom([{ features: [atlas] }], [0, 0, 90, 90]);
		expect(point.properties).toHaveProperty('name_de', null);
		expect(point.properties).toHaveProperty('name_it', null);
	});

	it('ignores an unnamed feature', () => {
		const unnamed = { properties: { name: '' }, geometry: { coordinates: [[[10, 40]]] } };
		expect(labelPointsFrom([{ features: [unnamed] }], [0, 0, 90, 90])).toEqual([]);
	});

	it('merges the land and sea files into one sorted list', () => {
		const adriatic = polygon('Adriatic Sea', [
			[13, 42],
			[16, 42],
			[16, 44],
			[13, 44]
		]);
		const names = labelPointsFrom([{ features: [alps] }, { features: [adriatic] }], italy).map(
			(p) => p.properties.name
		);
		expect(names).toEqual(['Adriatic Sea', 'ALPS']);
	});
});
