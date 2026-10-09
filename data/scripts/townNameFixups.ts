// Town-name fixes shared by build-points-map.ts (the towns maps) and
// build-facts.ts (the fact box's largest city), so both spell a town alike (#227).

// Same mechanism and reasoning as build-map.ts's NAME_FIXUPS: for the rare
// row where even the chosen --name-field is wrong or dated, not a whole new
// per-country table until there's more than one or two exceptions.
export const NAME_FIXUPS: Record<string, Record<string, string>> = {
	// Turkish dropped the circumflex from this city's name; its own
	// municipality writes Elazığ. Hakkâri, also on this map, keeps its.
	Turkey: { Elâzığ: 'Elazığ' },
	// The capital by the name its own map uses; Cusco's official spelling.
	Chile: { 'Santiago de Chile': 'Santiago' },
	Peru: { Cuzco: 'Cusco' },
	// South Africa renamed these towns between 2004 and 2021; Mmabatho is
	// now part of Mahikeng, the North West's capital.
	'South Africa': {
		Umtata: 'Mthatha',
		'Port Elizabeth': 'Gqeberha',
		Uitenhage: 'Kariega',
		Queenstown: 'Komani',
		Mmabatho: 'Mahikeng'
	},
	// The maps of v0.17 (#163): Natural Earth's English names are dated or
	// typoed for Kazakhstan (Oostanay, Mangyshlak is Aktau since 1992) and the
	// Philippines (Ormac), and its Danish names ignore the English ones.
	Kazakhstan: {
		'Nur-Sultan': 'Astana',
		Oostanay: 'Kostanay',
		Mangyshlak: 'Aktau',
		Rudniy: 'Rudny',
		Petropavlovsk: 'Petropavl',
		Aqtobe: 'Aktobe',
		Qaraghandy: 'Karaganda',
		Zhezqazghan: 'Zhezkazgan'
	},
	Philippines: { Ormac: 'Ormoc', 'Pasay City': 'Pasay', Roxas: 'Roxas City' },
	Denmark: { Århus: 'Aarhus', København: 'Copenhagen' },
	// v0.19: Natural Earth's spellings of Algerian and Pakistani towns.
	Algeria: {
		Tiarat: 'Tiaret',
		Tlimcen: 'Tlemcen',
		'Tizi-Ouzou': 'Tizi Ouzou',
		Bouïra: 'Bouira',
		'Oum el Bouaghi': 'Oum El Bouaghi',
		"M'sila": "M'Sila",
		'Sidi bel Abbes': 'Sidi Bel Abbès',
		Ghardaia: 'Ghardaïa'
	},
	Pakistan: { Sialkote: 'Sialkot', Saidu: 'Saidu Sharif', 'Sheikhu Pura': 'Sheikhupura' },
	// Iran's and Saudi Arabia's towns spelled as the provinces and regions
	// of the same maps are: English, not a transliteration's.
	Iran: {
		Sabzewar: 'Sabzevar',
		Qomsheh: 'Shahreza',
		'Bandar-e Bushehr': 'Bushehr',
		'Bandar-e-Abbas': 'Bandar Abbas',
		'Marv Dasht': 'Marvdasht'
	},
	'Saudi Arabia': {
		Makkah: 'Mecca',
		Hail: "Ha'il",
		'At Taif': 'Taif',
		Jizan: 'Jazan',
		Sakakah: 'Sakaka',
		'Hafar al Batin': 'Hafar Al-Batin',
		'Yanbu al Bahr': 'Yanbu',
		'Al Jubayl': 'Jubail',
		'Al-Qatif': 'Qatif',
		'Al Mubarraz': 'Al-Mubarraz',
		'Al Kharj': 'Al-Kharj',
		'Al Hillah': 'Al-Hillah'
	},
	// NAME_VI gives the full administrative form - "Thành phố X" is "X city".
	// A quiz slip wants the name, not the designation.
	Vietnam: {
		'Thành phố Hồ Chí Minh': 'Hồ Chí Minh',
		'Thành phố Tây Ninh': 'Tây Ninh'
	},
	// NAME_ES gives the formal names; both cities are universally called by
	// the short one, and the map already has room for neither in full.
	Colombia: {
		'Cartagena de Indias': 'Cartagena',
		'San Juan de Pasto': 'Pasto'
	},
	// The Revised Romanization South Korea has used officially since 2000.
	'South Korea': { Songnam: 'Seongnam' },
	// Both cities' own governments use the shorter modern spellings.
	Nigeria: { Oshogbo: 'Osogbo', Ogbomosho: 'Ogbomoso' },
	// NAME_EN gives "Odessa" (dated) even though the same dataset's NAME_UK
	// (Одеса) and every other Ukrainian city's NAME_EN already use the
	// modern standard transliteration - matches the regions map's fixup.
	Ukraine: { Odessa: 'Odesa' },
	// NAME_ES gives "Orense", the historic Castilian exonym - Ourense has
	// been this city's sole official name (Spanish and Galician alike)
	// since 1998. The plain NAME field already has this one right.
	Spain: { Orense: 'Ourense' },
	// Two real typos in the plain NAME field, found by auditing the full
	// top-50 list rather than spot-checking: "Shenyeng" isn't a real
	// Chinese city name (Shenyang is); "Xian" without the apostrophe reads
	// as a different, ambiguous romanization from the correct "Xi'an".
	China: { Shenyeng: 'Shenyang', Xian: "Xi'an" },
	// "Jaboatao" is missing its final diacritic - the real city (in the
	// Recife metro area) is "Jaboatão", confirmed against NAME_PT.
	Brazil: { Jaboatao: 'Jaboatão' },
	Mexico: {
		// The plain NAME field is the English exonym for the capital, unlike
		// every other Mexican city already in its correct Spanish form -
		// same reasoning as Lisbon->Lisboa (Portugal) and The Hague->Den
		// Haag (Netherlands). NAME_ES gives full official forms elsewhere
		// ("Puebla de Zaragoza", "León de Los Aldama") that are more formal
		// than how these cities are actually referred to day-to-day, so
		// this is a targeted fixup, not a wholesale --name-field switch.
		'Mexico City': 'Ciudad de México',
		// Two more missing diacritics, confirmed against NAME_ES.
		Nezahualcoyotl: 'Nezahualcóyotl',
		'Ciudad Obregon': 'Ciudad Obregón'
	},
	// Three double-space typos in the US list, found by auditing every name
	// above 200k for FT-27 - the same class as the Russian one below. The two
	// abbreviations are expanded while they are being fixed: a quiz slip that
	// says 'Ft. Worth' asks the player to recognise an abbreviation rather
	// than a city.
	'United States of America': {
		'Washington,  D.C.': 'Washington, D.C.',
		// Only the double space goes: 'St.' is how these cities write
		// themselves, and the source already has St. Louis, St. Petersburg and
		// St. Charles that way.
		'St.  Paul': 'St. Paul',
		// 'Ft.' is not - the same source writes Fort Wayne, Fort Collins, Fort
		// Lauderdale and Fort Pierce in full, so this one row is the odd one.
		'Ft.  Worth': 'Fort Worth',
		// A real typo, not a variant: the city east of Memphis is Bartlett,
		// Tennessee (found auditing the >200k list for FT-28).
		Barlett: 'Bartlett'
	},
	// Plain NAME has a literal double-space typo for the one Russian city
	// whose name contains a space - confirmed against NAME_EN's correctly
	// spaced "Saint Petersburg".
	Russia: { 'St.  Petersburg': 'Saint Petersburg' },
	India: {
		// NAME_EN already gives the modern standard English spelling for
		// four of these (Howrah, Solapur, Nashik, Visakhapatnam) - the same
		// kind of gap already seen for Odessa/Ukraine. Allahabad is
		// different: NAME_EN hasn't caught up either, since this one is a
		// genuine 2018 official rename (Allahabad -> Prayagraj by the Uttar
		// Pradesh government), not a transliteration-convention update -
		// same "use the current official name" principle as Kyiv/Odesa.
		Haora: 'Howrah',
		Sholapur: 'Solapur',
		Nasik: 'Nashik',
		Vishakhapatnam: 'Visakhapatnam',
		Allahabad: 'Prayagraj'
	},
	// Colonial-era Dutch spelling ("Bandjarmasin") and a plain typo
	// ("Pakalongan", missing its second syllable's real vowel) - the
	// correct modern Indonesian forms are Banjarmasin and Pekalongan.
	Indonesia: { Bandjarmasin: 'Banjarmasin', Pakalongan: 'Pekalongan' },
	// Missing diacritic, confirmed against NAME_ES ("San Nicolás de los
	// Arroyos" - kept short, same reasoning as Mexico's Puebla/León above).
	Argentina: { 'San Nicolas': 'San Nicolás' },
	// Found auditing the continent and Europe maps (#39). Two capitals by
	// their current names: Astana was renamed Nur-Sultan in 2019 and back in
	// 2022; Palau's government moved to Ngerulmud, in Melekeok state, in
	// 2006. Andorra's capital is not the country's name. The rest are
	// letters the source lost: Plzeň, Panevėžys, and Peja for Kosovo's Peć.
	Palau: { Melekeok: 'Ngerulmud' },
	Andorra: { Andorra: 'Andorra la Vella' },
	Czechia: { Pizen: 'Plzeň' },
	Lithuania: { Panevežys: 'Panevėžys' },
	Kosovo: { Pec: 'Peja' },
	// Wikidata's label is the full name; the town is Frankfurt on
	// germany-towns-100k and in data/facts/germany.json, and Frankfurt
	// (Oder) keeps its own qualifier on the East map.
	Germany: { 'Frankfurt am Main': 'Frankfurt' }
};

/** A town's name as the maps spell it: the fixup for its country, else the raw name. */
export function fixTownName(country: string, name: string): string {
	return NAME_FIXUPS[country]?.[name] ?? name;
}
