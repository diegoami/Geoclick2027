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
	| 'nav.quiz'
	| 'nav.tour'
	| 'nav.loading'
	| 'home.subtitle'
	| 'home.download.lead'
	| 'home.download.link'
	| 'home.due.upToDate'
	| 'home.due.toReview'
	| 'home.lastResult'
	| 'home.mistakeCount.one'
	| 'home.mistakeCount.other'
	| 'mapType.regions'
	| 'mapType.towns'
	| 'mapType.states'
	| 'mapType.provinces'
	| 'mapType.prefectures'
	| 'mapType.districts'
	| 'quiz.practiceModePrefix'
	| 'quiz.subtitle'
	| 'quiz.upToDate.title'
	| 'quiz.upToDate.body'
	| 'quiz.practiceAllRegions'
	| 'quiz.closeAriaLabel'
	| 'quiz.allCaughtUp'
	| 'quiz.done'
	| 'quiz.scoreLineRest'
	| 'quiz.totalMistakes.one'
	| 'quiz.totalMistakes.other'
	| 'quiz.revealedNote'
	| 'quiz.nextReview.one'
	| 'quiz.nextReview.other'
	| 'quiz.backToMaps'
	| 'quiz.practiceNote'
	| 'quiz.playAgain'
	| 'quiz.resizeTrayAriaLabel'
	| 'tour.prev'
	| 'tour.replay'
	| 'tour.pause'
	| 'tour.play'
	| 'tour.next';

type Dictionary = Record<TranslationKey, string>;

const en: Dictionary = {
	'nav.maps': 'Maps',
	'nav.overview': 'Overview',
	'nav.quiz': 'Quiz',
	'nav.tour': 'Tour',
	'nav.loading': 'Loading…',

	'home.subtitle': 'Pick a demo map to explore.',
	'home.download.lead': 'Prefer an app?',
	'home.download.link': 'Download for Windows or Android',
	'home.due.upToDate': 'No reviews needed',
	'home.due.toReview': '{count} to review',
	'home.lastResult': 'Last: {perfect}/{total}',
	'home.mistakeCount.one': '({count} mistake)',
	'home.mistakeCount.other': '({count} mistakes)',

	'mapType.regions': 'Regions',
	'mapType.towns': 'Towns',
	'mapType.states': 'States',
	'mapType.provinces': 'Provinces',
	'mapType.prefectures': 'Prefectures',
	'mapType.districts': 'Districts',

	'quiz.practiceModePrefix': 'Practice mode —',
	'quiz.subtitle': 'Drag each name onto its region — {placed} / {total} placed',
	'quiz.upToDate.title': 'Up to date!',
	'quiz.upToDate.body': 'No reviews needed on this map right now.',
	'quiz.practiceAllRegions': 'Practice all regions',
	'quiz.closeAriaLabel': 'Close and view the map',
	'quiz.allCaughtUp': 'All caught up!',
	'quiz.done': 'Done!',
	'quiz.scoreLineRest': '/ {total} placed correctly on the first try.',
	'quiz.totalMistakes.one': '{count} total mistake.',
	'quiz.totalMistakes.other': '{count} total mistakes.',
	'quiz.revealedNote': '{count} revealed after too many misses.',
	'quiz.nextReview.one': 'Next review in {count} day.',
	'quiz.nextReview.other': 'Next review in {count} days.',
	'quiz.backToMaps': 'Back to maps',
	'quiz.practiceNote': "Practice results don't affect your review schedule.",
	'quiz.playAgain': 'Play again',
	'quiz.resizeTrayAriaLabel': 'Resize name tray',

	'tour.prev': '‹ Prev',
	'tour.replay': 'Replay',
	'tour.pause': 'Pause',
	'tour.play': '▶ Play',
	'tour.next': 'Next ›'
};

