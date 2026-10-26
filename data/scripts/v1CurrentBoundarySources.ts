// Current non-Natural-Earth sources for the remaining approved v1.0 countries.
export interface CurrentBoundarySource {
	id: string;
	country: string;
	year: string;
	units: number;
	sourceUnits?: number;
	cacheName: string;
	format: 'geojson' | 'archive' | 'osm' | 'angola';
	member?: string;
	nameField: string;
	filename: string;
	url: string;
	sha256: string;
	provider: string;
	licence: string;
	licenceUrl: string;
	renames: Record<string, string>;
	resolver?: 'datagovsg';
	hashMode?: 'features';
	idField?: string;
	contextNames?: string[];
	titleCase?: boolean;
	stripSuffix?: string;
	secondary?: {
		cacheName: string;
		url: string;
		sha256: string;
		member: string;
		licence: string;
		licenceUrl: string;
	};
	references?: string[];
	notes?: string;
}
export const V1_CURRENT_BOUNDARY_SOURCES: CurrentBoundarySource[] = [
	{
		id: 'ethiopia',
		country: 'Ethiopia',
		year: '2025',
		units: 14,
		sourceUnits: 15,
		cacheName: 'eth.zip',
		format: 'archive',
		member: 'eth_admin1.geojson',
		nameField: 'adm1_name',
		filename: 'ethiopia-regions-2025.geojson',
		url: 'https://data.humdata.org/dataset/cb58fa1f-687d-4cac-81a7-655ab1efb2d0/resource/0518da1b-42d1-4624-ad64-768cb69f9d40/download/eth_admin_boundaries.geojson.zip',
		sha256: '62db6c6ef2bb205b430e5ae3406fb8f94b30ac77106db1aec5a1ad5e81244e7a',
		provider: 'OCHA Field Information Services; COD-AB Ethiopia version 04',
		licence: 'CC BY 3.0 IGO',
		licenceUrl: 'https://creativecommons.org/licenses/by/3.0/igo/',
		contextNames: ['Contested'],
		renames: {
			Gambela: 'Gambella',
			'South West Ethiopia': 'Southwest Ethiopia'
		}
	},
	{
		id: 'tanzania',
		country: 'Tanzania',
		year: '2018',
		units: 31,
		cacheName: 'tza.zip',
		format: 'archive',
		member: 'tza_admbnda_adm1_20181019.shp',
		nameField: 'ADM1_EN',
		filename: 'tanzania-regions-2018.geojson',
		url: 'https://data.humdata.org/dataset/451bdd28-d06d-46ea-91c0-2e081f884395/resource/55e9e1d3-6585-4e38-ae35-726875c1e8ed/download/tza_admbnda_adm1_20181019.zip',
		sha256: '929b9ffaf2d2b8a925bb0f1accfbbc2adae93b17b316e20712a0e9d61ec5f440',
		provider: 'Tanzania administrative boundaries via OCHA COD-AB, 2018-10-19',
		licence: 'CC BY 3.0 IGO',
		licenceUrl: 'https://creativecommons.org/licenses/by/3.0/igo/',
		renames: {
			'Dar-es-salaam': 'Dar es Salaam'
		}
	},
	{
		id: 'latvia',
		country: 'Latvia',
		year: '2021',
		units: 5,
		cacheName: 'latvia-regions-2021.geojson',
		format: 'geojson',
		nameField: 'NOSAUKUMS',
		filename: 'latvia-regions-2021.geojson',
		url: 'https://data.gov.lv/dati/dataset/788c670f-733a-4197-b159-4a00bada964b/resource/39336816-8b65-44d1-90c6-545018292916/download/planosanas_regioni.geojson',
		sha256: 'd30850125ff6a105f1e40f7b841cb979cbca8145b94869b4fc669501ddee4f4e',
		provider:
			'Latvian Ministry of Smart Administration and Regional Development; planning regions from 2021-07-01',
		licence: 'CC0 1.0',
		licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
		renames: {
			'Vidzemes re�ions': 'Vidzeme',
			'Latgales re�ions': 'Latgale',
			'R�gas re�ions': 'Rīga',
			'Kurzemes re�ions': 'Kurzeme',
			'Zemgales re�ions': 'Zemgale'
		}
	},
	{
		id: 'slovenia',
		country: 'Slovenia',
		year: '2026-10-26',
		units: 12,
		cacheName: 'SVN.geojson',
		format: 'geojson',
		nameField: 'NAZIV',
		filename: 'slovenia-regions-2026-10-26.geojson',
		url: 'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=SI.GURS.RPE:STATISTICNE_REGIJE&outputFormat=application/json&srsName=EPSG:4326',
		sha256: 'edaa6f3c0bbd0a78bbe4774bb0f5ccfdf2337b37db39c3f1606ab558b388a080',
		hashMode: 'features',
		idField: 'SIFRA',
		provider:
			'Geodetska uprava Republike Slovenije, Register prostorskih enot - statisticne regije, snapshot 2026-10-26',
		licence: 'CC BY 4.0',
		licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
		renames: {}
	},
	{
		id: 'singapore',
		country: 'Singapore',
		year: '2019',
		units: 5,
		cacheName: 'SGP-regions.geojson',
		format: 'geojson',
		resolver: 'datagovsg',
		nameField: 'REGION_N',
		filename: 'singapore-regions-2019.geojson',
		url: 'https://api-open.data.gov.sg/v1/public/api/datasets/d_bf4d24df9129d5a8ff8cf82e20959ee0/poll-download',
		sha256: '2ac87b6da63c39d6311c7bc018aafddbffcfa18fd8faed09243207c9b502627d',
		provider:
			'Urban Redevelopment Authority, Master Plan 2019 Region Boundary (No Sea), data.gov.sg',
		licence: 'Singapore Open Data Licence 1.0',
		licenceUrl: 'https://data.gov.sg/open-data-licence',
		renames: {
			'WEST REGION': 'West',
			'NORTH REGION': 'North',
			'CENTRAL REGION': 'Central',
			'EAST REGION': 'East',
			'NORTH-EAST REGION': 'North East'
		}
	},
	{
		id: 'singapore-planning-areas',
		country: 'Singapore',
		year: '2019',
		units: 55,
		cacheName: 'SGP-areas.geojson',
		format: 'geojson',
		resolver: 'datagovsg',
		nameField: 'PLN_AREA_N',
		filename: 'singapore-planning-areas-2019.geojson',
		url: 'https://api-open.data.gov.sg/v1/public/api/datasets/d_4765db0e87b9c86336792efe8a1f7a66/poll-download',
		sha256: 'f23856251b467089f788d0fff72ef5a38e753f21aa69b4352401d7ed50d380cc',
		provider:
			'Urban Redevelopment Authority, Master Plan 2019 Planning Area Boundary (No Sea), data.gov.sg',
		licence: 'Singapore Open Data Licence 1.0',
		licenceUrl: 'https://data.gov.sg/open-data-licence',
		titleCase: true,
		renames: {}
	},
	{
		id: 'israel',
		country: 'Israel',
		year: '2006',
		units: 6,
		cacheName: 'ISR.geojson',
		format: 'geojson',
		nameField: 'shapeName',
		filename: 'israel-districts-gb-9469f09.geojson',
		url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/ISR/ADM1/geoBoundaries-ISR-ADM1.geojson',
		sha256: '1ddf8523ef2074d658fd4a696fbb7ff82b73b77a0d69e620ed564f9a1b8c85d3',
		provider: 'geoBoundaries gbOpen 9469f09; Wikimedia district geometry',
		licence: 'Public Domain',
		licenceUrl: 'https://www.geoboundaries.org/api/current/gbOpen/ISR/ADM1/',
		renames: {
			'Southern District': 'Southern',
			'Central District': 'Central',
			'Jerusalem District': 'Jerusalem',
			'Northern District': 'Northern'
		}
	},
	{
		id: 'iraq',
		country: 'Iraq',
		year: '2026-10-26',
		units: 19,
		cacheName: 'iraq-2026-10-26.osm.pbf',
		format: 'osm',
		nameField: 'name_en',
		filename: 'iraq-governorates-2026-10-26.geojson',
		url: 'https://download.geofabrik.de/asia/iraq-261026.osm.pbf',
		sha256: '3025ea26e6abf5722f00449605a025a85c5ca1c84e9e78845f176d57297586dc',
		provider: 'OpenStreetMap contributors via Geofabrik, 2026-10-26 extract; admin_level=4',
		licence: 'ODbL 1.0',
		licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
		stripSuffix: ' Governorate',
		renames: {
			'Al-Anbar Governorate': 'Anbar',
			'Al-Najaf Governorate': 'Najaf',
			'Al-Qadisiyah Governorate': 'Qadisiyyah'
		}
	},
	{
		id: 'angola',
		country: 'Angola',
		year: '2025 groupings; 2026-10-26 geometry snapshot',
		units: 21,
		cacheName: 'angola-2026-10-26.osm.pbf',
		format: 'angola',
		nameField: 'name',
		filename: 'angola-provinces-2025.geojson',
		url: 'https://download.geofabrik.de/africa/angola-261026.osm.pbf',
		sha256: '2a2bd39460827480da03253b6c36d1537d4bce68227e0f47fcc139786c81fcbf',
		provider:
			'OpenStreetMap contributors via Geofabrik; OCHA COD-AB municipality unions; current province groupings from Law 14/24 and 2025 territorial codification',
		licence: 'ODbL 1.0 with attributed CC BY 3.0 IGO source',
		licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
		renames: {},
		secondary: {
			cacheName: 'ago-hdx.zip',
			url: 'https://data.humdata.org/dataset/a62b2816-7d2e-4e07-a794-0a1dcb507092/resource/1076fc26-8c42-4196-bb6b-2353487fd7e0/download/ago_admin_boundaries.geojson.zip',
			sha256: 'f9b464464b48fe4edb8ae51a3fbaef679cd30fc1d830ad2bc27048f63bf96211',
			member: 'ago_admin2.geojson',
			licence: 'CC BY 3.0 IGO',
			licenceUrl: 'https://creativecommons.org/licenses/by/3.0/igo/'
		},
		references: [
			'https://c2a.portais.gov.ao/uploads/Lei_14_24_de_5_de_Setembro_Moxico_Leste_f596c0aa39.pdf',
			'https://www.governo.gov.ao/provincia/cubango',
			'https://files.lex.ao/assembleia-nacional/2025/lei-n-o-8-25-de-16-de-setembro/download/lei-n-o-8-25-de-16-de-setembro_assembleia-nacional_lex-ao.pdf'
		],
		notes:
			'Cartographic reconstruction: split existing Moxico and Cuando Cubango with legal 2025 groupings of pre-reform municipality polygons, clipped to current province outlines; existing Icolo e Bengo from OSM. Not an official cadastral survey.'
	}
];
