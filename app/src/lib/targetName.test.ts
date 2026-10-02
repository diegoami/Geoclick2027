// Place names in the chosen language (#71, FT-81): the helper every view
// reads a shown name through, the rules the builders apply, and what the
// shipped maps carry.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_MAPS_DIR, listMapIds } from '../../../data/scripts/build-map-index';
import { countryNames, otherNames, townNames } from '../../../data/scripts/multiCountry';
import { setLanguage } from './i18n.svelte';
import type { MapDefinition } from './mapDefinition';
import { targetName } from './targetName';

const readMap = (id: string): MapDefinition =>
	JSON.parse(readFileSync(path.join(DEFAULT_MAPS_DIR, id, 'map.json'), 'utf-8'));

const CONTINENTS = ['europe', 'africa', 'asia', 'north-america', 'south-america', 'oceania'];
const EUROPE_PARTS = ['west', 'central', 'east', 'north', 'south'];
// The maps of several countries: the only ones whose places change name.
const NAMED_MAPS = new Set([
	...CONTINENTS.flatMap((c) => [`${c}-countries`, `${c}-capitals`]),
	...EUROPE_PARTS.map((p) => `europe-cities-${p}`),
	// Their label drops the "powiat " their name keeps for the tiles (#182).
	...['east', 'north', 'south', 'southeast', 'west'].map((p) => `poland-counties-${p}`)
]);

describe('targetName', () => {
	afterEach(() => setLanguage('en'));
	const france = { name: 'France', names: { it: 'Francia', de: 'Frankreich' } };

	it("gives the name in the language asked for, and `name` where there's none", () => {
		expect(targetName(france, 'it')).toBe('Francia');
		expect(targetName(france, 'de')).toBe('Frankreich');
		expect(targetName(france, 'en')).toBe('France');
		expect(targetName({ name: 'Bayern' }, 'it')).toBe('Bayern');
	});

	it('follows the chosen language by default', () => {
		setLanguage('it');
		expect(targetName(france)).toBe('Francia');
	});
});

describe('the names the builders write', () => {
	it('keeps only a name that differs, and drops empty ones', () => {
		expect(otherNames('Wien', { en: 'Vienna', it: 'Vienna', de: 'Wien' })).toEqual({
			en: 'Vienna',
			it: 'Vienna'
		});
		expect(otherNames('Oslo', { en: '', it: ' ', de: null })).toEqual({});
	});

	it('gives a country the short name it asks for, in every language', () => {
		expect(countryNames('Czechia', 'Repubblica Ceca', 'Tschechien')).toEqual({
			it: 'Cechia',
			de: 'Tschechien'
		});
		expect(countryNames("Côte d'Ivoire", "Costa d'Avorio", 'Elfenbeinküste')).toEqual({});
		expect(countryNames('United States', "Stati Uniti d'America", 'Vereinigte Staaten')).toEqual({
			it: 'Stati Uniti',
			de: 'Vereinigte Staaten'
		});
	});

	it('leaves out the town names that are not shown', () => {
		expect(townNames('Astana', { en: 'Nur-Sultan', it: 'Nur-Sultan', de: 'Nur-Sultan' })).toEqual(
			{}
		);
		expect(townNames('Donetsk', { it: "Donec'k", de: 'Donezk' })).toEqual({ de: 'Donezk' });
	});
});

describe('the names the maps carry', () => {
	const mapIds = listMapIds();

	it.each(mapIds)('%s: names only where a map spans several countries', (id) => {
		const named = readMap(id).targets.filter((t) => t.names);
		if (!NAMED_MAPS.has(id)) {
			expect(named.map((t) => t.id)).toEqual([]);
			return;
		}
		// Oceania's capitals are called the same in all three languages.
		expect(named.length).toBeGreaterThanOrEqual(0);
		for (const target of named) {
			for (const [language, value] of Object.entries(target.names!)) {
				expect(['en', 'it', 'de'], target.id).toContain(language);
				expect(value.trim(), target.id).not.toBe('');
				expect(value, target.id).not.toBe(target.name);
			}
		}
	});

	it.each([...NAMED_MAPS])('%s: no two places read the same in any language', (id) => {
		const { targets } = readMap(id);
		for (const language of ['en', 'it', 'de'] as const) {
			const shown = targets.map((t) => targetName(t, language));
			expect(new Set(shown).size, language).toBe(shown.length);
		}
	});

	it('every country has its Italian and German names', () => {
		const countries = CONTINENTS.flatMap((c) => readMap(`${c}-countries`).targets);
		const byId = new Map(countries.map((t) => [t.id, t]));
		expect(targetName(byId.get('france')!, 'it')).toBe('Francia');
		expect(targetName(byId.get('germany')!, 'de')).toBe('Deutschland');
		expect(targetName(byId.get('czechia')!, 'it')).toBe('Cechia');
		expect(targetName(byId.get('united-kingdom')!, 'it')).toBe('Regno Unito');
		expect(targetName(byId.get('cote-d-ivoire')!, 'it')).toBe("Côte d'Ivoire");
	});

	it('the world picker names each country as its Countries map does', () => {
		const picker: { countries: { id: string; names?: Record<string, string> }[] } = JSON.parse(
			readFileSync(path.join(DEFAULT_MAPS_DIR, 'world-picker', 'picker.json'), 'utf-8')
		);
		const countries = new Map(
			CONTINENTS.flatMap((c) => readMap(`${c}-countries`).targets).map((t) => [t.id, t])
		);
		for (const country of picker.countries) {
			expect(country.names, country.id).toEqual(countries.get(country.id)?.names);
		}
	});
});
