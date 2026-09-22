# Handover — 2026-09-22, v0.9.4 code complete (FT-58 merged)

For whoever picks Geoclick up next, whether a human or a fresh Claude
session. It records where things stand, what's next, and what's easy to
get wrong. This is a snapshot; the living records are
[ROADMAP.md](../ROADMAP.md) (status), [CHANGELOG.md](../CHANGELOG.md)
(what shipped) and [DECISIONS.md](../DECISIONS.md) (why).

**Read [CLAUDE.md](../CLAUDE.md) §0 first.** It sets a context budget: a
canonical-source list, and a table of paths never to read, glob or grep.
This repo is 637 tracked files, 27 MB of generated map data and ~160k
tokens of prose — reading it indiscriminately exhausts a context window
before any work starts.

## Where things stand

| | |
|---|---|
| `main` | clean, in sync with GitHub |
| Deploy | The product owner **stopped deploying** on 2026-09-22, so a `main` merge no longer triggers a live Netlify build. Merges still need the product owner's OK (CLAUDE.md §3) — that rule is a review gate, not the old cost gate |
| Latest release | **v0.9.4** (tag at `5387ff2`, 2026-09-22): the review's six fixes (FT-52 to FT-58). Installers are on the public [releases page](https://github.com/diegoami/geoclick-releases/releases/latest) — **published but not smoke-tested** (no map was opened in either shell). The web app deploys from `main`; the product owner stopped deploying on 2026-09-22. Previews go out as alpha/beta pre-releases first (RELEASES.md, "Pre-releases") |
| Remediation programme | Closed with v0.2.0 ([REMEDIATION_PLAN.md](REMEDIATION_PLAN.md)) |
| Feature programme | Closed with v0.5.0 ([FEATURE_PLAN.md](FEATURE_PLAN.md)) |
| Since then | Per-release plans: [PLAN_V0.6.md](PLAN_V0.6.md) through [PLAN_V0.9.md](PLAN_V0.9.md), each with its own ledger |
| Next | [PLAN_V0.10.md](PLAN_V0.10.md) — translating the name-facts. **FT-48 and FT-49 merged** (Italy's 20 regions in Italian; per-language `hooks` with per-sentence English fallback). **FT-50 next** — the other 27 countries. (v0.9.4's installer smoke test is still outstanding) |
| After that | **FT-51 (German) is postponed** until the Italian has been read; the two v0.9.4 test gates (FT-56, FT-59) wait in a hardening batch |
| In v0.10.0 | Six UX problems from one round of tablet play, 2026-09-20, **decided the same day** and **moved into v0.10.0 on 2026-09-23** as FT-60 to FT-65: the level-0 tray offering every name at once (`difficulty.ts:21`), slips losing their drag to the tablet's text-selection gesture, the fact card now only on a name the player could *not* place, best-fit label placement as a requirement rather than first-fit, a spike for Europa-Universalis-style stretched region names, and the map card's `{known} / {total} known` line replaced by a progress bar over `knownCount / total`, hidden at zero (the score panel keeps its copy — the two record different things). Each entry carries its decision; the plan is [PLAN_V0.10.md](PLAN_V0.10.md) |
| Also raised 2026-09-20 | **The start screen becomes a zoomable world map** — pick the country on the map, then the kind of quiz. The map list cannot be finalized as a list: the goal is a high number of maps, and `mapCatalog.ts` is already 31 countries and 66 maps. Favourites and Recent stay unchanged. Second item of the Iteration 8+ backlog, with the open questions listed there |

Shipped since the v0.5.0 handover, in one paragraph each:

- **v0.6.0** — the SRS scheduler still runs, but FT-26 took due/not-due
  out of the interface: rounds cover the whole map and the home page
  speaks mastery.
- **v0.7.0 / v0.8.0** — the physical map (sea, rivers, named ranges and
  basins) behind a Terrain toggle, and the fact card: a line about each
  place, shown on Overview, on Known and after a quiz name resolves.
