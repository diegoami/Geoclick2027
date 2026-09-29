# Geoclick — Decisions

A scannable log of *why* the project works the way it does — decisions
made along the way, with the reasoning, not the implementation detail.
For "what was built and how it was verified," see the relevant
iteration in [ROADMAP.md](ROADMAP.md) or the system description in
[ARCHITECTURE.md](ARCHITECTURE.md); this file exists so "why did we
decide X" doesn't require digging through either. Workflow/process *rules*
(how the implementing agent works in this repo) live in [AGENTS.md](AGENTS.md), not here
— that file is read in full at the start of every session, so it states
the rule and nothing else. Where a rule was learned the hard way, the
story that justifies it lives here, under its own heading, and AGENTS.md
points at it by name.

Keep this updated the same way as the other docs: when a decision gets
made, made explicitly to correct an earlier one, or gets revisited, add
or amend an entry here as part of that change, not as an afterthought.

## AGENTS.md is the one instructions file, and reviews start from OpenCode (2026-09-27)

- **One instructions file.** `CLAUDE.md`'s content moved into `AGENTS.md`, and
  `CLAUDE.md` is now a comment plus `@AGENTS.md`. Claude Code reads `CLAUDE.md`
  (which pulls in `AGENTS.md`); OpenCode and every other tool read `AGENTS.md`.
  The reverse arrangement — `AGENTS.md` pointing at `CLAUDE.md`, plus the
  "where it says Claude, read the implementing agent" translation — did not
  survive: two files, one idea. diegoami/discola-web made the same migration
  ([PR #72](https://github.com/diegoami/discola-web/pull/72)).
- **Only releases are reviewed, and the review starts from OpenCode.** The
  pasted `review-handoff` prompt is gone. The reviewer's job is written once in
  `.opencode/agents/release-reviewer.md` (a `primary` agent with `edit: deny`
  and `external_directory: allow`, so it can make its worktree beside the
  checkout but cannot edit); the owner starts it with
  `/review-release <milestone issue>` or
  `opencode run -m <provider/model> --command review-release <issue>`. Neither
  the command nor the agent sets a `model`, so the model the owner picks is the
  one used. Skills stay in `.claude/skills/`, which OpenCode reads; the skill
  now only fills in the milestone issue, gives the owner the command and
  processes the verdict.
- **Ad hoc worktrees.** An implementing session uses a worktree of its own while
  another session may be working in the main checkout, which is common here.
  After a merge, `git switch main && git pull --ff-only`, then delete the merged
  branch. The old rules — every session updates the main checkout on start, and
  the full worktree layout — are gone. Sessions update `docs/HANDOVER.md` on
  every change of state; the chat checkpoint template and its 5–6 turn rhythm
  are gone.

## Commit trailers name the model (history, moved here 2026-09-27)

- **Rule:** end every commit with a trailer naming the model that did the work,
  and the tool when it is not Claude Code (`AGENTS.md`, *Commit messages*). It
  was left stale once already — keep it current.
- **History.** 116 commits trailered "Sonnet 5" up to 2026-09-13, then 274
  trailered "Opus 5". 32 trailered "DeepSeek V4.1 Flash" from 2026-09-21, with
  ChatGPT GPT-5.6 Luna (high) reviewing its PRs. On 2026-09-23 the implementing
  model became Claude Opus 5.5; the same day, reviews moved to an independent
  model at milestones, recorded on GitHub. On 2026-09-25 FT-73 (the new
  countries' facts, `docs/PLAN_V0.12.md`) went briefly to Codex, which stalled
  before pushing anything; it came back to Claude Opus 5.5 the same day, run in
  a session of its own. From 2026-09-27 work may also be done in OpenCode, by
  more than one model; the milestone reviewer is then another model in
  OpenCode.

## Three fixes from tablet play after v0.11.0 (2026-09-24)

Raised by the product owner after playing `v0.11.0` on a tablet.

- **Terrain off and on again left the map without its names.** Hidden,
  the terrain layers let MapLibre drop the source's tiles; shown again, the
  source reports loaded with nothing in it, so the draw found no names and
  never retried. Now a draw that finds nothing waits for the tiles, as a
  first load does, and keeps waiting through a "loaded" that comes before
  them (`terrainLayer.ts`). Switching off still drops the wait (FT-54).
- **The credit line and the version badge no longer sit on the Quiz's
  names.** A panel that covers the bottom of the map - the tray, the Tour's
  controls - publishes how much it covers (`mapBottomOverlay.ts`), and
  app.css lifts MapLibre's bottom controls and the badge by that much. Two
  measures, not one: the credit is inside the map, the badge is fixed to
  the window. The badge moves to the bottom-left, because the credit and
  the badge had shared the bottom-right corner on every map screen.
- **On a narrow screen the credit starts folded behind its (i).** MapLibre
  opens it spread across the bottom and folds it only on the first drag;
  `geoclickMap.ts` folds it the moment MapLibre makes it compact. Watched
  with a MutationObserver, not on a map event: the credit turns compact
  when its text comes in from the sources, and neither `load` nor the first
  `idle` lines up with that. This makes batch D's "collapsed behind (i) on
  a narrow screen" true.
- **A button under the zoom control hides the map bar** (the tabs, the
  map's name, the pills) for a clear map during a round. A MapLibre control,
  so it stays where it is while everything else goes, and the way back is
  under the finger that hid them. **Session-only**, as the chosen names
  are (#11): it holds from map to map for the sitting, and a fresh start
  shows the buttons, so nobody has to rediscover how to get them back.
  While the tutorial runs the bar shows anyway: its steps point at the
  tabs and the pills.

## Poland's powiats under ODbL, and eleven more countries (2026-09-24, #39 batch E)

- **Poland's 380 powiats come from OpenStreetMap** (owner's answer,
  2026-09-24: yes to ODbL). What that asks: every map built from it says
  "© OpenStreetMap contributors, ODbL", which the credit line added in
  batch D already shows; and those five maps' boundaries, the one
  derived database, stay under ODbL. It reaches nothing else - not the
  app's code, not the other maps, not the facts.
- **Names as Poles write them**: "powiat oleski", and a city with powiat
  rights by its name. OpenStreetMap names eleven land powiats in English
  after their seat ("Siedlce County", "Colberg County" for Kołobrzeg's),
  so `admin2.ts` gives them their Polish names. Ten names occur twice in
  Poland (a powiat brzeski in Opolskie and in Małopolskie), and a map id
  comes from its name, so each of the twenty gets its voivodeship,
  "powiat brzeski (Opolskie)", on every map it is on, not just where both
  meet (`--disambiguate-by`).
- **Five parts of 62-85**, by voivodeship, the way Germany's Kreise are
  split: North (the four coastal and Kuyavian ones), West, East
  (Mazowieckie, Podlaskie, Łódzkie), South-East, South.
- **Eleven countries new to the app, from Natural Earth**, picked by the
  owner's leave ("you are free to pick them") and by whether Natural
  Earth's admin-1 layer is current: Belgium, Czechia, Croatia, Greece,
  Bulgaria, Chile, Peru, South Africa, Iran, Thailand, Saudi Arabia. The
  six with 20 or more towns over 100 000 also get a Towns map; Belgium,
  Czechia, Croatia, Greece and Bulgaria have 3-8, too few for one.
- **Not picked, and why:** Norway (Natural Earth still has the 21 counties
  of before 2020), Morocco (the 16 regions of before 2015), Kenya (the
  eight provinces of before 2013), Serbia (a district twice, names without
  diacritics), Denmark (five regions).
- **Names follow the rule of the rest:** a Latin-script country's own
  language (West-Vlaanderen, Jihomoravský, Požeško-slavonska, Biobío),
  English for Greek, Bulgarian, Persian, Thai and Arabic, as for Russia
  and Ukraine. Two places that share a name are told apart the way their
  own country does: Sofia City and Sofia Province, Lima Metropolitana and
  Lima Provincias, Grad Zagreb and Zagrebačka. South Africa's towns take
  the names of 2004-2021 (Gqeberha, Mthatha, Komani, Kariega).
- **Croatia is named by code**, because Natural Earth's `name` calls
  Požega-Slavonia by its neighbour's name and `name_en` gives the city of
  Zagreb and Zagreb County the same one.
- **No overseas pieces**: Chile without Easter Island and Juan Fernández
  (both in Valparaíso), South Africa without the Prince Edward Islands
  (in the Western Cape) - `--clip` now works on admin-1 maps too. Mount
  Athos, self-governing and in no Greek region, stays a target.

## Admin-2 maps, and the first boundaries not in the public domain (2026-09-24, #39 batch D)

- **Natural Earth first.** Its admin-1 layer is already one level finer
  than the maps showed for France (96 departments), Spain (50 provinces;
  48 without the Canaries, Ceuta and Melilla, as for the communities) and
  Ireland (34 councils, dissolved into the 26 counties people name). The
  same layer gave four countries that had no map: Switzerland's cantons,
  Austria's states, Romania's counties and Ireland's.
- **Not built from it:** Great Britain's 232 units mix London boroughs,
  metropolitan boroughs and unitary authorities, and predate the 2019-23
  reorganisations (Bournemouth and Poole apart, Cumbria whole), so a map of
  them would teach an outdated patchwork. Hungary's counties arrive with
  its 23 cities with county rights as separate holes and broken accents
  ("Gyôr"). Both wait for a better source.
- **Names are the ones each place uses now.** Spain's provinces take their
  only official names (Lleida, Girona, Ourense, A Coruña, Illes Balears);
  Romania's counties get back the diacritics every field of the source
  lost; two Swiss cantons in English or in full become Luzern and
  St. Gallen; two French typos are fixed.
- **Germany's Kreise and the Netherlands' municipalities come from
  geoBoundaries** (owner's answer to #39 Q5: an attribution licence is
  acceptable). geoBoundaries republishes each country's register under its
  own licence: Germany's 400 Kreise are the BKG's, **dl-de/by-2-0 -
  attribution required**; the 344 Dutch municipalities are **CC0**. The
  source files are pinned to one geoBoundaries release commit.
- **Poland's powiats were not built at first.** geoBoundaries' copy is
  from OpenStreetMap, **ODbL** - share-alike, not attribution only, which
  puts the derived tiles under ODbL too. That was a different question
  from the one the owner had answered, so it went back to the owner, who
  said yes the same day: see "Poland's powiats under ODbL" above.
- **The map's credit is now shown.** The tileset always carried it, but the
  pmtiles source never passed it to MapLibre's attribution control, so no
  map ever showed "Natural Earth". Harmless for public-domain data, not for
  dl-de/by-2-0, so `createMap` now gives the control each map.json's
  `attribution`: a line of small print along the bottom edge, collapsed
  behind (i) on a narrow screen.
- **Register names become map names** (`data/scripts/admin2.ts`): "Stuttgart,
  Stadtkreis" is Stuttgart, "Heilbronn, Landkreis" is Landkreis Heilbronn
  (the form that keeps it apart from the city), and the register's
  abbreviations are spelled out as the towns maps spell the towns.
- **Split by state, like the towns.** A register's district carries no
  state, so `--within` gives each one the Natural Earth admin-1 area its
  interior point is in - or, for the Wadden Islands that Natural Earth's
  coarser coast leaves out, the nearest. Germany in the same six parts as
  its towns (Bavaria's 96 Kreise stay one map, as Italy's 110 provinces
  are one), the Netherlands in five.
- **A district shares an id with the town it is named for**, and with it
  the town's authored sentences, where they were written for any kind of
  place: Heidelberg the Stadtkreis is Heidelberg the town, which is right,
  and Sevilla the province shows Sevilla the city's lines, which is the
  same conflation `spain-regions` already has for Madrid. Splitting those
  entries into `region` and `city` lists is authoring work in
  `data/facts/`, left for a later pass.

## Germany's towns come from Wikidata (2026-09-24, #39 batch C)

- **Natural Earth runs out at 58 German places**, and `germany-towns-100k`
  already uses 49. More of Germany needs another source.
- **Wikidata, because it is CC0**: public-domain-equivalent, so the
  sourcing rule above still holds and nothing new goes in the attribution
  beyond a credit. Every German municipality has its official key (AGS,
  P439), whose first two digits are its state, a dated population and
  coordinates. GeoNames (CC BY) and OSM (ODbL) would each have been a
  licence change for the same towns.
- **A committed snapshot, not a live query.** `fetch-wikidata-places.ts`
  writes `data/places/germany.geojson` (992 towns over 15 000, one per
  line, the fetch date in its header); the builders read the file. A map
  rebuilds without a network, and a Wikidata edit changes nothing until
  someone refetches on purpose - the same reason Natural Earth is
  downloaded once. Its fields are named like Natural Earth's places, so
  `build-points-map.ts --source` and `build-facts.ts` read it with the code
  they already had.
- **A town's newest dated population wins**, not the best-rank value: many
  towns carry a preferred census figure next to a newer estimate. Figures
  before 2011, the last census, are ignored.
- **Six parts by state, 60 towns each**: North (SH, HH, NI, HB, MV), West
  (NRW), Center (HE, RP, SL), East (BE, BB, SN, ST, TH), South-West (BW),
  South-East (BY). The proposal had five; Bavaria and Baden-Württemberg
  have 261 towns over 15 000 between them, too many for one map to reach
  below the big cities. Thüringen went east, with the other new states.
- **No town within 5 km of a bigger one** (`--min-spacing`). Around
  Frankfurt, Maintal and Mühlheim am Main are 2 km apart - a few pixels at
  the zoom a map of Hessen opens at, against a 24 px drop target. The next
  town down takes the freed place, so the map spreads out rather than
  shrinking.
- **The 49 towns of `germany-towns-100k` keep their ids**, and with them
  their authored sentences: Wikidata's "Frankfurt am Main" is fixed up to
  the "Frankfurt" the older map and `data/facts/germany.json` use.
  `germany-towns-100k` itself is unchanged.

## Place names in the chosen language (2026-09-26, #71)

The product owner played Europe — Countries in Italian and read FRANCE,
GERMANY, UNITED KINGDOM among Italian sea and mountain names. The #39 rule
("a country is called by its short English name") was mine, not one of the
owner's answers. The owner agreed the change on #71.

- **Countries follow the chosen language**, in English, Italian and German.
  Natural Earth's admin-0 `NAME_IT` / `NAME_DE` are used, with the English
  rule's fixups (`COUNTRY_NAME_FIXUPS_BY_LANGUAGE`): the short current name
  (Cechia, Stati Uniti), and the name a country asks for in every language
  (Côte d'Ivoire, Cabo Verde, Timor-Leste).
- **Towns follow it on maps of several countries only**: the six Capitals
  maps and Europe's five city maps (Mosca, Varsavia; Moskau, Warschau; and
  Rome, Warsaw in English). A country's own maps keep the local name, and
  regions keep theirs everywhere (Bayern, Lombardia). On a map of several
  countries a town is a foreign place, so it gets the reader's name for it.
  On its own country's map it is at home, so it keeps the local one.
- **Some of Natural Earth's names are not shown** (`TOWN_NAMES_NOT_SHOWN`):
  - old ones (Nur-Sultan);
  - English forms this project's rule turned away (Odessa; Vitebsk for
    Vitsyebsk);
  - Italian scholarly transliterations nobody writes (Nižnij Novgorod,
    Donec'k), where the English form reads as well. German's own forms
    (Charkiw) are what German uses, and stay.
  All 455 towns were read to find these.
- **`name` stays the key.** The tiles are joined on it (`promoteId`), and
  ids, progress, Favourites and grading are unchanged. The other names live
  in map.json as `names: { en?, it?, de? }` and never enter the tiles, so
  every tileset rebuilt byte-identical. The app reads a shown name through
  one helper, `targetName()`, and each view renames what's on the map when
  the language changes.
- **The start screen's country rows follow it too (FT-84)**, from the world
  picker's own `names` (`data/maps/world-picker/picker.json`, the same it/de
  set), so the list reads Germania where the map does. The six continents'
  rows already did, through `t('continent.<id>')`. English — and a country
  whose name is the same in every language — keeps the catalog's name: the
  picker carries no `en`, so "Great Britain" and "USA" stay as the catalog
  has them.

## Maps of several countries (2026-09-24, #39)

The product owner asked for continents, the parts of Europe, more of
Germany and a finer level than admin-1. The proposal is
[#39](https://github.com/diegoami/Geoclick2027/issues/39); the owner's
answers to its six questions are on the issue. This entry records what the
first batch (continents and the parts of Europe) settled.

- **A country is what Natural Earth's admin-0 layer draws as its own
  polygon**, if its TYPE is a sovereign state (including 'Sovereignty',
  which is how the source types Cuba and Kazakhstan and nothing else), a
  constituent country, or a disputed or indeterminate territory (Kosovo,
  Palestine, Western Sahara, Somaliland, Northern Cyprus). Dependencies and
  leases are out, and so, by name, are the territories that TYPE lets in:
  the Crown dependencies, Åland, Greenland, and three British overseas
  territories typed Disputed (Gibraltar, the Falklands, the British Indian
  Ocean Territory). No political claim either way; the list is
  `NOT_COUNTRIES` in `data/scripts/multiCountry.ts`.
- **Micro-states are off the Countries maps, on the Capitals maps.** Below
  2 500 km² after the clip (Malta, Andorra, Monaco, most Caribbean and
  Pacific island states), a country is smaller than a slip's drop target at
  a continent's zoom. A capital is a point and works at any size. Vatican
  City is off both: it is 3 km from Rome.
- **Europe has Russia to 60° E; Asia has no Russia.** All of Russia would
  fill Asia and cross the antimeridian, and `russia-regions` already asks
  for it. Every continent is clipped to a box (`--clip`), which also keeps
  France's overseas departments off Europe and Hawaii off North America.
- **Crimea is Ukraine's**, on the Countries maps as on `ukraine-regions`.
  Natural Earth's admin-0 layer draws it in Russia (de facto control);
  `--assign-admin1` moves the Crimea and Sevastopol admin-1 shapes into
  Ukraine before the map is built.
- **A country is called by its short English name**, and by the name it now
  asks for where that changed: Czechia, Côte d'Ivoire, Cabo Verde,
  Timor-Leste, each with the old name as an alias - the rule Kyiv and
  Odesa already follow. Turkey stays Turkey, as on its own map.
  *Amended 2026-09-26 ([#71](https://github.com/diegoami/Geoclick2027/issues/71)):*
  that is its English name. In Italian and German it is shown in that
  language (Francia, Frankreich); see "Place names in the chosen language".
- **A capital is the one the country's constitution names**, several where
  it names several (South Africa's three, Bolivia's two). Natural Earth
  flags the seat of government or the largest city in five places; the
  build swaps in Dodoma, Porto-Novo, Gitega, Naypyidaw and Yamoussoukro and
  drops Dar es Salaam, Cotonou, Bujumbura, Yangon, Abidjan and
  Johannesburg. Astana and Ngerulmud go by their current names. The
  Oceania map stops at the date line, which leaves Samoa and Tonga off.
- **A town has one name on every map it is on.** A map of several
  countries reads each town's name from the field its own country's Towns
  map reads (`LOCAL_NAME_FIELD`), so München is München on Germany and on
  Central Europe. Belgium and Switzerland use Natural Earth's plain NAME,
  since one language field would put Antwerpen in French or Genève in
  German. Each town records its country in map.json, and its authored
  sentences come from that country's file: 32 of Central Europe's 68 towns
  arrive with their name-facts already written. *Amended 2026-09-26
  (#71):* this is still the town's `name`, its key, but a map of several
  countries now shows it in the chosen language (München reads "Munich" in
  English and "Monaco di Baviera" in Italian on Central Europe). A
  country's own maps keep the local name.
- **The five parts of Europe** (owner's answer to Q1): West (France,
  Benelux, the UK, Ireland), Central (Germany, Poland, Czechia, Austria,
  Switzerland, Hungary, Slovakia, Slovenia), East (Ukraine, Belarus,
  Moldova, Romania, Bulgaria, the Baltics, Russia west of 60° E), North
  (the Nordics) and South (Iberia, Italy, the Balkans, Greece). A
  per-country cap (`--max-per-country`) keeps one large country from filling
  a part: Russia alone has more cities over 100 000 west of the Urals than
  the rest of Eastern Europe.
- **A continent is a catalog group like a country**, sorted among them by
  name, until the zoomable world-map start screen replaces the list.

## Translating fact-checked the English (2026-09-23, FT-50)

Every country file was translated by its own subagent, told to translate
faithfully and to *report* any English sentence it thought was wrong. The
reports were checked one by one and about 180 sentences were corrected, in
both languages, each listed in its country's commit message.

- **Correct the source, not just the translation.** A wrong fact is wrong
  for the English reader too; fixing only the Italian would make the two
  disagree. So the English was edited in the same commit as its Italian.
- **Clear errors only.** Arguable claims (Drenthe has "no city of any
  size", Åre is Sweden's biggest ski resort) were left alone; a hedge was
  added where the truth is disputed (Armenia's name, Doğubayazıt's crater).
- **Several were contradictions inside one file** — Ohio and Virginia each
  claimed eight presidents; two provinces each claimed to be the smallest
  (Brazil, Colombia, Turkey). A lint could find these by comparing
  superlatives across a file; not built.
- **Three sentences are new writing**, where the wrong fact had no true
  replacement: Paraíba (Sousa's dinosaur footprints), Wonju (Chiaksan
  National Park), Sukabumi (Mount Gede). Flagged to the product owner.
- **Why it matters for FT-51:** a German pass would re-read the same
  English; running it after these corrections means it starts from the
  better text.

## Region names along the region: an SVG overlay, with the pill as fallback (2026-09-23, FT-64 spike)

The spike drew every region's name along a computed spine on
`italy-regions`, `usa-states`, `germany-states` and `france-regions`, at
real zooms, desktop and phone. Branch `spike/ft-64-stretched-names`
(`f1f8f9b`, not for merge); open any of the four maps with `?spine`
(`?spine=debug` strokes the spine).

- **It reads.** At desktop zooms the maps look like maps: Liguria follows
  its crescent, Puglia and Calabria run down their peninsulas, Florida
  down its own, Emilia-Romagna along the Po; square states keep a level
  name. Spare length goes between the letters, EU4-style, up to 1.6 em.
- **The spine is computed at build time, three points per region.** A
  weighted parabola through the middle of the shape along its principal
  axis — which is exactly a quadratic Bézier, and Mercator-to-screen is
  affine, so `start, control, end` in `map.json` draws the curve at every
  zoom and bearing. About 160 bytes a region. Near-round shapes get a level
  axis; ends narrower than 45 % of the median width are dropped; a curve
  that leaves the shape is retried with more bow, then straight. 2 of 98
  regions got no spine (Maryland, Sachsen) in the spike's sample; across
  all 32 polygon maps it is 17 of about 1 050 (MAPS.md).
- **SVG `textPath`, not a MapLibre `symbol-placement: line` layer.** The
  symbol layer still needs the same build-time spine (as a line in the
  tiles), plus a vendored glyph stack to stay offline, and gives up the
  magnify and the rem floor — to buy native collision, which a name kept
  inside its own region barely needs. The style's `glyphs` URL stays
  unused (see the note in `data/styles/base.json`).
- **A stretched name only where it fits; today's pill everywhere else.**
  The name's size follows the region's width, so on a phone at the
  whole-country view only 3 of Italy's 20 names reach a readable 9 px.
  A name that does not fit — and a region with no spine, and every town —
  keeps the popup pill and its collision pass (FT-23/FT-63). Near-upright
  names read bottom to top, so a hair's change of slope cannot flip one.
- **What a real task has to add.** The SVG names join `labelCollision.ts`
  as fixed obstacles (terrain names overlap them today); the magnify
  (`labelMagnify.ts`) finds popups by DOM, so it needs an SVG hit-test;
  the retention tiers (known / nearly / seen / chosen) need their SVG
  styling; the size floor moves to rem. Explore first; Quiz and Tour
  labels are a separate call. Medium, not Small.
- **Built as FT-66 (2026-09-23), with three choices the spike left open.**
  *Spines come from the committed tiles, not the source shapefile:*
  `build-map.ts` needs the WSL2 toolchain, and rebuilding 32 maps' tiles
  to add a field would churn every tileset; the tiles already hold the
  geometry `mapColors.ts` reads, and a raster mask stitches a region's
  tile-clipped pieces with no polygon union. *The size floor is the
  popup's own, 0.8125 rem:* a stretched name never reads smaller than
  the pill it replaces, which on a phone at the country view leaves
  most names as pills - the intended hybrid. *A stretched name is a hard
  obstacle to every popup except a magnified one*, which still always
  gets its place; a magnified stretched name comes forward (full
  strength, 8 % larger) rather than growing out of its region.
- **Amended 2026-09-23 ([#34](https://github.com/diegoami/Geoclick2027/issues/34)):
  the hybrid is one typography at two sizes, not two styles.** On Argentina,
  where three names were curved and six were orange sans-serif boxes, the
  product owner found the labels "kind of mixed". The size rule is unchanged,
  but on Explore a region's fallback name is now set like its stretched one:
  Georgia capitals, the same ink and halo, and no box, the way an atlas sets
  a small territory. *Towns keep the pill* beside their dot (the owner's
  call), and Quiz and Overview labels keep their boxes: those have no
  stretched names, and the green and gold boxes are a quiz signal of their
  own. *The asked ink darkened* from the accent (4.2:1 on white) to
  `rgb(150, 85, 20)` (about 5.8:1), in both forms, so an asked name is one
  colour however it is drawn. *The hit area lost the pill's padding*,
  accepted pending a tablet check.
  **Superseded for the Quiz, Overview and Tour on 2026-09-25 (FT-74, #46
  Q5):** after playing v0.11.0 on a tablet the product owner wanted a
  region's name to look the same on every screen, so those three views now
  set it the same way; towns still keep the pill. The Quiz's signal moves
  from the box to the ink: a name placed right is the region green-grey, a
  name given away is brown, `rgb(120, 78, 28)` (about 6.6:1 on white).
- **Amended 2026-09-24: the name you just tapped always shows.** A
  stretched name is still a hard obstacle, and at the country view that hid
  small regions boxed in by curved neighbours: Basilicata between PUGLIA and
  CAMPANIA, Umbria, Friuli-Venezia Giulia. The owner tapped Basilicata, got
  its fact card, and saw no name. Now the name whose fact card is open
  (`FOCUSED_CLASS` in `labelCollision.ts`, set by MapView) gets its place the
  way a magnified one does, and competes normally again once the card closes.
  The owner rejected the alternative, curved names giving way to small
  regions: it would drop curved names exactly where the map is busiest.

## The v0.10.0 language decisions (2026-09-22, v0.10.0)

- **Italian first.** The product owner reads Italian, so he catches stilted
  prose immediately — the one failure mode the plan names and no test can
  catch. **German is postponed, not refused**: it has no native reader on
  the project, so its register risk has nobody positioned to catch it.
  Decide it after reading the Italian.
- **Per-sentence English fallback.** A place with two Italian sentences and
  three English ones shows two and one; a half-finished set is partly
  English, never broken. Hiding a card until a whole set is complete was the
  alternative, and it would make a half-translated country worse than an
  untranslated one.
- **No "EN" marker.** A fallen-back sentence reads as English, which is
  honest enough; a tag on a name-fact would clutter the card and imply the
  English is a stopgap rather than the source the translations come from.
- **These unblock [docs/PLAN_V0.10.md](docs/PLAN_V0.10.md).** FT-48 (Italy's
  20 regions, 60 sentences, Italian) is the first task and the only one that
  needs reading before the bulk; the register it sets is then copied for
  5 388 more.

## FT-38 is parked, not superseded (2026-09-20, FT-38)

- **The Wikidata landmark pass stays open, blocked on the same product
  decisions as v0.10.0.** HANDOVER.md had called it probably superseded by
  the 5 448 authored sentences, on the grounds that both exist to give a
  place something memorable.
- **That reasoning does not survive FT-45.** The rule set there is that the
  card says only what the map does not show. A volcano, a national park or
  a UNESCO site inside a region is exactly that — it is not the same
  category as "in the south of the country, no coast", which was cut
  because the map already shows it. On its own criterion, a landmark clause
  qualifies.
- **What actually blocks it is the slot, not the content.** FT-45 reduced
  `factClauses` to at most two short clauses, and the landmark clause was
  written to land in the composed sentence that no longer exists. Reviving
  it means either a new card line — which FT-45 deliberately cut back — or
  folding landmarks into the authored prose, which is a different, manual
  job. Its product choices (which kinds, how many, how phrased) were also
  never settled, and they determine the query.
- **Revisit after the v0.10.0 language decisions, not before.** FT-34 chose
  structured over prose so the derived half would be trilingual for free.
  The authored sentences are prose and need a human translator per
  language. If translating 5 448 of them proves expensive, templated
  landmark facts get *more* attractive, not less — so the order matters:
  decide the languages first, then reconsider this.
- **Closing it would have been the cheaper mistake.** A backlog item
  dismissed on a reason that does not hold is harder to recover than one
  parked with the real blocker written down.

## The name origin is pinned, not rotated (2026-09-19, FT-47)

- **The first fact in an authored list is shown every visit; only the rest
  rotate.** Every file in `data/facts/` is written to the rule that entry
  one is about the NAME, so the card rotating through all of them meant two
  visits in three carried no etymology at all. The product owner, once
  FT-45 had made the card sparse enough to notice: "now I have lost the name
  origin. You went too far with this."
- **It was not FT-45 that lost it.** This had been the behaviour since FT-41
  made the lists three deep, in v0.9.0; the derived paragraph was just
  covering for it. Worth recording, because the obvious fix - put the
  derived line back - would have fixed nothing.
- **It also restores what was asked for in the first place**, when the second
  line was designed: "we keep this line and then a second line with rotating
  facts." The origin was always meant to be the pinned half.
- **So the card is up to three lines**, in descending order of worth: where
  the name comes from (always), something else about the place (a different
  one each visit), and the surviving derived clause (quiet and small). A
  place with only one authored fact shows only the origin.

## The card says only what the map does not (2026-09-19, FT-45)

- **The derived line is gone, bar a clause.** It composed a whole sentence
  from Natural Earth - where the place is, whether it has a coast, what
  range crosses it, its highest point, its neighbours, its population and
  its growth since 1950. The product owner's verdict after using it: "the
  descriptions like 'in the south of the country, no coast' are useless and
  distracting. They should be dropped."
- **The reason is the rule for anything added here later**: "I can see
  myself if it is on the north or on the south." The map is already showing
  you where a place is. A sentence that repeats it puts words in front of
  the thing they describe. What earns its place is what the map does *not*
  show.
- **So what survives is exactly that.** A region keeps its biggest city; a
  town keeps the region it belongs to and its rank by population. Nothing
  keeps a compass point, a coastline, a summit or a neighbour list.
- **The name-fact now leads the card**, with that clause underneath it in
  smaller, quieter type. It used to be the other way round.
- **The data is untouched.** `build-facts.ts` still writes every field and
  `facts.json` still carries them; only `factClauses` chose to stop reading
  them. Bringing a clause back is one line and no rebuild. The cost of that
  choice is about 0.20 MB of the 1.4 MB of facts shipped in every build -
  recorded in MAPS.md rather than quietly paid.
- **This undid FT-42.** The small-screen rotation existed to alternate two
  full lines; one line and a short clause fit together on a phone, so
  `cardLines.ts` and its tests were deleted rather than left as a mechanism
  with nothing to rotate. The entry below is kept for the reasoning, which
  still holds if a second line ever comes back.

## A town's tap target is not its dot (2026-09-19, FT-46)

- **An invisible 22 px circle sits over every 9 px town dot**, and the click
  binds to that. The product owner: "on the known map, the clicking area for
  towns may be too small." It was exactly the dot - 18 px across, fine for a
  mouse and well under the 44 px this app already treats as the floor for a
  finger (the language picker, the zoom buttons, review F8).
- **Bind to the hit layer or the dot, never both.** The hit circle covers
  the dot completely, so two bindings would fire two handlers for one tap
  and toggle a name straight back off. Both MapView and OverviewView bind
  `targets-hit`, not `targets-circle`.
- **It costs nothing to draw and nothing to rebuild.** MapLibre hit-tests
  geometry rather than painted pixels, so a fully transparent layer still
  answers clicks; and it is a style layer over a source that already exists,
  so no tileset changed.

## One line at a time on a small screen (2026-09-19, FT-42) — superseded by FT-45

- **The fact card shows one of its two lines at a time on a phone**, and
  rotates between them. Raised by the product owner while FT-39 was being
  merged: "when it comes to phone and tablets we might have to make cuts,
  we might want to show one line and then we rotate." The card is
  something to read; the map is the thing being learned, and on a phone
  two lines are a real share of it.
- **"Small" means EITHER dimension ≤ 700 px**, not width alone (product
  owner, 2026-09-19). A phone held sideways is wide but short, and short
  is the case that costs the map its space — a width-only breakpoint,
  which is what the rest of the app uses, would miss exactly the worst
  case. The rule is one pure function, `isSmallViewport` in
  `cardLines.ts`, so it can be tested without a browser.
- **It rotates on a timer, every 5 s**, rather than on a tap or a swipe
  (product owner, same day). A tap would need the card to accept pointer
  events, which FT-35 deliberately refused so that a quiz drag crossing
  the card still reaches the map; a swipe would compete with both the
  map's pan and the quiz's drag. A timer needs no gesture at all.
- **The name-fact leads** (product owner, same day). It is the half he
  called the thing he had not seen in other programs, so if a player
  reads only one line it should be that one. Note this is the *opposite*
  order to the large-screen card, where the derived line sits physically
  on top — that layout is FT-35's and is unchanged. The order only
  governs which comes first when they are shown one at a time.
- **Anyone who has asked for less motion gets the whole card instead.**
  Text that changes under the reader is motion, so `prefers-reduced-
  motion: reduce` turns the rotation off — and then showing one line
  would simply hide half the content, so both are shown and the height is
  spent. Those players trade map area for completeness, which is the
  right way round for an accessibility fallback.
- **The saving is real but smaller than "one line instead of two"
  sounds**: measured over five Italian regions, 29 px upright (3.4% of an
  850 px screen) and 22 px sideways (5.5% of a 400 px one). The reason is
  that a name-fact is a whole sentence and wraps to two or three *visual*
  lines at 400 px wide, so removing one *logical* line removes less than
  half the card. Shortening the sentences for small screens, or clamping
  the visible text, would buy more; neither was in scope here.

## Two labelled test steps, not one (2026-09-13, moved here 2026-09-20)

- **"Test locally" and "test the deployment" are reported as two separate,
  explicitly named steps** whenever both apply. Verify locally first — dev
  server, or a production build served locally — and say so; only then check
  the live site, and say that too.
- **Why, and it cost real time:** the Iteration 4 quiz shipped correctly and
  passed every local check, while Netlify kept serving a stale build from a
  stuck production-branch setting. Conflating the two turned "why doesn't
  this feature work" into hours of chasing a feature that was fine. A report
  that does not separate them cannot distinguish a broken feature from a
  broken deploy.
- This rule was in `AGENTS.md` with its story attached until issue #9 moved
  the story here; the rule itself stays there, pointing at this entry.

## Hand a dashboard problem back (2026-09-13, moved here 2026-09-20)

- **Don't go down debugging rabbit holes — webhook configs, CLI internals,
  package source — when the user can fix it in a couple of dashboard clicks.**
  Try the direct tool once or twice; if that does not resolve it cleanly, say
  so and hand it back.
- **Why:** real time went into Netlify's zip/symlink internals and GitHub
  webhook delivery logs, diagnosing a stuck deploy that the user fixed by
  clicking "Trigger deploy" once.
- The rule has since paid for itself more than once — most recently on
  2026-09-19, when an Android emulator stopped rendering mid-release. Three
  attempts, then it was reported as an unverified artifact rather than
  investigated further; a plain `adb kill-server` fixed it the next day.

## Netlify build cost (2026-09-13, moved here 2026-09-20)

- **Build cost is not a constraint** (confirmed by the product owner
  directly). A push to `main` is not something to ration, and release-branch
  indirection to avoid builds is not wanted.
- **Still do not trigger a manual deploy** — via the MCP `deploy-site` tool
  or otherwise — as a debugging step. Push and let the git-triggered build
  run, then prod-check once the local build is known good. That is about
  keeping the two test steps legible (above), not about cost.
- If a deploy genuinely needs triggering by hand, that is the user's call
  from the dashboard. Related: the product owner tracks
  deploy status himself and does not want it reported back unprompted.
- **Superseded in part, 2026-09-22: the product owner stopped deploying.** A
  merge to `main` no longer publishes the web app, so "push and let the
  git-triggered build run" no longer produces a live site to check. Never
  trigger a deploy yourself; restarting them is the product owner's call.

## A milestone is a release tag, reviewed before it is created (2026-09-23)

- **A milestone is a release**: an annotated `vX.Y.Z` tag on `main`, on
  exactly the commit the review agreed with and the release is built from
  (product owner's cross-project definition, adopted after evaluation,
  [#29](https://github.com/diegoami/Geoclick2027/issues/29); amends the
  GitHub-review entry below, the same day). The review runs on a
  **milestone issue** over `git diff <previous tag>..<candidate>`; **the tag
  waits for it**; a BLOCK moves the candidate and brings a re-review
  unasked; a third round without AGREE goes to the owner, who may also tag
  without a review. Proposals and PRs are no longer milestones, and the
  `Review:` line on PRs is gone.
- **Why it was adopted, not just copied:** under #26 the stable tag landed
  on the release PR's merge commit, after a version bump and whatever doc
  commits reached `main` meanwhile. v0.10.0 was reviewed at `3ab4820`
  (versioned `0.10.0-beta.1`) and would have been tagged on a commit nobody
  reviewed. Tag = reviewed SHA = build source closes that. It also drops
  the release branch, the merge-commit rule and beta tags off `main`.
- **What it costs:** a proposal, or a Medium task's PR, no longer gets an
  independent look before merge; a design flaw surfaces at the release
  review. The owner's agreement stays the design gate. The "no re-reviews"
  rule of #26 is reversed for BLOCKs, because the tag cannot go on an
  unreviewed SHA.
- **Adapted here:** a beta is a throwaway version-only commit on the
  candidate, so the candidate already carries `X.Y.Z` and the tested code is
  the reviewed code; `main` takes only the milestone's fixes while its issue
  is open; the round ceiling lives in AGENTS.md, *Releases* (there is no
  PRINCIPLES.md); Claude keeps publishing (standing permission);
  `publish-release.mjs` refuses unless HEAD is the tag and names the
  tagged commit in the notes. Baseline: `v0.9.4` (`5387ff2`), already
  tagged on `main`; the first milestone under these rules is `v0.10.0`.

## An independent model reviews at milestones, on GitHub (2026-09-23, amended the same day)

- *Amended by the entry above: milestones are now release tags only; the
  release PR and the `Review:` line below are gone.*
- **The review is recorded on GitHub by the reviewer itself** (product
  owner, 2026-09-23, [#26](https://github.com/diegoami/Geoclick2027/issues/26),
  adapted from diegoami/discola-web; amends the first version of this
  entry, below). One issue per reproduced finding, labelled `review` plus a
  category; always one AGREE/BLOCK verdict comment naming the SHA; a
  `Review:` line on every milestone PR. Process: AGENTS.md, *Releases*;
  reviewer: `.opencode/agents/release-reviewer.md`.
- **Why GitHub and not a pasted report:** the first version handed the
  owner a prompt whose output was one Markdown report, pasted back into a
  Claude session. Findings then lived in a transcript: no issue to close
  with `Fixes #n`, no verdict on the thread, no record that a review ran
  or found nothing. The owner rejected it before it ran.
- **Milestones only** — a design proposal, a PR that implements one, a
  staged release. Discola also reviews every PR that changes what runs;
  that was dropped here, and so was its re-review after a MUST-FIX fix. A
  small fix inside an agreed plan is covered by the release review. **The
  review is offered, never waited on**: the owner's agreement starts a
  branch and the owner's decision merges, reviewed or not. **Tool-neutral**: the
  owner picks the tool (Codex, DeepSeek, …); the prompt signs "— Reviewer
  (<tool>, <model>)". No `AGENTS.md` was added — the prompt's first line
  does the handover, and a second instruction file would drift.
- **Releases gained a `release/X.Y.Z` PR** so a staged release has a
  thread and a SHA to review; the beta is packaged from its head, so the
  reviewer and the owner see the same build (docs/RELEASES.md).
- *First version, same day:* **Claude works without a per-PR review; at
  milestones the product owner runs an independent model over the
  repository**, superseding the entry below it. What this buys back is
  the thing the fresh-Claude loop traded away: a second model's blind
  spots. What it gives up is a review on every PR; a milestone review sees
  a batch at once, so a bug can sit on `main` until the next one. PR #23
  (FT-63) had one fresh-Claude round before the switch.

## Claude reviews its own PRs (2026-09-23, superseded the same day)

- *Superseded by the entry above.* **Every task PR is reviewed by a fresh
  Claude subagent**, replacing ChatGPT
  GPT-5.6 Luna (high), who had reviewed PRs #10–#21 under opencode. The
  product owner decided it when the implementing model changed to Claude
  Opus 5.5: opencode's `subagent({model: …})` cannot be driven from a Claude
  Code session, so the Luna procedure could not run as written.
- **What is kept:** a reviewer with no memory of the implementation, on
  GitHub, with findings ranked and every one answered — the part that caught
  a blocking finding on four of the seven v0.9.4 PRs (#12–#15).
- **What is traded away:** a second model's blind spots. The original rule
  said a model cannot review its own work with fresh eyes; a fresh context
  answers the "own work" half, not the "same model" half. The reviewer is
  told to distrust the PR body and verify cited lines and tests itself, which
  narrows the gap without closing it.
- Procedure: [docs/REVIEW_LOOP.md](docs/REVIEW_LOOP.md).

## Quiz mechanic

- **Drag-and-drop slip matching, not flashcard recognition/recall.** A
  set of name slips on the game area; drag one onto the region it names,
  drop to confirm. Chosen over an original flashcard-style design because
  it's a more direct test of map knowledge (find the *shape*, not just
  recognize a name) and a clearer visual differentiator from Seterra. The
  two-directional flashcard idea isn't gone, just deferred — nothing
  about drag-to-match blocks adding it later as a second quiz mode. See
  ROADMAP.md's Iteration 4.
- **A third item status, `'revealed'`, not just correct/incorrect.**
  After `MISSES_BEFORE_REVEAL` wrong drops on the same slip, it
  auto-resolves: name shown, slip leaves the tray, but scored and colored
  differently from a real success (excluded from `scoreSession`'s
  `perfect` count, muted color rather than success-green). Reason: a
  slip you keep failing needs a way out, not an infinite retry loop.
  *Amended 2026-09-18 (v0.6.0, FT-20): the threshold is **one** miss.*
  Three tries made a mistake cheap, and nothing warned you before the
  third one gave the answer away (v0.5.0 product review, F9). Now a wrong
  drop ends that name's turn: the region that was hit flashes red, the
  name is placed where it belongs in the "shown" colour, and the
  scheduler grades it `again`, so it returns in the same round and its
  clean streak resets. A `hard` grade (right, but only after a mistake)
  can no longer arise in the quiz; the scheduler still understands it.
- **Solved regions stay permanently labeled ("discovered"), via DOM
  `maplibregl.Popup`s, not a MapLibre symbol layer.** A feature-state-
  driven symbol layer was tried first (matching the pattern already used
  for fill color) and dropped: even with `text-allow-overlap`/`text-
  ignore-placement` set, MapLibre's collision/placement system
  unpredictably hid some labels regardless of opacity — confirmed
  directly via `queryRenderedFeatures` showing a label feature simply
  wasn't in the render results for one region while five others were
  fine.
  *Amended 2026-09-18 (v0.6.0, FT-23): DOM popups had no collision
  system at all, which is why a crowded map was unreadable. They now get
  one of their own, in JS — see "Names never overlap" below for what it
  does and why it is still not a symbol layer.*
- **Drop hit-testing: exact-pixel for hover, a tolerance radius
  (`DROP_TOLERANCE_PX`, 24px) for the drop itself — and the tolerance
  only ever helps the *correct* target land, never reattributes which
  region a wrong drop hit.** Needed because small regions (Bremen,
  Saarland) can be only a couple of screen pixels wide at a normal zoom
  level — exact-pixel-only hit-testing made them nearly impossible to
  hit. The 24px figure came from directly measuring Bremen's actual
  miss distance via `queryRenderedFeatures` at increasing radii, not a
  guess (an initial 14px guess still failed Bremen specifically).
- **A drop only counts as an attempt at all if it lands on or near some
  region.** Dropping outside the map, back onto the name tray (which
  visually overlaps the bottom of the map container), or on empty map
  space (sea, gaps between regions) are all treated as "changed my
  mind" — no error recorded, no wrong-flash, slip just returns to the
  tray. Landing on an actual *different* region still counts as wrong.
  This took three passes to get right (outside-the-page, then the tray-
  overlap case, then empty-space-inside-the-map) — each found by the
  user actually playing the quiz, not anticipated in advance.
- **The quiz fits the map into the space above the name tray** (FT-11,
  2026-09-14). It used to fit to the whole screen, and the tray covers
  the bottom of it, so the southernmost targets started out hidden:
  Sicily on Italy — Regions, at 1280×800 and on phones. Found when the
  tutorial's "try Sicilia" step couldn't be done without panning first.
  The fit happens once, when the tray's default height is first measured;
  resizing the tray afterwards leaves the map where the player put it.

## Persistence & retention

- **Local-first, no user accounts.** Progress lives on the device/
  browser, keyed to nothing but that. Spaced repetition only needs
  somewhere to remember state across sessions on one device — it doesn't
  need a login. Accounts are a separate, later concern (Iteration 8+),
  triggered only by wanting to sync progress *across* devices or a
  public leaderboard, not by spaced repetition itself. See
  ARCHITECTURE.md's Storage section.
- **Iteration ordering: local persistence before spaced repetition**,
  reversed from the original numbering. Spaced repetition has nothing to
  persist into without storage first — building it in the original order
  would mean starting from a design that couldn't actually be exercised
  end to end. See ROADMAP.md's Status section.
- **Same-day quiz progress persists immediately, not just at full
  session completion — but only for a genuinely clean, error-free
  match.** Abandoning a quiz partway through used to save nothing at
  all, forcing a full re-solve of everything (including regions you'd
  already gotten right minutes earlier) if you came back the same day.
  Fixed by persisting each correct match as it happens. But a region you
  fumbled (wrong drop before eventually getting it right) or gave up on
  (revealed) is exactly the one that needs more practice, not less —
  letting it coast as "done" for the rest of the day would work against
  the app's actual purpose. So only `errors === 0` matches persist;
  anything with an error, including a subsequently-corrected one, comes
  back as a completely fresh slip if you reopen the map later the same
  day. Deliberately stops at "today" with no real interval — that's
  Iteration 6's job, this was a same-day stopgap so partial progress
  wasn't thrown away in the meantime.
- **Iteration 6 retires the same-day mechanism above rather than running
  it alongside real spaced-repetition state.** Once `CardState`/
  `dueDate` exists, it's the one source of truth for "is this target
  already handled" — no parallel bookkeeping. A clean win now produces a
  `dueDate` of tomorrow-or-later, which is a strict generalization of
  "stays discovered until the calendar day rolls over," same visible
  effect from a real scheduler instead of a stand-in. A failed/revealed
  grade's resulting `dueDate` has to still land same-day, not get pushed
  to tomorrow by a naive "minimum interval = 1 day" implementation —
  otherwise the already-shipped, already-tested "mistakes resurface the
  same day" behavior regresses. See ROADMAP.md's Iteration 6 section,
  "Consistency review."
- **Only a full fail ("again"/revealed) is forced to repeat the same
  day — a recovered mistake ("hard": correct, but only after a wrong
  drop) graduates normally to "due tomorrow-or-later," not a same-day
  repeat.** A real fork, asked explicitly rather than assumed: strict
  "any mistake means more practice today" (matching Iteration 5's
  same-day rule to the letter) vs. standard spaced-repetition semantics,
  where eventually getting it right still counts as a pass. Decided on
  the latter. "Hard" still builds a weaker interval and lower ease
  factor than "good" would, so it resurfaces sooner than a region
  nailed first try — just not literally later the same day.
- **Every review interval is capped at 365 days (`MAX_INTERVAL_DAYS`)**
  (GC-010, 2026-09-13). Uncapped, `round(interval * easeFactor)` grew
  1 → 6 → 15 → 38 → 95 → 238 → 595 → 1488 days by the 8th clean review
  (the score panel would say "Next review in 2265 days"), and by the 20th
  it overflowed `Date` into a `"NaN-NaN-NaN"` due date — which
  string-compares after every real date, so `isDue` returned false
  forever and the card silently left the review pool, with nothing
  logged. Why a year rather than the review's alternative of 180 days:
  this is a geography game with a few dozen targets per map, not a
  thousands-of-cards exam deck, so reviewing a *mastered* region once a
  year costs the player almost nothing, and a year is the natural
  "do I still know this" horizon for place knowledge. The cap first
  bites at the 7th consecutive clean review (238 × 2.5 = 595 → 365), so
  it only ever affects regions a player demonstrably knows. It also
  makes the Date overflow structurally impossible rather than just
  unlikely. No migration was needed for already-stored cards: a review
  only happens when a card is due, so an interval over 365 days first
  becomes possible at that 7th review, after 1+6+15+38+95+238 = 393 days
  of history — and this app is weeks old, so no stored card can hold an
  overlong interval or a NaN date yet.
- **Ease factor now recovers: a clean ("good") review adds 0.1, up to a
  ceiling of 2.5 (`MAX_EASE_FACTOR`)** (GC-010). Before, "good" left ease
  unchanged and nothing ever raised it, so every "hard" (-0.15) was
  permanent: one fumble followed by 20 perfect reviews still sat at 2.35,
  and a card fumbled every other time slid to the 1.3 floor. +0.1 is
  SM-2's own adjustment for a perfect answer. The ceiling is the default
  on purpose — new cards start at the maximum, and ease exists to slow
  down cards you *struggle* with, not to let a long clean streak compound
  intervals faster than the default rate (the interval cap above bounds
  those anyway). Net effect on a card fumbled every other review: it
  still loses ease, but at -0.05 per hard/good pair instead of -0.15,
  and a clean run brings it back. Together with the same-day "again"
  rule and three grades instead of SM-2's six, this makes the scheduler
  SM-2-*derived*, not "classic SM-2" as the docs used to claim — fixed in
  `packages/srs/src/index.ts` and ARCHITECTURE.md.
- **Practice mode (Iteration 6) persists nothing — no SRS state and no
  last-session summary — and starts from a blank map.** It exists so replaying a
  mastered map is still possible once nothing's due, without that
  session silently perturbing the real review schedule, and without
  implying you already "know" everything by pre-marking it discovered
  before you've actually re-tried it this round. *Amended by GC-020
  (2026-09-13):* the code used to save the last-session summary for
  practice rounds too, contradicting "never writes back" — so a casual
  practice round silently replaced the home page's "Last: 18/20" record
  of the last real graded session. Resolved toward the rule rather than
  toward the code: the home page line describes where you stand on your
  review schedule, and a practice score doesn't. Practice results are
  still shown on the score panel at the end of the round; they just
  aren't kept.
  *Superseded 2026-09-18 (v0.6.0, FT-26): there is no practice mode any
  more.* It existed because a due-only round could come up empty; rounds
  now always cover the whole map, so replaying a mastered map is simply
  playing it, and every round is graded. See "The scheduler keeps running,
  out of sight" below.
- **The score panel's "Play again" only shows when it's actually
  accurate — when a due session finishes and something's still due, not
  automatically.** Found by actually finishing a map: since a revealed
  target stays due the same day by design, "Play again" after a finished
  session sometimes led nowhere (an immediate bounce to "Up to date!"),
  which reads as broken. The panel now checks whether anything's still
  due right when the session completes: if so, "Play again" stays and
  is accurate; if the whole map just graduated, it's replaced with
  "All caught up! Next review in N days" plus "Back to maps"/"Practice
  all regions" — no button implying there's something left to replay.
  The same fix applies to practice mode's own "Play again": since
  practice never changes due-state, it now starts another practice round
  directly instead of re-running a due-check that can't have changed.
  *Superseded 2026-09-18 (v0.6.0, FT-26): "Play again" is always accurate
  now, because there is always the whole map to play again.* With it went
  "All caught up!", "Next review in N days" and the "Up to date!" screen -
  and with that screen, the empty-chip glitch the v0.5.0 review found
  (F13).

## Data & maps

- **Ukraine's map includes Crimea and Sevastopol, merged in from outside
  Natural Earth's own `admin='Ukraine'` filter.** The dataset tags both
  under `admin='Russia'` instead, reflecting de facto control rather
  than international recognition — most of the world, including the UN,
  considers them Ukrainian territory under occupation. Put to the user
  rather than decided unilaterally, since it's a genuine judgment call
  outside "just fix bad source data": asked whether to ship what the
  source provides (25 targets, documented omission) or merge the two
  features in by hand. Chosen: merge them in, via a new `--extra-where`
  option that runs an independent, country-unconstrained query — see
  MAPS.md for the exact mechanism.
- **"Great Britain" was asked for, not "United Kingdom" — taken
  literally, not as loose synonyms.** Great Britain excludes Northern
  Ireland by definition; the UK doesn't. Both the regions map (dissolved
  from the UK's admin-1 districts, Northern Ireland's 26 dropped via a
  new `--exclude-field=geonunit` option) and the towns map (Belfast
  dropped via a new `--exclude` option on `build-points-map.ts`) honor
  this literally rather than defaulting to the more common "UK" framing.
  Noted in MAPS.md as a scope call the user can correct if "United
  Kingdom" (including Northern Ireland) was actually meant.
- **Overseas territories are excluded from a country's regions/towns
  map by default — same reasoning as `usa-states`'s Alaska/Hawaii
  exclusion, generalized.** France's and Spain's regions/towns maps
  initially shipped including their overseas départements (Guadeloupe,
  Martinique, Guyane française, Mayotte, Réunion) and, for Spain, the
  Canary Islands and the Ceuta/Melilla exclaves — all geographically
  distant from (or disconnected from) the mainland, which blows out the
  map's bounding box far past the useful extent for a demo map, exactly
  like Alaska/Hawaii would for the USA. Corrected same-day, user-flagged:
  drop them via `--exclude` (regions map, matched against the pre-dissolve
  département/provincia name) and `--exclude` on the towns map. Applies
  going forward to any country whose full territory includes far-flung
  overseas possessions — check for this before building a new country's
  maps, not just for France/Spain specifically.
- **Which 5 countries to add next (Japan, Canada, Australia, Portugal,
  Netherlands) was Claude's call, not user-specified.** The user asked
  for "10 more maps you think are interesting for people" and explicitly
  delegated the selection. Picked for geographic/cultural spread beyond
  the Europe-and-USA set built so far, not by any other criteria (e.g.
  population, land area) — flagged here since it's a product judgment
  call made without the user, unlike every other country added earlier
  (all user-named).
- **Australia's regions map excludes Jervis Bay Territory, Macquarie
  Island, and Lord Howe Island — a "not part of the canonical 8"
  judgment call, distinct from the overseas-territory rule above.**
  Natural Earth's raw admin-1 rows for Australia include these 3 in
  addition to the 6 states + NT + ACT that Australian schools actually
  teach as "the states and territories." Jervis Bay Territory isn't
  overseas at all (a tiny federal enclave inside NSW); Macquarie
  Island and Lord Howe Island are remote but are usually treated as
  belonging to Tasmania/NSW respectively, not as separate first-order
  entities. Excluded via the same `--exclude` mechanism as the overseas
  cases, but the underlying reasoning is "not a real state/territory,"
  not "too far from the mainland" — worth distinguishing if a future
  country raises the same "which of these rows actually count" question.
- **Russia's regions map excludes Crimea and Sevastopol, for direct
  consistency with the earlier Ukraine decision — not a new political
  judgment call, a mechanical application of one already made.** Natural
  Earth tags both under `admin='Russia'` (reflecting de facto control),
  the same as it does for `ukraine-regions`' source rows before that
  map's `--extra-where` merge — but it keeps their `iso_3166_2` codes
  under the Ukrainian `UA-` prefix even there. Showing them as Russian
  territory on `russia-regions` while already showing them as Ukrainian
  on `ukraine-regions` would contradict the project's own stated
  reasoning (UN-level international consensus) for the earlier
  decision, not present a second even-handed option. Applied to both
  the regions and towns maps.
- **India's regions map keeps Jammu & Kashmir and Ladakh as India
  depicts them, unlike Crimea — a deliberate distinction, not an
  oversight.** Crimea has near-universal international consensus (the
  UN included) against the controlling country's own claim, which is
  what justified overriding Natural Earth's `admin` tag there. Kashmir
  is a genuine three-way dispute (India/Pakistan/China) with no
  equivalent clean resolution to defer to — there's no "the world
  agrees, override the data" move available the way there was for
  Crimea. Default: show it as Natural Earth's own India-administered
  data depicts it, the same treatment every other non-Ukraine country
  in this project gets, rather than picking a side where the world
  hasn't. Revisit only if a comparably clean international consensus
  ever emerges, the same bar Crimea had to clear.
- **India's towns map excludes Amaravati despite it clearing the
  population threshold by a wide margin — a data-quality call, not a
  political one.** Its `POP_MAX` (5.8M) would rank it #7 nationally,
  ahead of Ahmedabad/Pune/Surat, but Amaravati is Andhra Pradesh's
  still-under-construction planned capital with an actual population of
  a few thousand people. `POP_MAX` is already known to sometimes read
  as a broader urban-agglomeration estimate (see the `POP_MAX` section
  below) - this is the same failure mode taken to an extreme past the
  point of being a reasonable tradeoff, actively misleading rather than
  "using a bigger boundary than expected." Excluded outright rather than
  accepted as another instance of the disclosed `POP_MAX` limitation.
- **Natural Earth has real exact-duplicate rows for the same city
  (Brazil's Vila Velha/Natal, Mexico's Mazatlán, Indonesia's Bandar
  Lampung, each appearing twice) — fixed with a general dedup step in
  `build-points-map.ts`, not a per-country workaround.** Found only once
  this project started building large towns maps (50+ candidates), where
  duplicates became likely enough to actually hit — smaller towns maps
  (5-40 targets) apparently never happened to include one. Left
  unhandled, two features sharing a name would produce two targets with
  the same `slugify()`-derived id: duplicate map pins, duplicate/
  colliding quiz slips. Dedupes by id after name fixups, keeping
  whichever duplicate has the higher `POP_MAX` — applies to every
  country's towns map going forward, not just this batch's.
- **Adaptive town selection (`--min-count`/`--max-count` on
  `build-points-map.ts`), replacing a one-size-fits-all `>100k`
  threshold.** Requested directly by the user (2026-09-13): "For
  countries like Sweden it makes sense to have a minimum of cities to
  show and change the 100k limit, while if there are too many cities
  like in China we have to think of increasing it." Both flags are
  no-ops at their defaults, verified by rebuilding `sweden-towns-100k`
  with the updated script and confirming byte-identical output against
  the already-shipped version - existing maps are unaffected unless
  explicitly rebuilt with the new flags. `--max-count=50` applied to
  every large country in the 2026-09-13 batch (China/Brazil/Mexico/
  Russia/India/Indonesia) - picked to stay under the largest
  already-shipped towns map (`japan-towns-100k`, 66) rather than an
  arbitrary round number. `--min-count=8` applied to Finland (only 4
  towns clear 100k) - not retroactively applied to the already-shipped
  `sweden-towns-100k` (5 towns), since that wasn't part of what was
  asked; revisit Sweden specifically if the user wants it bumped up
  too. See MAPS.md's "Adaptive town selection" section for the
  mechanism.
- **Public-domain data sources only (Natural Earth), on purpose.** A
  constraint carried through the whole project, not just an initial
  default — flagged again explicitly when scoping the self-serve
  map-authoring backlog item, which would need a different source (e.g.
  GADM) for finer administrative levels: don't adopt a new source
  without confirming it's actually redistributable the same way.
- **Map-building scripts live in the repository, not run once from
  outside it.** Stated explicitly at the user's request, though it was
  already true in practice — `data/scripts/` is committed like any other
  code. The gap this closes isn't the scripts existing, it's that no map
  currently shipping had its exact build command recorded anywhere
  outside conversation history. `MAPS.md` is the fix: every shipping
  map's command, plus planned ones, in one place — reproducing or
  auditing a map shouldn't depend on asking what was run.
- **Point targets (towns/cities) get a new style layer and a new
  pipeline script, not branches added to the existing polygon ones.**
  Worked out against the actual code, not reasoned abstractly: checked
  every place that currently assumes polygon geometry (hit-testing,
  click/hover binding, camera framing, the `labels` source-layer — which
  turned out to be unused by any app code at all, every popup anchors at
  `Target.centroid` directly instead). A `targets-circle` style layer
  reuses the exact same feature-state color scheme as `targets-fill` so
  a point map plays like the same game with round markers, not a second
  visual language. `Target.type` alone distinguishes a point map from a
  polygon one — no new map-level "geometry kind" field, since a map is
  always homogeneous. Built as `italy-towns-100k`/`germany-towns-100k` —
  see `MAPS.md`'s "Point-target implementation" section for the full
  breakdown, including two real bugs found only by testing the actual
  built maps (tippecanoe silently drops most points at low zoom by
  default; the polygon tolerance mechanism's "is the name present
  nearby" check breaks down for city clusters closer together than the
  tolerance radius itself) that weren't anticipated in the original
  design pass.
- **A point map's drop tolerance requires the dragged target to be the
  *closest* candidate to the drop point, not merely present within the
  tolerance radius — polygon maps keep the simpler check.** Found by
  testing the Ruhr area directly: Essen and Duisburg render only ~22px
  apart on screen at the default zoom, inside the 30px point tolerance,
  so dropping a "Duisburg" slip squarely on Essen's own marker still
  registered as Duisburg solved correctly. Polygons don't get this
  fix — the simpler membership check has shipped and been tested for
  months, and two candidates rarely sit that close together for
  polygon-sized targets, so there was no reason to risk changing
  behavior that already works.
- **Guided tour mode comes before the quiz**, pedagogically — represents
  ARCHITECTURE.md's original pitch: a reveal-first, tour-style
  introduction to a map before testing on it, differentiating from
  Seterra's quiz-only approach.
- **Lakes are rendered as a purely contextual layer, selected by bounding-
  box intersection rather than tagged to a country.** Found by actually
  looking at the USA map: Michigan's two peninsulas visually merged into
  neighboring states with no indication of the Great Lakes between them —
  the state polygons themselves were correct, nothing was wrong with the
  geometry, there was just no water rendered in the gap. Lakes aren't
  attributed to an admin boundary the way states are (Lake Superior spans
  into Canada, for instance), so they're selected by whether they
  intersect the map's overall bounding box, not by an `admin` field
  match — and a lake extending past that box is fine to keep, not
  something to clip away. First cut still read as barely visible — fixed
  not by making the lake color more saturated (the first instinct) but by
  lowering the *land* fill's opacity instead (`targets-fill` 0.85 → 0.6),
  on the user's suggestion. Lighter land contrasts against the lake blue
  better than a more saturated lake did against the land.
- **An "Overview" view (all regions pre-labeled "discovered", no
  interaction beyond pan/zoom) sits above Tour and Quiz on the map
  landing page.** Requested directly: seeing the whole answer key at a
  glance is the most basic thing to offer before asking someone to learn
  or be tested on a map, so it leads the list rather than being an
  afterthought. Deliberately reuses the same visual language as a solved
  quiz target (green fill, name popup) rather than inventing a new one.

## Hosting & infra

- **Netlify, not Cloudflare Pages.** Cloudflare was tried first and
  abandoned after several distinct platform-specific failures (Workers-
  vs-Pages confusion, `_redirects` ordering differences, and — the actual
  deciding issue — broken HTTP Range-request support for byte-serving
  `.pmtiles` files, confirmed via an open, unresolved upstream issue).
  Full postmortem in ROADMAP.md's Iteration 3.5 section.
- **Netlify builds cost credits on the plan in use — don't trigger them
  casually.** Push to a branch and let a normal git-triggered build (or
  the user's own manual dashboard trigger) handle it; don't use the
  Netlify MCP tool's deploy operation as a debugging or verification
  step.
- **New features/fixes: branch first, merge to `main` only after the
  user has tested it locally and approved it.** `main` auto-deploys.
  Doc-only changes are the exception and go straight to `main`.
- **Iteration 7 (desktop packaging) reprioritized ahead of the GUI/UX
  evaluation**, on explicit user request after seeing all five demo maps
  working — wanted a working desktop build to look at before spending
  time on interface redesign, rather than following the numeric iteration
  order.
- **Tauri wraps `app/build` completely unmodified — no separate
  desktop-only frontend code.** `desktop/src-tauri/tauri.conf.json`'s
  `beforeBuildCommand` just runs the existing `npm run build
  --workspace=app`; the only new code is the Rust plugin registration
  (`desktop/src-tauri/src/lib.rs`) and one new `ProgressRepository`
  implementation (`app/src/lib/sqliteProgressRepository.ts`) picked at
  runtime by `createProgressRepository()`'s `isTauri()` check. Confirms
  the "one shared web core, three shells" strategy from ARCHITECTURE.md
  actually holds up in practice, not just on paper.
- **SQLite schema is a direct column-for-column mirror of the
  `ProgressRepository` interface** (`card_states`/
  `last_session_summaries` tables in `lib.rs`'s `migrations()`), not a
  redesigned data model. The interface was already deliberately
  backend-agnostic (see Iteration 5's design) specifically so this swap
  wouldn't need one — confirmed by writing the SQLite implementation
  with zero changes to the interface itself.
- **Android packaging (Capacitor) reprioritized ahead of the GUI/UX
  evaluation too**, same reasoning as Tauri above — explicit user
  request to have both real packaged shells (desktop *and* mobile) in
  hand before spending time on interface redesign, not just desktop
  alone. iOS stays a separate, later item regardless of this reordering:
  it hard-requires a Mac with Xcode, hardware this project doesn't have,
  so it can't be pulled forward the same way Android can.
- **Capacitor's SQLite schema is hand-mirrored from Tauri's, not shared
  code — and since GC-040 (2026-09-13) the mirroring is enforced by a
  test instead of a comment.** Same `card_states`/`last_session_summaries`
  tables, column for column. The original reason for not sharing
  ("Capacitor has no equivalent of Tauri's `migrations()`") stopped being
  true in GC-040: Android now has a real versioned migration list
  (`MIGRATIONS` in `capacitorMigrations.ts`, driven by `PRAGMA
  user_version`). Before that it ran `CREATE TABLE IF NOT EXISTS` on every
  open with no version at all — so the real risk the review found was
  never "two copies might drift", it was that the first schema change on
  Android had no mechanism to run exactly once per device.
  **Why still two copies rather than one generated schema:** sharing would
  mean a build step — one `.sql` file pulled into Rust via `include_str!`
  and into TypeScript via a raw import — across two very different
  runners (tauri-plugin-sql's compile-time `Migration` list vs. a runtime
  JS loop), for a schema of two tables and twelve columns. The failure
  that sharing prevents is drift, and
  `capacitorMigrations.test.ts` now catches drift directly: it runs every
  lib.rs migration and every Android migration against a real SQLite
  (`node:sqlite`) and fails if the schemas differ or the lists have
  different lengths. Same protection, no build machinery. Revisit if a
  third backend appears or migrations start carrying data transforms that
  would be painful to write twice. **Why migration 0 is `IF NOT EXISTS`
  while every later one is a plain ALTER:** every Android install from
  before GC-040 already has the tables but reports `user_version = 0`;
  migration 0 has to be a no-op over them (keeping every row) and just
  stamp version 1. Tested against a fixture of the old on-open SQL.
- **PMTiles on Android: buffer the whole archive in memory rather than
  work around Capacitor's missing Range-request support.** Capacitor's
  Android WebView local asset server can't return real `206 Partial
  Content` responses for arbitrary file types — a known, open upstream
  issue (ionic-team/capacitor#7664) — so pmtiles' normal range-request
  `FetchSource` silently never gets real tile data on Android, even
  though the identical file renders correctly in the browser/Tauri
  builds. Considered and rejected: patching/forking Capacitor's asset
  handler (real upstream fix, but out of scope to maintain a fork for);
  serving map tiles from the live Netlify deploy instead of bundling them
  (would make map data require network access, undermining the "download
  once, play offline" pitch these demo maps were always built around).
  Chosen instead: since every demo map is well under 1MB, fetch each
  `.pmtiles` file once as an ordinary full `GET` (which Capacitor serves
  fine — only *partial*-content responses are broken) and hand pmtiles a
  custom in-memory `Source` that serves its byte-range reads out of that
  buffer, via the library's own documented `Protocol.add()`/`.get()`
  pre-registration API. Scoped to native Capacitor only
  (`Capacitor.isNativePlatform()`) — the browser and Tauri builds already
  work correctly via real range requests and don't need to change. This
  approach stops making sense if a much larger map (multi-MB+) is ever
  added for Android specifically; revisit then, not now.

## GUI/UX round 1 (2026-09-12)

- **Explored with the `design` skill before writing any implementation
  code.** Four directions (top nav, on-map labels, quiz tray, map colors)
  were mocked up — the color options as *real live renders* of the actual
  app with paint properties swapped at runtime via `setPaintProperty`, not
  drawn approximations — and approved one at a time in a published canvas
  before any Svelte/style code changed. Caught a real problem this way
  that a mockup-only process wouldn't have: the approved on-map label
  style was only checked for contrast against a single green fill: once
  the categorical palette was picked, the pill needed a measured opacity
  bump (55%→65%) to keep 4.5:1 contrast against the palette's lightest
  color. Checked with actual WCAG math, not eyeballed.
- **Map fill color is a hash on the region's own name, not a curated
  per-map list.** `["%", ["length", ["get","name"]], 8]` picks one of 8
  muted palette colors per feature. The alternative — a `match` expression
  enumerating every region name per map — would need maintaining by hand
  for all six current maps (and every future one), defeating the point of
  a shared `base.json`. Tradeoff accepted: this is a length-based hash,
  not true adjacency-aware graph coloring, so two neighboring regions can
  occasionally land on the same color. That reads as a minor cosmetic
  imperfection for a decorative palette, not a bug worth a real map-
  coloring algorithm — revisit only if a specific map's collision is
  actually distracting in practice.
- **Click-to-explore, tour-reveal, and quiz-solved/overview labels now
  share one visual treatment**, not three. They used to be two different
  styles (`.geoclick-popup` at a larger size for the single-interaction
  case, `.geoclick-solved-popup` smaller for the many-at-once case) —
  unified because the user's own framing of the complaint ("the label
  that shows a region's name, on click, during tour, or when solved")
  treated them as one thing, and after the redesign there was no good
  reason left to keep two.
- **The top nav bar is one shared `MapNav.svelte` component, not four
  copies.** Extracted after the first round shipped: the user asked for
  "the same or similar tabs" on the Overview/Quiz/Tour views too, at which
  point four near-identical copies of the same markup/CSS would have been
  clearly wrong, unlike the Tauri/Capacitor SQLite-schema case (there,
  duplication was chosen because there's no shared runtime to put a
  common definition in — here, all four call sites are Svelte components
  in the same app, exactly what a shared component is for. Added an
  `active` prop so each view highlights its own tab (solid accent
  background) rather than showing four generic buttons with no sense of
  "you are here", and a `subtitle` snippet so QuizView's progress count
  stacks naturally under the nav instead of a second hand-positioned
  overlay guessing where the first one ends.
- **Quiz tray height is a resize handle, not a bigger fixed default.**
  The problem wasn't that 30vh was too small for every map — it's exactly
  right for a 20-target map like `italy-regions` and cramped for a
  110-target one like `italy-provinces`. A single new fixed height can't
  be right for both; a user-adjustable one (drag or arrow keys,
  `role="slider"`) can. Not persisted across sessions — in-scope was
  giving the user control in the moment, not remembering a preference;
  that's a small, separate addition if it turns out to matter.
  **Follow-up, found by the user actually trying to shrink it:** the
  handle couldn't make the tray small - a classic flexbox gotcha, not a
  logic bug. `.tray-slips` (the wrapping slip container) is a `flex: 1`
  child; flex items default to `min-height: auto`, which for a wrapping
  container resolves to "tall enough to fit every row" - that silently
  overrode the smaller height the handle was setting on its parent, no
  matter how far you dragged. Fixed with an explicit `min-height: 0` on
  `.tray-slips` (lets it actually defer to its own `overflow-y: auto`)
  plus `overflow: hidden` on `.tray` itself as a belt-and-braces backstop.
  Also lowered the default (30vh → 22vh) and minimum (15vh → 9vh) now
  that shrinking actually works - the old bounds were partly compensating
  for the bug by never asking for a height small enough to expose it.

## Home page map list (2026-09-12, counts amended 2026-09-13)

> **Amended by GC-060 (2026-09-13).** This entry was reasoned from 28 maps
> across 14 countries. The list has since grown to **44 maps across 22
> countries** (1410 targets; `data/maps/index.json` is the live count). The
> bullets below keep the original reasoning with the original numbers, so it
> reads honestly as the decision it was; the search/filter conclusion is
> re-checked against today's numbers in its own bullet.

- **Grouped by country, not just a flat alphabetical list.** The user's
  own framing ("organize it better, at least alphabetically") set
  alphabetical as the floor, not the ceiling. With 28 maps across 14
  countries (at the time — 44 across 22 now, which only strengthens the
  case for grouping) and every country already shipping its maps as a natural
  regions/towns pair (a trio for Italy, which also has a provinces map),
  a flat 28-row alphabetical list would still read as a wall of similar
  entries ("France — Regions", "France — Towns" sorted apart from each
  other alphabetically by their full name isn't even guaranteed). A
  heading per country groups the pair visually and lets the link text
  drop the now-redundant country prefix (just "Regions"/"Towns" under an
  "France" heading, not "France — Regions"). Countries are ordered
  alphabetically by name, and each country's own maps alphabetically by
  label - both levels meet the stated minimum, the grouping is the part
  beyond it.
  **Amended 2026-09-29 (v0.15.0, proposal
  [#110](https://github.com/diegoami/Geoclick2027/issues/110)):** a
  country's own maps are no longer alphabetical. They are ordered **broad
  to specific** - the top-level administrative map; its zoomed/split maps;
  the smaller divisions broad to narrow, each division's split maps
  adjacent; full-country cities/towns; their subsets; other map types
  last. The order lives in `app/src/lib/mapCatalog.ts` and is shared by
  the picker and the in-map selector; the tiers are in
  `docs/PLAN_V0.15.md`. Countries themselves stay alphabetical.
- **A 2-column CSS grid above the existing 640px breakpoint, one column
  below it.** Reuses the breakpoint `MapNav.svelte` already established
  rather than inventing a new one. With 14 country groups (22 now), a single
  column at desktop width would push later countries far down the page
  for no reason - two columns is a small CSS change (`display: grid`
  behind the media query, `display: flex; flex-direction: column` below
  it), not a new dependency or a bigger redesign.
- **No search/filter UI.** Considered and rejected as disproportionate to
  the actual complaint: grouping plus alphabetical order already gets any
  country to a glance/scroll away, and a search box adds a second way to
  find something that mostly duplicates what the grouped layout already
  does at this list size (14 countries). Revisit only if the list grows
  enough that scrolling itself becomes the complaint, not scanning.
  **Re-affirmed at 22 countries / 44 maps (GC-060, 2026-09-13).** The
  trigger above — scrolling, not scanning, becoming the complaint — has
  not been met: nobody has raised it, and in the two-column desktop
  layout the 22 alphabetical country headings fit in roughly one and a
  half screens, still a scan rather than a hunt. Re-open when either a
  user actually reports hunting for a country, or the list passes about
  40 countries (~3 desktop screens), whichever comes first. This
  re-affirmation was made by the remediation loop against the entry's
  own stated trigger; the product owner can overrule it.

## Internationalization (i18n)

- **Hand-rolled dictionary + `t()`/`tPlural()` helper (`app/src/lib/
  i18n.svelte.ts`), not a library (`sveltekit-i18n`, `typesafe-i18n`,
  inlang/Paraglide).** Requested directly by the user (2026-09-12),
  alongside map-list reorganization and optional SSO. Scoped to the app's
  own UI chrome only — nav labels, home page text, quiz/tour status and
  button copy — around 35 distinct strings across five components. That's
  well under the scale where a library's build-step/plugin machinery,
  message-extraction tooling, or generated-types pipeline pays for
  itself; AGENTS.md's own guidance ("three similar lines is better than a
  premature abstraction") points the same direction. A plain
  `Record<TranslationKey, string>` per language, with `TranslationKey` a
  union type (not `Record<string,string>`) so TypeScript itself catches a
  missing translation as a compile error, gets the one property worth
  having from a real i18n library — completeness checking — without any
  of the tooling overhead.
- **State lives in a module-scope Svelte 5 rune (`.svelte.ts`), not a
  classic `writable` store.** `$state` at module scope is the documented
  Svelte 5 pattern for state shared across components; every call site
  reading `t()`/`getLanguage()` inside a template or `$derived` picks up
  changes the same way reading any other `$state` value does, no store
  subscription boilerplate needed.
- **Persisted to `localStorage` under `geoclick:language:v1`, guarded the
  same way `progressRepository.ts`'s `createLocalStorageProgressRepository`
  is** (`typeof localStorage === 'undefined'` checks) — the home page and
  other routes prerender at build time, when `localStorage` doesn't
  exist. Defaults to English when nothing is stored or the value isn't a
  recognized language.
- **Map/target names are explicitly out of scope, on purpose.** Region
  and city names (Toscana, Bayern, Kyiv, ...) are real geographic proper
  nouns already localized per-country through `data/scripts/
  build-map.ts`/`build-points-map.ts`'s `NAME_FIXUPS` tables and
  `--name-field` — a separate, already-solved mechanism (see MAPS.md).
  Routing those through the UI dictionary would conflict with decisions
  already made per-country for reasons that have nothing to do with the
  viewer's own display language.
- **Pluralization is a hand-picked `.one`/`.other` key pair per counted
  string (`tPlural()`), not a CLDR plural-rules library.** English,
  German, and Italian all only distinguish singular (count === 1) from
  everything else for the specific counts this app displays (mistakes,
  days until next review) - matches how these strings were already
  worded before i18n existed (`mistake`/`mistakes`, `day`/`days`).
  Good enough for three languages and a handful of counted strings; would
  need revisiting (a real plural-rules table) if a language with richer
  plural categories (e.g. Polish, Russian) were ever added.
- **~~Three small text pills (EN/DE/IT)~~ one pill that opens a list.**
  *Corrected 2026-09-19 (FT-43).* Three pills matched the muted small-pill
  language from GUI/UX round 1, which is why they were chosen — but they
  cost a pill's width per language in a map bar that is already tight on a
  phone, so the control could not grow. The product owner's point: "it is
  not scalable for more languages." One button, 44 px wide closed, costs
  the same whatever the list holds.
- **A listbox, not a native `<select>`.** A `<select>` would have been less
  code and free keyboard support, but it can only show one string per
  option, and this control wants two: terse closed ("EN") and readable open
  ("English"). The popup therefore implements the listbox pattern properly —
  `aria-haspopup`, `aria-expanded`, `role="option"`/`aria-selected`, arrow
  keys, Home/End, Enter/Space to commit, Escape to close and return focus,
  and an outside pointerdown to dismiss.
- **Arrowing does not change the language.** The keyboard cursor is separate
  state from the chosen language, so moving through the list does not
  re-render the whole UI on every keystroke; the choice commits on Enter or
  click.
- **Names are shown in their own language**, never translated — the
  convention every real switcher uses, so a language you cannot yet read is
  still recognisable. The picker's own accessible name *is* translated
  (`lang.label`), which the three-pill version got wrong: it hardcoded
  `aria-label="Language"` in English.
- Shown in two places: `MapNav.svelte` (present on every map-scoped view)
  and the home page header (which doesn't render `MapNav`) - both reuse
  the same `LanguageSwitcher.svelte` component rather than duplicating
  the markup. Unchanged.

## Visual refresh: background (2026-09-13)

- **The map's "ocean/empty space" background moved from flat gray
  (`#eef3f6`) to a warm parchment tone (`#f0ead9`), not a richer blue.**
  Requested directly: "the background color is kind of meh, maybe
  something more captivating." A richer blue was tried first (`#a9cfdf`)
  since water conventionally reads as blue on maps, and rejected after
  actually looking at it: it reads too close to the lakes layer's own
  blue (`#bcdcea`, DECISIONS.md's earlier "Lakes are rendered as a
  purely contextual layer" entry), undoing the contrast that entry
  already tuned once — the Great Lakes nearly vanished into the
  surrounding "ocean" background on `usa-states`. A warm neutral instead
  of a cool one keeps the original design's actual intent (a plain
  backdrop, not a literal ocean) while looking more intentional than
  flat gray, and — checked directly, not assumed — makes the lakes
  layer's blue read *more* clearly against a warm background than it
  did against the old cool gray-blue one, not less. Also re-verified
  against `italy-provinces`' full 8-color categorical palette (every
  hash-derived land color, not just green) and a towns map's `context`
  layer (`japan-towns-100k`) before settling on the value — neither
  regressed.
- **The home page background moved from plain white to a soft
  three-stop gradient** (`#e3f0e6` sage → `#dce6f2` blue → `#f7ecd9`
  cream, `160deg`, fixed so it doesn't scroll with content) drawn from
  the same muted-earthy family as the map's own categorical palette,
  for the same "meh" complaint. A first, much subtler version (near-
  white with barely-there tinting) was tried and rejected as still too
  timid to actually read as a change — the shipped version is
  deliberately more visible while staying low-saturation enough not to
  fight with body text or the map-card borders.

## Quiz solved-state contrast (2026-09-13, opacities amended by GC-032)

> **Amended by GC-032 (2026-09-13).** The opacity split below is still the
> mechanism, but the numbers moved with the new palette (see "Map colors"):
> named states 0.85 fill / opaque circle, unsolved 0.55 fill / 0.85 circle.
> 0.3 had washed every unsolved region into near-identical beige. The palette
> no longer has a green, so opacity no longer has to carry the whole signal.
> Measured, not eyeballed: the smallest solved-vs-unsolved colour distance
> went from ΔE 29 to 34. The bullets below keep the original numbers.

- **Unsolved and solved regions/cities now differ by opacity
  (saturation), not just hue.** Reported directly after the background
  refresh above made it more noticeable: "looking at the quiz the color
  scheme is confusing, I do not know which regions have been recognized
  or not." Root cause, found by checking the actual palette rather than
  guessing: the 8-color categorical palette (unsolved default) includes
  a muted teal-green (`#8fb8a8`) close enough to `quizCorrect`'s green
  (`#5a9c6f`) that at the same flat 0.6 opacity, an unsolved region
  could plausibly read as already-solved at a glance — the hue
  difference alone wasn't a strong enough signal.
- **Fix: `fill-opacity`/`circle-opacity` became `case` expressions
  matching the same feature-states `fill-color`/`circle-color` already
  branch on**, not a new mechanism. Any named state (solved, wrong,
  revealed, hovered, explore-highlighted) renders at high opacity (0.8
  fill / fully opaque circle); the unsolved default drops to low
  opacity (0.3 fill / 0.65 circle). Saturation itself is now the
  primary "is this done yet" signal, independent of which of the 8
  hash-derived colors an unsolved region happens to have - directly
  matching the user's own suggested fix ("different level of
  saturation"). Circles kept a higher unsolved-state floor than fills
  (0.65 vs 0.3) since a point marker's *only* visual footprint is its
  fill - dropping it as low as a polygon's would risk making an
  unsolved city hard to see/aim for, unlike a polygon target, which
  stays fully legible via its always-visible outline regardless of
  fill opacity.
- **Applies uniformly across every view sharing this style** (MapView's
  click-explore, TourView's reveal, QuizView's solve/wrong/reveal,
  OverviewView's "everything already discovered"), not something scoped
  to the quiz specifically - `base.json` has one shared paint
  expression per layer, not a per-view variant. Checked directly, not
  assumed: `italy-regions` (polygon quiz, two real solves) and
  `sweden-towns-100k` (point quiz) both verified live before shipping -
  solved targets read unambiguously against every unsolved one in both
  geometry types.

## Map colors (2026-09-13, GC-032)

- **Neighbouring targets never share a colour.** The old base colour was
  `name.length % 8`, a hash, not a colouring. Adjacent regions matched
  often enough to notice. On `italy-provinces`, Bolzano, Sondrio, Belluno,
  Brescia and Bergamo (all seven letters) formed one olive swath with no
  visible borders between them. Each target now carries a `colorIndex`
  (0-5) in its `map.json`, chosen by graph colouring. The style reads the
  slot back through feature-state, which `createMap` sets on
  `'style.load'`, before the first paint.
- **Adjacency comes from the committed tiles, not the Natural Earth
  source.** The tiles are the geometry players actually see. Rebuilding
  adjacency from source would mean reproducing every map's dissolves and
  name fixups in a second pipeline. `data/scripts/mapColors.ts` draws the
  polygons onto a 2048-cell grid and counts two targets as adjacent if their
  cells come within 2 cells of each other. That margin also closes the
  hairline gaps left where tippecanoe simplified a shared border twice.
  Points (towns) have no borders, so each town is linked to its 3 nearest
  neighbours instead. On screen, "adjacent" for markers means "close".
- **Six colours, not four.** Any polygon map can be coloured with 6 using
  the simple ordering used here (smallest-last). Six also gives more variety
  than four. The colouring picks the least-used free colour each time, so
  all six appear about equally. 42 of the 44 maps use all six; the other
  two need only five. It's deterministic, so rebuilds don't reshuffle
  colours.
- **The palette stays away from the state colours.** It is blue, lavender,
  orchid, pink, salmon and slate: no green (solved), gold (revealed) or red
  (wrong). The drag-hover colour moved from a light blue (`#6fa8dc`) to a
  deep blue (`#2a64c4`), because the new palette's own blue made hover
  nearly invisible on 1 in 6 regions. Colour distance to the nearest
  palette colour went from ΔE 16 to 38, beating the old style's 28.
  Solved-vs-unsolved rose from ΔE 29 to 34. Revealed-vs-salmon is the
  tightest remaining pair (ΔE 21, the old style's worst was 23). It was
  accepted because a revealed target also gets its name label.
- **Kept in sync by the tooling, not by memory.** `build-map.ts` and
  `build-points-map.ts` colour a map as their last step. `npm run
  build-map-colors` recolours every committed map (or one, with
  `-- --map=<id>`) without touching the tiles. `app/src/lib/mapColors.test.ts`
  recomputes adjacency for all 44 maps from their tiles and fails on any
  same-coloured neighbours. It also fails if the style's number of palette
  colours drifts from `PALETTE_SIZE`.

## Tour length on big maps (2026-09-13, GC-033)

- **Big maps start the tour faster. The committed tour data is
  unchanged.** Every tour step dwells 3 s at 1x, so italy-provinces
  (110 steps) took 5:30 and russia-regions (83) took 4:09. TourView now
  starts at 1x when the whole tour fits in **3 minutes**. Otherwise it
  starts at the slowest menu speed that brings it under 3 minutes.
  italy-provinces starts at 2× (**2:45**, 1.5 s a province), and
  russia-regions and japan-towns-100k start at 1.5× (2:46 / 2:12). The
  other 41 maps are exactly as before: 1x, 3 s a step. The speed menu
  still overrides the default at any point.
- **Why not shorter dwells in tour.json:** that would touch 3 committed
  files plus the build scripts, and the player couldn't get the slower
  pace back. Changing the default speed is one function
  (`app/src/lib/tourSpeed.ts`), and anyone who wants 3 s a province picks
  1×. The rule uses each tour's actual dwell total, not its step count,
  so a hand-tuned tour.json with shorter steps stays at 1×.
- **Why 3 minutes:** that's 60 steps at 1x, so every map with 60 targets
  or fewer (41 of 44) keeps its current pace. Only the outliers speed up.
  1.5 s a province is still long enough to read each name.
  `tourSpeed.test.ts` pins the rule against every committed tour.
- **The floor moved from 1x to 0.75x** (2026-09-19, FT-43; product owner:
  "the tour a tad slower"). A short tour now starts at 0.75x, so a step
  dwells 4 s rather than 3 s and the camera eases over 1.6 s rather than
  1.2 s. 3 s was enough to watch a region light up but not to read its
  name, find it and take it in. The budget still outranks the floor: a tour
  that would exceed 3 minutes at 0.75x starts at 1x or faster, so nothing
  got longer than the budget — `tourSpeed.test.ts` asserts exactly that
  over all 63 committed tours, which is the check that matters when every
  tour is suddenly a third longer. The boundary is 45 steps: 45 is exactly
  3:00 at the floor and keeps it, 46 gives the floor up. 0.75x also joined
  the speed menu, so the pace is still the player's to override.

## SSO/cross-device sync deferred (2026-09-13)

- **The Supabase SSO/cross-device-sync work is deliberately paused, not
  abandoned.** The user asked to resume it ("let us pickit up") after it
  had sat unfinished since 2026-09-12, and it was reconciled with four
  intervening merges to `main` (map-list reorg, i18n, eight-countries
  batch, background + quiz-contrast) — branch brought up to date,
  `svelte-check` clean, and a real gap fixed along the way
  (`AccountStatus.svelte` had hardcoded English from predating the i18n
  merge, now routed through `t()`). Immediately after seeing that state,
  the user changed their mind: "it does not make sense to add that
  before planning to buy a domain, go public, set it up in a store."
- **Reasoning: cross-device sync only pays for itself once there's a
  public, persistent identity for someone to return to** — a domain, a
  live public deployment, app-store presence. Building auth/sync
  infrastructure ahead of that is premature; the feature would have
  no real audience to serve yet.
- **The branch (`feature/supabase-sso-sync`, at commit `f8fa986`) is
  being kept, not deleted or merged** — the work (Supabase client,
  Postgres schema with row-level security, `supabaseProgressRepository`,
  Google sign-in UI, sync layer, see the "Cross-device sync (Supabase)"
  entry above) stays parked exactly as reconciled, ready to pick up once
  a domain purchase, public launch, or app-store submission is actually
  being planned. See ROADMAP.md's Iteration 8+ backlog for the
  corresponding status update.

## Remediation programme structure (2026-09-13, first draft — since scaled down)

- **SUPERSEDED same day: `main` is a normal integration branch again, no
  release-branch buffering.** The plan below built its whole release-branch
  structure around avoiding paid Netlify builds. The product owner then
  confirmed directly that build cost is not actually a constraint — see
  AGENTS.md's Workflow section, updated the same day. Task/feature branches
  now merge straight into `main` once approved, same as every other feature
  in this project's history; `docs/RELEASES.md` was rewritten accordingly
  rather than deleted, since tags and release notes are still wanted (see
  the entry below).
- **SUPERSEDED TWICE, same day — final: ONE engine (opus), ONE agent, no
  multi-agent anything.** Draft 1 had four engines
  (haiku/sonnet/opus/fable); draft 2 cut that to two (sonnet implements,
  opus reviews/orchestrates) to push back on cost; draft 3 is the product
  owner's final call: "for complex tasks let us Opus do them, or maybe let
  us just Opus do the change alone, no two steps required, no multi agent,
  just loop." So: `engine: opus` on all 19 tasks, and the same single agent
  works them sequentially in a loop. What replaced the cold-context
  reviewer, deliberately and with the loss acknowledged: the four scripted
  gates are the mechanical review, and the product owner is the judgement
  review at merge time. `/code-review` is available on a branch without
  spawning anything, and is worth running on the two High-effort tasks
  (GC-021, GC-032). The rule that survived intact is "two failed attempts
  and stop" — a task with a written DoD that fails twice means the DoD is
  wrong, not the work.
- **The nice-to-have tier is back in, on an effort test.** Draft 2 dropped
  review items #20-#30 entirely ("no nice to have things"); the product
  owner then reversed it — "Ok the nice to have, do those, if they are low
  effort." All eleven pass that test (every one was Low in draft 1's own
  estimate, five are one-liners inside a file another task already opens),
  so all 30 punch-list items are now assigned: 19 tasks instead of 15, with
  GC-004/GC-031/GC-033/GC-080 restored as tasks and #20/#21/#23/#24/#26
  folded into GC-003/GC-022/GC-020/GC-041. #24 is the one with a real
  production footprint (`window.__map` currently ships to every user).
- **No zombies, as an explicit requirement.** The product owner asked for
  it directly, and the parallel design was what created them: worktrees,
  one `node_modules` each, a dev server each, a branch each. Draft 3's
  answer is mostly structural — one checkout, one branch at a time, one
  fixed dev port (5174, leaving 5173 for the owner) — plus
  `node scripts/task.mjs doctor [--fix]`, run every loop iteration and
  before every release: it finds orphan worktrees, `worktree-agent-*` and
  merged-but-undeleted branches, state/branch disagreement, interrupted
  state writes, and stray listeners on 5173-5199. It reports processes and
  never kills them — one of them is usually the owner's own dev server.
- **No GitHub for the remediation programme; task state is one local file
  per task.** The product owner: "not using Github, but just using local
  harnesses." A `status:` field in `docs/tasks.yaml` was rejected because
  three implementers plus an orchestrator doing read-modify-write on one
  YAML file is a silent lost-update race — so state is
  `.orchestrator/state/GC-0NN.json`, one file per task (single writer by
  construction, temp-file + rename, transition table enforced by
  `scripts/task.mjs`). With draft 3's single agent the race it was designed
  around cannot happen at all, so the state files are simply the loop's
  memory across restarts — kept because a transition table that refuses an
  illegal move is cheap insurance against a confused session. `tasks.yaml`
  is immutable spec. **Because those files are gitignored, the trackable
  record is a committed progress ledger** — the table in
  `docs/REMEDIATION_PLAN.md`, ticked as part of each merge; the product
  owner should never have to run a command to see where the programme
  stands. The review handoff is a branch plus `git diff main...<branch>`
  plus a worklog (`task.mjs log`), not a draft PR. Consequence accepted and
  confirmed by the owner: the programme is single-machine.
- **A release "batch" is a completed wave; the programme closes at
  `v0.2.0`.** Release tracking stays (git tag + `CHANGELOG.md` entry) but
  goes local. A wave boundary is the batching unit because it is already
  defined by the DAG, needs no fresh judgement, and is the point where the
  tree is quiescent — "every N tasks" would cut mid-dependency, and
  "whenever someone remembers" is how the project went eight iterations
  without a tag. Waves 0+1 → `v0.1.1`, wave 2 → `v0.1.2`, waves 3+4 +
  programme close → `v0.2.0` (the shape shifted in draft 3 when the restored
  nice-to-haves added waves 3 and 4). `1.0.0` stays reserved for the real public launch (see the
  SSO-deferral entry), so the closing milestone is a MINOR bump under that
  ceiling: "known issues from the Sept 13 review resolved".
- **REVERSED same day: the "nice-to-have / low value" tier (`#20`–`#30`) is
  back in.** Draft 2 dropped it ("let us focus on the necessary things, no
  nice to have things"); the owner then restored it conditionally — see the
  effort-test entry above. GC-000 is the only thing still dropped. The
  `dropped:` list in `tasks.yaml` and the restored-items table in
  `docs/REMEDIATION_PLAN.md` are the record either way, so nothing gets
  silently re-derived as new work later.
- **Still holds**: two failed attempts then stop and escalate rather than
  grinding a third (a written DoD that fails twice means the spec is wrong,
  not the work); gates before merge, always. What did NOT survive draft 3:
  cold-context review by a separate agent, because there is no separate
  agent. See [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md).
- **SUPERSEDED after GC-001: the human is no longer the per-task merge
  authority — the loop automerges.** Product owner, 2026-09-13, after
  approving the first task: *"I think we need to change the behaviour to
  automerge."* The loop now merges a task itself once all four gates are
  green and every DoD item is verified, and reports each merge in a short
  summary. It still stops for the three release tags (the product owner's
  only routine gate), for two failed attempts, for a DoD item it cannot
  verify on this machine, and for a spec that is wrong in substance. The
  cost, accepted knowingly: `main` (which deploys) now gets each task
  without a human reading the diff first. The compensations are the gates,
  the written DoD, `/code-review` on the two High-effort tasks, and every
  merge being one `git revert` away. Scoped to the remediation loop only —
  AGENTS.md's ask-before-merge rule still governs all other work.
- **Root `package.json` is the single source of truth for the version.** The
  repo had drifted to three different versions across seven files (`0.0.1`
  workspace, `0.1.0` Tauri/Cargo, `1.0` Android `versionName`);
  `scripts/sync-version.mjs` propagates and `--check`s it. The Android shell
  claiming `1.0` was the worst of the three — it is POC quality. Still
  holds; unaffected by the two supersessions above.

## First tracked release, v0.1.0 (2026-09-13)

- **The current state of `main` — everything shipped before any
  remediation fix lands — is tagged `v0.1.0` and treated as the project's
  first real release**, not just an informal snapshot. Product owner's
  call: reaching the point of having an independent review, a remediation
  plan, and a release process all in place is itself a milestone worth
  marking, distinct from whenever the remediation work itself finishes.
  See [CHANGELOG.md](CHANGELOG.md) for the release notes.
- **The version and a short build/commit identifier are shown on every
  screen** (`app/src/lib/VersionBadge.svelte`, bottom-right corner,
  injected at build time from `package.json` and `git rev-parse
  --short HEAD`) — requested directly ("release number and build should
  be prominent in the application"), not left as something only visible
  by reading a file. `1.0.0` stays reserved for the real public-launch
  milestone (domain, app-store submission) per the SSO-deferral entry
  above; `0.1.0` is deliberately a low number for "first tracked release,"
  not a claim of feature-completeness.

## PMTiles storage: stay in plain git for now (ADR, 2026-09-13)

GC-080 (review D12, #29). A decision record only — nothing was migrated,
no `.gitattributes` change, no file moved.

- **Measured, not estimated (2026-09-13, commit `2003d62`).** 44 tilesets
  in `data/maps`, **13.88 MB** in the working tree (smallest
  `netherlands-regions` 23 KB, largest `russia-regions` 2.0 MB; mean
  323 KB). `map.json` + `tour.json` together add only 0.43 MB. The git
  pack is **15.60 MiB**, of which **14.22 MB is tileset history** — 57
  distinct `.pmtiles` blobs, because rebuilds keep the old blob forever
  (`usa-states` has 4 versions, `italy-regions`/`germany-states` 3 each).
  `.git` on disk: 19 MB. The repo is four days old (first commit
  2026-09-09).
- **Growth per country batch is rising, because the countries are
  getting bigger:** Italy/Germany/USA 0.34 MB per country; the 6-country
  batch 0.25; the 5-country batch 0.73; the 8-country batch **0.97 MB
  per country (7.73 MB in one batch)**. Plan on ~1 MB per country from
  here, plus any rebuild of an existing map costing its full size again.
  A style/data change that forced retiling all 44 maps would add ~14 MB
  in a single commit — which is exactly why GC-032 (the palette task) is
  forbidden from retiling.
- **Options, costed:**
  1. **Status quo** (plain git). Costs: the pack grows ~1 MB per new
     country and never shrinks; every clone downloads all history. At
     15.6 MiB that is a non-issue. GitHub only starts warning on single
     files at 50 MB and rejects at 100 MB; the largest tileset is 2 MB.
     All three shells keep working unchanged: the Netlify build, Tauri's
     `frontendDist` and Capacitor's `cap sync` all read the files through
     the prepared `app/static/maps` path (a committed symlink when this was
     written; FT-58 makes the build prepare it, so a checkout no longer
     carries the link).
  2. **Git LFS.** Two very different variants. *LFS for new/rebuilt
     tilesets only* rewrites nothing — but also saves nothing on the
     14.22 MB already in history, only on growth. *Migrating history*
     (`git lfs migrate import --everything`) rewrites every commit:
     every hash changes, `main` must be force-pushed, tags `v0.1.0` and
     `v0.1.1` move, every clone (and the parked
     `feature/supabase-sso-sync`) must re-clone or be rebased, and every
     commit hash cited in this repo's own docs — the remediation ledger,
     CHANGELOG, these entries — goes dead. That is an irreversible,
     Ultrahigh change. Either variant also brings: GitHub's LFS storage
     and monthly bandwidth quota, which is small on the free tier and
     paid beyond it, and which every Netlify build and every fresh clone
     draws on; `git lfs` installed on every machine (Git for Windows
     bundles it; WSL and the Android build box need it too); and
     `.gitattributes` changing `*.pmtiles binary` to
     `*.pmtiles filter=lfs diff=lfs merge=lfs -text`, still *after*
     GC-001's catch-all. **The failure mode is nasty and familiar:** a
     checkout without LFS support gets ~130-byte text pointer files in
     place of the tilesets, and the app then shows labels but no
     polygons — the identical symptom to the two `.gitattributes`
     corruption bugs in ONBOARDING.md's gotchas. For the three shells:
     Netlify must fetch LFS objects during its build — verify on a
     branch deploy before relying on it (its old "Large Media" LFS
     service has been retired); Tauri and Capacitor are fine only if the
     machine that builds them has LFS.
  3. **Fetch-at-build from a release artefact** (tilesets zipped and
     attached to a release, downloaded and checksum-verified by a
     prebuild script into `data/maps`). Costs: tilesets stop being
     versioned in the same commit as the code that reads them (needs a
     hash manifest in-repo); every build of every shell gains a network
     dependency and a new failure point; building a map gains an upload
     step; and it puts GitHub Releases in the loop, which this project
     otherwise keeps out of its workflow. Buys: a small, fast clone.
  4. **Generate-at-build — rejected.** Needs `ogr2ogr`, `tippecanoe`
     and `pmtiles` plus the Natural Earth sources, a WSL2/Linux
     toolchain that Netlify's build image doesn't have and the Windows
     build box only has via WSL. It would also make every build depend on
     the map pipeline being reproducible, which today relies on manual
     curation steps (MAPS.md).
- **Decision: stay on plain git (option 1).** At 15.6 MiB the problem
  the review raised is real but years away, and every alternative adds
  per-build cost or failure modes today to save megabytes nobody is
  paying for. History is never rewritten for this without the product
  owner's explicit approval as its own task.
- **Revisit trigger** — whichever comes first: the git pack passes
  **100 MB** (`git count-objects -vH`, `size-pack`); any single tileset
  passes **25 MB** (half GitHub's warning threshold); or the catalog
  passes **60 countries** (~38 MB more at ~1 MB/country). When
  triggered, the preferred first step is **LFS for new and rebuilt
  tilesets only, no history rewrite**, after proving a Netlify branch
  deploy serves real tiles rather than pointer files (`curl` a
  `.pmtiles` and check it starts with the `PMTiles` magic bytes).
  Fetch-at-build is the fallback if Netlify can't fetch LFS. Whichever
  is chosen, extend `app/src/lib/mapData.test.ts` to assert every
  `.pmtiles` starts with those magic bytes, so a pointer-file checkout
  fails the gates instead of shipping blank maps.

## Feature programme decisions (2026-09-13)

The four requests in `docs/FEATURE_BACKLOG.md` became a separate
twelve-task programme, `docs/FEATURE_PLAN.md`. Before planning, every
product question the backlog flagged was put to the product owner. The
answers:

- **Downloads live in a separate public "releases-only" GitHub repo**, and
  the source repo stays private. GitHub release files on a private repo
  need a login with repo access, so a public release needs a public repo.
  The backlog had suggested static files on the Netlify site, but that was
  rejected on size. The current installers (18 MB `.msi`, 17 MB
  `-setup.exe`, 27 MB `.apk`) would be committed to git on every release,
  about 60 MB a time. That would pass GC-080's 100 MB "revisit storage"
  threshold within two releases. A releases repo keeps the binaries out of
  git entirely. Making the source public stays tied to the 1.0 launch.
  The repo is `diegoami/geoclick-releases` (FT-08). Its front page comes
  from `docs/releases-repo/README.md`, and `scripts/publish-release.mjs`
  uploads each release there, only with `--confirm` and the product
  owner's OK.
- **Installers are built manually**, on the local machine with a
  checklist and script. No CI for now.
- **Claude drafts 2-3 logo candidates**, and the product owner picks one.
- **Text size: names on the map, magnified on demand.** Revised at FT-02's
  review. The first answer was a Normal/Large switch for map labels and
  quiz slips. Once labels moved to 13px `rem` and grew to 20px on hover,
  the product owner found hover-to-magnify better than the base size alone
  ("still not satisfying"). They replaced the switch with the same
  magnify-on-tap for touch screens (FT-03). One behaviour on every
  device, no new setting. A whole-app font scale was explicitly not
  wanted.
  - **Labels take no pointer input** (FT-18, 2026-09-14): a drag or pinch
    that starts on a name moves the map. Found testing v0.5.0-beta.1 on
    Android: MapLibre ignores gestures that begin on a popup, and the
    magnify listener fired on touch-down, so on a phone, where names
    cover much of the overview, a pan often just magnified a label and
    the map barely moved (the tutorial's step 2 asks for exactly that
    drag). Magnify is now worked out from the pointer's position:
    hovering with a mouse, or a tap that doesn't move, never a drag.
- **The tutorial is sandboxed.** It runs a real quiz, but its progress is
  in memory only and never becomes real review data. It is started by a
  button plus a dismissible first-visit nudge, and never auto-starts. It
  always uses Italy — Regions. The request's "preview" means the existing
  Overview.
- **Ask before every merge.** The remediation loop's automerge was
  approved for that loop only; for user-visible features the product
  owner wants to try each branch first. Tasks that need the product owner
  (the logo pick, the Android signing key, creating the public repo,
  publishing) also stop at that step.
- **Added 2026-09-14, before the tutorial; amended 2026-09-29 after map testing:**
  - A map picked from the home screen opens on Known (`/map/<id>`), where
    names reveal on click and reflect learning progress. Overview remains a
    separate view with every name shown. The owner changed the map-pick
    destination from Overview to Known in v0.15 (proposal #110, PR #111).
  - Android's back button goes up one level instead of back through
    history: Quiz, Tour and Overview go to Known; Known goes to the map list;
    the list closes the app.
  - The Known/Overview distinction shipped in `v0.4.0` (FT-13, FT-14) so it
    could be tried on a phone. The tutorial moved to `v0.5.0`.
- **Added 2026-09-14, for v0.5.0:**
  - A home page **Recent** section shows the 5 maps opened most recently,
    counting any view of a map.
  - **Favourites** are toggled by a star on every home page card and in
    the map bar.
  - The home page order is Favourites, then Recent, then all maps.
  - The tutorial's practice run doesn't count as a visit.
  - Both lists are stored on the device, like the language setting (FT-15,
    FT-16).
- **Added 2026-09-14, at FT-09's review of the tutorial script**
  (`docs/TUTORIAL.md`):
  - Explore gets a step of its own, so the tutorial has eleven steps.
  - **Only Italy — Regions is sandboxed**, narrowing the entry above.
    Every other map reads and writes real progress during the tutorial.
    With everything in memory, the tutorial's first screen would show
    every map card as due, as if progress had been wiped. A player who
    paused the tutorial to play another map would also lose that session
    without being told.
  - The favourite star is a tip in the outro, not a step. Finish leaves
    the player on the tour, which keeps playing.

## The map is something you build (2026-09-19, FT-39)

- **A map now opens on Known, and a tap leaves a name there.** The product
  owner, after using v0.8.0-beta.1: _"if you tap a second region the
  previous region name stays, and to make it disappear you have to tap it
  again. So you can decide what names you want to show on the map for
  helping you memorize them."_ The screen stops being a readout of progress
  and becomes a worksheet.
- **One rule, two inputs.** What the player earned (the clean streak, FT-22)
  and what they chose (a tap). No override means the earned answer; an
  override means always or never. A tap writes whichever override
  contradicts what is on the screen, so it always does the visible thing -
  the player never has to know there are two inputs at all.
- **Tapping a name you know hides it** (decision 3). One rule for everything
  on the map, which also lets you clear away what you are sure of and work
  on the rest. **Clear** in the legend puts a map back to plain.
- **A name you asked for is drawn in the accent colour**, not as a fourth
  strength of knowing. The three earned strengths keep meaning exactly what
  they meant; "I put this here" and "I learned this" are different claims
  and the map should not blur them. *Amended 2026-09-24 (#11):* as built,
  a tapped name the player had already earned kept its earned strength, so
  a tap looked like it did nothing. The product owner's rule: an explicit
  tap is **Chosen** whatever the streak - the tap is the newer and more
  deliberate claim.
- **~~The choices live in localStorage~~, not in the progress store.** They
  are a view of a map, not a record of what the player knows. Storing them
  as progress would have meant a schema migration in both native backends,
  which a test holds to parity, to record something that is not progress.
  *Amended 2026-09-24 (#11, product owner 2026-09-22):* the choices are now
  **session-only**, in memory; reopening the app shows what is known and
  nothing else, and the old `geoclick:shown-names:v1` key is removed on
  load. With a tap always drawn as Chosen, a persisted choice would pin a
  learned name in the accent colour for good, hiding the progress under it.
- **Overview stays** (decision 1). A map that opens on Known opens nearly
  empty for a newcomer, and Overview - every name at once - is what that
  player needs. Dropping it would have made the first meeting with a map a
  wall of blank shapes.

## A module cycle made the Terrain button do nothing (2026-09-19, FT-33 fix)

- **Found by testing the button rather than the stored preference.** Every
  earlier check had set `geoclick:terrain:v1` before the page loaded, which
  exercises the path through `createMap`. Pressing the button is a
  different path, and it was broken: the preference flipped, the button
  showed pressed, and nothing was fetched or drawn.
- **The cause was two live copies of one module.** `geoclickMap.ts` kept a
  registry of open maps and `refreshTerrain()` walked it; `terrainLayer.ts`
  imported `registerTilesArchive` back out of `geoclickMap.ts`. That cycle
  gave the dev server two instances: `createMap` registered its map in one,
  the button read the other, which was empty. The instrumented run showed
  it plainly - registry size 1 on create, 0 on click, with no map removed
  in between.
- **Both halves are now gone rather than patched.** The PMTiles plumbing
  moved to `pmtilesSource.ts`, which imports nothing from the app and so
  cannot be in a cycle; and the registry was replaced by an `$effect` in
  each view watching the preference. The button now only writes the
  preference, which is what a button should do - the views follow it
  because it is `$state`, the ordinary Svelte way.
- **The lesson worth keeping:** a feature with two entry points needs both
  tested. The persisted path had passed every time.

## The map can show what is under it (2026-09-19, FT-33)

- **The sea is blue now, behind a button.** Until v0.8.0 every map was
  politics only — flat coloured shapes on sand, with the water exactly the
  same sand as the land, so no coastline read at all. The product owner's
  diagnosis was the right one: "the overview maps may be too political, and
  we might think of a way to show non-invasively elevation, coast, rivers or
  anything that could help mnemonics". A region drawn with nothing around it
  has nothing to sit against, and a name with nothing to hang on is a name
  you re-learn every session.
- **~~Off~~ ON by default, one setting for all 63 maps.** *Corrected
  2026-09-19 (FT-43) — it shipped off and that was wrong.* The original
  reasoning was that non-invasive was the ask, so a returning player's map
  should look exactly as it did until they pressed Terrain. What actually
  happened is that the product owner, who asked for the feature, opened the
  Known map after the release and asked why the landmarks and reliefs were
  missing and whether they had been merged. They had; he had simply never
  pressed the button. A feature nobody sees unless they press something is
  not non-invasive, it is invisible — and that is a worse failure than a map
  that changed appearance once. It is now on unless a player turns it off.
- **The default flip does not override anyone.** The preference stores three
  states, not two: `'1'` on, `'0'` off, and *absent* meaning never touched.
  Only the absent case takes the new default, so a player who deliberately
  turned Terrain off stays off. Worth keeping in mind for any future default
  that flips: a two-state flag cannot tell "off" from "unset", and flipping
  its default silently overrules everyone who chose the old one.
- **One setting for every map, not one per map.** A player who wants the sea
  wants it everywhere; having to switch it on again for each of 63 maps
  would be worse than no setting. Unchanged.
- **Antique-map decoration belongs to Terrain (2026-09-29, FT-88).** Original,
  bundled vector motifs live only in empty sea, below the geography and labels,
  and follow the existing Terrain preference. No scanned map art or runtime
  network asset; “Here be dragons” is rendered from localized English, German,
  and Italian text without MapLibre's remote glyph server.
- **Named features, not elevation shading.** What helps a mnemonic is a
  *name* — the Alps, the Adriatic, the Po — and Natural Earth already has
  1 047 named land features and 306 named marine ones, carrying German and
  Italian names, which is why the Terrain labels are trilingual without a
  word being translated by hand. Hypsometric shading would need a source
  that is not Natural Earth, a new pipeline step, and real weight in every
  tileset; deferred deliberately, not forgotten (docs/PLAN_V0.8.md).
- **Its own tileset, not four more layers in the map's own.** Measured on
  `italy-regions`, not guessed: folding the physical layers into
  `tiles.pmtiles` cost +238 KB (45 KB → 283 KB), or +130 KB with the same
  simplification the targets get — while a separate archive at the map's own
  zoom ceiling is 53 KB and is fetched only when the button is pressed. That
  matters more than it looks: `geoclickMap.ts` pulls a whole archive into
  memory on desktop and Android, because neither shell serves range
  requests, so the inline version would have charged every player who never
  switches it on, on every map open.
- **Which also meant the 63 existing tilesets did not have to change.** A
  separate archive is a new file, not a modified one, so the backfill
  (`build-terrain.ts --all`) added 63 files and touched none. MAPS.md's
  standing rule — don't commit a rebuilt tileset unless the map itself
  changed — would otherwise have been broken 63 times over for nothing.
- **The maximum zoom follows the map, and stops well short of the targets'.**
  Cost here is driven by extent, not detail: Russia is 850 KB at zoom 6, and
  simplifying its vertices ten times harder only reaches 547 KB, while one
  zoom level less reaches 553 KB and two reach 385 KB. So each map's terrain
  is built to three levels above the zoom it opens at, and MapLibre
  over-zooms past that — a slightly soft coastline on a background layer.
- **Switching Terrain on lightens what is drawn over it** (amended
  2026-09-19, after the product owner tried the first build: _"rilievo is
  hardly visible because the dark green colour is too strong, and hardly
  visible also when there are other colours"_). He was right — a polygon map
  paints every target at 0.55 and at 0.85 once solved, which on the Overview
  is all of them, and a points map lays its country context over the whole
  country at 0.85. So while the layer is on, `targets-fill` keeps 45 % of its
  opacity and `context-fill` 25 %; switching off restores both exactly. The
  two factors differ on purpose: a target fill is the game and has to stay
  legible enough to tell two neighbours apart, while the country context is
  pure backdrop and the sea already says where the coast is. Town markers are
  not dimmed at all — a 9 px dot is a thing to hit, not a wash of colour.
- **Terrain names always lose a collision.** Registered with a negative
  priority (`labelCollision.ts`), so a region's own name wins the space, and
  among themselves Natural Earth's scalerank decides, so the Alps beat a
  ridge next door. The effect is the right way round: on a fully labelled
  Overview the background stays background, while in the quiz — where few
  names are on the map yet — the terrain shows.

## The second line is about the name (2026-09-19, FT-36)

- **The derived line was not a mnemonic and the product owner said so**
  after using it: _"reads right, but still, it does not help with
  mnemonics. For instance, Lombardia is called like that because of the
  Longobards."_ He is right, and the distinction is exact. The derived line
  says **where** a place is. What you are actually trying to remember is
  its **name**, and an etymology is the hook that holds one: Lombardia from
  the Longobards, Piemonte from _ai piedi dei monti_, Lazio from Latium,
  which is where Latin itself comes from.
- **So the card has two lines, not one longer one.** The first is computed
  and trilingual; the second is authored, English for now, and about the
  word rather than the place. Merging them would lose the distinction that
  makes the second one worth reading.
- **Each place gets a LIST, and the card rotates through it** — a different
  one every time you meet the place. One fact shown forever is one fact
  learned; several, met in turn across sessions, is what makes more than one
  stick. Which one you are due is per device (localStorage, like the
  language and the favourites), so it is a convenience, not progress.
- **The name first, then the place.** Priority to anything that explains the
  word — where it comes from, who it was named after, what it meant. A fact
  merely about the place ("pandas in Sichuan") earns the second slot, not
  the first, because it does not help with the name.
- **Authored per country, projected per map.** `data/facts/<country>.json`
  is keyed by target id, and `build-facts.ts` copies each entry into every
  map that contains the place — so Italy's regions and its provinces, or a
  country's cities and each of its regional slices, never hold four copies
  of a sentence that then drift apart.
- **The file is named for the country as `map.json` spells it** —
  `united-states-of-america.json`, not `usa.json` — so the lookup needs no
  table of aliases. Getting this wrong fails silently: the facts build
  cleanly and every card shows its derived line alone.
- **An id can be two places.** A province and a city inside it sometimes
  share one: China has five. Four are municipalities where the province IS
  the city and one list serves both; Jilin the province and Jilin the river
  town are different places, so that entry splits into `region` and `city`
  and a province fact is never shown for a town.
- **A fact written for an id no map has is a test failure.** It would be
  invisible otherwise: the card just shows its derived line, and nobody
  would ever see the sentence someone wrote.

## The fact is data, not a sentence (2026-09-19, FT-34)

- **`facts.json` holds fields, not prose.** A population, a list of
  neighbours, a compass position — and the sentence is assembled at run time
  from the i18n dictionary. The alternative, writing the sentence at build
  time, would mean writing it three times and watching two of them go stale.
  This way the derived half of the fact box was trilingual the day it
  existed, and only the authored hook (FT-36) needs a translator.
- **Order is the argument.** The clauses come back best-first — where it is,
  then what it is against, then the numbers, with the neighbours last
  because that list is long and dull. What fixes a place in the mind is
  rarely its population.
- **Growth beats a bare count.** "795 000 people in 1950, 3 074 000 today"
  says something about a place; "3 074 000" says something about a number.
  The count is the fallback, used when the city did not really grow.
- **Nothing is guessed.** A fact that cannot be computed is left out of the
  file, and the app renders only what it is given. That is why coverage is
  uneven by design — every target has a position and a coast answer, 9 %
  have a named summit — and why a blank field is never a wrong field.

## A landmark in the wrong place is worse than none (2026-09-19, FT-33 fix)

- **The product owner read the map and found two names in the sea**: the
  Apennines, and the Balkan Peninsula — _"those landmarks may hurt more than
  help"_. He is right, and it is the sharper version of the whole feature's
  premise: the layer exists to give a name somewhere to hang, so a label
  pointing at the wrong place does the opposite of its job.
- **Both had one cause**: the label went to the middle of the *clipped*
  shape's *bounding box*. Neither half survives contact with real geography.
  The middle of a box is outside anything long or curved, and the middle of
  a clipped remnant is nowhere in particular. Labels are now placed at a
  point genuinely inside the feature, computed from its whole geometry.
- **A feature whose middle is off this map is dropped**, rather than moved
  somewhere plausible. If the Balkan Peninsula's name cannot go where the
  Balkan Peninsula is, a map of Italy is better off not mentioning it.
  The exception is a feature that covers the map: the Sahara's middle is in
  Algeria and a map of Egypt should still say SAHARA.
- **Natural Earth's translations get a correction list, not a heuristic.**
  Its Italian for the feature `APPENNINI` is "Appennino ligure" — one
  sub-range at the north-west end of a chain running the length of the
  country. A third of the 581 named land features have a longer localized
  name and nearly all of those are ordinary translations, so there is
  nothing to detect automatically. `TERRAIN_NAME_FIXUPS` is a list, added
  to when a person reads the map and finds one wrong, exactly like the
  place-name fixups that have caught a dozen source errors since v0.5.0.

## Peaks and the great circles (2026-09-19, FT-37)

- **Two more landmark sets inside the same Terrain toggle**, not a second
  switch. The product owner, after trying FT-33: _"any other landmarks that
  could help with mnemonics? Such as volcanoes, mountain peaks, national
  parks and whatever."_ Named summits carry their height ("Mont Blanc
  4 807 m"), because the number is part of the hook; the great circles are
  dashed and grey, because a solid line there would read as a border.
- **What was rejected, and why** — measured against all 63 maps rather than
  argued about:
  - **National parks**: Natural Earth's file is the **United States only**,
    61 features. One country of 28.
  - **Airports**: 1 659 placements, every map has some, so coverage was not
    the problem — an airport sits at a city the player is already learning,
    so it restates a dot already on screen.
  - **Glaciated areas** (1.6 MB): five countries' worth of value.
  - **Urban areas** (12.8 MB) and **roads/railroads** (8.9/14.8 MB): too
    heavy, and on a towns map the built-up blob hints at the answer.
- **Volcanoes are not a Natural Earth layer at all** — but the famous ones
  are already in the elevation points as plain mountains (Vesuvio, Monte
  Etna, Fuji, Nevado del Ruiz). A real volcano/park/heritage-site pass needs
  **Wikidata**, which is CC0 and which this data can already address:
  Natural Earth carries a Wikidata id for 94 % of admin-1 rows and 98 % of
  populated places. That went into FT-34's fact pipeline rather than onto
  the map, because the licensing is clean (unlike OpenStreetMap's ODbL
  share-alike, or the Smithsonian volcano catalogue) and because a fact
  reads better than another dot.
- **Twelve peaks per map.** China has 97 named summits inside its box and
  Russia 87; drawing all of them makes a wall of text the collision pass
  then has to hide, which costs tile bytes to achieve nothing. Named
  depressions are exempt from the cap — there are nine in the world, and
  the Qattara Depression at −133 m is exactly the sort of thing that fixes
  a place in the mind.

## The tab is called Known, and a finger can hit things (2026-09-18, FT-32)

- **The retention tab is "Known"** (Gewusst, Conoscenza), not Progress.
  The product owner's call, after playing v0.6.0: the screen shows the
  names you know, drawn as strongly as you know them, and "Known" says
  that, where "Progress" describes a journey the app does not otherwise
  talk about. It also matches the word the map's own legend already uses
  for a name at full strength. This closes the 🧑 item FT-22 left open.
- **The difficulty ladder keeps its thresholds** — a quarter of a map
  known before the tray narrows to six names, 60 % before three, 85 %
  before one — and the wording "3 names at a time" stands. Also the
  product owner's call, after playing them. This closes FT-21's 🧑 item.
- **Touch targets grew without the controls growing** (review F8). The
  language pills are still 32 × 22 on screen and the favourite star still
  36 px, but each now carries an invisible area centred on it: 44 px tall
  for the pills, 44 × 44 for the star. The pills' areas stop exactly where
  their neighbour's begins — the gap between them was widened to make
  room — because an overlap would mean one pill silently taking taps
  meant for the next. MapLibre's zoom buttons had no such room: they sit
  in a stack with no gaps, so those grew for real, 29 px to 40 px, with
  their glyphs unchanged.
- **The quiz tray's handle stops at about 22 px**, not 44. The map is
  directly above it and the first row of names directly below, so a
  44 px invisible strip would take taps meant for one or the other. The
  visible grip is what it was; the row around it is padded as far as it
  can go without stealing.
- **The accessibility tree was checked, not assumed.** v0.5.0's notes
  suspected the star and the language pills of losing their name and
  pressed state; reading the real tree shows `button "EN" [pressed]` and
  `button "Favourite: Argentina — Regions"`, so that was the emulator's
  own tooling, not the app. A TalkBack pass on a real phone is still
  worth doing, and is the product owner's to run.

## The scheduler keeps running, out of sight (2026-09-18, FT-26)

- **A round is always the whole map.** Due-only rounds were the reason
  the app had a practice mode, an "Up to date!" screen and a home page
  full of dates - three pieces of interface explaining a schedule the
  player never asked for. The product owner's call for v0.6.0 (decision 1
  in docs/PLAN_V0.6.md): keep the scheduler, hide it. Every answer is
  still graded and every review date still written, so nothing learned is
  thrown away and scheduling can come back later - as a suggestion of
  what to play, not as a gate on what may be played.
- **The map list says how well you know a map, not when it is due.**
  "14 / 20 known", plus what the ladder is doing ("3 names at a time")
  once it has started holding names back. A map never played says
  nothing at all: it is a map to start, not a map at 0. The score panel
  ends on the same line, so finishing a round and going back to the list
  tell the same story. Wording chosen by the product owner, 2026-09-18.
- **A round you are in the middle of survives a trip to the Overview**
  (quizRound.ts). Looking a name up in the Overview and coming back is
  something both the tutorial and the manual tell players to do; with
  whole-map rounds and nothing "not due" to pre-solve, that trip would
  otherwise have wiped the round. The round is kept in memory only, per
  map: a sitting, not a save. A reload or a new day starts fresh, and the
  tutorial's sandbox throws its round away with the rest of itself.

## A map opens fully visible (2026-09-18, FT-25)

- **The opening fit leaves room for the view's own furniture.** The map
  bar sits over the top of every map screen and the quiz tray over the
  bottom, but the camera was fitted to the whole canvas, so on a phone
  the northernmost regions started behind the bar and the first thing a
  player had to do was pan - which the v0.5.0 product review called a
  blocker (F1). Each overlay now says where it is
  (`data-map-overlay="top"`/`"bottom"`) and the fit measures them, so
  anything added later is accounted for by saying so in its markup.
  A side that is covered gets a smaller margin than a bare edge (12 px
  against 40): the furniture is already a visible boundary, and on a
  phone every pixel given back is map.
- **The fit covers each target's whole extent, not just its centroid.**
  Fitting to centroids (the v0.5.0 behaviour) left the outer targets
  half off the screen on a phone - Puglia's heel, the west of
  Nordrhein-Westfalen - which is the same "you have to pan before you
  can play" problem. A target whose bbox wraps the antimeridian still
  contributes only its centroid: merging a wrapping box with the others
  is ambiguous, and Alaska's Aleutian tip would pull the camera out to
  the whole hemisphere.
- **What this cannot fix:** a map that reaches far north on a tall narrow
  screen (Russia at 390 px) hits MapLibre's own limit - the world would
  be shorter than the viewport - so the camera is clamped and the far
  north still sits partly behind the bar. Every region's centre is on
  screen; the alternative would be a map that stops being Mercator.

## Names never overlap (2026-09-18, FT-23/FT-24)

- **A name is either legible or it isn't drawn.** The product owner's
  requirement for v0.6.0: "on maps names do not overlap". Italy's 110
  provinces used to pile their labels on top of one another until the
  overview was a wall of text. Now every label is measured after each map
  move, and a name is dropped when a more important one already holds
  that spot. Zoom in and the same pass finds room for it again, which is
  also the answer to "what happens to the names that are hidden" — the
  product owner's choice over shrinking or stacking them.
- **A name that doesn't fit tries somewhere else before giving up**
  (FT-24). A region's name wants the middle of its region and will take a
  line above or below it; further than that and it would start to look
  like the neighbour's name. A town's name never sits on its dot - the
  player has to see the dot they are aiming at, especially while dragging
  a slip onto it - so it goes beside it, at a fixed clearance from the
  dot's middle. Both come out of the same pass: a label offers the spots
  it would accept, and gets the best one that is free. On Italy - Towns
  this is the difference between 26 names and all 40.
- **"Best" is a score, not the first free spot** (FT-63, amends FT-24,
  which took a town's first free side - right, left, above, below - and
  so put Duisburg's name over Essen's dot with open space to its west).
  A town's name now has eight spots, the four sides and the four
  corners, and every free one is scored in pixels: room to the nearest
  name or dot (capped at 12 px), minus twice how far it strays from its
  place, minus 100 for each other town's dot it would cover, minus 30
  times the share of it off the map's edge, minus 0.5 per step down the
  view's own order (the tie-break, so a name with room on both sides
  still goes right). Every town's dot counts, named or not - in a quiz,
  the unsolved ones too. A dot is a cost, not a wall: a name that can
  only go over a dot still goes there, so a dot never hides a name. The
  pass is still greedy, though, so a more important name taking its best
  spot can take a lesser one's only spot: on 2 000 random 40-town
  layouts the reviewer drew 38.9 names on average against FT-24's 36.0,
  but 23 of those layouts drew fewer. Straying counts double so that a
  region's one-line step can never win back its cost in room: a region's
  name still leaves its middle only when the middle is taken. What sits
  *under* a name - water, a region border - is not scored: the pass
  knows the labels and the dots, not the map's paint. The map's edge is
  the whole container, map bar included, so a name under the bar counts
  as on the map.
- **A pan moves only the names at the map's edge** (FT-63). Every other
  term is relative to the labels and dots, so a pan gives the same
  answer - provided every position comes from the map's projection. A
  label's place used to be read back from the DOM, which MapLibre rounds
  to a whole pixel; against unrounded dots that was enough to flip
  Hannover across its dot on a half-pixel pan. It now comes from
  `map.project` of the popup's own place, the same as the dots, on the
  world copy nearest the view. While the map is moving - between MapLibre's `move` and
  `moveend` - a name keeps its spot against one up to 4 px better (the
  stay bonus), so the pixel rounding of a pan or a zoom's animation
  doesn't flicker names side to side. On a still map every pass places
  each name afresh: a bonus kept for good (round 1 of PR #23) left a name
  pushed aside by a neighbour's hover, or by the edge, on its second-best
  side long after the neighbour or the edge had gone.
- **Which name gives way**: the smaller region's. Area (from each
  target's bbox, corrected for latitude) decides between two names that
  want the same place, the way an atlas keeps the big name and lets the
  small one wait for the zoom. On the retention map (FT-22) the strength
  ranks first — a name you know beats one you have only half learned —
  and area breaks ties within a strength. In the quiz, the name just
  placed wins: it is the answer to what the player did a second ago. A
  name the player is pointing at or has tapped (FT-02/FT-03) always wins,
  and its neighbours give way while it is grown.
- **Collision is computed in JS over the DOM labels, not by a MapLibre
  symbol layer** — which does collision natively, and was the obvious
  candidate. Two reasons decided it:
  - symbol layers draw text from glyph PBFs, and the style's `glyphs`
    entry points at a public font server. Nothing in the app fetches it
    today, and Geoclick has to work fully offline, so a symbol layer
    would mean vendoring and shipping a font stack in every build;
  - everything a label does today lives in CSS: the magnify on hover and
    tap, the three retention strengths, the "shown" colour for a name
    given away, `rem` sizing that follows the browser's font-size
    setting. A symbol layer would have to reimplement all of it in
    expressions, and could not magnify a single label at all.
  The pass itself is small: read every label's rectangle once per frame,
  keep them in order of importance, hide the rest. See
  `app/src/lib/labelCollision.ts`.

## The retention map replaces Explore (2026-09-18, FT-22)

- **The second tab now shows what you know.** Every name placed right at
  least once is written on the map, at one of three strengths: solid at a
  clean streak of 3 or more, lighter at 2, faint at 1. A name never placed
  cleanly - or one missed since - isn't drawn at all, so the map is an
  honest picture of knowledge rather than of visits.
- **Why here:** with the due counts retired (decision 1 of v0.6.0), the
  player needs somewhere to see progress, and a map says it better than a
  number. Explore's own job - "what is this region?" - is kept: clicking
  still names any region, known or not, so nothing was lost by reusing the
  tab rather than adding a sixth one to a bar that is already full on
  phones.
- **On a map never played it is exactly the old Explore:** a blank map to
  test yourself against.
- **The tab is called "Progress"** (DE *Fortschritt*, IT *Progressi*),
  with a three-swatch legend in the corner. The name is the product
  owner's call at review; "Known" / "Gewusst" / "Conoscenza" was the
  alternative.
- Pointing at or tapping a faint name brings it to full strength, so a
  half-learned name can still be read (reuses FT-02/FT-03's magnify).

## The tray offers fewer names as a map is learned (2026-09-18, FT-21)

- **The quiz deals a *hand*, not the whole deck.** How many names the tray
  offers depends on how much of the map is known (names at a clean streak
  of 3 or more): under 25 % ten, from 25 % six, from 60 % three, from
  85 % one. **Amended 2026-09-23 (FT-60):** under 25 % was *every name*
  until the product owner capped it at ten — a new map laid its whole deck
  in the tray (49 slips on `germany-towns-100k`, 110 on `italy-provinces`),
  which on a tablet is a wall of slips rather than a hand. While a tutorial
  runs, the two slips it spotlights (Sicilia, Sardegna) are dealt first.
  `app/src/lib/difficulty.ts` holds the thresholds and the
  drawing, pure and unit-tested; QuizView deals at the start of a round and
  tops the hand up after every resolved drop.
- **Why:** with every remaining name in front of the player, the end of a
  round is a process of elimination rather than knowledge — the v0.5.0
  product review called this out (F3) — and a map you already know plays
  exactly like the first time. The same map now asks more of you as you
  improve, which is the release's theme.
- **The hand keeps its survivors.** A refill only replaces the name just
  placed, so a name the player is still thinking about doesn't vanish and
  reappear elsewhere.
- **The level is shown, not hidden:** a quiet note beside the progress
  line, "3 names at a time". Nothing is shown at level 0: ten is the
  default hand, and the progress line already counts placed-of-total.
- The thresholds and the hand sizes are a first guess, not measured; they
  live in one place so they can be retuned.

## A clean streak per name (2026-09-18, FT-19)

- **Each target now also stores how often in a row it was placed right with
  no mistake** (`cleanStreak` in `packages/srs`). v0.6.0 needs a plain
  answer to "how well is this name known" for two things: how prominently
  the retention map draws it, and how many names the quiz offers at once
  (docs/PLAN_V0.6.md). Three in a row means known.
- **Why not reuse `repetitions`:** it counts passes, including ones that
  needed a second try, and only a total fail resets it. A name fumbled every
  other round would look as good as one never missed.
- **Any mistake resets it to 0**, including a `hard` grade (right, but only
  after a wrong drop) which still passes for scheduling. Getting it right
  eventually is a pass; it is not evidence of knowing it.
- **Cards saved before v0.6.0 start at 0.** The browser store fills the field
  in on read, and both SQLite backends get a migration that adds the column
  with a default. Guessing a streak from the existing review history would be
  wrong more often than right, so a returning player rebuilds one over the
  next few rounds - said plainly in the release notes.
- The scheduler itself is unchanged: dates, intervals and ease behave as
  before, and the streak rides along beside them.

## Tutorial sandbox (2026-09-14, FT-10)

- **The tutorial's quiz never becomes real progress**, the same rule as
  Practice mode ("persists nothing"). While the tutorial runs,
  `createProgressRepository()` wraps the real store:
  Italy — Regions lives in an in-memory repository that starts empty, so
  the quiz starts fresh whatever the player's real progress is, and it's
  thrown away when the tutorial ends.
- **Only the tutorial's map is sandboxed** (FEATURE_PLAN.md, decision 18).
  Every other map reads and writes the real store. Sandboxing everything
  would show every home page card as due during the tutorial, and a map
  played while the tutorial is paused would lose its session without a
  word.
- **A repository handed out during the tutorial stays sandboxed after it
  ends.** The sandbox is read when the repository is created, not on
  every call, so a quiz still open when the tutorial ends can't write its
  tutorial results into real progress. Views remount at the end to pick
  up the real store (FT-11 keys them on `isTutorialSandboxActive()`).
- The switch is `app/src/lib/tutorialSandbox.svelte.ts`
  (`startTutorialSandbox` / `endTutorialSandbox`); only the tutorial
  engine calls it. It also keeps the tutorial's map out of Recent.

## Tutorial nudge and copy length (2026-09-14, FT-12)

- **The "New here?" nudge goes away for good** once the tutorial has
  been started (from anywhere) or the player chooses "No thanks". Its
  buttons say what they do, rather than a bare ×. The choice is stored on
  the device like the language (`geoclick:tutorial-seen:v1`). It only
  offers; the tutorial never starts by itself (decision 6).
- **Each numbered step fits in four lines at 360px in German.** Cards sit
  over the screen the player is working on, so a long one hides what the
  step is about. Measured in FT-12's browser runs; step 10 (spaced
  repetition) was the only one over, at 7 lines, and lost two clauses. The
  intro and outro may take five, since there's nothing to do behind them.

## Recent and favourite maps (2026-09-14, FT-15/FT-16)

- **They're stored on the device, not in the progress store.**
  `app/src/lib/mapPrefs.svelte.ts` keeps them in localStorage, like the
  UI language. They are conveniences of this device rather than learning
  progress, so they don't need the SQLite schema, migrations or a future
  sync story. localStorage works in all three shells.
- **Recent (FT-15):** opening any map view counts (MapNav records it
  on mount). The home page shows 5, newest first; up to 10 are stored,
  so a map later removed from the catalog doesn't shorten the list.
  During the tutorial, visits to its map aren't recorded
  (`setUnrecordedMap`, FT-10), so its practice run doesn't count; other
  maps opened while it's paused still are.
- **The section renders only after mount.** The home page is
  prerendered without access to device storage, and rendering the list
  during hydration would mismatch the prerendered HTML. The same goes for
  each star's filled state.
- **Favourites (FT-16):** one `FavouriteStar` button, used on every home
  card and in the map bar, and kept in sync through the shared store.
  - On a card, the star is a sibling of the card link, not inside it:
    nesting a button inside a link would give keyboard and screen-reader
    users one muddled control.
  - In the map bar it sits next to the map name, not as a sixth tab,
    because the tab row is full at phone width.
  - Its accessible name stays "Favourite: <map>", with `aria-pressed`
    for the state; the tooltip says what a click will do. The plan said
    the name should flip between "Add…" and "Remove…", but that announces
    the state twice with `aria-pressed`, so the standard toggle-button
    pattern won.
  - Favourites keep the order they were starred.
- **Favourites and Recent share one panel, set apart from the full list**
  (FT-17). As plain sections with the same headings and cards as the
  country groups, they read like two more countries (product owner). The
  panel has its own background and border, the headings an icon and the
  accent colour, and an "All maps" heading starts the country list. The
  panel and heading appear only when there is something in them.

## Pre-release channel: alpha and beta (2026-09-14)

- **Previews are published, not handed around.** The product owner asked
  for any build given to testers, desktop or Android, to appear on the
  public releases page marked alpha or beta if it isn't fully tested. The
  trigger was a preview APK of FT-13/FT-14 about to be sent directly for
  a phone test.
- **alpha** means unmerged work tested only by the developer. **beta**
  means everything for the release is merged and waiting for the product
  owner's test. Both are GitHub pre-releases: never "latest", with a
  warning banner, and "(alpha)" or "(beta)" in the title. The website's
  download link keeps pointing at the last stable release.
- **Android's versionCode scheme changed to
  `(major·10000 + minor·100 + patch)·100 + stage`** (alpha N, beta 50+N,
  stable 99). The old `major·10000 + minor·100 + patch` had no room
  between versions, so an alpha → beta → stable sequence couldn't install
  as updates. v0.3.1 shipped 301; every new code is higher.
- **Pre-releases skip the `.msi`.** The Windows Installer format's
  version is numeric only, and WiX rejects "alpha". The NSIS
  `-setup.exe` has no such limit. Rules and steps are in
  docs/RELEASES.md, "Pre-releases".

## App logo (2026-09-13, FT-04)

- **Geoclick's icon is a cream map pin with an amber centre on the app's
  deep green** (`design/logo/geoclick-logo.svg`). Until now every shell
  shipped someone else's art: Tauri's and Capacitor's scaffold icons on
  desktop and Android, and the Svelte framework logo as the web favicon.
- **Picked from three drafts**, each reviewed at real sizes (16–128 px),
  in a browser tab, on light and dark desktops, and in Android's circle,
  squircle and square launcher shapes. The other two were a four-region
  "patchwork" with a solved tick, and a pointer clicking a country. The
  pin won as the clearest mark at 16 px.
- **The web favicon switches to it too**, so all three shells match
  (product owner, same day). The switch and the platform icon sets are
  FT-05.
