# v0.6.0 — Harder as you get better (planned 2026-09-18)

The programme that follows [FEATURE_PLAN.md](FEATURE_PLAN.md), which closed
with v0.5.0. This release changes what the quiz *is*: instead of asking only
what is due and letting the tray give the answer away, it keeps track of how
well each name is known, offers fewer names to choose from as you improve,
punishes a miss at once, and shows what you know on a map of its own. Names on
the map stop overlapping.

**Status: planned.** The product decisions below were taken by the product
owner on 2026-09-18; no task is started.

Input: the product owner's requests, and the independent review in
[reviews/2026-09-14-product-review.md](reviews/2026-09-14-product-review.md)
(F3 "review rounds are solvable by elimination", F9 "no warning before the
third miss", F1 "the phone map starts under the toolbar").

---

## Product decisions (2026-09-18)

| # | Question | Decision |
|---|---|---|
| 1 | What happens to spaced repetition? | **Keep the scheduler, hide it.** No more "N to review" on the home page and no due-only rounds: a quiz always covers the whole map. Review dates are still written underneath, so nothing already learned is thrown away and scheduling can resurface later. Feedback moves to the retention map. |
| 2 | How does a map get harder? | **A ladder driven by how well the map is known.** The tray offers a limited hand of names, refilled as they are placed: every name at first, then 6, then 3, then 1. Fewer names means no help from elimination, so the same map keeps getting harder. |
| 3 | Three tries per name? | **No. One mistake is a fail**, and the name is then shown in its right place. |
| 4 | What replaces Explore? | **The retention map.** Same tab and route; instead of a blank map to click at, it shows every name you know, as prominently as you know it: right 3 times in a row without a mistake = full strength, twice = weaker, once = faint, never = not shown. Clicking a region still reveals its name, so Explore's use is kept. |
| 5 | Overlapping names | **Names never overlap.** The map engine places them and drops any that would collide; zooming in brings the hidden ones back. Region names sit inside the shape, town names beside the dot (right, left, above or below). |
| 6 | Clock, high scores, leaderboards | **Postponed.** This is not an arcade game. Not in v0.6.0; revisit later if the calm version proves itself. |

## What "knowing a name" means

One new number per name: **the clean streak** — how many times in a row it has
been placed right with no mistake in that round. A mistake, or a name that had
to be shown, resets it to 0.

| Clean streak | On the retention map | Meaning |
|---|---|---|
| 3 or more | full-size, full-strength label | known |
| 2 | slightly smaller, lighter | nearly there |
| 1 | small, faint | seen once |
| 0, or never played | no label (click to reveal) | unknown |

A map's own level is the share of its names at streak 3 or more, and that
level drives the difficulty ladder (FT-21).

---

## Tasks

One branch per task, `feat/ft-NN-…`; `npm run gates` before pushing; verify in
a real browser with screenshots; **ask the product owner before every merge**;
tick the ledger after each merge. Same rules as the previous programme
(FEATURE_PLAN.md, "How this programme runs"). 🧑 marks a point where the task
stops for the product owner.

### FT-19 — Remember how well each name is known · Medium

- **Why:** everything else here needs a per-name "right in a row without a
  mistake" count, and today's card state has none (`repetitions` counts passes
  including ones after a mistake, and only a total fail resets it).
- **Do:**
  - add `cleanStreak` to `CardState` in `packages/srs`: `+1` on a `good`
    grade, `0` on `hard` and `again`;
  - persist it in all three stores: localStorage (free), Tauri SQLite
    (migration 2: `ALTER TABLE card_states ADD COLUMN clean_streak INTEGER NOT
    NULL DEFAULT 0`), Capacitor SQLite (the same statement as a new migration),
    and read and write it in both SQLite repositories;
  - everyone already playing starts from 0 on every name and rebuilds a streak
    over the next rounds. Say so in the release notes.
- **Tests:** scheduler transitions (the streak grows, resets, and survives a
  `hard` that still passes); a migration test for v1 to v2 leaving existing
  rows intact; a round trip per backend.
- **DoD:** the number is stored and read everywhere; gates green; DECISIONS.md
  entry.

### FT-20 — One mistake and the name is shown · Low · deps: FT-19