const de: Dictionary = {
	'nav.maps': 'Karten',
	'nav.overview': 'Übersicht',
	'nav.quiz': 'Quiz',
	'nav.tour': 'Tour',
	'nav.loading': 'Lädt…',

	'home.subtitle': 'Wähle eine Demokarte zum Erkunden.',
	'home.download.lead': 'Lieber als App?',
	'home.download.link': 'Für Windows oder Android herunterladen',
	'home.due.upToDate': 'Keine Wiederholung nötig',
	'home.due.toReview': '{count} zu wiederholen',
	'home.lastResult': 'Zuletzt: {perfect}/{total}',
	'home.mistakeCount.one': '({count} Fehler)',
	'home.mistakeCount.other': '({count} Fehler)',

	'mapType.regions': 'Regionen',
	'mapType.towns': 'Städte',
	'mapType.states': 'Staaten',
	'mapType.provinces': 'Provinzen',
	'mapType.prefectures': 'Präfekturen',
	'mapType.districts': 'Bezirke',

	'quiz.practiceModePrefix': 'Übungsmodus —',
	'quiz.subtitle': 'Ziehe jeden Namen auf seine Region — {placed} / {total} platziert',
	'quiz.upToDate.title': 'Alles aktuell!',
	'quiz.upToDate.body': 'Für diese Karte ist gerade keine Wiederholung nötig.',
	'quiz.practiceAllRegions': 'Alle Regionen üben',
	'quiz.closeAriaLabel': 'Schließen und Karte ansehen',
	'quiz.allCaughtUp': 'Alles nachgeholt!',
	'quiz.done': 'Fertig!',
	'quiz.scoreLineRest': 'von {total} beim ersten Versuch richtig platziert.',
	'quiz.totalMistakes.one': '{count} Fehler insgesamt.',
	'quiz.totalMistakes.other': '{count} Fehler insgesamt.',
	'quiz.revealedNote': '{count} nach zu vielen Fehlversuchen aufgedeckt.',
	'quiz.nextReview.one': 'Nächste Wiederholung in {count} Tag.',
	'quiz.nextReview.other': 'Nächste Wiederholung in {count} Tagen.',
	'quiz.backToMaps': 'Zurück zu den Karten',
	'quiz.practiceNote': 'Übungsergebnisse wirken sich nicht auf deinen Wiederholungsplan aus.',
	'quiz.playAgain': 'Nochmal spielen',
	'quiz.resizeTrayAriaLabel': 'Größe der Namensablage anpassen',

	'tour.prev': '‹ Zurück',
	'tour.replay': 'Nochmal',
	'tour.pause': 'Pause',
	'tour.play': '▶ Abspielen',
	'tour.next': 'Weiter ›'
};

const it: Dictionary = {
	'nav.maps': 'Mappe',
	'nav.overview': 'Panoramica',
	'nav.quiz': 'Quiz',
	'nav.tour': 'Tour',
	'nav.loading': 'Caricamento…',

	'home.subtitle': 'Scegli una mappa demo da esplorare.',
	'home.download.lead': "Preferisci un'app?",
	'home.download.link': 'Scarica per Windows o Android',
	'home.due.upToDate': 'Nessuna ripetizione necessaria',
	'home.due.toReview': '{count} da ripassare',
	'home.lastResult': 'Ultimo: {perfect}/{total}',
	'home.mistakeCount.one': '({count} errore)',
	'home.mistakeCount.other': '({count} errori)',

	'mapType.regions': 'Regioni',
	'mapType.towns': 'Città',
	'mapType.states': 'Stati',
	'mapType.provinces': 'Province',
	'mapType.prefectures': 'Prefetture',
	'mapType.districts': 'Distretti',

	'quiz.practiceModePrefix': 'Modalità allenamento —',
	'quiz.subtitle': 'Trascina ogni nome sulla sua regione — {placed} / {total} posizionati',
	'quiz.upToDate.title': 'Tutto aggiornato!',
	'quiz.upToDate.body': 'Al momento non ci sono ripetizioni da fare su questa mappa.',
	'quiz.practiceAllRegions': 'Allenati su tutte le regioni',
	'quiz.closeAriaLabel': 'Chiudi e guarda la mappa',
	'quiz.allCaughtUp': 'Tutto recuperato!',
	'quiz.done': 'Fatto!',
	'quiz.scoreLineRest': 'su {total} posizionati correttamente al primo tentativo.',
	'quiz.totalMistakes.one': '{count} errore in totale.',
	'quiz.totalMistakes.other': '{count} errori in totale.',
	'quiz.revealedNote': '{count} svelati dopo troppi tentativi sbagliati.',
	'quiz.nextReview.one': 'Prossima ripetizione tra {count} giorno.',
	'quiz.nextReview.other': 'Prossima ripetizione tra {count} giorni.',
	'quiz.backToMaps': 'Torna alle mappe',
	'quiz.practiceNote': "I risultati dell'allenamento non influiscono sul piano di ripasso.",
	'quiz.playAgain': 'Gioca ancora',
	'quiz.resizeTrayAriaLabel': 'Ridimensiona il vassoio dei nomi',

	'tour.prev': '‹ Indietro',
	'tour.replay': 'Riguarda',
	'tour.pause': 'Pausa',
	'tour.play': '▶ Riproduci',
	'tour.next': 'Avanti ›'
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
	base: 'home.mistakeCount' | 'quiz.totalMistakes' | 'quiz.nextReview',
	count: number,
	params: Record<string, string | number>
): string {
	const key = (count === 1 ? `${base}.one` : `${base}.other`) as TranslationKey;
	return interpolate(dictionaries[currentLanguage][key], params);
}
