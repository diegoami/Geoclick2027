import { V1_CURRENT_BOUNDARY_SOURCES } from './v1CurrentBoundarySources.js';
import { slugify } from './mapBuildUtils.js';
export interface Country {
	country: string;
	id: string;
	type: string;
	label: string;
	expectedRegions: number;
	nameField?: string;
	population: number;
	largestCityFacts?: boolean;
	mapId?: string;
	secondAdministrative?: Country;
	clip?: string;
	rename?: string;
	dissolve?: string;
	townSource?: string;
	townSourceCountry?: string;
	townNameField?: string;
	source?: string;
	attribution?: string;
	boundaryFacts?: boolean;
	townExclude?: string;
	retainTowns?: string;
	// Towns map land and terrain cover the whole regions map (--extent=regions).
	townsExtentFromRegions?: boolean;
	expectedLargest?: Record<string, string>;
}
// Natural Earth separates county-right cities; merge them into their counties.
// Budapest remains its own unit. Veszprém city already shares its county name.
const hungarianCounties: Record<string, string> = {
	Sopron: 'Győr-Moson-Sopron',
	Szeged: 'Csongrád-Csanád',
	Salgótarján: 'Nógrád',
	Szolnok: 'Jász-Nagykun-Szolnok',
	Érd: 'Pest',
	Eger: 'Heves',
	Miskolc: 'Borsod-Abaúj-Zemplén',
	Hódmezôvásárhely: 'Csongrád-Csanád',
	Dunaújváros: 'Fejér',
	Kecskemét: 'Bács-Kiskun',
	Tatabánya: 'Komárom-Esztergom',
	Gyôr: 'Győr-Moson-Sopron',
	Szombathely: 'Vas',
	Zalaegerszeg: 'Zala',
	Nagykanizsa: 'Zala',
	Kaposvár: 'Somogy',
	Pécs: 'Baranya',
	Szekszárd: 'Tolna',
	Székesfehérvár: 'Fejér',
	Békéscsaba: 'Békés',
	Debrecen: 'Hajdú-Bihar',
	Nyíregyháza: 'Szabolcs-Szatmár-Bereg',
	'Gyor-Moson-Sopron': 'Győr-Moson-Sopron',
	Csongrád: 'Csongrád-Csanád'
};
const currentSource = (id: string) => {
	const source = V1_CURRENT_BOUNDARY_SOURCES.find((s) => s.id === id);
	if (!source) throw new Error('Missing source specification: ' + id);
	return {
		country: source.country,
		id,
		source: 'data/boundaries/' + source.filename,
		boundaryFacts: true,
		attribution:
			source.provider + '; ' + source.year + '; ' + source.licence + '; ' + source.licenceUrl
	};
};
export const V1_COUNTRIES: Country[] = [
	{
		country: 'Hungary',
		id: 'hungary',
		retainTowns: 'Salgótarján,Vác,Szekszárd',
		expectedLargest: { 'csongrad-csanad': 'Szeged', pest: 'Érd' },
		townSource: 'data/places/hungary.geojson',
		type: 'county',
		label: 'Counties',
		expectedRegions: 20,
		dissolve: 'name',
		rename: Object.entries(hungarianCounties)
			.map(([from, to]) => from + '=' + to)
			.join(','),
		population: 10000
	},
	{
		country: 'Slovakia',
		id: 'slovakia',
		expectedLargest: { trenciansky: 'Trenčín', nitriansky: 'Nitra' },
		// Petržalka is a Bratislava borough, not a separate town (petrzalka.sk).
		townExclude: 'Petržalka',
		townSource: 'data/places/slovakia.geojson',
		rename: 'Prešov=Prešovský,Trenciansky=Trenčiansky',
		type: 'region',
		label: 'Regions',
		expectedRegions: 8,
		population: 10000
	},
	{
		country: 'Estonia',
		id: 'estonia',
		source: 'data/boundaries/estonia-counties-2026-09-02.geojson',
		attribution:
			'Administrative and settlement units: Estonian Land and Spatial Development Board, snapshot 2026-09-02; unrestricted use with attribution',
		boundaryFacts: true,
		expectedLargest: { parnu: 'Pärnu', saare: 'Kuressaare', hiiu: 'Kärdla', jogeva: 'Jõgeva' },
		townSource: 'data/places/estonia.geojson',
		type: 'county',
		label: 'Counties',
		expectedRegions: 15,
		population: 5000
	},
	{
		country: 'Lithuania',
		id: 'lithuania',
		expectedLargest: {
			telsiu: 'Mažeikiai',
			utenos: 'Utena',
			taurages: 'Tauragė',
			marijampoles: 'Marijampolė',
			alytaus: 'Alytus'
		},
		townSource: 'data/places/lithuania.geojson',
		rename:
			'Telšiai=Telšių,Šiauliai=Šiaulių,Panevezio=Panevėžio,Klaipedos=Klaipėdos,Taurages=Tauragės,Marijampoles=Marijampolės',
		type: 'county',
		label: 'Counties',
		expectedRegions: 10,
		population: 10000
	},
	{
		country: 'Iceland',
		id: 'iceland',
		expectedLargest: { [slugify('Höfuðborgarsvæðið')]: 'Reykjavík' },
		dissolve: 'name',
		rename: 'Reykjavík=Höfuðborgarsvæðið,Höfuðborgarsvæði=Höfuðborgarsvæðið',
		type: 'region',
		label: 'Regions',
		expectedRegions: 8,
		population: 1000
	},
	{
		country: 'Costa Rica',
		id: 'costa-rica',
		type: 'province',
		label: 'Provinces',
		expectedRegions: 7,
		nameField: 'name_es',
		population: 1000,
		clip: '-86.1,7.8,-82.3,11.3'
	},
	{
		country: 'United Arab Emirates',
		id: 'united-arab-emirates',
		townSource: 'data/places/united-arab-emirates.geojson',
		type: 'region',
		label: 'Emirates',
		expectedRegions: 7,
		population: 1000,
		source: 'data/boundaries/united-arab-emirates-gb-9469f09.geojson',
		boundaryFacts: true,
		townNameField: 'NAME',
		attribution:
			'geoBoundaries gbOpen 9469f09; OpenStreetMap, Wambacher; 2017; Open Data Commons Open Database License 1.0; https://opendatacommons.org/licenses/odbl/1-0/'
	},
	{
		country: 'Sri Lanka',
		id: 'sri-lanka',
		townSource: 'data/places/sri-lanka.geojson',
		type: 'province',
		label: 'Provinces',
		expectedRegions: 9,
		population: 10000,
		source: 'data/boundaries/sri-lanka-gb-9469f09.geojson',
		boundaryFacts: true,
		townNameField: 'NAME',
		attribution:
			'geoBoundaries gbOpen 9469f09; OpenStreetMap, Wambacher; 2017; Open Data Commons Open Database License 1.0; https://opendatacommons.org/licenses/odbl/1-0/'
	},
	{
		country: 'Uzbekistan',
		id: 'uzbekistan',
		townSource: 'data/places/uzbekistan.geojson',
		type: 'region',
		label: 'Regions',
		expectedRegions: 14,
		population: 10000,
		source: 'data/boundaries/uzbekistan-gb-9469f09.geojson',
		boundaryFacts: true,
		townNameField: 'NAME',
		attribution:
			'geoBoundaries gbOpen 9469f09; OpenStreetMap, Wambacher; 2017; Open Data Commons Open Database License 1.0; https://opendatacommons.org/licenses/odbl/1-0/'
	},
	{
		country: 'Nepal',
		id: 'nepal',
		townSource: 'data/places/nepal.geojson',
		type: 'province',
		label: 'Provinces',
		expectedRegions: 7,
		population: 10000,
		source: 'data/boundaries/nepal-gb-9469f09.geojson',
		boundaryFacts: true,
		townNameField: 'NAME',
		attribution:
			'geoBoundaries gbOpen 9469f09; Survey Department of Nepal, OCHA FISS; 2020; Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO); https://creativecommons.org/licenses/by/3.0/igo/'
	},
	{
		country: 'Taiwan',
		id: 'taiwan',
		type: 'county',
		label: 'Counties and Cities',
		expectedRegions: 22,
		population: 10000,
		source: 'data/boundaries/taiwan-gb-9469f09.geojson',
		boundaryFacts: true,
		townNameField: 'NAME',
		// Owner: exclude the four Taoyuan boroughs, as with Petržalka.
		townExclude: 'Zhongli,Bade,Pingzhen,Yangmei',
		attribution:
			'geoBoundaries gbOpen 9469f09; OpenStreetMap, Wambacher; 2017; Open Data Commons Open Database License 1.0; https://opendatacommons.org/licenses/odbl/1-0/'
	},
	{
		country: 'Uganda',
		id: 'uganda',
		type: 'region',
		label: 'Regions',
		expectedRegions: 4,
		population: 10000,
		source: 'data/boundaries/uganda-gb-9469f09.geojson',
		boundaryFacts: true,
		townNameField: 'NAME',
		attribution:
			'geoBoundaries gbOpen 9469f09; OpenStreetMap, Wambacher; 2017; Open Data Commons Open Database License 1.0; https://opendatacommons.org/licenses/odbl/1-0/'
	},
	{
		country: 'Democratic Republic of the Congo',
		id: 'congo-kinshasa',
		expectedLargest: { tanganyika: 'Kalemie' },
		type: 'province',
		label: 'Provinces',
		expectedRegions: 26,
		population: 10000,
		source: 'data/boundaries/congo-kinshasa-gb-9469f09.geojson',
		boundaryFacts: true,
		townNameField: 'NAME',
		attribution:
			'geoBoundaries gbOpen 9469f09; OpenStreetMap, Wambacher; 2017; Open Data Commons Open Database License 1.0; https://opendatacommons.org/licenses/odbl/1-0/',
		townSourceCountry: 'Congo (Kinshasa)'
	},
	{
		country: 'Ghana',
		id: 'ghana',
		expectedLargest: { central: 'Cape Coast' },
		townSource: 'data/places/ghana.geojson',
		type: 'region',
		label: 'Regions',
		expectedRegions: 16,
		population: 10000,
		source: 'data/boundaries/ghana-gb-9469f09.geojson',
		boundaryFacts: true,
		townNameField: 'NAME',
		attribution:
			'geoBoundaries gbOpen 9469f09; Open Street Map; 2021; Creative Commons Attribution-ShareAlike 2.0; https://creativecommons.org/licenses/by-sa/2.0/'
	},
	{
		...currentSource('ethiopia'),
		expectedLargest: { tigray: 'Mekele' },
		type: 'region',
		label: 'Regions',
		expectedRegions: 14,
		population: 10000,
		townNameField: 'NAME'
	},
	{
		...currentSource('tanzania'),
		expectedLargest: { mara: 'Musoma', kigoma: 'Kigoma' },
		type: 'region',
		label: 'Regions',
		expectedRegions: 31,
		population: 10000,
		townNameField: 'NAME'
	},
	{
		...currentSource('latvia'),
		townSource: 'data/places/latvia.geojson',
		type: 'region',
		label: 'Regions',
		expectedRegions: 5,
		population: 5000,
		townNameField: 'NAME'
	},
	{
		...currentSource('slovenia'),
		townSource: 'data/places/slovenia.geojson',
		type: 'region',
		label: 'Regions',
		expectedRegions: 12,
		population: 5000,
		townNameField: 'NAME'
	},
	{
		...currentSource('singapore'),
		type: 'region',
		label: 'Regions',
		expectedRegions: 5,
		population: 0,
		largestCityFacts: false,
		secondAdministrative: {
			...currentSource('singapore-planning-areas'),
			mapId: 'singapore-planning-areas',
			type: 'division',
			label: 'Planning Areas',
			expectedRegions: 55,
			population: 0,
			largestCityFacts: false
		}
	},
	{
		...currentSource('israel'),
		townSource: 'data/places/israel.geojson',
		type: 'region',
		label: 'Districts',
		expectedRegions: 6,
		population: 10000,
		townNameField: 'NAME'
	},
	{
		...currentSource('iraq'),
		type: 'province',
		label: 'Governorates',
		expectedRegions: 19,
		population: 10000,
		townNameField: 'NAME'
	},
	{
		...currentSource('angola'),
		type: 'province',
		label: 'Provinces',
		expectedRegions: 21,
		population: 10000,
		townNameField: 'NAME'
	},
	// v1.1 (#270): Natural Earth admin-1 units with dated Wikidata towns.
	{
		country: 'Bolivia',
		id: 'bolivia',
		type: 'province',
		label: 'Departments',
		expectedRegions: 9,
		rename: 'El Beni=Beni',
		townSource: 'data/places/bolivia.geojson',
		expectedLargest: { 'la-paz': 'El Alto', beni: 'Trinidad', pando: 'Cobija' },
		townsExtentFromRegions: true,
		population: 100000
	},
	{
		// Fifteen provinces after the 2011 split of La Habana into Artemisa and
		// Mayabeque, plus the special municipality of Isla de la Juventud.
		country: 'Cuba',
		id: 'cuba',
		type: 'province',
		label: 'Provinces',
		expectedRegions: 16,
		rename: 'Ciudad de la Habana=La Habana',
		townSource: 'data/places/cuba.geojson',
		expectedLargest: {
			artemisa: 'Artemisa',
			mayabeque: 'San José de las Lajas',
			'isla-de-la-juventud': 'Nueva Gerona'
		},
		townsExtentFromRegions: true,
		population: 100000
	}
];
export function v1MapIds(country: Country): [string, string] {
	const region = country.mapId ?? country.id + '-' + slugify(country.label);
	const second = country.secondAdministrative;
	return [
		region,
		second
			? (second.mapId ?? country.id + '-' + slugify(second.label))
			: country.id + '-towns-' + country.population / 1000 + 'k'
	];
}
