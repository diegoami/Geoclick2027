# Geoclick — Independent code/design review (2026-09-13)

Performed by a fresh Claude Opus session against `docs/code-review-handover`
(commit `a03bd72`, i.e. `main` + `REVIEW_HANDOVER.md`), per the brief in that
file. Everything below was checked against source or actually executed —
not inferred from this project's own docs. See `REVIEW_HANDOVER.md` for
what the reviewer was told going in.

---

## 1. Code review

### Must-fix correctness

**C1. `packages/srs` produces an invalid `dueDate` after ~20 clean reviews, silently retiring the card forever.**
`packages/srs/src/index.ts:96` — `interval = Math.round(prevInterval * easeFactor)` with no cap. `addDaysLocal` (`:28-34`) then overflows JS `Date`. Verified by running the real `rate()`:

```
rep  8 interval=1488       dueDate=2032-10-12
rep 12 interval=58125      dueDate=2291-03-24
rep 19 interval=35476875   dueDate=163913-04-19
rep 20 interval=88692188   dueDate=NaN-NaN-NaN
>>> isDue(card, '2026-09-13') === false
```

`"NaN-NaN-NaN"` string-compares greater than any real date, so `isDue` returns `false` permanently. The value is then persisted verbatim (`due_date TEXT NOT NULL` accepts it on both SQLite backends, and `JSON.stringify` on localStorage). The card is gone, with no error anywhere. Also poisons the home page's due count.

First step: add `const MAX_INTERVAL_DAYS = 365;` (or 180 — this is a geography quiz, not a medical-school deck) and clamp in `rate()` before building `dueDate`. Add a test asserting `rate()` output after 30 consecutive `'good'` grades still parses as a date.

**C2. Even before the overflow, the schedule is unusable as a product.** Rep 8 — eight clean plays of one region — schedules the next review 4 years out and the score panel will literally print "Next review in 2265 days." There is no maximum-interval discussion anywhere in `DECISIONS.md` or `ROADMAP.md`. Same fix as C1.

**C3. The ease factor can never increase, so every card monotonically decays toward the 1.3 floor.**
`packages/srs/src/index.ts:91`: `Math.max(MIN_EASE_FACTOR, prevEase - (grade === 'hard' ? 0.15 : 0))`. `'good'` subtracts zero; nothing adds. Measured: after one `'hard'` followed by 20 flawless `'good'` reviews, ease is still 2.35, never recovering. Alternating hard/good 12× lands at 1.60 and keeps falling. Real SM-2 raises EF on a high-quality answer — and both `ARCHITECTURE.md` and the module's own header comment call this "classic SM-2", so this is a doc/code disagreement as well as a design flaw.
First step: in `rate()`, for `grade === 'good'` use `Math.min(MAX_EASE_FACTOR, prevEase + 0.1)` with `MAX_EASE_FACTOR = 2.5`; add a test `"a clean review after a fumble recovers some ease"`.

**C4. `QuizView` can call `setFeatureState` before the style loads, throwing.**
`QuizView.svelte:557-559` sets `phase = 'upToDate'` **synchronously** right after `createMap()`, before `map.once('load')` at `:571`. The panel with the "Practice all regions" button renders immediately (`:616-621`). Clicking it calls `startPractice()` → `clearAllVisuals()` (`:463-473`) → `map.setFeatureState(...)`, which MapLibre throws on until the style's sources exist. Every other call site in this file and in `OverviewView.svelte:35` is explicitly deferred to `'load'` with a comment saying exactly why; this one path was missed. Reachable on a slow tile fetch or a fast click.
First step: gate the `upToDate` panel (or `clearAllVisuals`) on a `styleLoaded` flag set in the `map.once('load')` handler.

**C5. The wrong-answer flash timeout runs after unmount.**
`QuizView.svelte:406-414` schedules a 700 ms `setTimeout` that calls `map.setFeatureState`. `onDestroy` (`:593-595`) calls `map.remove()` but never clears the timer, and the guard is `if (exactName && map)` — `map` is still a truthy reference to a removed map. Navigating away within 700 ms of a wrong drop throws in the timer.
First step: store the handle in a module-scope variable and `clearTimeout` it in `onDestroy` (`advanceTimer` in `TourView.svelte:158` already does this correctly — copy that).

