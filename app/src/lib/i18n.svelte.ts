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
	| 'nav.overview'
	| 'nav.explore'
	| 'retention.known'
	| 'retention.nearly'
	| 'retention.seen'
	| 'nav.quiz'
	| 'nav.tour'
	| 'nav.loading'
	| 'home.subtitle'
	| 'home.recent'
	| 'home.favourites'
	| 'home.allMaps'
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
	| 'mapType.prefectures'
	| 'mapType.districts'
	| 'mapType.governorates'
	| 'mapType.cities'
	| 'mapType.citiesEast'
	| 'mapType.citiesCenter'
	| 'mapType.citiesWest'
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
	| 'quiz.backToMaps'
	| 'quiz.playAgain'
	| 'quiz.resizeTrayAriaLabel'
	| 'tour.prev'
	| 'tour.replay'
	| 'tour.pause'
	| 'tour.play'
	| 'tour.next'
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
	| 'tutorial.step1'
	| 'tutorial.step2'
	| 'tutorial.step2.touch'
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
	| 'tutorial.step11';

type Dictionary = Record<TranslationKey, string>;

const en: Dictionary = {
	'nav.maps': 'Maps',
	'nav.overview': 'Overview',
	'nav.explore': 'Known',
	'retention.known': 'Known',
	'retention.nearly': 'Nearly',
	'retention.seen': 'Seen once',
	'nav.quiz': 'Quiz',
	'nav.tour': 'Tour',
	'nav.loading': 'Loading…',

	'home.subtitle': 'Pick a demo map to explore.',
	'home.recent': 'Recent',
	'home.favourites': 'Favourites',
	'home.allMaps': 'All maps',
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
	'mapType.prefectures': 'Prefectures',
	'mapType.districts': 'Districts',
	'mapType.governorates': 'Governorates',
	'mapType.cities': 'Cities',
	'mapType.citiesEast': 'Cities — East',
	'mapType.citiesCenter': 'Cities — Center',
	'mapType.citiesWest': 'Cities — West',

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
	'quiz.backToMaps': 'Back to maps',
	'quiz.playAgain': 'Play again',
	'quiz.resizeTrayAriaLabel': 'Resize name tray',

	'tour.prev': '‹ Prev',
	'tour.replay': 'Replay',
	'tour.pause': 'Pause',
	'tour.play': '▶ Play',
	'tour.next': 'Next ›',
	'tutorial.button': 'Tutorial',
	'tutorial.start': 'Start',
	'tutorial.skip': 'Skip',
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
		"Learn the map by playing with it. This short tutorial takes about three minutes and you'll try every part of the app yourself. Nothing you do in it counts towards your progress.",
	'tutorial.outro.title': "You're all set",
	'tutorial.outro.body':
		'Pick any map and play. Tip: the star on a map keeps it at the top of your list. You can replay this tutorial any time with the Tutorial button.',
	'tutorial.step1': "Let's start with a map. Open **Regions**, under Italy.",
	'tutorial.step2':
		'Zoom with the mouse wheel or the **+** and **−** buttons, and drag the map to move around. Try it now.',
	'tutorial.step2.touch':
		'Pinch to zoom, or use the **+** and **−** buttons, and drag with one finger to move around. Try it now.',
	'tutorial.step3':
		'This is the **overview**, where every region shows its name. Hover over a name to enlarge it.',
	'tutorial.step3.touch':
		'This is the **overview**, where every region shows its name. Tap a name to enlarge it.',
	'tutorial.step4':
		'**Known** shows how well you know this map: the names you have placed right, as strongly as you know them. Open it and click any region to see which one it is.',
	'tutorial.step4.touch':
		'**Known** shows how well you know this map: the names you have placed right, as strongly as you know them. Open it and tap any region to see which one it is.',
	'tutorial.step5': 'Ready to test yourself for real? Open the **Quiz**.',
	'tutorial.step6':
		'Drag a name from the tray onto its region. Try **Sicilia**: the big island off the toe of the boot.',
	'tutorial.step7':
		'Now get one wrong on purpose: drop **Sardegna** anywhere on the mainland. The region you hit flashes red, and Sardegna is shown where it really is.',
	'tutorial.step8': 'Not sure where a region is? Look it up in the **overview**.',
	'tutorial.step9': 'Found Sardegna? Go back to the **Quiz**.',
	'tutorial.step10':
		'The regions you placed are still marked. Place a name right three times in a row and it counts as known — **Known** shows how far you have got.',
	'tutorial.step11':
		'Last one: the **Tour** flies you to each region in turn and shows its name. Open it.'
};

