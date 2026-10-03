// Iteration 8+ (i18n): translations for the app's own UI chrome only - nav
// labels, home page text, quiz/tour status and button copy. Deliberately a
// small hand-rolled dictionary + t() helper, not a library
// (sveltekit-i18n/typesafe-i18n/Paraglide) - the whole app has on the order
// of 30-40 distinct UI strings across a handful of components, nowhere near
// enough to justify a library's build-step/plugin machinery. See
// DECISIONS.md's i18n entry for the full reasoning.
//
// Map/target names (Toscana, Bayern, Kyiv, ...) are explicitly OUT of scope
// here - those are real geographic proper nouns already localized
// per-country through data/scripts/build-map.ts's NAME_FIXUPS tables and
// --name-field, a separate, already-solved problem. Don't route those
// through this file.

export type Language = 'en' | 'de' | 'it';

export const LANGUAGES: Language[] = ['en', 'de', 'it'];

const STORAGE_KEY = 'geoclick:language:v1';

// Every key used anywhere in the app's UI. Listing keys as a union (rather
// than typing each dictionary as Record<string, string>) means TypeScript
// actually checks that de/it below define every key en does - a missing
// translation is a compile error, not a silent fallback discovered by
// clicking around.
export type TranslationKey =
	| 'nav.maps'
	| 'nav.switchMap'
	| 'nav.hideButtons'
	| 'nav.showButtons'
	| 'home.exit'
	| 'home.toolbar'
	| 'home.myMaps'
	| 'home.about'
	| 'home.back'
	| 'myMaps.empty'
	| 'about.tagline'
	| 'about.version'
	| 'about.credits'
	| 'home.viewLabel'
	| 'home.viewMap'
	| 'home.viewList'
	| 'picker.continents'
	| 'picker.label'
	| 'picker.world'
	| 'picker.close'
	| 'picker.noMaps'
	| 'continent.europe'
	| 'continent.africa'
	| 'continent.asia'
	| 'continent.north-america'
	| 'continent.south-america'
	| 'continent.oceania'
	| 'nav.overview'
	| 'nav.explore'
	| 'retention.known'
	| 'retention.nearly'
	| 'retention.seen'
	| 'nav.quiz'
	| 'nav.tour'
	| 'nav.terrain'
	| 'fact.position.north'
	| 'fact.position.south'
	| 'fact.position.east'
	| 'fact.position.west'
	| 'fact.position.northEast'
	| 'fact.position.northWest'
	| 'fact.position.southEast'
	| 'fact.position.southWest'
	| 'fact.position.centre'
	| 'fact.coastal'
	| 'fact.landlocked'
	| 'fact.terrain'
	| 'fact.peak'
	| 'fact.largestCity'
	| 'fact.cityIn'
	| 'fact.capital'
	| 'fact.cityRank'
	| 'fact.population'
	| 'fact.grew'
	| 'fact.borders'
	| 'fact.and'
	| 'fact.close'
	| 'known.clear'
	| 'known.chosen'
	| 'nav.loading'
	| 'nav.detailedMaps'
	| 'home.recent'
	| 'home.favourites'
	| 'home.allMaps'
	| 'home.mapTypeFor'
	| 'home.search'
	| 'home.searchClear'
	| 'home.searchResults'
	| 'home.searchOneResult'
	| 'home.nudge.text'
	| 'home.nudge.start'
	| 'home.nudge.dismiss'
	| 'fav.label'
	| 'fav.add'
	| 'fav.remove'
	| 'home.download.lead'
	| 'home.download.link'
	| 'home.known'
	| 'home.lastResult'
	| 'home.mistakeCount.one'
	| 'home.mistakeCount.other'
	| 'mapType.regions'
	| 'mapType.towns'
	| 'mapType.states'
	| 'mapType.provinces'
	| 'mapType.provincesNorth'
	| 'mapType.provincesCenter'
	| 'mapType.provincesSouth'
	| 'mapType.prefectures'
	| 'mapType.districts'
	| 'mapType.governorates'
	| 'mapType.cities'
	| 'mapType.citiesEast'
	| 'mapType.citiesCenter'
	| 'mapType.citiesWest'
	| 'mapType.citiesNorth'
	| 'mapType.citiesSouth'
	| 'mapType.citiesCentral'
	| 'mapType.countries'
	| 'mapType.capitals'
	| 'mapType.departments'
	| 'mapType.counties'
	| 'mapType.romanianCounties'
	| 'mapType.cantons'
	| 'mapType.germanDistricts'
	| 'mapType.municipalities'
	| 'mapType.polishCounties'
	| 'mapType.croatianCounties'
	| 'mapPart.north'
	| 'mapPart.south'
	| 'mapPart.east'
	| 'mapPart.west'
	| 'mapPart.center'
	| 'mapPart.southWest'
	| 'mapArt.hereBeDragons'
	| 'mapPart.southEast'
	| 'quiz.subtitle'
	| 'quiz.closeAriaLabel'
	| 'quiz.known'
	| 'quiz.done'
	| 'quiz.scoreLineRest'
	| 'quiz.totalMistakes.one'
	| 'quiz.totalMistakes.other'
	| 'quiz.revealedNote'
	| 'quiz.namesAtATime.one'
	| 'quiz.namesAtATime.other'
	| 'quiz.playAgain'
	| 'quiz.resizeTrayAriaLabel'
	| 'quiz.storageWarning'
	| 'tour.prev'
	| 'tour.replay'
	| 'tour.pause'
	| 'tour.play'
	| 'tour.next'
	| 'tour.speed'
	| 'tour.progress'
	| 'tutorial.button'
	| 'tutorial.start'
	| 'tutorial.skip'
	| 'tutorial.back'
	| 'tutorial.next'
	| 'tutorial.finish'
	| 'tutorial.replay'
	| 'tutorial.stepCounter'
	| 'tutorial.paused'
	| 'tutorial.resume'
	| 'tutorial.end'
	| 'tutorial.intro.title'
	| 'tutorial.intro.body'
	| 'tutorial.outro.title'
	| 'tutorial.outro.body'
	| 'tutorial.continent'
	| 'tutorial.country'
	| 'tutorial.country.touch'
	| 'tutorial.step1'
	| 'tutorial.step2'
	| 'tutorial.step2.touch'
	| 'tutorial.terrain'
	| 'tutorial.terrain.touch'
	| 'tutorial.step3'
	| 'tutorial.step3.touch'
	| 'tutorial.step4'
	| 'tutorial.step4.touch'
	| 'tutorial.step5'
	| 'tutorial.step6'
	| 'tutorial.step7'
	| 'tutorial.step8'
	| 'tutorial.step9'
	| 'tutorial.step10'
	| 'tutorial.step11'
	| 'lang.label';

