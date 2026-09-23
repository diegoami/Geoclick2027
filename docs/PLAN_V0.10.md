# v0.10.0 — The name-facts in your own language, and the tablet-play fixes (planned 2026-09-19, rescoped 2026-09-23)

> **Queued behind v0.9.4, now unblocked.** On 2026-09-20 the product owner
> put the code review's issues ahead of this; on 2026-09-22 that batch was
> reshaped to the ones worth doing before v0.10.0 —
> [PLAN_V0.9.4.md](PLAN_V0.9.4.md) shipped FT-52 to FT-58 and deferred the
> two test gates (FT-56, FT-59) — and **v0.9.4 was released on 2026-09-22**.
> This plan keeps its number. Its three product decisions were **answered
> on 2026-09-22** (below) and it has started: **FT-48 and FT-49 are
> merged** (Italy's 20 regions in Italian, and the per-language shape with
> per-sentence fallback). **FT-50** — the other 27 countries — is next.

## Why

Geoclick is trilingual everywhere except the one place a player actually
reads a sentence. Opening **China — Regions** with the interface in Italian
today gives this:

| Part of the screen              | Language                                     |
| ------------------------------- | -------------------------------------------- |
| Tabs                            | Mappe / Conoscenza / Panoramica ✓             |
| Landmark names                  | Penisola di Noto, Delta del Gange, monti Yin ✓ |
| The card's bottom clause        | Città più grande: Chengdu (4.123.000) ✓       |
| **The card's name-fact**        | _"Four circuits" — four administrative districts of the Song…_ ✗ |

The product owner found it himself and called it "funny" — which is exactly
right: it does not read as a missing feature, it reads as a **glitch**,
because everything around it works. That is the argument for doing this
rather than documenting it again.

Everything else is trilingual because it is **composed at run time** from
the i18n dictionary and from Natural Earth's own `name_de`/`name_it`
fields. The name-facts are the only hand-written prose in the project, and
decision 3 in [PLAN_V0.8.md](PLAN_V0.8.md) deliberately deferred
translating them: at the time there were 101 of them on three maps.

There are now **5 448**, on all 63.

## The size of it, measured 2026-09-19

```
authored places      1 814
English sentences    5 448
add Italian         +5 448
add Italian+German +10 896
```

That is the whole of FT-41 again, once per language. It is not a
sub-task of anything; it is a release.

## The risk worth naming first

The English sentences were written carefully: they hedge where sources
disagree ("probably", "the derivation is contested"), they avoid repeating
what the map already shows, and they lead with the name. Reproducing that
in Italian and German means the author is judging whether a hedge still
reads as a hedge, and whether a sentence sounds like prose or like
translated prose, in languages the reader speaks better than the writer
writes them.

**The failure mode is not wrong facts — it is stilted, plausible prose that
a native reader finds grating.** That cannot be caught by a lint or a test.
It can only be caught by the product owner reading it, which is why the
first task below is twenty minutes of work and a review gate, not a batch.

## Product decisions (answered 2026-09-22)

🧑 **Italian first. Per-sentence English fallback. No "EN" marker. German
postponed.** The three questions and what was chosen:

| #   | Question                          | Decision                                                                 |
| --- | --------------------------------- | ------------------------------------------------------------------------ |
| 1   | Which languages, and in what order? | **Italian first**; decide on German after reading it.                    |
| 2   | What does an untranslated sentence do? | **Fall back to English per sentence** — a half-finished set is partly English, never broken. |
| 3   | Is a visible marker wanted?       | **No marker** — the English reads as English; a tag would clutter the card. |

**German is postponed** (FT-51), not refused: it has no native reader on
the project, so its register risk has nobody positioned to catch it. Decide
it after the Italian.

## Tasks

### FT-48 — One country, translated, and read · Small · 🧑 gate

- **Do:** Italy's 20 regions — 60 sentences — in Italian, in the final file
  shape (below). Nothing else.