const de: Dictionary = {
	'nav.maps': 'Karten',
	'nav.overview': 'Übersicht',
	'nav.explore': 'Gewusst',
	'retention.known': 'Gewusst',
	'retention.nearly': 'Fast',
	'retention.seen': 'Einmal',
	'nav.quiz': 'Quiz',
	'nav.tour': 'Tour',
	'nav.loading': 'Lädt…',

	'home.subtitle': 'Wähle eine Demokarte zum Erkunden.',
	'home.recent': 'Zuletzt geöffnet',
	'home.favourites': 'Favoriten',
	'home.allMaps': 'Alle Karten',
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
	'mapType.prefectures': 'Präfekturen',
	'mapType.districts': 'Bezirke',
	'mapType.governorates': 'Gouvernements',
	'mapType.cities': 'Städte',
	'mapType.citiesEast': 'Städte — Osten',
	'mapType.citiesCenter': 'Städte — Mitte',
	'mapType.citiesWest': 'Städte — Westen',

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
	'quiz.backToMaps': 'Zurück zu den Karten',
	'quiz.playAgain': 'Nochmal spielen',
	'quiz.resizeTrayAriaLabel': 'Größe der Namensablage anpassen',

	'tour.prev': '‹ Zurück',
	'tour.replay': 'Nochmal',
	'tour.pause': 'Pause',
	'tour.play': '▶ Abspielen',
	'tour.next': 'Weiter ›',
	'tutorial.button': 'Tutorial',
	'tutorial.start': "Los geht's",
	'tutorial.skip': 'Überspringen',
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
		'Lerne die Karte, indem du mit ihr spielst. Dieses kurze Tutorial dauert etwa drei Minuten, und du probierst jeden Teil der App selbst aus. Was du dabei machst, zählt nicht für deinen Fortschritt.',
	'tutorial.outro.title': 'Alles bereit',
	'tutorial.outro.body':
		'Wähle eine beliebige Karte und leg los. Tipp: Mit dem Stern bleibt eine Karte oben in deiner Liste. Du kannst dieses Tutorial jederzeit über die Schaltfläche „Tutorial“ wiederholen.',
	'tutorial.step1': 'Fangen wir mit einer Karte an. Öffne **Regionen** unter Italy.',
	'tutorial.step2':
		'Zoome mit dem Mausrad oder den Tasten **+** und **−**, und ziehe die Karte, um dich zu bewegen. Probier es aus.',
	'tutorial.step2.touch':
		'Zoome mit zwei Fingern oder den Tasten **+** und **−**, und verschiebe die Karte mit einem Finger. Probier es aus.',
	'tutorial.step3':
		'Das ist die **Übersicht**: Hier steht jede Region mit ihrem Namen. Fahre mit der Maus über einen Namen, um ihn zu vergrößern.',
	'tutorial.step3.touch':
		'Das ist die **Übersicht**: Hier steht jede Region mit ihrem Namen. Tippe auf einen Namen, um ihn zu vergrößern.',
	'tutorial.step4':
		'**Gewusst** zeigt, wie gut du diese Karte kennst: die Namen, die du richtig platziert hast, so deutlich, wie du sie kennst. Öffne es und klicke auf eine Region, um zu sehen, welche es ist.',
	'tutorial.step4.touch':
		'**Gewusst** zeigt, wie gut du diese Karte kennst: die Namen, die du richtig platziert hast, so deutlich, wie du sie kennst. Öffne es und tippe auf eine Region, um zu sehen, welche es ist.',
	'tutorial.step5': 'Bereit für den echten Test? Öffne das **Quiz**.',
	'tutorial.step6':
		'Ziehe einen Namen aus der Ablage auf seine Region. Versuch es mit **Sicilia**, der großen Insel vor der Stiefelspitze.',
	'tutorial.step7':
		'Jetzt ein Fehler mit Absicht: Lege **Sardegna** irgendwo auf dem Festland ab. Die getroffene Region blinkt rot, und Sardegna wird dort gezeigt, wo sie wirklich liegt.',
	'tutorial.step8': 'Nicht sicher, wo eine Region liegt? Schau in der **Übersicht** nach.',
	'tutorial.step9': 'Sardegna gefunden? Dann zurück zum **Quiz**.',
	'tutorial.step10':
		'Deine platzierten Regionen sind noch markiert. Dreimal hintereinander richtig, und ein Name gilt als gewusst — **Gewusst** zeigt, wie weit du bist.',
	'tutorial.step11':
		'Zum Schluss die **Tour**: Sie fliegt dich nacheinander zu jeder Region und zeigt ihren Namen. Öffne sie.'
};