type Dictionary = Record<TranslationKey, string>;

const en: Dictionary = {
	'lang.label': 'Language',
	'nav.maps': 'Maps',
	'nav.switchMap': 'Switch map',
	'nav.hideButtons': 'Hide the buttons',
	'nav.showButtons': 'Show the buttons',
	'home.exit': 'Exit',
	'home.toolbar': 'Geoclick',
	'home.myMaps': 'My maps',
	'home.about': 'About',
	'home.back': 'Back',
	'myMaps.empty':
		'Your favourite maps and the ones you played last show up here. Tap the star on a map to keep it.',
	'about.tagline': 'Learn the map by playing with it.',
	'about.version': 'Version {version}, build {build}',
	'about.credits':
		'Map data from Natural Earth and Wikidata. Maps drawn with MapLibre and PMTiles.',
	'home.viewLabel': 'Show the maps as',
	'home.viewMap': 'Map',
	'home.viewList': 'List',
	'picker.continents': 'Continents',
	'picker.label': 'World map: choose a continent, then a country',
	'picker.world': 'World',
	'picker.close': 'Close',
	'picker.noMaps': 'No maps of {country} yet: these are {continent}’s.',
	'continent.europe': 'Europe',
	'continent.africa': 'Africa',
	'continent.asia': 'Asia',
	'continent.north-america': 'North America',
	'continent.south-america': 'South America',
	'continent.oceania': 'Oceania',
	'nav.overview': 'Overview',
	'nav.explore': 'Known',
	'retention.known': 'Known',
	'retention.nearly': 'Nearly',
	'retention.seen': 'Seen once',
	'nav.quiz': 'Quiz',
	'nav.tour': 'Tour',
	'nav.terrain': 'Terrain',
	'fact.position.north': 'In the north of the country.',
	'fact.position.south': 'In the south of the country.',
	'fact.position.east': 'On the east side of the country.',
	'fact.position.west': 'On the west side of the country.',
	'fact.position.northEast': 'In the north-east of the country.',
	'fact.position.northWest': 'In the north-west of the country.',
	'fact.position.southEast': 'In the south-east of the country.',
	'fact.position.southWest': 'In the south-west of the country.',
	'fact.position.centre': 'In the middle of the country.',
	'fact.coastal': 'On the sea.',
	'fact.landlocked': 'No coast of its own.',
	'fact.terrain': 'Lies in the {name}.',
	'fact.peak': 'Highest point: {name}, {elevation} m.',
	'fact.largestCity': 'Biggest city: {name} ({population}).',
	'fact.cityIn': 'In {region}.',
	'fact.capital': "The country's capital.",
	'fact.cityRank': 'No. {rank} by population on this map.',
	'fact.population': 'About {population} people.',
	'fact.grew': '{before} people in 1950, {after} today.',
	'fact.borders': 'Borders {names}.',
	'fact.and': 'and',
	'fact.close': 'Close',
	'known.clear': 'Clear',
	'known.chosen': 'Chosen',
	'nav.loading': 'Loading…',
	'nav.detailedMaps': 'Show detailed maps',

	'home.recent': 'Recent',
	'home.favourites': 'Favourites',
	'home.allMaps': 'All maps',
	'home.mapTypeFor': 'Map type for {name}',
	'home.search': 'Search maps',
	'home.searchClear': 'Clear',
	'home.searchResults': '{count} maps',
	'home.searchOneResult': '1 map',
	'home.nudge.text': 'New here? A three-minute tutorial shows you around.',
	'home.nudge.start': 'Start the tutorial',
	'home.nudge.dismiss': 'No thanks',
	'fav.label': 'Favourite: {name}',
	'fav.add': 'Add to favourites',
	'fav.remove': 'Remove from favourites',
	'home.download.lead': 'Prefer an app?',
	'home.download.link': 'Download for Windows or Android',
	'home.known': '{known} / {total} known',
	'home.lastResult': 'Last: {perfect}/{total}',
	'home.mistakeCount.one': '({count} mistake)',
	'home.mistakeCount.other': '({count} mistakes)',

	'mapType.regions': 'Regions',
	'mapType.towns': 'Towns',
	'mapType.states': 'States',
	'mapType.provinces': 'Provinces',
	'mapType.provincesNorth': 'Provinces — North',
	'mapType.provincesCenter': 'Provinces — Center',
	'mapType.provincesSouth': 'Provinces — South',
	'mapType.prefectures': 'Prefectures',
	'mapType.districts': 'Districts',
	'mapType.governorates': 'Governorates',
	'mapType.cities': 'Cities',
	'mapType.citiesEast': 'Cities — East',
	'mapType.citiesCenter': 'Cities — Center',
	'mapType.citiesWest': 'Cities — West',
	'mapType.citiesNorth': 'Cities — North',
	'mapType.citiesSouth': 'Cities — South',
	'mapType.citiesCentral': 'Cities — Central',
	'mapType.countries': 'Countries',
	'mapType.capitals': 'Capitals',
	'mapType.departments': 'Departments',
	'mapType.counties': 'Counties',
	'mapType.romanianCounties': 'Counties',
	'mapType.cantons': 'Cantons',
	'mapType.germanDistricts': 'Districts',
	'mapType.municipalities': 'Municipalities',
	'mapType.polishCounties': 'Counties',
	'mapType.croatianCounties': 'Counties',
	'mapPart.north': 'North',
	'mapPart.south': 'South',
	'mapPart.east': 'East',
	'mapPart.west': 'West',
	'mapPart.center': 'Center',
	'mapPart.southWest': 'South-West',
	'mapArt.hereBeDragons': 'Here be dragons',
	'mapPart.southEast': 'South-East',

	'quiz.subtitle': 'Drag each name onto its region — {placed} / {total} placed',
	'quiz.closeAriaLabel': 'Close and view the map',
	'quiz.known': '{known} / {total} known',
	'quiz.done': 'Done!',
	'quiz.scoreLineRest': '/ {total} placed correctly on the first try.',
	'quiz.totalMistakes.one': '{count} total mistake.',
	'quiz.totalMistakes.other': '{count} total mistakes.',
	'quiz.revealedNote': '{count} shown after a mistake.',
	'quiz.namesAtATime.one': 'one name at a time',
	'quiz.namesAtATime.other': '{count} names at a time',
	'quiz.playAgain': 'Play again',
	'quiz.resizeTrayAriaLabel': 'Resize name tray',
	'quiz.storageWarning':
		'Progress cannot be saved on this device right now, so this round will not be remembered.',

	'tour.prev': '‹ Prev',
	'tour.replay': 'Replay',
	'tour.pause': 'Pause',
	'tour.play': '▶ Play',
	'tour.next': 'Next ›',
	'tour.speed': 'Tour speed',
	'tour.progress': 'Step {current} of {total}',
	'tutorial.button': 'Tutorial',
	'tutorial.start': 'Start',
	'tutorial.skip': 'Exit tutorial',
	'tutorial.back': 'Back',
	'tutorial.next': 'Next',
	'tutorial.finish': 'Finish',
	'tutorial.replay': 'Replay',
	'tutorial.stepCounter': 'Step {n} of {total}',
	'tutorial.paused': 'Tutorial paused',
	'tutorial.resume': 'Resume',
	'tutorial.end': 'End tutorial',
	'tutorial.intro.title': 'Welcome to Geoclick',
	'tutorial.intro.body':
		"Learn the map by playing. This three-minute tutorial introduces the app's main features. Your practice on Italy — Regions won't change your real progress.",
	'tutorial.outro.title': "You're all set",
	'tutorial.outro.body':
		'Pick any map and play. Tip: the star on a map keeps it at the top of your list. You can replay this tutorial any time with the Tutorial button.',
	'tutorial.continent': 'Every map starts from the world. Choose **Europe**.',
	'tutorial.country': 'Now click **Italy** on the map. Its row in the list lights up.',
	'tutorial.country.touch': 'Now tap **Italy** on the map. Its row in the list lights up.',
	'tutorial.step1': "Choose **Regions** in Italy's row to open that map.",
	'tutorial.step2':
		'Zoom with the mouse wheel or the **+** and **−** buttons, and drag the map to move around. Try it now.',
	'tutorial.step2.touch':
		'Pinch to zoom, or use the **+** and **−** buttons, and drag with one finger to move around. Try it now.',
	'tutorial.step3':
		'This is **Known**, the map you build. Click a region to put its name on the map — it stays there. Click it again to take it off, so you choose which names to study.',
	'tutorial.step3.touch':
		'This is **Known**, the map you build. Tap a region to put its name on the map — it stays there. Tap it again to take it off, so you choose which names to study.',
	'tutorial.terrain':
		'**Terrain** adds geographic detail behind the map, including rivers, mountain ranges and the sea overlay. The land and sea remain distinct when Terrain is off. Press **Terrain** to hide or show this extra detail.',
	'tutorial.terrain.touch':
		'**Terrain** adds geographic detail behind the map, including rivers, mountain ranges and the sea overlay. The land and sea remain distinct when Terrain is off. Tap **Terrain** to hide or show this extra detail.',
	'tutorial.step4':
		'Names you place right in the quiz appear here on their own, as strongly as you know them. New to a map? **Overview** shows every name at once — open it.',
	'tutorial.step4.touch':
		'Names you place right in the quiz appear here on their own, as strongly as you know them. New to a map? **Overview** shows every name at once — open it.',
	'tutorial.step5': 'Ready for a quiz? Open the **Quiz**.',
	'tutorial.step6':
		'Drag a name from the tray onto its region. Try **Sicilia**: the big island off the toe of the boot.',
	'tutorial.step7':
		'Now get one wrong on purpose: drag **any** name onto a region it does not belong to — **Sardegna** onto the mainland, say. The region you hit flashes red, and the name is shown where it really belongs.',
	'tutorial.step8': 'Not sure where a region is? Look it up in the **overview**.',
	'tutorial.step9': 'Found Sardegna? Go back to the **Quiz**.',
	'tutorial.step10':
		'The regions you placed are still marked. Place a name right three times in a row and it counts as known — **Known** shows how far you have got.',
	'tutorial.step11':
		'Last one: the **Tour** flies you to each region in turn and shows its name. Open it.'
};