- **Why:** three tries make a miss cheap, and the third try reveals the answer
  with no warning (review F9). One mistake, one lesson.
- **Do:**
  - `packages/quiz-engine`: reveal after the **first** wrong drop
    (`MAX_ATTEMPTS_BEFORE_REVEAL` 3 → 1, renamed to suit);
  - QuizView: on a wrong drop, flash the region that was hit red as it does
    now, then light up the **right** one and place the name there in the
    revealed style, so the miss teaches the answer;
  - the scheduler grade stays `again`, so the name comes back in the same
    round;
  - copy: "N revealed after too many misses" becomes "N shown after a
    mistake", in EN/DE/IT;
  - tutorial step 7 says the name "goes back to the tray" — rewrite it and its
    German and Italian copy, and update `docs/TUTORIAL.md`.
- **Tests:** quiz-engine unit tests; a browser run of a miss.
- **DoD:** as above, plus the user manual's quiz section updated.

### FT-21 — Fewer names to choose from as you improve · High · deps: FT-19

- **Why:** with every remaining name in the tray, the end of a round is solved
  by elimination (review F3), and a map you know well is the same round every
  time.
- **Do:**
  - a pure, unit-tested module (`difficulty.ts`): a map's level from the share
    of names at clean streak 3 or more — **level 0** under 25 % (all names),
    **1** from 25 % (6 names), **2** from 60 % (3 names), **3** from 85 %
    (1 name);
  - the tray becomes a *hand*: it holds at most that many pending names, drawn
    at random from the ones left and refilled as they are placed;
  - the progress line still counts the whole map ("5 / 20 placed");
  - say the level plainly somewhere small — draft: a chip by the progress
    line, "3 names at a time";
  - 🧑 the product owner reviews that wording and the four thresholds at the
    merge request;
  - the tutorial's quiz steps must still work at level 0, which is where a new
    player is.
- **Tests:** the level and hand-size function; a browser run at each level with
  seeded progress.
- **DoD:** the ladder works end to end on the web; gates green; DECISIONS.md
  entry.

### FT-22 — The retention map replaces Explore · Medium · deps: FT-19

- **Why:** the player needs to see what they know, now that "N to review" is
  retired (decision 1).
- **Do:**
  - same tab and route; the view labels every name by its clean streak (the
    table above), and leaves unknown ones unlabelled;
  - clicking or tapping a region still reveals its name, as Explore did;
  - rename the tab: draft EN **Progress** / DE **Fortschritt** / IT
    **Progressi** (alternatives: "Known" / "Gewusst" / "Conoscenza");
  - a small legend explaining the three strengths;
  - 🧑 the product owner picks the tab name at the merge request;
  - tutorial step 4 (the Explore step) and `docs/TUTORIAL.md` follow the new
    name and wording, in three languages.
