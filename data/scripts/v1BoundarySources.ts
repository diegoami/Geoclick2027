// Pinned source objects for the approved v1.0 country expansion (#241).
// Renames update presentation; source names and licences stay in each snapshot.
export const V1_BOUNDARY_SOURCES = [
	{
		id: 'united-arab-emirates',
		country: 'United Arab Emirates',
		iso: 'ARE',
		year: '2017',
		units: 7,
		provider: 'OpenStreetMap, Wambacher',
		url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/ARE/ADM1/geoBoundaries-ARE-ADM1.geojson',
		sha256: 'f6f0097b183518b7ddedd48c60b7e864e222156d2f0227bd345f271c2dd3d873',
		licence: 'Open Data Commons Open Database License 1.0',
		licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
		renames: {
			'Ras al-Khaimah': 'Ras Al Khaimah',
			'Umm al-Quwain': 'Umm Al Quwain'
		}
	},
	{
		id: 'sri-lanka',
		country: 'Sri Lanka',
		iso: 'LKA',
		year: '2017',
		units: 9,
		provider: 'OpenStreetMap, Wambacher',
		url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/LKA/ADM1/geoBoundaries-LKA-ADM1.geojson',
		sha256: '29905000ac7860781735a34f556be278e023a4e7188dd53f7a9717457f1716a3',
		licence: 'Open Data Commons Open Database License 1.0',
		licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
		renames: {
			'Northern Province': 'Northern',
			'Eastern Province': 'Eastern',
			'Central Province': 'Central',
			'North Central Province': 'North Central',
			'North Western Province': 'North Western',
			'Sabaragamuwa Province': 'Sabaragamuwa',
			'Southern Province': 'Southern',
			'Uva Province': 'Uva',
			'Western Province': 'Western'
		}
	},
	{
		id: 'uzbekistan',
		country: 'Uzbekistan',
		iso: 'UZB',
		year: '2017',
		units: 14,
		provider: 'OpenStreetMap, Wambacher',
		url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/UZB/ADM1/geoBoundaries-UZB-ADM1.geojson',
		sha256: '32552c187bd709f4f7d18e191d724edb8fcd2215d4519ffaa8ff02adcc16bca5',
		licence: 'Open Data Commons Open Database License 1.0',
		licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
		renames: {
			'Andijan Region': 'Andijan',
			'Namangan Region': 'Namangan',
			'Fergana Region': 'Fergana',
			'Republic of Karakalpakstan': 'Karakalpakstan',
			'Xorazm Region': 'Khorezm',
			'Navoiy Region': 'Navoi',
			'Surxondaryo Region': 'Surkhandarya',
			'Samarqand Region': 'Samarkand',
			'Tashkent Region': 'Tashkent Region',
			'Sirdaryo Region': 'Syrdarya',
			'Jizzakh Region': 'Jizzakh',
			'Bukhara Region': 'Bukhara',
			'Qashqadaryo Region': 'Kashkadarya',
			Tashkent: 'Tashkent City'
		}
	},
	{
		id: 'nepal',
		country: 'Nepal',
		iso: 'NPL',
		year: '2020',
		units: 7,
		provider: 'Survey Department of Nepal, OCHA FISS',
		url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/NPL/ADM1/geoBoundaries-NPL-ADM1.geojson',
		sha256: '5c1799924d277df4f63f6c8e29fbcbb2cd61320fd13e013e431c4a68f09656c1',
		licence: 'Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)',
		licenceUrl: 'https://creativecommons.org/licenses/by/3.0/igo/',
		renames: {
			'Province 1': 'Koshi',
			'Province 2': 'Madhesh',
			Sudurpaschim: 'Sudurpashchim'
		}
	},
	{
		id: 'taiwan',
		country: 'Taiwan',
		iso: 'TWN',
		year: '2017',
		units: 22,
		provider: 'OpenStreetMap, Wambacher',
		url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/TWN/ADM1/geoBoundaries-TWN-ADM1.geojson',
		sha256: 'deca94f3b490395e09081700860175bd6c217129373a9f77acefa7c1144be90e',
		licence: 'Open Data Commons Open Database License 1.0',
		licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
		renames: {
			'Matsu Islands': 'Lienchiang County',
			Kinmen: 'Kinmen County',
			Penghu: 'Penghu County',
			Chiayi: 'Chiayi City',
			Hsinchu: 'Hsinchu City',
			Keelung: 'Keelung City',
			Taichung: 'Taichung City',
			Taoyuan: 'Taoyuan City',
			'New Taipei': 'New Taipei City',
			Tainan: 'Tainan City',
			Taipei: 'Taipei City',
			Kaohsiung: 'Kaohsiung City'
		}
	},
	{
		id: 'uganda',
		country: 'Uganda',
		iso: 'UGA',
		year: '2017',
		units: 4,
		provider: 'OpenStreetMap, Wambacher',
		url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/UGA/ADM1/geoBoundaries-UGA-ADM1.geojson',
		sha256: '44e303862627447e7564d02c17f69679695267a19b9b8a84c87a4202677f718d',
		licence: 'Open Data Commons Open Database License 1.0',
		licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
		renames: {
			'Northern Region': 'Northern',
			'Eastern Region': 'Eastern',
			'Central Region': 'Central',
			'Western Region': 'Western'
		}
	},
	{
		id: 'congo-kinshasa',
		country: 'Democratic Republic of the Congo',
		iso: 'COD',
		year: '2017',
		units: 26,
		provider: 'OpenStreetMap, Wambacher',
		url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/COD/ADM1/geoBoundaries-COD-ADM1.geojson',
		sha256: '3deb46256765a4ce78a2e8dadaf6f93f43869877e55d242d1e68139b45a5395a',
		licence: 'Open Data Commons Open Database License 1.0',
		licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
		renames: {
			'Upper Uele': 'Haut-Uélé',
			'Lower Uele': 'Bas-Uélé',
			'North Kivu': 'Nord-Kivu',
			'South Kivu': 'Sud-Kivu',
			'Central Kasai': 'Kasaï-Central',
			Kasai: 'Kasaï',
			'Kasai-Oriental': 'Kasaï-Oriental'
		}
	},
	{
		id: 'ghana',
		country: 'Ghana',
		iso: 'GHA',
		year: '2021',
		units: 16,
		provider: 'Open Street Map',
		url: 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/GHA/ADM1/geoBoundaries-GHA-ADM1.geojson',
		sha256: 'ee73028cfcfbfc5a5bb851c118d47136086de499d23a5e0e27dc2876b6796bca',
		licence: 'Creative Commons Attribution-ShareAlike 2.0',
		licenceUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
		renames: {
			'Western North Region': 'Western North',
			'Ahafo Region': 'Ahafo',
			'Bono East Region': 'Bono East',
			'Savannah Region': 'Savannah',
			'North East Region': 'North East',
			'Oti Region': 'Oti',
			'Western Region': 'Western',
			'Eastern Region': 'Eastern',
			'Northern Region': 'Northern',
			'Central Region': 'Central',
			'Ashanti Region': 'Ashanti',
			'Bono Region': 'Bono',
			'Volta Region': 'Volta',
			'Upper West Region': 'Upper West',
			'Upper East Region': 'Upper East',
			'Greater Accra Region': 'Greater Accra'
		}
	}
] as const;