const de: Dictionary = {
	'lang.label': 'Sprache',
	'nav.maps': 'Karten',
	'nav.switchMap': 'Karte wechseln',
	'nav.hideButtons': 'Schaltflächen ausblenden',
	'nav.showButtons': 'Schaltflächen einblenden',
	'home.exit': 'Beenden',
	'home.toolbar': 'Geoclick',
	'home.myMaps': 'Meine Karten',
	'home.about': 'Über Geoclick',
	'home.back': 'Zurück',
	'myMaps.empty':
		'Hier erscheinen deine Lieblingskarten und die zuletzt gespielten. Tippe auf den Stern einer Karte, um sie zu behalten.',
	'about.tagline': 'Lerne die Karte, indem du mit ihr spielst.',
	'about.version': 'Version {version}, Build {build}',
	'about.credits':
		'Kartendaten von Natural Earth und Wikidata. Karten gezeichnet mit MapLibre und PMTiles.',
	'home.viewLabel': 'Karten zeigen als',
	'home.viewMap': 'Karte',
	'home.viewList': 'Liste',
	'picker.continents': 'Kontinente',
	'picker.label': 'Weltkarte: wähle einen Kontinent, dann ein Land',
	'picker.world': 'Welt',
	'picker.close': 'Schließen',
	'picker.noMaps': 'Noch keine Karten von {country}: hier die von {continent}.',
	'continent.europe': 'Europa',
	'continent.africa': 'Afrika',
	'continent.asia': 'Asien',
	'continent.north-america': 'Nordamerika',
	'continent.south-america': 'Südamerika',
	'continent.oceania': 'Ozeanien',
	'nav.overview': 'Übersicht',
	'nav.explore': 'Gewusst',
	'retention.known': 'Gewusst',
	'retention.nearly': 'Fast',
	'retention.seen': 'Einmal',
	'nav.quiz': 'Quiz',
	'nav.tour': 'Tour',
	'nav.terrain': 'Gelände',
	'fact.position.north': 'Im Norden des Landes.',
	'fact.position.south': 'Im Süden des Landes.',
	'fact.position.east': 'Im Osten des Landes.',
	'fact.position.west': 'Im Westen des Landes.',
	'fact.position.northEast': 'Im Nordosten des Landes.',
	'fact.position.northWest': 'Im Nordwesten des Landes.',
	'fact.position.southEast': 'Im Südosten des Landes.',
	'fact.position.southWest': 'Im Südwesten des Landes.',
	'fact.position.centre': 'In der Mitte des Landes.',
	'fact.coastal': 'Am Meer.',
	'fact.landlocked': 'Ohne eigene Küste.',
	'fact.terrain': 'Liegt in {name}.',
	'fact.peak': 'Höchster Punkt: {name}, {elevation} m.',
	'fact.largestCity': 'Größte Stadt: {name} ({population}).',
	'fact.cityIn': 'In {region}.',
	'fact.capital': 'Hauptstadt des Landes.',
	'fact.cityRank': 'Nr. {rank} nach Einwohnern auf dieser Karte.',
	'fact.population': 'Etwa {population} Einwohner.',
	'fact.grew': '{before} Einwohner 1950, heute {after}.',
	'fact.borders': 'Grenzt an {names}.',
	'fact.and': 'und',
	'fact.close': 'Schließen',
	'known.clear': 'Zurücksetzen',
	'known.chosen': 'Gewählt',
	'nav.loading': 'Lädt…',
	'nav.detailedMaps': 'Detaillierte Karten anzeigen',

	'home.recent': 'Zuletzt geöffnet',
	'home.favourites': 'Favoriten',
	'home.allMaps': 'Alle Karten',
	'home.mapTypeFor': 'Kartentyp für {name}',
	'home.search': 'Karten suchen',
	'home.searchClear': 'Löschen',
	'home.searchResults': '{count} Karten',
	'home.searchOneResult': '1 Karte',
	'home.nudge.text': 'Neu hier? Ein Tutorial von drei Minuten zeigt dir alles.',
	'home.nudge.start': 'Tutorial starten',
	'home.nudge.dismiss': 'Nein, danke',
	'fav.label': 'Favorit: {name}',
	'fav.add': 'Zu Favoriten hinzufügen',
	'fav.remove': 'Aus Favoriten entfernen',
	'home.download.lead': 'Lieber als App?',
	'home.download.link': 'Für Windows oder Android herunterladen',
	'home.known': '{known} / {total} gewusst',
	'home.lastResult': 'Zuletzt: {perfect}/{total}',
	'home.mistakeCount.one': '({count} Fehler)',
	'home.mistakeCount.other': '({count} Fehler)',

	'mapType.regions': 'Regionen',
	'mapType.towns': 'Städte',
	'mapType.states': 'Staaten',
	'mapType.provinces': 'Provinzen',
	'mapType.provincesNorth': 'Provinzen — Norden',
	'mapType.provincesCenter': 'Provinzen — Mitte',
	'mapType.provincesSouth': 'Provinzen — Süden',
	'mapType.prefectures': 'Präfekturen',
	'mapType.districts': 'Bezirke',
	'mapType.governorates': 'Gouvernements',
	'mapType.cities': 'Städte',
	'mapType.citiesEast': 'Städte — Osten',
	'mapType.citiesCenter': 'Städte — Mitte',
	'mapType.citiesWest': 'Städte — Westen',
	'mapType.citiesNorth': 'Städte — Norden',
	'mapType.citiesSouth': 'Städte — Süden',
	'mapType.citiesCentral': 'Städte — Mitte',
	'mapType.countries': 'Länder',
	'mapType.capitals': 'Hauptstädte',
	'mapType.departments': 'Départements',
	// Ireland's counties are Grafschaften in German, Romania's județe Kreise.
	'mapType.counties': 'Grafschaften',
	'mapType.romanianCounties': 'Kreise',
	'mapType.cantons': 'Kantone',
	'mapType.germanDistricts': 'Kreise',
	'mapType.municipalities': 'Gemeinden',
	// A powiat is a Kreis in German, a županija a Gespanschaft.
	'mapType.polishCounties': 'Kreise',
	'mapType.croatianCounties': 'Gespanschaften',
	'mapPart.north': 'Norden',
	'mapPart.south': 'Süden',
	'mapPart.east': 'Osten',
	'mapPart.west': 'Westen',
	'mapPart.center': 'Mitte',
	'mapPart.southWest': 'Südwesten',
	'mapArt.hereBeDragons': 'Hier sind Drachen',
	'mapPart.southEast': 'Südosten',

	'quiz.subtitle': 'Ziehe jeden Namen auf seine Region — {placed} / {total} platziert',
	'quiz.closeAriaLabel': 'Schließen und Karte ansehen',
	'quiz.known': '{known} / {total} gewusst',
	'quiz.done': 'Fertig!',
	'quiz.scoreLineRest': 'von {total} beim ersten Versuch richtig platziert.',
	'quiz.totalMistakes.one': '{count} Fehler insgesamt.',
	'quiz.totalMistakes.other': '{count} Fehler insgesamt.',
	'quiz.revealedNote': '{count} nach einem Fehler gezeigt.',
	'quiz.namesAtATime.one': 'ein Name auf einmal',
	'quiz.namesAtATime.other': '{count} Namen auf einmal',
	'quiz.playAgain': 'Nochmal spielen',
	'quiz.resizeTrayAriaLabel': 'Größe der Namensablage anpassen',
	'quiz.storageWarning':
		'Fortschritt kann auf diesem Gerät gerade nicht gespeichert werden — diese Runde wird nicht gemerkt.',

	'tour.prev': '‹ Zurück',
	'tour.replay': 'Nochmal',
	'tour.pause': 'Pause',
	'tour.play': '▶ Abspielen',
	'tour.next': 'Weiter ›',
	'tour.speed': 'Tourgeschwindigkeit',
	'tour.progress': 'Schritt {current} von {total}',
	'tutorial.button': 'Tutorial',
	'tutorial.start': "Los geht's",
	'tutorial.skip': 'Tutorial beenden',
	'tutorial.back': 'Zurück',
	'tutorial.next': 'Weiter',
	'tutorial.finish': 'Fertig',
	'tutorial.replay': 'Nochmal',
	'tutorial.stepCounter': 'Schritt {n} von {total}',
	'tutorial.paused': 'Tutorial pausiert',
	'tutorial.resume': 'Fortsetzen',
	'tutorial.end': 'Tutorial beenden',
	'tutorial.intro.title': 'Willkommen bei Geoclick',
	'tutorial.intro.body':
		'Lerne die Karte spielend kennen. In etwa drei Minuten zeigt dir das Tutorial die wichtigsten Funktionen. Dein Üben auf Italien — Regionen verändert deinen echten Lernfortschritt nicht.',
	'tutorial.outro.title': 'Alles bereit',
	'tutorial.outro.body':
		'Wähle eine beliebige Karte und leg los. Tipp: Mit dem Stern bleibt eine Karte oben in deiner Liste. Du kannst dieses Tutorial jederzeit über die Schaltfläche „Tutorial“ wiederholen.',
	'tutorial.continent': 'Jede Karte beginnt bei der Welt. Wähle **Europa**.',
	'tutorial.country':
		'Klicke jetzt auf der Karte auf **Italien**. Seine Zeile in der Liste leuchtet auf.',
	'tutorial.country.touch':
		'Tippe jetzt auf der Karte auf **Italien**. Seine Zeile in der Liste leuchtet auf.',
	'tutorial.step1': 'Wähle **Regionen** in Italiens Zeile, um diese Karte zu öffnen.',
	'tutorial.step2':
		'Zoome mit dem Mausrad oder den Tasten **+** und **−**, und ziehe die Karte, um dich zu bewegen. Probier es aus.',
	'tutorial.step2.touch':
		'Zoome mit zwei Fingern oder den Tasten **+** und **−**, und verschiebe die Karte mit einem Finger. Probier es aus.',
	'tutorial.step3':
		'Das ist **Gewusst**, deine eigene Karte. Klicke auf eine Region, um ihren Namen daraufzusetzen — er bleibt dort stehen. Noch einmal klicken nimmt ihn wieder weg: So wählst du selbst, welche Namen du lernen willst.',
	'tutorial.step3.touch':
		'Das ist **Gewusst**, deine eigene Karte. Tippe auf eine Region, um ihren Namen daraufzusetzen — er bleibt dort stehen. Noch einmal tippen nimmt ihn wieder weg: So wählst du selbst, welche Namen du lernen willst.',
	'tutorial.terrain':
		'**Gelände** ergänzt geografische Details hinter der Karte, darunter Flüsse, Gebirge und die Meeresdarstellung. Land und Meer bleiben auch ohne Gelände unterscheidbar. Drücke auf **Gelände**, um diese Details ein- oder auszublenden.',
	'tutorial.terrain.touch':
		'**Gelände** ergänzt geografische Details hinter der Karte, darunter Flüsse, Gebirge und die Meeresdarstellung. Land und Meer bleiben auch ohne Gelände unterscheidbar. Tippe auf **Gelände**, um diese Details ein- oder auszublenden.',
	'tutorial.step4':
		'Namen, die du im Quiz richtig platzierst, erscheinen hier von selbst — so deutlich, wie du sie kennst. Neu auf einer Karte? Die **Übersicht** zeigt alle Namen auf einmal. Öffne sie.',
	'tutorial.step4.touch':
		'Namen, die du im Quiz richtig platzierst, erscheinen hier von selbst — so deutlich, wie du sie kennst. Neu auf einer Karte? Die **Übersicht** zeigt alle Namen auf einmal. Öffne sie.',
	'tutorial.step5': 'Bereit für ein Quiz? Öffne das **Quiz**.',
	'tutorial.step6':
		'Ziehe einen Namen aus der Ablage auf seine Region. Versuch es mit **Sicilia**, der großen Insel vor der Stiefelspitze.',
	'tutorial.step7':
		'Jetzt ein Fehler mit Absicht: Zieh **irgendeinen** Namen auf eine Region, zu der er nicht gehört — zum Beispiel **Sardegna** aufs Festland. Die getroffene Region blinkt rot, und der Name wird dort gezeigt, wo er wirklich hingehört.',
	'tutorial.step8': 'Nicht sicher, wo eine Region liegt? Schau in der **Übersicht** nach.',
	'tutorial.step9': 'Sardegna gefunden? Dann zurück zum **Quiz**.',
	'tutorial.step10':
		'Deine platzierten Regionen sind noch markiert. Dreimal hintereinander richtig, und ein Name gilt als gewusst — **Gewusst** zeigt, wie weit du bist.',
	'tutorial.step11':
		'Zum Schluss die **Tour**: Sie fliegt dich nacheinander zu jeder Region und zeigt ihren Namen. Öffne sie.'
};

