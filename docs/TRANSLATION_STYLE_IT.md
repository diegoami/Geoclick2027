# Translating Geoclick's name-facts into Italian (FT-50)

> The brief each translator is given, one country file at a time
> ([PLAN_V0.10.md](PLAN_V0.10.md), FT-50). Workflow: `npm run translate-facts
-- --country=<c> --lang=it --extract=<c>.en.json`, translate into
> `<c>.it.json` following this file, `--merge=<c>.it.json` (it rejects wrong
> counts, unknown places, a leftover em dash or a straight apostrophe), then
> `npm run refresh-facts-hooks` and commit the country on its own.

Geoclick is a geography game. When a player taps a place on the map, a card
shows ONE of these sentences, alone, under a short derived line (position,
coast, biggest city). The sentences were written carefully in English; your
job is to write the Italian a native Italian writer would have written — not
translated prose. The product owner is a native Italian speaker and will
spot-check your work. **The failure mode to avoid is not wrong facts: it is
stilted, plausible prose that a native reader finds grating.**

## Hard rules

1. **Same sentences, same order, same count.** Sentence N in Italian is
   sentence N in English (the app falls back to English by position).
2. **Add nothing, drop nothing.** No new facts, no lost facts. Keep every
   hedge: "probably" → "probabilmente"; "the derivation is contested" →
   "l'etimologia è discussa"; "perhaps", "possibly", "nobody is sure"
   stay hedged. Do not resolve a doubt the English leaves open.
3. **One sentence stays one sentence** (it must fit one line of a card; if
   the English is long, the Italian may be about as long, not longer).
4. **Each sentence must stand alone** — it is shown without the others.
5. Where English wordplay or an English-only idiom does not carry, rephrase
   to carry the MEANING. Never invent a replacement fact.

## House style (from the 60 Italian sentences the product owner approved)

- The English em dash "—" usually becomes a **colon** in Italian (see
  examples); sometimes a comma reads better. Never keep "—".
- Glosses of names go in **straight double quotes**: "il foro di Giulio".
- Apostrophe: the typographic ’ (U+2019), e.g. l’Adige, d’Italia — as in the
  approved sentences. Never the straight ' inside Italian words.
- "worn-down Latin X" → "X consumato dal tempo" or "il latino X, consumato dal
  tempo" — whatever reads naturally in the sentence.
- "Named for / after X" → "Prende il nome da X".
- Numbers in Italian format: 600.000 · 2,5 milioni · 1.200 km. Dates: 25 a.C.,
  30 d.C., "nel 1861", "fino al 1919".
- **Place names:** use the established Italian exonym where one exists and is
  what an Italian reader would use (Lisbona, Siviglia, Saragozza, Parigi,
  Borgogna, Bretagna, Andalusia, Baviera, Monaco di Baviera, Colonia, Pechino,
  Nuova York is NOT used — New York stays). Otherwise keep the local name.
  Keep the _etymon_ itself (a Latin, Arabic, Celtic, Basque… word) as written
  in the English, with its gloss translated.
- **People:** the conventional Italian form where one exists (Giulio Cesare,
  Carlo Magno, Enrico IV, Giacomo II, Alfonso X), otherwise as in English.
- Peoples/tribes: Italian forms (i Liguri, i Galli, i Visigoti, i Mori, i
  Lusitani, i Baschi, i Celti, gli Arabi).
- Avoid anglicisms and calques ("fare senso", "realizzare" for "realise",
  "eventualmente" for "eventually", "assumere" for "assume"). Prefer the plain
  word an Italian writer would choose. Avoid bureaucratic register.

## Approved examples (English → Italian, the voice to match)

- Two places in one name: Trento the city, and the upper valley of the Adige, the river that runs the length of it.
  → Due luoghi in un solo nome: Trento, la città, e l’alta valle dell’Adige, il fiume che la percorre per tutta la sua lunghezza.
