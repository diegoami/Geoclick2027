// The pure decisions behind the maps of several countries (#39). Imported
// from data/scripts the way placeSelection.test.ts does - the builders need
// a toolchain, these parts don't.
import { describe, expect, it } from 'vitest';
import {
	capPerCountry,
	localNameField,
	parseList,
	polygonAreaKm2,
	sqlIn,
	sqlString
} from '../../../data/scripts/multiCountry';

/** A lon/lat box as a closed GeoJSON ring. */
const box = (w: number, s: number, e: number, n: number) => [
	[w, s],
	[e, s],
	[e, n],
	[w, n],
	[w, s]
];

describe('polygonAreaKm2', () => {
	it('measures a one-degree cell at the equator', () => {
		// 111.2 km x 110.6 km on the sphere.
		const area = polygonAreaKm2({ type: 'Polygon', coordinates: [box(0, 0, 1, 1)] });
		expect(area).toBeGreaterThan(12_300);
		expect(area).toBeLessThan(12_400);
	});

	it('shrinks the same cell towards the pole', () => {
		const equator = polygonAreaKm2({ type: 'Polygon', coordinates: [box(0, 0, 1, 1)] });
		const north = polygonAreaKm2({ type: 'Polygon', coordinates: [box(0, 60, 1, 61)] });
		// cos(60.5°) ≈ 0.49
		expect(north / equator).toBeCloseTo(0.49, 1);
	});

	it('does not care which way a ring winds', () => {
		const ring = box(10, 40, 12, 42);
		const reversed = [...ring].reverse();
		expect(polygonAreaKm2({ type: 'Polygon', coordinates: [ring] })).toBeCloseTo(
			polygonAreaKm2({ type: 'Polygon', coordinates: [reversed] }),
			6
		);
	});

	it('subtracts holes and adds the parts of a MultiPolygon', () => {
		const outer = polygonAreaKm2({ type: 'Polygon', coordinates: [box(0, 0, 2, 2)] });
		const hole = polygonAreaKm2({ type: 'Polygon', coordinates: [box(0.5, 0.5, 1.5, 1.5)] });
		const holed = polygonAreaKm2({
			type: 'Polygon',
			coordinates: [box(0, 0, 2, 2), box(0.5, 0.5, 1.5, 1.5)]
		});
		expect(holed).toBeCloseTo(outer - hole, 6);
		const two = polygonAreaKm2({
			type: 'MultiPolygon',
			coordinates: [[box(0, 0, 1, 1)], [box(5, 0, 6, 1)]]
		});
		expect(two).toBeCloseTo(
			2 * polygonAreaKm2({ type: 'Polygon', coordinates: [box(0, 0, 1, 1)] }),
			6
		);
	});

	it('gives nothing for a geometry that has no area', () => {
		expect(polygonAreaKm2({ type: 'Point', coordinates: [0, 0] })).toBe(0);
	});
});

describe('capPerCountry', () => {
	const places = [
		{ name: 'Moscow', country: 'Russia' },
		{ name: 'Saint Petersburg', country: 'Russia' },
		{ name: 'Kyiv', country: 'Ukraine' },
		{ name: 'Nizhny Novgorod', country: 'Russia' },
		{ name: 'Kharkiv', country: 'Ukraine' }
	];

	it('keeps the first N of each country, in the order given', () => {
		expect(capPerCountry(places, (p) => p.country, 1).map((p) => p.name)).toEqual([
			'Moscow',
			'Kyiv'
		]);
		expect(capPerCountry(places, (p) => p.country, 2).map((p) => p.name)).toEqual([
			'Moscow',
			'Saint Petersburg',
			'Kyiv',
			'Kharkiv'
		]);
	});

	it('is a no-op without a cap', () => {
		expect(capPerCountry(places, (p) => p.country, Infinity)).toBe(places);
	});
});

describe('localNameField', () => {
	it("reads the field the country's own Towns map reads", () => {
		expect(localNameField('Germany')).toBe('NAME_DE');
		expect(localNameField('Italy')).toBe('NAME_IT');
		expect(localNameField('United Kingdom')).toBe('NAME_EN');
	});

	it('falls back to NAME, including for the bilingual countries', () => {
		// One language field would put Antwerpen in French or Genève in German.
		expect(localNameField('Belgium')).toBe('NAME');
		expect(localNameField('Switzerland')).toBe('NAME');
		expect(localNameField('Czechia')).toBe('NAME');
	});
});

describe('flag and SQL helpers', () => {
	it('parses a comma list, ignoring blanks and spaces', () => {
		expect(parseList(' France, Belgium ,,Netherlands ')).toEqual([
			'France',
			'Belgium',
			'Netherlands'
		]);
		expect(parseList(undefined)).toEqual([]);
	});

	it('quotes values for OGR SQL, doubling any quote inside', () => {
		expect(sqlString("Côte d'Ivoire")).toBe("'Côte d''Ivoire'");
		expect(sqlIn('ADMIN', ['Chad', "Côte d'Ivoire"])).toBe("ADMIN IN ('Chad','Côte d''Ivoire')");
	});
});