const it: Dictionary = {
	'lang.label': 'Lingua',
	'nav.maps': 'Mappe',
	'nav.switchMap': 'Cambia mappa',
	'nav.hideButtons': 'Nascondi i pulsanti',
	'nav.showButtons': 'Mostra i pulsanti',
	'home.exit': 'Esci',
	'home.toolbar': 'Geoclick',
	'home.myMaps': 'Le mie mappe',
	'home.about': 'Informazioni',
	'home.back': 'Indietro',
	'myMaps.empty':
		'Qui compaiono le tue mappe preferite e quelle giocate per ultime. Tocca la stella di una mappa per tenerla.',
	'about.tagline': 'Impara la mappa giocandoci.',
	'about.version': 'Versione {version}, build {build}',
	'about.credits':
		'Dati cartografici da Natural Earth e Wikidata. Mappe disegnate con MapLibre e PMTiles.',
	'home.viewLabel': 'Mostra le mappe come',
	'home.viewMap': 'Mappa',
	'home.viewList': 'Elenco',
	'picker.continents': 'Continenti',
	'picker.label': 'Mappa del mondo: scegli un continente, poi un paese',
	'picker.world': 'Mondo',
	'picker.close': 'Chiudi',
	'picker.noMaps': 'Ancora nessuna mappa di {country}: ecco quelle dell’{continent}.',
	'continent.europe': 'Europa',
	'continent.africa': 'Africa',
	'continent.asia': 'Asia',
	'continent.north-america': 'America del Nord',
	'continent.south-america': 'America del Sud',
	'continent.oceania': 'Oceania',
	'nav.overview': 'Panoramica',
	'nav.explore': 'Conoscenza',
	'retention.known': 'Sai',
	'retention.nearly': 'Quasi',
	'retention.seen': 'Una volta',
	'nav.quiz': 'Quiz',
	'nav.tour': 'Tour',
	'nav.terrain': 'Rilievo',
	'fact.position.north': 'Nel nord del paese.',
	'fact.position.south': 'Nel sud del paese.',
	'fact.position.east': 'Nella parte est del paese.',
	'fact.position.west': 'Nella parte ovest del paese.',
	'fact.position.northEast': 'Nel nord-est del paese.',
	'fact.position.northWest': 'Nel nord-ovest del paese.',
	'fact.position.southEast': 'Nel sud-est del paese.',
	'fact.position.southWest': 'Nel sud-ovest del paese.',
	'fact.position.centre': 'Al centro del paese.',
	'fact.coastal': 'Sul mare.',
	'fact.landlocked': 'Senza sbocco sul mare.',
	'fact.terrain': 'Si trova in {name}.',
	'fact.peak': 'Punto più alto: {name}, {elevation} m.',
	'fact.largestCity': 'Città più grande: {name} ({population}).',
	'fact.cityIn': 'In {region}.',
	'fact.capital': 'Capitale del paese.',
	'fact.cityRank': 'N. {rank} per abitanti su questa mappa.',
	'fact.population': 'Circa {population} abitanti.',
	'fact.grew': '{before} abitanti nel 1950, oggi {after}.',
	'fact.borders': 'Confina con {names}.',
	'fact.and': 'e',
	'fact.close': 'Chiudi',
	'known.clear': 'Azzera',
	'known.chosen': 'Scelto',
	'nav.loading': 'Caricamento…',
	'nav.detailedMaps': 'Mostra le mappe dettagliate',

	'home.recent': 'Recenti',
	'home.favourites': 'Preferiti',
	'home.allMaps': 'Tutte le mappe',
	'home.mapTypeFor': 'Tipo di mappa per {name}',
	'home.search': 'Cerca mappe',
	'home.searchClear': 'Cancella',
	'home.searchResults': '{count} mappe',
	'home.searchOneResult': '1 mappa',
	'home.nudge.text': 'Prima volta qui? Un tutorial di tre minuti ti mostra come funziona.',
	'home.nudge.start': 'Inizia il tutorial',
	'home.nudge.dismiss': 'No, grazie',
	'fav.label': 'Preferito: {name}',
	'fav.add': 'Aggiungi ai preferiti',
	'fav.remove': 'Rimuovi dai preferiti',
	'home.download.lead': "Preferisci un'app?",
	'home.download.link': 'Scarica per Windows o Android',
	'home.known': 'Sai {known} / {total}',
	'home.lastResult': 'Ultimo: {perfect}/{total}',
	'home.mistakeCount.one': '({count} errore)',
	'home.mistakeCount.other': '({count} errori)',

	'mapType.regions': 'Regioni',
	'mapType.towns': 'Città',
	'mapType.states': 'Stati',
	'mapType.provinces': 'Province',
	'mapType.provincesNorth': 'Province — Nord',
	'mapType.provincesCenter': 'Province — Centro',
	'mapType.provincesSouth': 'Province — Sud',
	'mapType.prefectures': 'Prefetture',
	'mapType.districts': 'Distretti',
	'mapType.governorates': 'Governatorati',
	'mapType.cities': 'Città',
	'mapType.citiesEast': 'Città — Est',
	'mapType.citiesCenter': 'Città — Centro',
	'mapType.citiesWest': 'Città — Ovest',
	'mapType.citiesNorth': 'Città — Nord',
	'mapType.citiesSouth': 'Città — Sud',
	'mapType.citiesCentral': 'Città — Centro',
	'mapType.countries': 'Paesi',
	'mapType.capitals': 'Capitali',
	'mapType.departments': 'Dipartimenti',
	// Ireland's counties are contee in Italian, Romania's județe distretti.
	'mapType.counties': 'Contee',
	'mapType.romanianCounties': 'Distretti',
	'mapType.cantons': 'Cantoni',
	'mapType.germanDistricts': 'Circondari',
	'mapType.municipalities': 'Comuni',
	// A powiat is a distretto in Italian, a županija a regione.
	'mapType.polishCounties': 'Distretti',
	'mapType.croatianCounties': 'Regioni',
	'mapPart.north': 'Nord',
	'mapPart.south': 'Sud',
	'mapPart.east': 'Est',
	'mapPart.west': 'Ovest',
	'mapPart.center': 'Centro',
	'mapPart.southWest': 'Sud-ovest',
	'mapArt.hereBeDragons': 'Qui ci sono i draghi',
	'mapPart.southEast': 'Sud-est',

	'quiz.subtitle': 'Trascina ogni nome sulla sua regione — {placed} / {total} posizionati',
	'quiz.closeAriaLabel': 'Chiudi e guarda la mappa',
	'quiz.known': 'Sai {known} / {total}',
	'quiz.done': 'Fatto!',
	'quiz.scoreLineRest': 'su {total} posizionati correttamente al primo tentativo.',
	'quiz.totalMistakes.one': '{count} errore in totale.',
	'quiz.totalMistakes.other': '{count} errori in totale.',
	'quiz.revealedNote': '{count} mostrati dopo un errore.',
	'quiz.namesAtATime.one': 'un nome alla volta',
	'quiz.namesAtATime.other': '{count} nomi alla volta',
	'quiz.playAgain': 'Gioca ancora',
	'quiz.resizeTrayAriaLabel': 'Ridimensiona il vassoio dei nomi',
	'quiz.storageWarning':
		'Al momento non è possibile salvare i progressi su questo dispositivo, quindi questa partita non verrà ricordata.',

	'tour.prev': '‹ Indietro',
	'tour.replay': 'Riguarda',
	'tour.pause': 'Pausa',
	'tour.play': '▶ Riproduci',
	'tour.next': 'Avanti ›',
	'tour.speed': 'Velocità del tour',
	'tour.progress': 'Passaggio {current} di {total}',
	'tutorial.button': 'Tutorial',
	'tutorial.start': 'Inizia',
	'tutorial.skip': 'Esci dal tutorial',
	'tutorial.back': 'Indietro',
	'tutorial.next': 'Avanti',
	'tutorial.finish': 'Fine',
	'tutorial.replay': 'Ricomincia',
	'tutorial.stepCounter': 'Passo {n} di {total}',
	'tutorial.paused': 'Tutorial in pausa',
	'tutorial.resume': 'Riprendi',
	'tutorial.end': 'Termina il tutorial',
	'tutorial.intro.title': 'Ti diamo il benvenuto in Geoclick',
	'tutorial.intro.body':
		"Impara la mappa giocando. In circa tre minuti il tutorial ti mostra le funzioni principali. L'esercitazione su Italia — Regioni non modifica i tuoi progressi reali.",
	'tutorial.outro.title': 'Tutto pronto',
	'tutorial.outro.body':
		"Scegli una mappa qualsiasi e gioca. Suggerimento: con la stella una mappa resta in cima all'elenco. Puoi rifare questo tutorial quando vuoi con il pulsante Tutorial.",
	'tutorial.continent': 'Ogni mappa parte dal mondo. Scegli **Europa**.',
	'tutorial.country':
		"Ora fai clic sull'**Italia** nella mappa. La sua riga nell'elenco si illumina.",
	'tutorial.country.touch':
		"Ora tocca l'**Italia** sulla mappa. La sua riga nell'elenco si illumina.",
	'tutorial.step1': "Scegli **Regioni** nella riga dell'Italia per aprire questa mappa.",
	'tutorial.step2':
		'Usa la rotellina del mouse o i pulsanti **+** e **−** per lo zoom, e trascina la mappa per spostarti. Prova ora.',
	'tutorial.step2.touch':
		'Usa due dita o i pulsanti **+** e **−** per lo zoom, e trascina la mappa con un dito per spostarti. Prova ora.',
	'tutorial.step3':
		'Questa è **Conoscenza**, la mappa che costruisci tu. Clicca una regione per mettere il suo nome sulla mappa: resta lì. Cliccala di nuovo per toglierlo — scegli tu quali nomi studiare.',
	'tutorial.step3.touch':
		'Questa è **Conoscenza**, la mappa che costruisci tu. Tocca una regione per mettere il suo nome sulla mappa: resta lì. Toccala di nuovo per toglierlo — scegli tu quali nomi studiare.',
	'tutorial.terrain':
		'**Rilievo** aggiunge dettagli geografici dietro la mappa, tra cui fiumi, catene montuose e la rappresentazione del mare. Terra e mare restano distinti anche quando Rilievo è disattivato. Premi **Rilievo** per nascondere o mostrare questi dettagli.',
	'tutorial.terrain.touch':
		'**Rilievo** aggiunge dettagli geografici dietro la mappa, tra cui fiumi, catene montuose e la rappresentazione del mare. Terra e mare restano distinti anche quando Rilievo è disattivato. Tocca **Rilievo** per nascondere o mostrare questi dettagli.',
	'tutorial.step4':
		'I nomi che indovini nel quiz compaiono qui da soli, con la forza con cui li sai. Mappa nuova? La **Panoramica** mostra tutti i nomi insieme: aprila.',
	'tutorial.step4.touch':
		'I nomi che indovini nel quiz compaiono qui da soli, con la forza con cui li sai. Mappa nuova? La **Panoramica** mostra tutti i nomi insieme: aprila.',
	'tutorial.step5': 'Vuoi fare un quiz? Apri il **Quiz**.',
	'tutorial.step6':
		"Trascina un nome dal vassoio sulla sua regione. Prova con **Sicilia**, l'isola grande davanti alla punta dello stivale.",
	'tutorial.step7':
		'Ora sbaglia apposta: trascina **un nome qualsiasi** su una regione a cui non appartiene — per esempio **Sardegna** sulla penisola. La regione che hai toccato lampeggia in rosso e il nome viene mostrato dove si trova davvero.',
	'tutorial.step8': "Non sai dov'è una regione? Controlla nella **panoramica**.",
	'tutorial.step9': 'Trovata la Sardegna? Torna al **Quiz**.',
	'tutorial.step10':
		'Le regioni che hai posizionato restano segnate. Tre volte di fila giuste e un nome conta come imparato — **Conoscenza** mostra a che punto sei.',
	'tutorial.step11':
		"Per finire, il **Tour**: ti porta da una regione all'altra e ne mostra il nome. Aprilo."
};