const it: Dictionary = {
	'nav.maps': 'Mappe',
	'nav.overview': 'Panoramica',
	'nav.explore': 'Conoscenza',
	'retention.known': 'Sai',
	'retention.nearly': 'Quasi',
	'retention.seen': 'Una volta',
	'nav.quiz': 'Quiz',
	'nav.tour': 'Tour',
	'nav.loading': 'Caricamento…',

	'home.subtitle': 'Scegli una mappa demo da esplorare.',
	'home.recent': 'Recenti',
	'home.favourites': 'Preferiti',
	'home.allMaps': 'Tutte le mappe',
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
	'mapType.prefectures': 'Prefetture',
	'mapType.districts': 'Distretti',
	'mapType.governorates': 'Governatorati',
	'mapType.cities': 'Città',
	'mapType.citiesEast': 'Città — Est',
	'mapType.citiesCenter': 'Città — Centro',
	'mapType.citiesWest': 'Città — Ovest',

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
	'quiz.backToMaps': 'Torna alle mappe',
	'quiz.playAgain': 'Gioca ancora',
	'quiz.resizeTrayAriaLabel': 'Ridimensiona il vassoio dei nomi',

	'tour.prev': '‹ Indietro',
	'tour.replay': 'Riguarda',
	'tour.pause': 'Pausa',
	'tour.play': '▶ Riproduci',
	'tour.next': 'Avanti ›',
	'tutorial.button': 'Tutorial',
	'tutorial.start': 'Inizia',
	'tutorial.skip': 'Salta',
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
		"Impara la mappa giocandoci. Questo breve tutorial dura circa tre minuti e proverai in prima persona ogni parte dell'app. Quello che fai qui non conta per i tuoi progressi.",
	'tutorial.outro.title': 'Tutto pronto',
	'tutorial.outro.body':
		"Scegli una mappa qualsiasi e gioca. Suggerimento: con la stella una mappa resta in cima all'elenco. Puoi rifare questo tutorial quando vuoi con il pulsante Tutorial.",
	'tutorial.step1': 'Iniziamo con una mappa. Apri **Regioni**, sotto Italy.',
	'tutorial.step2':
		'Usa la rotellina del mouse o i pulsanti **+** e **−** per lo zoom, e trascina la mappa per spostarti. Prova ora.',
	'tutorial.step2.touch':
		'Usa due dita o i pulsanti **+** e **−** per lo zoom, e trascina la mappa con un dito per spostarti. Prova ora.',
	'tutorial.step3':
		'Questa è la **panoramica**, dove ogni regione mostra il suo nome. Passa il mouse su un nome per ingrandirlo.',
	'tutorial.step3.touch':
		'Questa è la **panoramica**, dove ogni regione mostra il suo nome. Tocca un nome per ingrandirlo.',
	'tutorial.step4':
		'**Conoscenza** mostra quanto conosci questa mappa: i nomi che hai posizionato bene, con la forza con cui li sai. Aprilo e clicca una regione per scoprire qual è.',
	'tutorial.step4.touch':
		'**Conoscenza** mostra quanto conosci questa mappa: i nomi che hai posizionato bene, con la forza con cui li sai. Aprilo e tocca una regione per scoprire qual è.',
	'tutorial.step5': 'Ora la prova vera: apri il **Quiz**.',
	'tutorial.step6':
		"Trascina un nome dal vassoio sulla sua regione. Prova con **Sicilia**, l'isola grande davanti alla punta dello stivale.",
	'tutorial.step7':
		'Ora sbaglia apposta: lascia **Sardegna** in un punto qualsiasi della penisola. La regione che hai toccato lampeggia in rosso e Sardegna viene mostrata dove si trova davvero.',
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
// build time, when localStorage doesn't exist.
function loadInitialLanguage(): Language {
	if (typeof localStorage === 'undefined') return 'en';
	const stored = localStorage.getItem(STORAGE_KEY);
	return isLanguage(stored) ? stored : 'en';
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
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, language);
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