- **Why first:** it is the smallest complete unit that shows the voice, and
  the product owner reads Italian. If the register is wrong, this costs
  twenty minutes instead of a day.
- **DoD:** 🧑 the product owner reads all 60 and says whether the voice is
  right. **No further translation starts until he has.**

### FT-49 — The file shape and the fallback · Small · deps: FT-48

- **Do:** `hooks` becomes per-language without breaking what exists.
  Proposed, to be confirmed by what FT-48 learns:

  ```json
  "lombardia": {
  	"en": ["Named for the Longobards…", "…", "…"],
  	"it": ["Dai Longobardi…", "…", "…"]
  }
  ```

  A plain array stays legal and means English, so nothing already written
  has to be touched in the same commit as the code change.

- `build-facts.ts` writes every language it finds; `facts.ts` picks the
  current one and falls back to English **per sentence**, so a place with
  two Italian sentences and three English ones shows two and one.
- **Tests:** the fallback, a partly-translated place, a plain-array place,
  and a language with nothing at all.
- **DoD:** gates green; `facts.json` still rebuilds byte-identically on a
  second run.

### FT-50 — Italian, the rest · Large · deps: FT-49

- **Do:** the remaining 27 country files, 5 388 sentences.
- **Batch by country**, committing each, so the work is reviewable in
  pieces and a bad run is revertible without losing the good ones.
- 🧑 the product owner spot-checks a country every few batches rather than
  reading 5 000 sentences.
- **DoD:** every place with an English sentence has an Italian one; the
  orphan lint still passes.

### FT-51 — German · Large · deps: FT-50

- Same again, if the Italian went well. Split out deliberately: German has
  no native reader on this project, so it carries the register risk with no
  one positioned to catch it.
- **Postponed (2026-09-22).** Not in v0.10.0's scope until the Italian has
  been read; planned, not dropped.

## The tablet-play fixes (product owner, 2026-09-23)

The Iteration 8+ backlog's first item, decided 2026-09-20 and unscheduled.
The product owner put it **in v0.10.0** on 2026-09-23. The full reasoning
for each lives in ROADMAP.md's backlog entry; these are the tasks.

### FT-60 — A finite first hand · Small

- **Why:** `HAND_SIZES[0]` is `Infinity` (`app/src/lib/difficulty.ts:21`),
  so a map never played lays every name in the tray at once — 49 slips on
  `germany-towns-100k`, 110 on `italy-provinces`. The hand only starts
  shrinking once a quarter of the map is known.
- **Do:** a finite level-0 hand. **The hand holds 10** (product owner,
  2026-09-23).
- **DoD:** a first round offers ten names; no new indicator is needed
  (`quiz.subtitle` already shows placed-of-total).

### FT-61 — A slip keeps its drag on a tablet · Small

- **Why:** a slip is a `<button>` holding text, and nothing sets
  `user-select`/`-webkit-touch-callout` or handles `pointercancel`, so a
  tablet's text-selection gesture takes the pointer mid-drag — "the tablet
  wants to copy".
- **Do:** set the text-selection guards and add a `pointercancel` handler
  that returns the slip to the tray. **Build it now and confirm on the
  tablet at release time** (product owner, 2026-09-23). The drawn-image
  slip is the fallback only if that fails; it costs selectable,
  translatable, screen-reader-readable place names.
- **DoD:** a slip drags and drops with no selection UI, and a cancelled drag
  returns it — confirmed on the tablet during the release gate.

### FT-62 — The fact card only on a name you could not place · Small

- **Why:** the card appears after every resolved name, at the moment the
  player is reaching for the next slip. The content is fine (FT-45); the
  timing is not.
- **Do:** show it only when the name was *not* answered correctly —
  `status === 'revealed'`.
- **DoD:** a correct drop says nothing; a revealed name still shows the
  card. Decide whether the dwell time changes now it is rarer.