const dictionaries: Record<Language, Dictionary> = { en, de, it };

function isLanguage(value: string | null): value is Language {
	return value === 'en' || value === 'de' || value === 'it';
}

// Guarded the same way createLocalStorageProgressRepository is
// (progressRepository.ts) - the home page and other routes prerender at
// build time, when localStorage doesn't exist. The read is inside the try:
// a disabled or sandboxed localStorage throws on getItem itself, and the
// app must still start in English (FT-57).
function loadInitialLanguage(): Language {
	try {
		if (typeof localStorage === 'undefined') return 'en';
		const stored = localStorage.getItem(STORAGE_KEY);
		return isLanguage(stored) ? stored : 'en';
	} catch {
		return 'en';
	}
}

// Module-scope $state, not a class/writable store - the standard Svelte 5
// pattern for state shared across components (a .svelte.ts file can use
// runes at module scope). Read through getLanguage()/t() so every call site
// re-runs when the language changes, the same way reading any other $state
// value inside a component's template does.
let currentLanguage = $state<Language>(loadInitialLanguage());

export function getLanguage(): Language {
	return currentLanguage;
}

export function setLanguage(language: Language): void {
	currentLanguage = language;
	// The switch itself must work even where storage refuses: the language
	// changes for this run and simply is not remembered (FT-57).
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, language);
		}
	} catch {
		// Not worth logging every switch; the run still shows the language.
	}
}