**C6. Practice mode writes to the repository, contradicting the stated design.**
`DECISIONS.md`: "Practice mode never writes back to SRS state." The completion `$effect` at `QuizView.svelte:162-168` calls `saveLastSessionSummary` unconditionally, including in practice mode. It's not SRS state, but it *is* persisted state that overwrites the home page's "Last: 18/20" — so a casual practice round rewrites the record of your real graded session. Either guard it with `mode === 'due'` or amend the decision entry.

### Worth fixing

**C7. `promoteId: "name"` makes "target names are unique within a map" a hard, unenforced invariant.**
`data/styles/base.json:12`. Every feature-state write in the app keys on the *name* (`QuizView.svelte:287/294/319/467`, `TourView.svelte:49/66`, `OverviewView.svelte:39`), and quiz correctness is decided by name comparison (`QuizView.svelte:369-373`). `build-points-map.ts:232-237` dedupes by slug; **`build-map.ts` has no equivalent check** — it would ship two same-named regions silently. Checked all 44 maps / 1410 targets: currently zero duplicate names and zero duplicate ids, so this is latent, not live.
First step: add a `if (new Set(targets.map(t => t.name)).size !== targets.length) throw` assertion in `build-map.ts` right after the targets array is built (`:353`), plus a repo-level data test that loads every `data/maps/*/map.json` and asserts uniqueness.

**C8. Raw HTML injection of target names into popups.**
`TourView.svelte:82` (`setHTML(\`<strong>${target.name}</strong>\`)`), `MapView.svelte:57`, `QuizView.svelte:327`, `OverviewView.svelte:48`. Names come from Natural Earth today, so this is not exploitable now — but `ROADMAP.md`'s own "user-authored / OSM maps" direction and `desktop/src-tauri/tauri.conf.json`'s `"csp": null` mean there's no second line of defense. `setText()` is a drop-in for all four.

**C9. Home page fetches all 44 `map.json` files on every load.**
`app/src/routes/+page.svelte:42-57` — 44 parallel requests, ~484 KB of JSON, parsed on every home-page mount, purely to compute due counts. Stored card states already contain `targetId`; the only thing the map defs supply is the total target count.
First step: have the build (or `mapCatalog.ts`) carry a `targetCount` per map, and derive due counts from card state alone. Falls out naturally if you fix C13 too.

**C10. One DOM popup per target.**
`OverviewView.svelte:37-51` creates a `maplibregl.Popup` for *every* target unconditionally — 110 on `italy-provinces`, 83 on `russia-regions`, 66 on `japan-towns-100k`. `QuizView.applyPreSolvedVisuals` does the same for pre-solved targets. Each popup is a DOM node repositioned by MapLibre on every render frame, so a `flyTo` on a large map is repainting 110 absolutely-positioned elements per frame. The symbol-layer approach was correctly rejected for placement reasons (`DECISIONS.md`), but "N popups" doesn't have to be the only alternative — zoom-gated popup creation, or a single canvas overlay, would.

**C11. Adding a map requires edits in three unrelated places.**
`data/scripts/build-map.ts`'s `NAME_FIXUPS` (or `build-points-map.ts`'s), the generated `data/maps/<id>/`, **and** a hand-written entry in `app/src/lib/mapCatalog.ts:32-185` (a 150-line literal that is a manual mirror of `ls data/maps`). Nothing detects drift: a map directory with no catalog entry is simply invisible on the home page, and a catalog entry with no directory 404s at runtime.
First step: generate `mapCatalog`'s data from a `data/maps/index.json` emitted by the build scripts, or at minimum add a test asserting `readdirSync('data/maps')` matches the catalog's id set exactly.

**C12. Asset fetches bypass SvelteKit's `base` path.**
`geoclickMap.ts:57-58` and `:66`, `tour.ts:15`, `+page.svelte:45` hardcode `/maps/...` and `/styles/base.json`, while every link in the app correctly uses `resolve()` from `$app/paths`. `ARCHITECTURE.md` documents a prepared `deploy/github-pages` branch with a `BASE_PATH` subpath fix — that branch cannot work as written, because these five fetches will 404 under a subpath. Use `` `${base}/maps/...` ``.