- Italy’s richest region per head, and the one that keeps most of its own taxes — a deal struck in 1972 to settle German-speaking unrest.
  → La regione più ricca d’Italia per abitante, e quella che trattiene la maggior parte delle proprie tasse: un patto del 1972 per placare il malcontento dei germanofoni.
- Friuli is worn-down Latin Forum Iulii, "Julius's forum" — Julius Caesar's market town, now Cividale.
  → Friuli è il latino Forum Iulii, "il foro di Giulio", consumato dal tempo: il borgo mercato di Giulio Cesare, oggi Cividale.
- Friulian is its own Romance language, not an Italian dialect, and about 600,000 people still speak it.
  → Il friulano è una lingua romanza a sé, non un dialetto italiano, e circa 600.000 persone lo parlano ancora.
- Named for the Veneti, who were living here before Rome was — the same root as Venice itself.
  → Prende il nome dai Veneti, che vivevano qui prima che Roma esistesse: la stessa radice di Venezia.
- The mainland that Venice ruled for four centuries; the city is the small part, the Veneto is the rest.
  → La terraferma che Venezia governò per quattro secoli; la città è la parte piccola, il Veneto è tutto il resto.
- The valley of Aosta, and Aosta is worn-down Augusta Praetoria — the town the Emperor Augustus founded in 25 BC.
  → La valle di Aosta, e Aosta è Augusta Praetoria consumata dal tempo: la città che l’imperatore Augusto fondò nel 25 a.C.
- Italy's smallest region, and the only one that is a single valley: one river, one road, walls of rock either side.
  → La regione più piccola d’Italia, e l’unica che è una sola valle: un fiume, una strada, pareti di roccia ai due lati.
- Named for the Longobards, the "long-beards", a Germanic people who took northern Italy in 568 and ruled it for two centuries.
  → Prende il nome dai Longobardi, i "dalle lunghe barbe", un popolo germanico che nel 568 conquistò l’Italia settentrionale e la governò per due secoli.
- In the Middle Ages its bankers were so well known that a Lombard was a moneylender — London's Lombard Street is named after them.
  → Nel Medioevo i suoi banchieri erano così noti che "longobardo" significava usuraio: Lombard Street a Londra prende il nome da loro.
- It produces about a fifth of Italy’s entire economy — more than the whole of Greece.
  → Produce circa un quinto dell’intera economia italiana: più della Grecia intera.
- Literally "at the foot of the mountains" — ai piedi dei monti, the Alps that wrap it on three sides.
  → Letteralmente "ai piedi dei monti": le Alpi che la cingono su tre lati.
- The road is why almost every city here sits in a row: Piacenza, Parma, Reggio, Modena, Bologna, Rimini.
  → È per via di quella strada che quasi ogni città qui è allineata: Piacenza, Parma, Reggio, Modena, Bologna, Rimini.
- Named for the Ligures, who were here before the Romans and before the Celts — nobody is sure what language they spoke.
  → Prende il nome dai Liguri, che erano qui prima dei Romani e prima dei Celti: nessuno sa con certezza quale lingua parlassero.
- The Ligurian Sea is named after the region, not the other way round.
  → È il Mar Ligure a prendere il nome dalla regione, non il contrario.

Note what they do: they restructure where Italian wants it ("È il Mar Ligure a
prendere il nome…"), they drop an English gloss that would be redundant in
Italian ("ai piedi dei monti" is already Italian), and they never sound
translated.

## Special case: Italian places

When the place itself is Italian (Italy's provinces), the English sometimes
explains an Italian word to an English reader ("Literally 'at the foot of the
mountains' — ai piedi dei monti"). In Italian, drop the redundant gloss and
say it once, as the Piemonte example does.

## Output

Write a JSON file with EXACTLY the same keys and shape as the input English
file: for each place a list of Italian sentences; where the input is split by
kind (`{ "region": [...], "city": [...] }`), split the output the same way.
UTF-8, tab-indented. The merge step checks it; fix anything it reports.
If the English itself looks wrong, say so rather than translating the error:
the first wave found one (Castel del Monte is on the one-cent coin).
