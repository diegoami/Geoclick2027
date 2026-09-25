# v0.12.0 — Facts for the new maps, and one style for region names (planned 2026-09-25)

> **Agreed** on [#46](https://github.com/diegoami/Geoclick2027/issues/46),
> 2026-09-25, with the recommended answer to all five questions (below).
> Nothing is built yet. The three tablet-play fixes of PR #47 are already on
> `main` and ship in this release too (CHANGELOG, `## Unreleased`).

## Why

v0.11.0 doubled the map list, from 63 to 127, and left the new half without
the part of the game the product owner values most: the fact card's
sentences. On the 63 older maps every place has three, in English and
Italian. On the 64 new ones a player taps Attica, Isfahan or Brazil and
reads only what is generated from the map data: the local name, the
neighbours, the coast, the largest city. The product owner found it on the
tablet the day v0.11.0 shipped.

The same test found the Quiz still drawing region names in boxes, as #34
agreed (Q1, "Explore only"). A region's name should look the same on
every screen.

## The size of it, measured 2026-09-25

Each place counted once, over the 64 maps added since v0.10.0, by the file
its facts will live in:

| Tier  | What                                                                                                                                                                                                    |  Places | Files                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------: | ------------------------------------------------------------------------------------ |
| **1** | the continents: every country (172) and the capitals and European cities with no sentences (284)                                                                                                        | **456** | `world.json` for the countries; each town in its own country's file, 160 of them new |
| **2** | the 15 new countries: Belgium, Czechia, Croatia, Greece, Bulgaria, Chile, Peru, South Africa, Iran, Thailand, Saudi Arabia, Ireland, Switzerland, Austria, Romania: their regions (363) and towns (176) | **539** | 15 new country files                                                                 |
| 3     | the finer maps of countries already here: departments, provinces, Kreise, municipalities, powiats, Germany's towns in six parts                                                                         |   1 474 | 5 existing files                                                                     |

At three sentences a place, **tiers 1 and 2 are about 3 000 sentences in
English and 3 000 in Italian.** That is more than v0.10's 5 448 Italian
sentences, and unlike v0.10 the English does not exist yet either.

## The risk worth naming first

v0.10 translated sentences that had already been written and checked. These
have to be written from scratch, about places that are less familiar than
Lombardia: Sistan and Baluchestan, Ñuble, the Northern Borders. **The
failure mode is a plausible, confident, wrong fact.** A clumsy sentence is
visible; an invented etymology is not. A lint cannot catch either.

So the same rules as FT-41, held more strictly:

- **The name first, then the place**, as everywhere else. Where a
  derivation is disputed, say so ("probably", "the derivation is
  contested"). Never pick the more colourful version.
- **Nothing the card already shows**: not the neighbours, not the coast,
  not the largest city. The card also opens with the place's name
  ("Crete — …"), so no sentence starts with it (found in FT-70).
- **When unsure, leave it out.** Two solid sentences are better than three
  with a guess in them. The DoD's "three a place" is a target, and a place
  with fewer is reported, not padded.
- **A voice gate before the bulk** (FT-70), and 🧑 spot-checks by the
  product owner every few batches.

## Product decisions (answered 2026-09-25, #46)

| #   | Question                                  | Decision                                                         |
| --- | ----------------------------------------- | ---------------------------------------------------------------- |
| 1   | Which tiers?                              | **Tiers 1 and 2.** Tier 3 is its own release.                    |
| 2   | How many sentences?                       | **Three**, as in v0.10. Districts get 1–2 when their turn comes. |
| 3   | Where do countries' facts live?           | **A new `data/facts/world.json`**, keyed by country.             |
| 4   | Languages?                                | **English and Italian.** German (FT-51) stays postponed.         |
| 5   | Which views get the boxless region names? | **Quiz, Overview and Tour.** Town names keep their pills.        |

A decision made in writing this plan, following the resolver as it
already works: **a town on a continent map takes its sentences from its
own country's file** (`authoredResolver`, `data/scripts/factsHooks.ts:38`),
so Debrecen goes in a new `hungary.json`, not in `world.json`. Each of those
160 files starts with a handful of towns, and is already there, with the
right ids, on the day that country gets a map of its own.

## Tasks

### FT-69 — Countries read `world.json` · Small

- **Do:**
  - `authoredResolver` gives a target of type `country` its sentences
    from `data/facts/world.json`, keyed by the target id (`italy`,
    `czechia`). The file takes the same `{ en, it }` shape as the others.
  - **One country, one file name.** `czechia-regions` was built with
    Natural Earth's admin-1 name, "Czech Republic", so its places would look
    for `czech-republic.json`, while the Czech towns on Europe's city maps
    look for `czechia.json`. It is the only map whose country is spelled
    differently from the continent maps' (checked over all 127). Fix it in
    one place in `factsHooks.ts`, so the rename also covers any later map.
  - `refresh-facts-hooks` covers the continent maps, whose `country` is
    "Europe" and has no file of its own.
- **Tests:** a country target reads `world.json`; a town on the same map
  still reads its country's file; "Czech Republic" and "Czechia" reach the
  same file; a country missing from `world.json` gets no sentences, as
  before.
- **DoD:** gates green; `facts.json` rebuilds byte-identically on a second
  run.

### FT-70 — One file, written and read · Small · 🧑 gate · deps: FT-69

- **Do:** **Greece** (14 regions, 42 sentences in English and 42 in
  Italian), in the final shape. It's small, and it has the hard cases in
  miniature: names from Greek, a region that is really a mountain (Mount
  Athos), islands.
- **DoD:** 🧑 the product owner reads the Italian and the English, and says
  whether the voice is right and the facts sound true. **No other writing
  starts until the product owner has.**

### FT-71 — Tier 1: the continents' countries · Large · deps: FT-70

- **Do:** 172 countries in `world.json`, **one commit per continent**
  (Europe 39, Africa 52, Asia 47, the Americas 28, Oceania 6), English and
  Italian together.
- A country's sentences are about the country's name and the country as a
  whole. What is inside it belongs to its own file.
- **DoD:** every target on the six Countries maps has sentences; Italian
  passes `houseStyle` (FT-67); 🧑 a spot-check after Europe.

### FT-72 — Tier 1: the capitals and Europe's cities · Large · deps: FT-71

- **Do:** the 284 towns in their countries' files, 160 of them new files.
  **One commit per continent** (Europe's five city maps together).
- A capital that is already in its country's file keeps its sentences. It
  is not among the 284.
- **DoD:** every target on the Capitals maps and on Europe's five city maps
  has sentences; the orphan lint passes (no sentence for an id no map
  has).

### FT-73 — Tier 2: the 15 new countries · Large · deps: FT-70

- **Do:** 539 places, **one commit per country file**, in the order of the
  catalog. The nine European ones have regions only; Chile, Peru, South
  Africa, Iran, Thailand and Saudi Arabia have regions and towns.
- **The region and the town of the same name get their own lists**
  (`{ region: …, city: … }`, `authoredHooks.ts`): the Lima regions, not
  Lima the city; Santiago the capital, not the Metropolitana. This avoids
  in the new files the conflation Sevilla still has in Spain's.
- Greece is already done (FT-70).
- **DoD:** every target on the 21 maps of these countries has sentences;
  🧑 spot-checks after the third and the ninth file.

### FT-74 — One style for region names · Small

- **Do:** the Quiz, Overview and Tour label a region the way Explore's
  fallback does since #36: Georgia capitals, the halo, the asked ink, no
  box. Tag their region popups `geoclick-region-name`, as `MapView.svelte`
  does, so the three existing rules in `app.css` apply. Town names keep
  their pills (#34 Q2).
- **Watch:** a Quiz label marks a solved name, and its colour says whether
  it was right first time. The boxless name has to carry that colour in its
  ink. Check it against the Quiz's own states before calling it done.
- **Tests:** extend `regionLabel.browser.test.ts`, which today checks that a
  Quiz label _keeps_ its box; it now checks the opposite for regions and
  still checks it for towns.
- **DoD:** gates green; 🧑 checked on the tablet (tapping, magnifying,
  reading a solved name).

### FT-75 — The two review nits from v0.11.0 · Small

- `--within`'s nearest-area fallback (`data/scripts/build-map.ts`, the
  `areaOf` helper) measures in squared degrees; scale the longitude
  difference by cos(latitude), so a degree east counts for what it is on
  the ground.
- The `--disambiguate-by` failure message names the flag as
  `--disambiguate`.
- **DoD:** the shipped maps that use `--within` rebuild byte-identically.
  None of their targets hits the fallback in a way the change moves; the
  rebuild proves it.

## Out of scope

- **Tier 3**, 1 474 places on the finer maps: a release of its own. Its
  first step is the `region` lists that stop Sevilla the province from
  showing Sevilla the city's sentences.
- **German** (FT-51), still postponed.
- **Machine translation**, for the reason v0.10 gave: a plausible error is
  invisible in sentences about etymology.
- **Facts for maps that don't exist yet.** Nothing is written for a place
  no map has; the orphan lint enforces that.

## Order

**FT-69 → FT-70 (gate) → FT-71 → FT-72 → FT-73.** FT-74 and FT-75 are
independent and small; they go in first, while the gate waits for the
product owner's reading. Each task is its own branch and PR; the writing
tasks may take several PRs each, one per batch, so each can be merged and
read on its own.

**→ Release `v0.12.0`** per [RELEASES.md](RELEASES.md), "The milestone":
the CHANGELOG's `## Unreleased` (PR #47's fixes) becomes the v0.12.0
entry.

## Progress ledger

| Task  | State      | Merge        | Notes                                                                                                                                        |
| ----- | ---------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| FT-69 | **merged** | PR #48       | countries read `world.json`; "Czech Republic" = "Czechia"; `world.json` holds only its `_note` so far                                        |
| FT-70 | **merged** | PR #49       | Greece, 14 regions, 42 + 42 sentences; 🧑 read and approved by the owner, 2026-09-25: the gate is passed                                     |
| FT-71 | **merged** | PRs #52–#55  | all 172 countries, 516 + 516 sentences; Europe 🧑 spot-checked                                                                               |
| FT-72 | **merged** | PRs #56, #57 | 286 towns in 160 new country files, each a `city` entry; every capital (165) at three sentences, 94 small towns at one or two (owner’s call) |
| FT-73 | planned    | —            | the 15 new countries, 539 places, one commit per file                                                                                        |
| FT-74 | **merged** | PR #51       | region names boxless in the Quiz, Overview and Tour; given-away ink brown; tried in `v0.12.0-alpha.2`                                        |
| FT-75 | **merged** | PR #50       | distance on the ground; the message names `--disambiguate-by`; all 16 `--within` maps rebuild byte-identical                                 |