**C13. `<html lang>` is hardcoded `en` and never updated.**
`app/src/app.html:2`. Switching to DE/IT changes every visible string but not the document language — screen readers keep reading German UI with English phonemes, and `:lang()`/hyphenation are wrong. This is precisely the class of thing an i18n library handles for free; see §3.

### Low severity / hygiene

- **`app/src/lib/vitest-examples/greet.ts` + `greet.spec.ts`** — leftover SvelteKit scaffolding. It is one of the "41 tests." Delete.
- **`data/scripts/*.ts` is neither typechecked nor linted.** No `tsconfig.json` under `data/`, and root `lint` is `npm run lint --workspace=app`. These files use `any` liberally (`build-map.ts:341`, `:354`, `:363`; `build-points-map.ts:187`, `:206`). They're the least-tested, most-consequential code in the repo.
- **`slugify` (`mapBuildUtils.ts:28-35`)** has the combining-diacritic range written as raw literal Unicode combining characters inside the regex, rather than the escaped code-point range (U+0300 to U+036F) — works, but invisible/fragile in most editors. It also has no non-Latin fallback: any future `--name-field=NAME_ZH`/`NAME_RU` yields empty ids for every target.
- **`pmtiles` binary path is hardcoded** to `path.join(process.env.HOME ?? '', '.local/bin/pmtiles')` (`build-map.ts:414`, `build-points-map.ts:312`). This *is* the WSL2-lock-in, concretely — see §3.
- **`ogr2ogr -where` clauses interpolate `--country`/`--exclude` unescaped** (`build-map.ts:271-275`, `build-points-map.ts:168-170`). Developer-only input, but a country or city name containing an apostrophe breaks the build with an opaque OGR error.
- **`window.__map` debug hook ships in production** (`QuizView.svelte:550-555`). Harmless; worth `import.meta.env.DEV`-gating.
- **`localStorage.setItem` is unguarded** (`progressRepository.ts:67-70`). Reads have a try/catch with a good comment; writes throw on `QuotaExceededError` (Safari private mode). Asymmetric.
- **Popup CSS is duplicated verbatim in four components.** `:global(.geoclick-popup ...)` is byte-identical in `MapView.svelte:106-118` and `TourView.svelte:255-267`; `:global(.geoclick-solved-popup ...)` is duplicated in `QuizView.svelte:893-908` and `OverviewView.svelte:92-104`. A styling change is a four-file edit with no compiler help. Move to `app.css`.
- **Comment-to-code ratio.** Several files are >50% prose (`data/styles/base.json` has a single 2.4 KB `metadata` string). This is unusual and mostly *good* — but prose drifts silently, and it already has: see S4 below.

---

## 2. Sanity check

### Verified by running

| Claim | Result |
|---|---|
| `npm run test` — 41 Vitest tests | **True.** 10 (app) + 15 (quiz-engine) + 16 (srs) = 41, exit 0. Caveat: 1 of the 10 is the `greet` scaffold, so 40 are real. |
| `npm run check` passes | **True.** 390 files, 0 errors, 3 warnings (`trayEl`/`trayHandleRowEl`/`traySlipsEl` not declared `$state` in `QuizView.svelte:39-41` — benign, they're `bind:this` refs, but they're read inside `measureTraySizing` which is called from an `$effect`, so silencing them with `$state` would be more correct than leaving them). |
| `npm run build --workspace=app` | **True.** Builds in 2.7 s, postbuild copies both maplibre worker files. |
| Built output actually serves | **True.** Served `app/build` locally: `/`, `/maps/italy-regions/map.json`, `/styles/base.json`, the copied worker chunk all 200; `.pmtiles` returns `206 Partial Content` with a correct `Content-Range`. Symlinks resolved correctly into `build/`. |
| Dev server / clickthrough | **True.** Loaded `italy-provinces` quiz (110 slips, tray, drag affordances) and the `russia-regions` tour (83 steps, play/pause/step/speed all functional). |
| "No Playwright config or `.spec.ts` in the repo" | **True**, and stronger than stated — see D1. |
| "44 maps" | **True.** 44 directories, 1410 targets total. |

