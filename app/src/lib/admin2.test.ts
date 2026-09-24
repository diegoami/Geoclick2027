// Germany's districts and Poland's powiats as a player names them (#39). Imported from
// data/scripts the way placeSelection.test.ts does.
import { describe, expect, it } from 'vitest';
import { germanDistrictName, NAME_CLEANERS, polishCountyName } from '../../../data/scripts/admin2';

describe('germanDistrictName', () => {
	it('calls a city that is its own district by the city', () => {
		expect(germanDistrictName('Stuttgart, Stadtkreis')).toBe('Stuttgart');
		expect(germanDistrictName('München, Kreisfreie Stadt')).toBe('München');
	});

	it('keeps a Landkreis apart from the city it is named after', () => {
		expect(germanDistrictName('Heilbronn, Landkreis')).toBe('Landkreis Heilbronn');
		expect(germanDistrictName('Heilbronn, Stadtkreis')).toBe('Heilbronn');
	});

	it('leaves a district with a name of its own alone', () => {
		expect(germanDistrictName('Rems-Murr-Kreis')).toBe('Rems-Murr-Kreis');
		expect(germanDistrictName('Landkreis Rostock')).toBe('Landkreis Rostock');
		expect(germanDistrictName('St. Wendel')).toBe('St. Wendel');
		expect(germanDistrictName('Lindau (Bodensee)')).toBe('Lindau (Bodensee)');
	});

	it('drops the register’s country qualifier', () => {
		expect(germanDistrictName('Friesland (DE)')).toBe('Friesland');
	});

	it('spells out the register’s abbreviations, suffix or not', () => {
		expect(germanDistrictName('Neumarkt i.d. OPf.')).toBe('Neumarkt in der Oberpfalz');
		expect(germanDistrictName('Weiden i.d. Opf, Kreisfreie Stadt')).toBe('Weiden in der Oberpfalz');
		expect(germanDistrictName('Mühldorf a. Inn')).toBe('Mühldorf am Inn');
	});

	it('is the cleaner --clean-names=german-districts picks', () => {
		expect(NAME_CLEANERS['german-districts']).toBe(germanDistrictName);
	});
});

describe('polishCountyName', () => {
	it('keeps a powiat OpenStreetMap already names in Polish', () => {
		expect(polishCountyName('powiat oleski')).toBe('powiat oleski');
		expect(polishCountyName('Rybnik')).toBe('Rybnik');
	});

	it('gives the powiats named in English after their seat their Polish names', () => {
		expect(polishCountyName('Siedlce County')).toBe('powiat siedlecki');
		expect(polishCountyName('Colberg County')).toBe('powiat kołobrzeski');
		expect(polishCountyName('Tarnowskie Góry County')).toBe('powiat tarnogórski');
	});

	it('gives Kraków back its accent', () => {
		expect(polishCountyName('Krakow')).toBe('Kraków');
	});

	it('is the cleaner --clean-names=polish-counties picks', () => {
		expect(NAME_CLEANERS['polish-counties']).toBe(polishCountyName);
	});
});