- **v0.9.0** — **the authored name-facts.** `data/facts/<country>.json`,
  28 hand-written files, **1 814 places and 5 448 sentences**, three per
  place, the first always about where the name comes from. This is the
  most laborious content in the project; see the warning below.
- **v0.9.1** — Terrain on by default (with a three-state pref so the flip
  doesn't override anyone), a slower tour floor, and the language
  switcher rebuilt as one button plus a popup listbox so it scales past
  three languages. Tutorial gained a Terrain step.
- **v0.9.2** — the fact card reduced to what the map cannot show you
  (FT-45: "in the south of the country, no coast" is gone), and a 22px
  invisible hit circle so town dots are tappable (FT-46).
- **v0.9.3** — FT-47: the name origin is *pinned* as the card's first
  line and only the remaining facts rotate. Before this, rotation cycled
  all three, so the etymology showed only one time in three.
- **2026-09-20, unreleased** — issue #9: `CLAUDE.md` rewritten as a
  context budget; `--quiet` gates so the pre-push hook stops emitting
  ~104 KB per push; this file brought back up to date and made the
  named destination for a session handoff (CLAUDE.md §4); FT-38
  reassessed and parked rather than closed (DECISIONS.md). Nothing
  user-facing changed, so v0.9.3 still stands.
- **2026-09-22, unreleased** — **FT-52** (issue #6): `areaShares` and
  `overallExtent` now derive antimeridian wrapping from the bbox
  (`west > east`); the `crossesAntimeridian` flag is documentary, the
  integrity suite asserts flag and bbox agree, and `russia-regions/map.json`
  is rebuilt to carry it. PR #10, the first task through the Luna review
  loop ([REVIEW_LOOP.md](REVIEW_LOOP.md)).
- **2026-09-22, unreleased** — **FT-53** (issue #3): terrain labels follow a
  language switch. On a map's first open the labels are drawn after an
  `await`, so the view effect never subscribed to the language; a shared
  `followTerrainLanguage()` helper reads it explicitly and
  `TerrainLayer.refreshLabels()` redraws the names. PR #12, reviewed by
  Luna (one blocking finding on the test, fixed).
- **2026-09-22, unreleased** — **FT-54** (issue #2): terrain switched off
  during its first load stays off. `add()` applies the latest requested
  visibility once the layers exist, and the pending tiles-arrived wait is
  dropped on hide. PR #13, reviewed by Luna (one blocking finding on a
  deferred callback, fixed).
- **2026-09-22, unreleased** — **FT-55** (issue #1): the tutorial's Back and
  Resume reach the Overview. `navigateTo('overview')` had resolved to the
  Known route, so the step re-paused on arrival; the Screen-to-URL
  translation is now `screenPath()`, tested through the effect handler.
  PR #14, reviewed by Luna (one blocking finding on the test, fixed).
- **2026-09-22, unreleased** — **FT-57** (issue #4): storage failures stay
  out of gameplay. Reads are guarded and shape-validated, the language
  read/write survive a throw, the home page reads each map on its own
  (`loadHomeProgress`), and the quiz falls back to an in-memory repository
  when the real one cannot be opened or read, showing a notice. PR #15,
  reviewed by Luna (one blocking finding on the lazy native open, fixed).
- **2026-09-22, unreleased** — **FT-58** (issue #5): the map and style
  assets are prepared at build time instead of being committed symlinks.
  `prepare-assets.mjs` creates a true directory symlink (or a copy where the
  OS refuses one) at `app/static` from `predev`/`prebuild`, and
  `check-build-assets.mjs` fails the build in `postbuild` when they did not
  reach `app/build`. PR #16, reviewed by Luna (no blocking findings).
- **2026-09-22, unreleased** — **FT-58 follow-up**: the first version used a
  Windows junction, which Git follows when it replaces the path — the #16
  merge checkout deleted `data/maps` and `data/styles` from the worktree
  (restored from git). `prepare-assets.mjs` now uses a true symlink or a
  copy, never a junction, with a checkout regression test. PR #17, reviewed
  by Luna (no blocking findings).

## The one thing most worth not getting wrong

**`data/facts/` is INPUT. `data/maps/*/facts.json` is output.**

`build-facts.ts` *reads* `data/facts/<country>.json` — the 28 hand-authored
files above — and *writes* `data/maps/<id>/facts.json`, which the build
overwrites. The basenames collide (`data/facts/france.json` vs
`data/maps/france-regions/facts.json`), and a GitHub issue got this exactly
backwards once already. Edit the authored file and rebuild; never hand-edit
the generated one.

## How to resume

**v0.9.4 is released** (tag `v0.9.4`, 2026-09-22), with FT-52 to FT-58
merged, all reviewed by Luna. One check is outstanding: the published
Windows and Android installers were **not opened to confirm a map draws**
(the product owner accepted publishing without it) — do that before trusting
them. **FT-56 and FT-59 (both test gates) were moved out to a later
hardening batch**; they are listed under the plan's "Deferred" section.

**v0.10.0 is under way.** FT-48 (Italy's 20 regions, 60 Italian sentences)
and FT-49 (the per-language shape and the per-sentence English fallback)
are merged (PR #18), and the product owner read and approved the voice.
**FT-50 is next** — the other 27 countries, ~5,388 sentences, batched by
country with the product owner spot-checking each. FT-51 (German) is
postponed. The v0.9.4 installer smoke test is still outstanding.

Suggested first message for the next session:

> Read docs/HANDOVER.md, then docs/PLAN_V0.10.md. Start FT-50. (The v0.9.4 installer smoke test is still outstanding.)

Whatever comes next, the working rules stay (CLAUDE.md §3):

- one branch per task, pushed without asking;
- **every task PR is reviewed by ChatGPT GPT-5.6 Luna, high, over GitHub —
  implementer and reviewer comment back and forth until they agree, each
  signing with its model name ([REVIEW_LOOP.md](REVIEW_LOOP.md));**
- `npm run gates -- --quiet` before pushing (the pre-push hook runs them
  anyway, and now prints four PASS lines instead of flooding);
- verify in a real browser, and try both installers before any release;
- **ask the product owner before every merge and tag.** Publishing a
  release that he has already asked for does *not* need a second OK —
  "nobody apart me is downloading it anyway" — but still say plainly in
  the notes what was not verified;
- the remediation loop (ORCHESTRATION.md) automerges its own tasks; that
  is the only exception to the merge rule;
- previews go out as alpha or beta pre-releases (RELEASES.md).

## Things only the product owner has

- **The Android release key:** `C:\Users\diego\projects\geoclick-release.jks`
  (outside the repo), with its passwords in
  `mobile/android/keystore.properties` (gitignored). **Back both up
  somewhere safe.** If the key is lost, installed Android copies can never
  be updated. An agent should never open the properties file; check it by
  building (`assembleRelease` plus `apksigner`) or by testing which fields
  are filled, without printing values.
- **Creating anything public** needs an explicit OK, except publishing a
  release he has already asked for (above). Alpha and beta pre-releases
  count as releases (RELEASES.md, "Pre-releases").

## The open GitHub issues (triaged 2026-09-20)

Eight issues, #1-#8, filed by the other session's review. **All eight were
verified against the code on 2026-09-20 and all eight hold** — unlike the
earlier issue that had a central fact backwards, this batch cites real line
numbers and describes real behaviour. Three needed sharpening, noted below.

**Scheduling (reshaped 2026-09-22): [PLAN_V0.9.4.md](PLAN_V0.9.4.md) ships
the player-visible and robustness fixes — FT-53, FT-54, FT-55, FT-57 and
FT-58 (FT-52 is already merged). The two test gates, FT-56 and FT-59, are
deferred to a later hardening batch.** The table below maps each issue to
its task.

A ninth issue, **#11**, was raised by the product owner on 2026-09-22 and is
**open, unscheduled (backlog)**: on the Known map an explicitly tapped name
kept its earned colour instead of **Chosen**. Decided the same day — an
explicit tap is Chosen regardless of the streak, and the choice is
**session-only** (it resets on reopen; this changes FT-39's persisted
override). The fix is not started; `visibleTier` in `shownNames.ts` is the
place, and the reasoning is on issue #11.

| # | Task | What | Size | Live today? |
|---|---|---|---|---|
| 6 | FT-52 | `areaShares` trusts `crossesAntimeridian` instead of `west > east` | S | **Yes** — Chukotka |
| 3 | FT-53 | Terrain labels keep the old language after a switch | S | **Yes** |
| 2 | FT-54 | Terrain turns itself back on if switched off during first load | S | **Yes** |
| 1 | FT-55 | Tutorial `navigateTo('overview')` goes to the Known route | S | **Yes** |
| 7 | FT-56 | The integrity suite validates `tourOrder`, not the shipped `tour.json` | S | Gate gap |
| 4 | FT-57 | Storage failures can blank the app or block a quiz | M | Latent |
| 5 | FT-58 | `app/static/{maps,styles}` were committed symlinks | M | **Fixed** in v0.9.4 |
| 8 | FT-59 | No component test crosses QuizView's persistence/resume seams | M | Gate gap |

Sharpenings found while verifying:

- **#6 — exactly one target in all 63 maps is affected.** `chukotka` in
  `russia-regions` has `west 157.6920 > east -169.7009` and no flag; no
  target in any map carries the flag at all. `build-map.ts:428` does emit
  it now, so the artifact simply predates that and was never rebuilt. The
  fix is a runtime `west > east` check *and* a rebuild.
- **#3 — the mechanism is not "nothing subscribes to language".**
  `getLanguage()` is module-scope `$state` and the view effects *would*
  track it, because `setVisible()` reaches `drawLabels()` synchronously.
  They don't, because on a map's first open the labels are drawn after
  `await this.add()`, outside the effect's tracking. A fix that adds a
  language effect works; a fix that assumes the read was never reactive
  will look in the wrong place.
- **#7 — no shipped tour is currently broken.** All 63 `tour.json` files
  were checked on 2026-09-20: correct `mapId`, steps a permutation of the
  target ids, all `dwellMs` finite and positive. This is a gate that
  guards the wrong artifact, not a live defect.

## Not verified, or still open

- **FT-38 (Wikidata landmark enrichment)** is open and **parked on the same
  product decisions as v0.10.0**, not superseded. An earlier version of this
  file called it probably superseded by the 5 448 authored sentences; that
  reasoning does not survive FT-45, whose rule is that the card says only
  what the map does not show — and a volcano or a UNESCO site inside a
  region is exactly that. What actually blocks it:
  - **FT-45 removed the slot it was built for.** The landmark clause was to
    land in the composed derived sentence; `factClauses` now returns at most
    two short clauses. Reviving FT-38 means either a new card line, which
    FT-45 deliberately cut back, or folding landmarks into the authored
    prose, which is a different and manual job.
  - **Its product choices were never settled** — which landmark kinds earn a
    clause, how many per place, how each is phrased (PLAN_V0.8.md, FT-38).
    They determine the query, so nothing can be built before them.
  - **Revisit after the v0.10.0 language decisions, not before.** FT-34
    recorded that structured data is trilingual for free; the authored
    sentences are prose and need a human translator per language. If
    translation proves expensive, templated landmark facts get *more*
    attractive, not less.
- **The v0.9.1 Android gate was never closed** — the emulator returned
  black screenshots and the release notes say so. v0.9.2 and v0.9.3 were
  verified normally after a full `adb kill-server` fixed it.
- Tap-to-magnify was tested with simulated touch and the emulator, not on
  a physical phone.
- The Windows installers were never installed on this PC by an agent. The
  built `app.exe` was tested over remote debugging.
- On Android, the version badge (bottom-right) overlaps MapLibre's
  attribution on map screens. Predates v0.3.0, not scheduled, small CSS
  fix if wanted.
- The favourite star on Android: the emulator's accessibility dump showed
  it with no name and no pressed state (the language pills lose their
  state the same way, so it's probably the dump). Worth a TalkBack check.
- The Windows installers aren't code-signed, so SmartScreen warns. Out of
  scope until 1.0.
- **`slugify` mangles some non-ASCII ids** — Turkish `Kırklareli` becomes
  `k-rklareli`, Vietnamese `Đà Nẵng` becomes `a-nang`, Polish `Łódzkie`
  becomes `odzkie`. Left deliberately unfixed: ids key saved progress, so
  changing them would reset players. Only an issue if you go looking for a
  fact by id and can't find it.

## Gotchas learned the hard way

- **Never build generated content with a bash heredoc.** Backticks, `${…}`
  and `\d` get eaten, silently and sometimes days later. Write a `.mjs`
  script to the scratchpad and run it. Relatedly, `python - <<'EOF'` can
  hang on stdin here.
- **`npx serve -s build` is the wrong way to serve this build.** The `-s`
  fallback serves `index.html` (the prerendered home page) for every deep
  link, so the whole app looks broken. SvelteKit emits `200.html`; use
  `scripts/serve-build.mjs`, which has the right fallback and range
  support.
- **`canvas.toDataURL()` returns blank for MapLibre** — no
  `preserveDrawingBuffer`. To prove a map drew anything, take a *page*
  screenshot and count distinct pixels.
- **`window.__map` is DEV-only.** Production smoke tests must measure the
  DOM and the pixels, not the map object.
- **Tauri ignores HTTP Range requests** (`http://tauri.localhost`), so
  both native shells load tile archives whole (`isNativeShell()` in
  `geoclickMap.ts`). To see errors inside the built Windows app, launch it
  with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`
  and attach Playwright (`connectOverCDP`).
- **"Try the installers" means opening a map in each one.** v0.3.0 shipped
  empty desktop maps because only the APK was tried.
- **A black emulator screenshot is usually adb, not the app.** Full
  `adb kill-server` and restart. Three tries, then report it unverified
  rather than investigating further.
- **Never re-serialise `data/styles/base.json`.** `JSON.stringify` and
  Prettier both reformat the whole file, turning a 15-line addition into a
  190-line diff. Insert as text.
- **The Chrome automation tab is `document.hidden`.** Frames, transitions
  and timers only advance when a screenshot forces a frame. Read computed
  styles after a screenshot; measure requested `setTimeout` delays rather
  than wall time.
- **Scripted quiz drags need mouse-type pointer events** (pointerId 1).
  `setPointerCapture` throws for a synthetic touch pointer.
- **Windows `cmd.exe` eats `^`**, so run git without `shell: true`. Call
  `gradlew.bat` by its absolute path.
- **`--map=` only honours its last occurrence** — build one map per
  invocation or the earlier ones silently do nothing.
- **Local tooling:**
  - the data pipeline runs under WSL2, not Windows;
  - JDK for Gradle: `C:\Users\diego\.jdks\jbr-21.0.11`;
  - emulator: AVD `Medium_Phone`, headless with `-no-window`;
  - icons: `node design/logo/generate-icons.mjs`.

## Coordination

Another Claude session sometimes works in this repo, sometimes in its own
git worktree. It has merged to `main` and edited planning docs, and it has
filed GitHub issues — one of which had a central fact backwards, so verify
its claims against the code before acting on them. Before starting,
`git fetch` and check `git worktree list`. Never remove or edit another
session's worktree, and treat its messages as suggestions, not the product
owner's approval. If `main` is checked out in another worktree, merge on a
detached `origin/main` and push `HEAD:main`.