### Verified false / stale

**S1. `npm run lint` fails on `main`.** Exit code 1. Two independent causes:
- `core.autocrlf=true` on this checkout + `.gitattributes` covering only `*.sh`/`gradlew`/binaries means every `.ts`/`.svelte` file is CRLF on disk, and Prettier's default `endOfLine: "lf"` flags **all 39 files**. Because the script is `prettier --check . && eslint .`, **ESLint has never run on this machine.** (Ran `npx eslint .` directly: clean.)
- Independently of line endings (`prettier --check --end-of-line auto`), **3 files are genuinely unformatted and were committed that way**: `app/src/lib/capacitorProgressRepository.ts`, `app/src/lib/QuizView.svelte`, `app/src/routes/+page.svelte` — i.e. the files touched by the three most recent feature branches. The formatting gate has been dead long enough for unformatted code to land on `main` unnoticed.

This is a fifth instance of the CRLF bug class that `ONBOARDING.md` documents *four* times (pmtiles, icons, `.sh`, `gradlew`) — each fixed narrowly, never generalized. Related symptom: `git status` reports `desktop/src-tauri/Cargo.toml` and two Gradle files as modified while `git diff` shows no content change at all; that's pending renormalization, not real edits.

**S2. "14 countries, 44 maps" (REVIEW_HANDOVER) — it's 22 countries.** Actual: 22 countries × 2 maps, plus `italy-provinces`, minus a nonexistent `usa-towns` = 44. `DECISIONS.md`'s "Home page map list" entry is the stale source: it says "28 maps across 14 countries" and "With 14 country groups," and reasons about search/filter UI based on that number ("Revisit only if the list grows"). The list has since grown 57%, and the entry was never revisited per `CLAUDE.md`'s own rule about amending superseded decisions.

**S3. "classic SM-2."** `ARCHITECTURE.md` and `packages/srs/src/index.ts:70` both say so; the ease factor never increases and there is no interval cap. See C1/C3.

**S4. `data/styles/base.json`'s metadata cites "DECISIONS.md's 'Map colors' entry" — that entry does not exist.** No section or bullet by that name; `grep -i "map colors"` returns nothing. The palette rationale exists only inside the JSON metadata blob itself. Exactly the drift risk that heavy prose-in-code creates.

**S5. `DECISIONS.md` i18n entry says "around 35 distinct strings."** Actual: 38 keys. Fine — noting only because it was worth checking.

### Could not verify