### FT-63 — Labels go where there is the most room · Medium

- **Why:** `candidatesFor` (`app/src/lib/labelCollision.ts:169`) offers four
  fixed spots and the pass takes the first that fits, so Duisburg's name
  covers Essen while open space to its west goes unused.
- **Do:** every target's dot becomes an obstacle; the candidate set widens
  past four compass points; each candidate is scored — room around it,
  distance to the nearest anchor and dot, how much sits over background —
  and the best is taken. Keep the cost explainable, cheap for 110 labels,
  and stable under a one-pixel pan.
- **DoD:** Duisburg moves west; panning does not shuffle the map's names.

### FT-64 — Spike: region names stretched along the region · Small spike

- **Why:** a region's name sits on its centroid and reads as a pin, not a
  territory. Drawing it along the shape's long axis is what makes a map
  look like a map (Europa Universalis does this).
- **Do:** a spike only — draw one region's name along a computed spine, on
  a real map at real zoom levels, and see whether it reads. That decides
  between an SVG `textPath` overlay (keeps offline, magnify and rem sizing)
  and a MapLibre symbol layer with `symbol-placement: line` (needs a
  vendored glyph stack, loses FT-02/FT-03).
- **DoD:** a decision, not a shipped feature.

### FT-65 — The map card shows a progress bar, not the known line · Small

- **Why:** `home.known` shows `{known} / {total}` on every map card, and a
  played map with no known name reads "0 / 49 known".
- **Do:** a progress bar over `knownCount / total`, **hidden at zero**, on
  the map list only. The score panel's `quiz.known` stays; fix the comment
  at `app/src/lib/QuizView.svelte:751` that still says the two are one
  statement. Leave `quiz.subtitle` and `retention.known` alone.
- **DoD:** a played-but-none-known map shows nothing; a map with known
  names shows the bar.

## Out of scope

- **Machine translation.** These are careful sentences about etymology,
  where a plausible-sounding error is invisible. Nothing here is worth the
  speed.
- **Translating the map's place names.** Those come from Natural Earth and
  already carry `name_de`/`name_it` where the data has them; where it does
  not, a place keeps its own name, which is the convention the app already
  follows (DECISIONS.md, "Place names are not translated").

## Order

**The tablet-play fixes first, then the Italian bulk.** The small, visible
ones — **FT-62**, **FT-65**, **FT-61**, **FT-60** — then **FT-63** (best-fit
placement), then the **FT-64** spike, which decides whether stretched names
become a task at all. Then **FT-50**, the remaining 27 countries of Italian,
batched by country. **FT-51 (German) is postponed.**

The FT-48 gate is already passed. **→ Release `v0.10.0`** per
[RELEASES.md](RELEASES.md).

## Progress ledger

| Task  | State       | Merge | Notes                                        |
| ----- | ----------- | ----- | -------------------------------------------- |
| FT-48 | **merged**  | `51892fc` | Italy's 20 regions, 60 Italian sentences, read and approved (PR #18) |
| FT-49 | **merged**  | `51892fc` | per-language `hooks`, per-sentence fallback (PR #18) |
| FT-50 | not started | —     | Italian, the other 27 countries              |
| FT-51 | postponed   | —     | German, only if the Italian read well   |
| FT-60 | **merged**  | `8b75e1e` | finite level-0 hand, size 10; tutorial slips dealt first (PR #22) |
| FT-61 | **merged**  | `6b794b8` | a slip keeps its drag on a tablet; confirm on device at release (PR #21) |
| FT-62 | **merged**  | `b2f0c8b` | the fact card only on a name not placed (PR #19) |
| FT-63 | **in review** | —   | labels go where there is the most room: 8 spots, scored; every dot an obstacle |
| FT-64 | not started | —     | spike: names stretched along the region  |
| FT-65 | **merged**  | `f3b4421` | map card progress bar, hidden at zero (PR #20) |
