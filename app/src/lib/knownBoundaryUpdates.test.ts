import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pointInPolygon, type AnyGeometry } from '../../../data/scripts/factGeometry';
type Feature = { properties: { name: string }; geometry: AnyGeometry };
const collection = (file: string) =>
	JSON.parse(
		readFileSync(new URL('../../../data/boundaries/' + file, import.meta.url), 'utf8')
	) as { features: Feature[] };
const map = (id: string) =>
	JSON.parse(
		readFileSync(new URL('../../../data/maps/' + id + '/map.json', import.meta.url), 'utf8')
	) as { targets: { id: string; name: string }[] };
describe('approved known boundary corrections', () => {
	it('separates Hanau and Leipzig city from their rural neighbours', () => {
		const data = collection('germany-districts-2026.geojson');
		expect(data.features).toHaveLength(401);
		const at = (name: string, point: [number, number]) =>
			pointInPolygon(point, data.features.find((f) => f.properties.name === name)!.geometry);
		expect(at('Hanau', [8.917, 50.132])).toBe(true);
		expect(at('Main-Kinzig-Kreis', [8.917, 50.132])).toBe(false);
		expect(at('Leipzig', [12.3731, 51.3397])).toBe(true);
		expect(at('Landkreis Leipzig', [12.3731, 51.3397])).toBe(false);
		expect(at('Landkreis Leipzig', [12.805, 51.128])).toBe(true);
		expect(at('Leipzig', [12.805, 51.128])).toBe(false);
		expect(data.features.some((f) => f.properties.name === 'Eisenach')).toBe(false);
		expect(map('germany-districts-center').targets.map((t) => t.id)).toContain('hanau');
		const east = map('germany-districts-east').targets.map((t) => t.id);
		expect(east).toEqual(expect.arrayContaining(['leipzig', 'landkreis-leipzig', 'wartburgkreis']));
		expect(east).not.toContain('eisenach');
	});
	it('teaches Voorne aan Zee in place of its three predecessor municipalities', () => {
		const data = collection('netherlands-municipalities-2026.geojson');
		expect(data.features).toHaveLength(342);
		const merged = data.features.find((f) => f.properties.name === 'Voorne aan Zee')!;
		for (const p of [
			[4.163, 51.902],
			[4.129, 51.833],
			[4.066, 51.913]
		] as [number, number][])
			expect(pointInPolygon(p, merged.geometry)).toBe(true);
		const ids = map('netherlands-municipalities-southwest').targets.map((t) => t.id);
		expect(ids).toContain('voorne-aan-zee');
		for (const retired of ['brielle', 'hellevoetsluis', 'westvoorne'])
			expect(ids).not.toContain(retired);
	});
});
