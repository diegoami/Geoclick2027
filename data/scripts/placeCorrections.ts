// Reviewed source corrections shared by map selection and derived facts.
// Keep raw downloads/snapshots intact; apply these before spatial/population filtering.
import type { Position } from './factGeometry.js';
interface Correction {
	coordinates?: Position;
	population?: number;
	replacesPopulation?: number;
	populationDate?: string;
	exclude?: boolean;
	source: string;
}
const corrections: Record<string, Record<string, Correction>> = {
	Ghana: {
		// The Wikidata row was ~280 km west of its namesake Accra locality.
		Dome: {
			coordinates: [-0.236099, 5.650029],
			source: 'https://www.geonames.org/2301639/dome.html'
		}
	},
	'Congo (Kinshasa)': {
		// Natural Earth uses an old district/shore point, not the inhabited centre.
		Kalemie: {
			coordinates: [29.1947078704834, -5.947485075933609],
			source: 'https://www.geonames.org/214974/kalemie.html'
		}
	},
	Tanzania: {
		Musoma: {
			coordinates: [33.8, -1.5],
			source:
				'https://www.dodomacc.go.tz/storage/app/uploads/public/662/75c/81b/66275c81bac81915370063.pdf'
		},
		Kigoma: {
			coordinates: [29.62667, -4.87694],
			source: 'https://www.geonames.org/157738/kigoma.html'
		}
	},
	Ethiopia: {
		// Observed 2007 census, not the 2013 projections in the same report.
		Mekele: {
			population: 215546,
			replacesPopulation: 95856,
			populationDate: '2007-01-01',
			source:
				'https://unhabitat.org/sites/default/files/download-manager-files/City%20Prosperity%20Index%20Ethiopian%20City%20%E2%80%93%20Mekelle.pdf'
		}
	},
	// One count for every larger town: the 2024 census (23 March), municipal
	// results as INE published them. Wikidata mixed projections from 2012-2021
	// and gave Santa Cruz de la Sierra its department's population.
	Bolivia: Object.fromEntries(
		(
			[
				['Santa Cruz de la Sierra', 1606671, 3122605],
				['Cochabamba', 661484, 632013],
				['Sucre', 296125, 360544],
				['Warnes', 150803, 214216],
				['Potosí', 218336, 189652],
				['Tarija', 238942, 179528],
				['Sacaba', 218502, 172466],
				['Quillacollo', 165830, 137182],
				['Montero', 127544, 126886],
				['Riberalta', 107141, 78100],
				['Cobija', 54386, 78555]
			] as const
		).map(([name, population, replacesPopulation]) => [
			name,
			{
				population,
				replacesPopulation,
				populationDate: '2024-03-23',
				source:
					'https://eju.tv/2024/08/conozca-la-poblacion-de-bolivia-por-departamento-y-municipio-censo-2024/'
			}
		])
	),
	Cuba: {
		// The 2012 census, the date of the other Cuban rows, not an unexplained 2022 value.
		'La Habana': {
			population: 2106146,
			replacesPopulation: 2492618,
			populationDate: '2012-09-14',
			source: 'https://en.wikipedia.org/wiki/2012_Cuba_census'
		}
	},
	Norway: {
		// Bærum is a municipality, not a separately named city.
		Bærum: { exclude: true, source: 'https://snl.no/B%C3%A6rum' }
	},
	Taiwan: Object.fromEntries(
		['Zhongli', 'Bade', 'Pingzhen', 'Yangmei'].map((name) => [
			name,
			{
				exclude: true,
				source: 'https://www.tycg.gov.tw/en/'
			}
		])
	)
};
const countryKey = (country: string) =>
	country === 'Democratic Republic of the Congo' ? 'Congo (Kinshasa)' : country;
export function placeCorrectionAttribution(country: string): string {
	return ['Ghana', 'Congo (Kinshasa)', 'Tanzania'].includes(countryKey(country))
		? 'Coordinate corrections: GeoNames, CC BY 4.0, https://www.geonames.org; Musoma coordinate: Tanzania municipal strategic plan; data/scripts/placeCorrections.ts'
		: country === 'Ethiopia'
			? 'Mekele population correction: 2007 census via UN-Habitat; data/scripts/placeCorrections.ts'
			: '';
}
export function correctPlaces<T extends { properties: Record<string, unknown>; geometry: unknown }>(
	features: readonly T[]
): T[] {
	return features.flatMap((feature) => {
		const p = feature.properties;
		const correction = corrections[countryKey(String(p.ADM0NAME))]?.[String(p.NAME)];
		if (!correction) return [feature];
		if (correction.exclude) return [];
		if (
			correction.replacesPopulation !== undefined &&
			Number(p.POP_MAX) !== correction.replacesPopulation
		)
			return [feature];
		return [
			{
				...feature,
				geometry: correction.coordinates
					? { type: 'Point', coordinates: correction.coordinates }
					: feature.geometry,
				properties: {
					...p,
					...(correction.population
						? { POP_MAX: correction.population, populationDate: correction.populationDate }
						: {}),
					correctionSource: correction.source
				}
			} as T
		];
	});
}