function interpolate(template: string, params?: Record<string, string | number>): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, key) =>
		key in params ? String(params[key]) : match
	);
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
	return interpolate(dictionaries[currentLanguage][key], params);
}

/** Translate outside the active-language UI, e.g. into bundled map artwork. */
export function tForLanguage(
	key: TranslationKey,
	language: Language,
	params?: Record<string, string | number>
): string {
	return interpolate(dictionaries[language][key], params);
}

// Picks the `.one`/`.other` variant of a pair of keys sharing the same
// prefix, English-rule based (count === 1 -> one) - matches how every
// pluralized string in this app was already worded (`mistake`/`mistakes`,
// `day`/`days`) before i18n existed. Good enough for en/de/it, all of which
// only distinguish singular from "everything else" for these particular
// counts (0, 2, 3, ...) - not a general CLDR plural-rules implementation,
// which would be overkill for three languages and a handful of counted
// strings.
export function tPlural(
	base: 'home.mistakeCount' | 'quiz.totalMistakes' | 'quiz.nextReview' | 'quiz.namesAtATime',
	count: number,
	params: Record<string, string | number>
): string {
	const key = (count === 1 ? `${base}.one` : `${base}.other`) as TranslationKey;
	return interpolate(dictionaries[currentLanguage][key], params);
}