- **Tests:** a browser component test over seeded streaks (the three strengths
  render, unknown names don't); a real browser run.
- **DoD:** as above, plus the user manual section rewritten.

### FT-23 — Names that never overlap: regions · High

- **Why:** the product owner's requirement, and the honest way to label a
  crowded map. Today every label is a DOM popup that ignores its neighbours.
- **Do:**
  - draw target names with a MapLibre **symbol layer** over the `labels`
    source-layer already in every tileset, with collision on
    (`text-allow-overlap: false`), so a name that doesn't fit is dropped until
    you zoom in;
  - which names show differs per view (all on the Overview, by streak on the
    retention map, only solved ones in the quiz), so the layer reads from a
    GeoJSON source the view updates — not from feature-state, because MapLibre
    reserves collision space even for labels it is told not to paint;
  - keep the hover and tap magnify (FT-02/FT-03) by drawing the magnified name
    as a single DOM label on top of the symbol layer;
  - DECISIONS.md's "labels are DOM popups, not a symbol layer" entry is
    superseded: rewrite it, including why the old reason to avoid symbol
    layers (labels disappearing unpredictably) is now the wanted behaviour.
- **Tests:** a browser check that a dense map (Italy — Provinces) hides names
  and reveals them on zoom, at 1280 px and 390 px.
- **DoD:** the Overview and the retention map use the new layer; magnify still
  works; gates green.

### FT-24 — Names that never overlap: towns, quiz and tour · Medium · deps: FT-23

- **Do:**
  - town names sit beside their dot, taking the first free side (right, left,
    above, below) through MapLibre's variable anchors, never on top of it;
  - the quiz's solved and shown names, and the tour's current name, come from
    the same layer, so they can't overlap either;
  - check that the quiz's drag still hit-tests dots correctly once labels sit
    beside them.
- **Tests:** browser runs of a towns quiz and a tour; the existing quiz tests
  keep passing.
- **DoD:** no overlapping names anywhere; gates green.

### FT-25 — The map fits the visible screen on phones · Low

- **Why:** review F1, a blocker on phones: the map is fitted to the whole
  canvas, so the northernmost regions start hidden under the map bar and the
  first thing a player must do is pan.
- **Do:** pad the fit by the measured height of the top overlays, as v0.5.0
  already does for the quiz tray at the bottom, on every map view.
- **Tests:** a browser check at 390 × 844 that the northernmost and
  southernmost targets are inside the visible area, on Germany, Italy and
  Japan.
- **DoD:** gates green; screenshots in the merge request.

### FT-26 — The home page speaks mastery, not due dates · Low · deps: FT-19, FT-21

- **Do:**
  - map cards drop "8 to review" and "No reviews needed" and say how well the
    map is known instead — draft: "14 / 20 known", plus the level, for example
    "3 names at a time";
  - the score panel loses "Next review in N days" and gains the same mastery
    line; "Play again" always plays the whole map;
  - practice mode existed only because due-only rounds could leave nothing to
    play: fold it into the normal quiz and drop the "Up to date!" screen (and
    with it the empty-chip glitch, review F13);
  - 🧑 the product owner reviews the wording;
  - copy in EN/DE/IT; the user manual and `docs/TUTORIAL.md` step 10 follow.
- **DoD:** no due counts left in the interface; gates green.

**→ Release `v0.6.0`** per [RELEASES.md](RELEASES.md): a beta pre-release for
the product owner's test on the phone first, then the stable release.

---

## Order

FT-19 → FT-20 → FT-21 → FT-22 → FT-23 → FT-24 → FT-26, with FT-25 slotted in
whenever convenient, since it touches nothing else. FT-19 comes first because
three later tasks read the new number; FT-23 before FT-24 because the second
reuses the first's layer.

## Progress ledger

| Task | State | Merge | Notes |
|---|---|---|---|
| FT-19 | **merged** | `8109965` | clean streak in packages/srs + all three stores; migrations keep existing rows; checked in a browser |
| FT-20 | **merged** | `12172ec` | one miss reveals in place; copy + tutorial + manual screenshots updated |
| FT-21 | **merged** | `d889451` | hand of 6/3/1 by mastery, refilled per drop; note by the progress line; 🧑 thresholds and wording still open to retuning |
| FT-22 | todo | — | 🧑 tab name |
| FT-23 | todo | — | |
| FT-24 | todo | — | |
| FT-25 | todo | — | |
| FT-26 | todo | — | 🧑 wording |

| Release | State | Tag | Date |
|---|---|---|---|
| `v0.6.0` | not cut | — | — |

## Deliberately not in v0.6.0

- **Clock, high scores, leaderboards, streaks, share cards** (decision 6).
- **A countries-of-the-world map**, capitals, flags: the review's biggest
  content gap, but content work rather than this release's theme.
- **Accounts, sync, app-store listings, a domain:** the launch work from the
  review's section 7, to be decided after this release.
- **A keyboard path through the quiz** (review F6): worth doing, but it needs
  its own design.

## Risks

- **The label rewrite (FT-23, FT-24) is the risky part.** It replaces the
  mechanism every view uses to show names, it was tried once before and
  abandoned, and "hidden until you zoom in" changes how the Overview feels. It
  can be shipped on its own and reverted without touching the rest of the
  release.
- **Everyone's streaks start at zero** (FT-19), so on the first play after the
  update every map looks unknown on the retention map and plays at level 0.
  The alternative, guessing a streak from the existing review history, would
  be wrong more often than right.
- **Dropping the due counts removes the only reason the app currently gives to
  come back.** The retention map has to carry that weight; the review already
  doubted "N to review" as a pull, but it was at least a prompt.