- Tauri desktop and Capacitor Android builds (no Rust/Android toolchain in the reviewer's environment). The SQLite repositories have **zero tests**, so nothing in this review exercised them.
- Live Netlify behavior (deliberately out of scope — no deploys triggered).

---

## 3. Design issues

### Reviewer's take on each "known soft spot" from `REVIEW_HANDOVER.md`

**D1. No E2E suite — confirmed, and worse than described.** There is no Playwright config, no `.spec.ts`, no `e2e/` or `tests/` directory. But the important part the handover missed: **`app/vite.config.ts:51-62` actively forecloses component testing.** The `test.projects` array contains exactly one project (`name: 'server'`, `environment: 'node'`) whose `exclude` is `['src/**/*.svelte.{test,spec}.{js,ts}']`. The SvelteKit template's `client` (browser/jsdom) project was removed. So a `.svelte.test.ts` written today silently doesn't run — it isn't a matter of "nobody wrote one," the harness would need re-adding first.

Risk assessment: **higher than the doc implies, and concentrated in one file.** `QuizView.svelte` is 909 lines and holds essentially all of the app's genuinely tricky logic — pointer-capture drag, two different hit-test tolerance models, the point-map nearest-candidate disambiguation, feature-state lifecycle, tray measurement, a completion `$effect` with a manual idempotence guard, and the entire SRS write-back path. `packages/quiz-engine` and `packages/srs` are well tested and also the two files least likely to break. The tests cover the safe part. Four of the six must-fix findings above (C4, C5, C6, and the SRS write-back implications of C1/C3) live in code no test touches.

But *Playwright specifically* isn't the highest-leverage fix. Most of the value is reachable much cheaper:
- Extract the drop-resolution decision out of `onSlipPointerUp` into a pure function `resolveDrop({exactName, nearbyNames, draggedName, isPointMap, candidates}) -> boolean` and unit-test it, including the Essen/Duisburg case that's currently only documented in a comment.
- Add a browser-mode Vitest project back to `vite.config.ts` and write *one* smoke test per view (mounts, no console error, renders N slips).
- A data-integrity test over `data/maps/*/map.json` (name uniqueness, id uniqueness, finite bboxes, tourOrder ⊆ target ids, catalog coverage) is the single highest value-per-line test you could add, and needs no browser at all.

**D2. Hand-mirrored SQLite schemas — real, but the risk is different from how it was framed.** The two files are not equivalent implementations of one schema; they're structurally different. `desktop/src-tauri/src/lib.rs:7-32` uses `tauri-plugin-sql`'s versioned `Migration` list. `app/src/lib/capacitorProgressRepository.ts:15-33` uses `CREATE TABLE IF NOT EXISTS` with **no version tracking whatsoever** and passes `version: 1` to `createConnection` without a corresponding upgrade statement set. So the actual asymmetry isn't "you might forget to edit the second file" — it's that **the Capacitor side has no migration mechanism to edit.** The first schema change on Android is either data loss or a hand-written `ALTER` with no record of which devices have applied it.

For a two-backend POC the *duplication* is fine (12 lines, both visible). The *missing migration path* is the thing worth an hour. First step: add a `PRAGMA user_version` check in `getDb()` and a `MIGRATIONS: string[]` array indexed by version, mirroring Tauri's shape — then the duplication is genuinely symmetric and the "keep both in sync" comment becomes true. Better still, export the SQL from one shared `.sql` file that `build.rs` includes and the TS imports as a string.

**D3. `NAME_FIXUPS` — not urgent, but for a different reason than expected.** The tables are ~90 lines with excellent per-entry provenance comments; as *data* they're fine where they are. The thing actually blocking a non-developer isn't the fixups — it's **C11**: adding a country means editing a 150-line TypeScript literal in `mapCatalog.ts`, which is a harder ask than adding a row to a JSON object. Fix C11 first; move `NAME_FIXUPS` to `data/fixups/<country>.json` later, or never.

**D4. The color hash — worse than suspected, with numbers to back it up.**

Computed `name.length % 8` for all 1410 targets and counted same-color pairs among bbox-overlapping (adjacent-proxy) neighbors:

```
map                   targets  adjPairs  sameColor
italy-provinces           110       297     61 (20.5%)
usa-states                 49       122     26 (21.3%)
japan-regions              47       109     24 (22.0%)
china-regions              31        80     16 (20.0%)
great-britain-regions      15        32     10 (31.3%)
mexico-regions             32        89     15 (16.9%)
```

Random 8-coloring would give ~12.5%. Observed is **1.3–2.5× worse**, because place names cluster hard around 5–8 characters — the global bucket distribution is 5.0% (bucket 3) to 20.8% (bucket 7), not 12.5% each. And collisions *cluster spatially*, which a random model wouldn't predict: Bolzano / Sondrio / Belluno / Brescia / Bergamo are all 7 letters, so a contiguous swath of northern Italy renders in one identical olive. North Dakota / South Dakota (both 12) are adjacent and identical. Hebei / Henan, Shaanxi / Sichuan, Beijing / Tianjin, Akita / Iwate, Niigata / Tochigi / Ibaraki — same story.

**And there's a second-order problem nobody had flagged.** Loaded `italy-provinces` in the browser. At the current `fill-opacity: 0.3` (from the Sept 13 solved-contrast fix, `base.json:85-98`) over the `#f0ead9` parchment background (from the Sept 13 background refresh), the 8-color palette collapses into a near-uniform pastel wash — the colors are barely distinguishable *even when they differ*. The two visual decisions from the same day interact: dropping unsolved opacity from 0.6 to 0.3 fixed the solved/unsolved ambiguity by effectively deleting the categorical palette's ability to distinguish anything. The hash collisions are currently masked by the palette being nearly invisible, which means "fixing" the hash without revisiting the opacity would accomplish nothing.

First step, and it's cheap: replace the `["%", ["length", ["get","name"]], 8]` expression with a precomputed `colorIndex` property written into each feature at build time by a greedy graph-coloring pass over shared borders (`mapshaper -each` can give adjacency, or approximate with bbox-touch + centroid distance). The style then becomes `["match", ["get","colorIndex"], 0, "#...", ...]` — same shape, zero runtime cost, guaranteed no adjacent collisions. Separately, decide whether the palette is load-bearing at all; if it isn't, drop to two neutral tones and stop paying for it.

**D5. i18n hand-rolled — keep it, with one correction.** 38 keys across 3 languages is well inside the range where a library is overhead, the `TranslationKey` union genuinely delivers the one feature that matters (compile-time completeness), and `tPlural`'s one/other rule is honestly scoped. The reasoning holds.

Two things it missed that a library would have handled for free:
- **`<html lang>` is never updated** (C13). Real accessibility bug, five lines to fix: a `$effect` in `+layout.svelte` calling `document.documentElement.lang = getLanguage()`.
- **Sort order is computed in English.** `mapCatalog.ts` is sorted by untranslated English labels; in Italian, Italy's three maps render as Province / Regioni / Città, which is not alphabetical. Trivial, but it accumulates.

The real tripwire is already stated correctly in `DECISIONS.md`: adding Polish or Russian breaks `tPlural`. Given that `poland-regions`, `russia-regions`, and `ukraine-regions` all ship today, that's a plausible next request, not a hypothetical. Revisit then, not now.

**D6. WSL2-only pipeline — mostly an accepted cost, with one line worth changing.** `ogr2ogr`/`tippecanoe` really are Linux-first and `tippecanoe` has no usable Windows build; WSL2 is the correct answer for a solo project and Docker would add a build step to something run a handful of times per country batch. But `path.join(process.env.HOME ?? '', '.local/bin/pmtiles')` is gratuitous — it hardcodes one user's install location for a tool that's on `PATH`, and it fails with a confusing `ENOENT` for anyone else. Change to `process.env.PMTILES_BIN ?? 'pmtiles'`. That's the whole fix; everything else about the WSL2 dependency is fine.

**D7. Netlify-credit-gated merges — the constraint is fine, the workflow it produced is not.** Requiring explicit approval before a `main` push is reasonable and costs nothing. The problem is that it's the *only* gate, and there's no cheap gate underneath it. `npm run lint` has been failing (S1) through at least three merged feature branches, and unformatted code reached `main` as a result. A local pre-push hook running `npm run check && npm run test && npm run lint` costs zero Netlify credits and would have caught that immediately. The deploy-cost constraint is not a reason to have no CI — it's a reason to have *local* CI.

### Design issues nobody flagged

**D8. `QuizView.svelte` is 909 lines and owns five distinct responsibilities** — map lifecycle, pointer-drag gesture, hit-testing geometry, tray layout measurement, and SRS scheduling/persistence. It's readable today because of unusually good comments, but every must-fix correctness finding except C1–C3 is in this file, and it's the file with no test coverage. Extracting the pure parts (`resolveDrop`, `gradeFor(item)`) would be the single biggest testability win in the repo and is mechanical.

**D9. `OverviewView` reuses the `quizCorrect` feature-state to mean "everything is discovered."** `OverviewView.svelte:40`. It works, but the style's state vocabulary is now quiz-specific while four views share it — the next state anyone adds (a "favorite" marker, a tour-visited flag) will have to either invent a parallel name or overload another quiz state. Rename the states to intent (`solved`/`revealed`/`hover`/`error`/`focus`) while there are only five of them and one style file.

**D10. `ProgressRepository` has no delete/reset.** Four methods, all read-or-upsert. There is no way for a user to reset a map's progress or clear all data, and no way for a test to tear down. The moment SSO/sync comes back (paused, not abandoned), reconciliation will need deletes. Add `clearMap(mapId)` and `clearAll()` now while there are three implementations and not four.

**D11. `session` is rebuilt from scratch but `cardStatesByTargetId` is mutated in place.** `QuizView.svelte:124` holds a non-reactive `Map` mutated at `:393` and wholesale-replaced at `:456`, while `session` is immutable-updated. Two different state disciplines in one component, with a comment at `:36` explaining that `progressRepository` is "a plain module-scope variable, not `$state`" — three conventions in one file. It works; it's the kind of thing that produces a subtle bug on the next edit.

**D12. `data/maps` is 14 MB of binary `.pmtiles` tracked in git**, and every map rebuild creates a fresh blob for each of 44 files. At 22 countries this is fine; at 60 it isn't, and history is already permanent. Worth a decision *now* (Git LFS, or fetch-at-build from a release artifact) rather than after another few batches.

**Antimeridian bbox note, reported honestly:** found `russia-regions`' Chukotka has an inverted bbox (`[157.692, 61.8148, -169.7009, 71.6]` — west > east) from `build-map.ts:196-203`'s antimeridian wrap, and predicted `TourView`'s `fitBounds` would frame the whole globe. **Tested it in the browser and that prediction was wrong** — MapLibre's `cameraForBounds` calls `.adjustAntiMeridian()` and Chukotka frames correctly. It remains a latent data wart: any non-MapLibre consumer of that bbox gets it wrong, and `overallBboxOf` in `mapBuildUtils.ts:37-49` already silently mis-clips the lake selection for Russia because of it. Low priority, but worth an assertion at build time so it's documented rather than rediscovered.

---

## 4. Prioritized task list

### Must-fix

1. **Cap the SRS interval.** `packages/srs/src/index.ts:96`. Add `MAX_INTERVAL_DAYS` (suggest 365) and clamp before `addDaysLocal`. Add a test asserting `rate()` after 30 consecutive `'good'` grades still yields a parseable `YYYY-MM-DD`. *Fixes C1 (silent permanent card loss) and C2 (4-year intervals) together.*
2. **Let the ease factor recover.** `packages/srs/src/index.ts:91`. `'good'` → `Math.min(2.5, prevEase + 0.1)`. Test: `'hard'` then three `'good'` grades ends above where the `'hard'` left it.
3. **Repair `npm run lint`.** Add `* text=auto eol=lf` (or explicit `*.ts`/`*.svelte`/`*.json`/`*.md` entries) to `.gitattributes`, then `git add --renormalize .`. Then run `npm run format` — three files on `main` are genuinely unformatted. Verify `npx eslint .` actually executes afterward. ESLint has never run in this workflow due to this.
4. **Guard the pre-style-load `setFeatureState` path.** `QuizView.svelte:557` / `:463-473` / `:512`. Add a `styleLoaded` flag set in `map.once('load')` and gate the `upToDate` panel's render on it.
5. **Clear the wrong-flash timeout on destroy.** `QuizView.svelte:406` → hold the handle; `clearTimeout` in `onDestroy` at `:593`.
6. **Decide practice-mode persistence.** `QuizView.svelte:162`. Either add `&& mode === 'due'` or amend the `DECISIONS.md` "Practice mode" entry. Currently they contradict.
7. **Add a data-integrity test over `data/maps/*/map.json`.** New file `app/src/lib/mapData.test.ts` (or a root `data/maps.test.ts`). Assert per map: target names unique (the `promoteId: "name"` invariant, C7), ids unique, every `centroid`/`bbox` finite, `tourOrder` is a permutation of target ids, and the directory set matches `mapCatalog.mapGroups` exactly (C11). ~40 lines; covers four separate latent failures at once.

### Worth doing

8. **Fix the map palette.** Precompute a `colorIndex` per feature in `build-map.ts` via greedy adjacency coloring; change `base.json:72-83` and `:132-143` to `["match", ["get","colorIndex"], ...]`. *And* revisit `fill-opacity: 0.3` at the same time — at that opacity the palette currently does almost nothing (D4).
9. **Give the Capacitor backend a migration mechanism.** `app/src/lib/capacitorProgressRepository.ts:15-33`. `PRAGMA user_version` + an indexed `MIGRATIONS: string[]`, mirroring `desktop/src-tauri/src/lib.rs:7-32`. First schema change is otherwise data loss on Android.
10. **Extract and test `resolveDrop`.** Pull the correctness decision out of `QuizView.svelte:344-373` into `app/src/lib/quizDrop.ts` as a pure function. Test cases: exact hit; tolerance rescue on a tiny polygon; a wrong drop that should *not* be rescued; and the Essen/Duisburg point-cluster case (two candidates inside the 30px radius, correct answer is the farther one → must be wrong).
11. **Restore a browser Vitest project.** `app/vite.config.ts:51-62` — re-add the `client` project the template shipped with (it currently excludes `.svelte.test.ts` with nothing that runs them). Then one mount-smoke test per view.
12. **Fix `<html lang>`.** `app/src/routes/+layout.svelte` — `$effect(() => { document.documentElement.lang = getLanguage(); })`.
13. **Stop fetching 44 `map.json` on the home page.** `app/src/routes/+page.svelte:42-57`. Emit `targetCount` per map into `mapCatalog` and compute due counts from card state alone.
14. **Route asset fetches through `base`.** `geoclickMap.ts:57,58,66`; `tour.ts:15`; `+page.svelte:45`. Prerequisite for the prepared-but-broken `deploy/github-pages` path.
15. **Add a local pre-push hook** running `npm run check && npm run test && npm run lint`. Zero Netlify credits; would have caught #3.
16. **Add `clearMap`/`clearAll` to `ProgressRepository`** (`app/src/lib/progressRepository.ts:25-30`) across all three implementations, before there's a fourth.
17. **Switch popups to `setText`.** `TourView.svelte:82`, `MapView.svelte:57`, `QuizView.svelte:327`, `OverviewView.svelte:48`.
18. **Reconcile the stale counts.** `DECISIONS.md`'s "Home page map list" entry (28 maps / 14 countries → 44 / 22) and its search-UI conclusion; `REVIEW_HANDOVER.md`'s "14 countries." Also either write the missing `DECISIONS.md` "Map colors" entry that `base.json:5` cites, or fix the citation (S4).
19. **Correct the "classic SM-2" claims** in `ARCHITECTURE.md` and `packages/srs/src/index.ts:70` — or make the code match them (items 1–2 would).

### Nice-to-have / low value

20. Delete `app/src/lib/vitest-examples/`.
21. Move the duplicated popup CSS out of four `.svelte` files into `app.css`.
22. `PMTILES_BIN ?? 'pmtiles'` instead of the hardcoded `$HOME/.local/bin` path (`build-map.ts:414`, `build-points-map.ts:312`).
23. Declare `trayEl`/`trayHandleRowEl`/`traySlipsEl` as `$state` (`QuizView.svelte:39-41`) to clear the three `svelte-check` warnings.
24. `import.meta.env.DEV` guard on `window.__map` (`QuizView.svelte:550`).
25. Add a `tsconfig.json` + lint coverage for `data/scripts/`.
26. try/catch around `localStorage.setItem` (`progressRepository.ts:67-70`).
27. Use the escaped code-point range (U+0300-U+036F) instead of raw combining characters in `slugify` (`mapBuildUtils.ts:31`).
28. Assert `bbox[0] < bbox[2]` in `build-map.ts` (or emit an explicit `crossesAntimeridian` flag) so Chukotka's inverted bbox is documented rather than rediscovered.
29. Decide on Git LFS for `data/maps/*.pmtiles` before the repo grows past 22 countries.
30. Reduce `DEFAULT_DWELL_MS` or make it target-count-aware — `italy-provinces`' generated tour is 110 × 3s = 5.5 minutes at 1×.

---

## Meta-observation from the reviewer

The documentation here is genuinely unusual in quality — the per-decision provenance in `NAME_FIXUPS`, the "found by actually testing X, not assumed" notes, the gotcha log. It made this review much faster than it would otherwise have been. The failure mode it has produced is that **prose is being used where an assertion belongs**: "target names are unique within a single map" is a paragraph in a JSON metadata blob rather than a `throw` in the build script; "keep both schemas in sync" is a comment rather than a shared file; "`npm run lint`" is a documented command that has been failing for weeks. The highest-leverage change to how this project is run isn't more documentation — it's converting about six of the existing prose invariants into executable checks.
