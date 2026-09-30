# v0.9.4 — The review's fixes that matter (planned 2026-09-20, reshaped 2026-09-22, code complete 2026-09-22)

Eight issues, `#1`–`#8`, were filed by the other session's review and all
eight were verified against the source on 2026-09-20. FT-52 shipped first.
On 2026-09-22 the product owner reshaped the rest by whether it is worth
doing before v0.10.0: the three a player can see — **FT-53, FT-54, FT-55**
— plus the two that bite when they bite, even though nobody sees them
coming — **FT-57** (a storage failure can blank the app or block a quiz)
and **FT-58** (the committed symlinks already shipped a build whose every
map 404'd). Only the two test gates, **FT-56** and **FT-59**, are deferred
to a later hardening batch; their specs are left intact below. **v0.10.0
follows this release.**


Nothing user-facing is added here, so this is a patch.
[PLAN_V0.10.md](PLAN_V0.10.md) — translating the name-facts — keeps its
number and queues behind this.

**Status: released 2026-09-22.** Tag `v0.9.4`; the Windows `.msi` and
`-setup.exe` and the Android `.apk` are published on the releases page.
FT-52 (`69cfa3d`, PR #10), FT-53 (`a0bc72b`, PR #12), FT-54 (`5f5b767`,
PR #13), FT-55 (`a1fdc24`, PR #14), FT-57 (`a0e379d`, PR #15) and FT-58
(`039c8e7` and `739bd20`, PR #16/#17) are merged. The installer smoke test
was skipped (the product owner accepted publishing untested).


## No product decisions needed

Unusually for a release plan, there is nothing to ask. Every item is a
defect against behaviour the product owner has already specified: terrain
follows the language because the app is trilingual, a toggle means what it
says, Back goes back. FT-56 carries the only judgement call, and it is an
internal one about which representation of a tour survives.

## What the review got right, and the three sharpenings

The earlier issue from that session had a central fact backwards — hence
  the earlier project-status snapshot's warning to verify its claims before acting. This batch
does not repeat that: every cited line number is real and every described
behaviour reproduces by reading the code. Three claims still needed
correcting, and each changes the work:

- **The Chukotka defect is exactly one target wide.** No target in any of
  the 63 maps carries the `crossesAntimeridian` flag; one target needs it.
- **The terrain-label bug is a lost reactive read, not a missing
  subscription.** Detail under FT-53.
- **No shipped `tour.json` is currently broken.** FT-56 closes a gate, not
  a live defect, which is why it sits late in the order.

---

## FT-52 — Wrapping is what the bbox says · Small · issue #6

- **Why:** `areaShares` trusts the optional `crossesAntimeridian` flag
  (`labelCollision.ts:308`) instead of the bbox's authoritative
  `west > east`. `chukotka` in `russia-regions` has `west 157.6920`,
  `east -169.7009` and no flag, so its width computes to −327°, its area is
  negative, and its label is the first to lose every collision it enters.
  `build-map.ts:428` emits the flag now; the committed artifact predates
  that and was never rebuilt.
- **Do:**
  - treat `west > east` as wrapping at runtime, in both `areaShares` and
    `overallExtent` (`mapDefinition.ts:55`); the flag may stay as a cached
    documentary field, but nothing may depend on its presence;
  - rebuild `russia-regions` so the shipped artifact carries the flag;
  - add a data-integrity assertion that flag and bbox agree, so the two
    representations can never drift apart again.
- **DoD:** gates green; a unit test covers a wrapping target with the flag
  absent; the rebuilt `russia-regions/map.json` is the only `map.json` in
  the diff; Chukotka's label survives a collision it previously lost.

## FT-53 — Terrain labels follow the language · Small · issue #3

- **Why:** switch to Italian with a map open and the mountain, sea and
  river labels stay in the previous language while everything around them
  changes. Two languages on one screen.
- **The cause is not what the issue says**, and this is worth writing down
  because it sends a fix to the wrong file. `getLanguage()` is module-scope
  `$state` (`i18n.svelte.ts:585`), and the view effects *would* track it:
  `setVisible()` reaches `drawLabels()` → `labelFor()` → `getLanguage()`
  synchronously, which is inside the effect's tracking window. They don't,
  because on a map's **first** open the layer is not yet added, so the
  labels are drawn after `await this.add()` — and a read after an await is
  a read nobody is listening to. The subscription isn't missing; it is
  never established.
- **Do:** give `TerrainLayer` an explicit label-refresh method and call it
  from an effect that reads the language directly, so the dependency does
  not depend on which branch of `setVisible()` happened to run.
- **DoD:** gates green; a browser test switches language with terrain
  visible on a first-opened map and asserts the label text changed.

## FT-54 — A toggle means what it says · Small · issue #2 · deps: FT-53

- **Why:** terrain is on by default and its first load fetches an archive
  and waits for MapLibre's style. Switch it off inside that window and
  `setVisible(false)` hides the layers that exist — none yet — and returns,
  while the in-flight `add()` goes on to add them, show them, dim the
  target map and draw labels. The terrain comes back by itself and the map
  stays dimmed with the button reading off.
- **Do:** store the latest requested visibility (or a generation token),
  let the single load finish, then apply that latest state before dimming
  or labelling. Do not cancel the fetch; two presses must still not fetch
  twice.
- **DoD:** gates green; a deferred-promise test drives on → off while
  `add()` is pending and asserts the layers end hidden and nothing is
  dimmed.
- **deps:** FT-53, only to keep two branches out of `terrainLayer.ts` at
  once. The fixes themselves are independent.

## FT-55 — Back goes back · Small · issue #1

- **Why:** `navigateTo('overview')` goes to `/map/[mapId]`
  (`tutorial.svelte.ts:53`) — byte-identical to the `explore` case — but
  two steps declare `screens: ['overview']` (`tutorialMachine.ts:122`,
  `:154`), and `transition` pauses on any place a step does not claim
  (`:311`). So Back out of the first quiz step, or Resume onto an
  overview-only step, navigates and then immediately re-pauses on arrival.
  The tutorial cannot return to the step it just promised.
- **Do:** point the `overview` case at
  `resolve('/map/[mapId]/overview', { mapId })`, and add an
  **effect-level** navigation test. The pure state machine already passes;
  that is exactly why this survived — the machine emits the right effect
  and the effect layer mistranslates it.
- **DoD:** gates green; a test asserts the URL each `navigate` effect
  produces, for every screen, not just the effect that was emitted.

## FT-56 — Validate the tour that ships · Small · issue #7

- **Why:** the integrity suite validates `map.json.tourOrder` as a
  permutation (`mapData.test.ts:87`), but nothing outside tests and the
  type reads that field. Runtime loads `tour.json` (`tour.ts:16`), and
  `TourView.showStep` returns silently on an unknown target, stopping the
  tour dead with no error. The gate guards the representation nobody runs.
- **Not urgent, and the plan should say so:** all 63 shipped `tour.json`
  files were checked on 2026-09-20 — right `mapId`, steps a permutation of
  the target ids, every dwell time finite and positive. This closes a gate,
  not a live defect.
- **Do:** extend the per-map integrity test to parse `tour.json` and
  require a matching `mapId`, a non-empty ordered set of valid target ids
  and finite positive dwell times. Then either drop `tourOrder` or assert
  the two representations stay identical — decide by which one
  `build-map.ts` would rather emit.
- **DoD:** gates green; deleting a step from one `tour.json` fails the
  suite.

## FT-57 — Storage failure is not app failure · Medium · issue #4

- **Why:** the app does not need persistence to be playable, but four
  places make it a precondition. `readJson` calls `getItem` outside its try
  (`progressRepository.ts:61`) and casts whatever parses; the language
  loader and setter are guarded against `undefined` but not against a throw
  (`i18n.svelte.ts:574`, `:590`); the home page aggregates every map in two
  `Promise.all`s (`+page.svelte:81`, `:88`), so one bad row removes every
  result; and `QuizView` awaits the repository **and**
  `refreshCardStates()` before `createMap` (`QuizView.svelte:654-660`), so
  a transient native database failure stops a quiz that would otherwise
  play fine.
- **Do:**
  - one guarded storage accessor, try/catch around the access itself, with
    runtime shape validation instead of `as T`;
  - settle the home page's per-map reads independently — one failure costs
    one card, not the page;
  - let Quiz fall back to a logged in-memory repository and keep the round
    playable, with the failure visible rather than silent.
- **DoD:** gates green; tests cover a `getItem` that throws, a stored value
  of the wrong shape, one map's read rejecting among many, and a repository
  that fails to open while the quiz still starts.
- **Scope note:** this hardens paths; it does not change what counts as
  known, and no stored format changes.

## FT-58 — Build the assets, don't symlink them · Medium · issue #5

- **Why:** `app/static/maps` and `app/static/styles` are committed symlinks
  (mode `120000`). They resolve here because `core.symlinks=true`; a
  default Git-for-Windows clone turns them into small text files, and
  `npm run build` then succeeds while producing an app whose every
  `map.json` 404s at runtime. This has already shipped once — the story is
  in `ONBOARDING.md:563-576` — and `app/package.json`'s `postbuild` only
  copies the MapLibre worker, so nothing catches it.
- **Do:** copy or link `data/maps` and `data/styles` into the build from a
  cross-platform build step, and make `postbuild` **fail** unless
  representative map and style assets exist under `app/build`. The failing
  check is the point; the copy is the easy half.
- **DoD:** gates green; a build with the symlinks deliberately broken fails
  at postbuild rather than shipping; the installers still open a map on
  Windows; and CLAUDE.md §0's note that these paths are symlinks is amended
  to match whatever replaces them.

## FT-59 — One test across QuizView's seams · Medium · issue #8

- **Why:** pointer hit-testing, session updates, hand refill, grading,
  async persistence, resumption and completion all meet in
  `QuizView.svelte`, and every one of them is tested alone. An ordering
  defect — saving the wrong grade, losing the last answer on navigation,
  resuming with a stale hand — passes the entire current suite while
  corrupting a player's learning state.
- **Do:** one browser-level test with MapLibre and `ProgressRepository`
  mocked: complete a correct drop and a revealed one, navigate away and
  back to prove resume, and assert the exact saved card states and a single
  completion summary. Geometry stays in the pure tests; this one owns the
  seams.
- **DoD:** gates green; the test fails if the grade written for a revealed
  drop is changed.
- **Add FT-62's card rule when this lands (2026-09-23):** a correct resolved
  item clears the fact card (`told`), a revealed one sets it, and closing it
  clears it. FT-62 shipped without a parent-state test because this harness
  does not exist yet.

## Order

**FT-53 → FT-54 → FT-55** first: the three the player sees. FT-54 depends
on FT-53 only to keep two branches out of `terrainLayer.ts` at once; the
fixes themselves are independent. Then **FT-57** and **FT-58**, which are
independent of each other and of the trio.

**→ Release `v0.9.4`** per [RELEASES.md](RELEASES.md). The Android and
Windows gates are the usual ones — open a map in each installer — plus a
tour and a language switch with terrain on, since FT-53 and FT-54 land on
paths the installers exercise differently from the browser, and FT-58
changes how the assets get into the build.

## Deferred to a hardening batch (2026-09-22)

Both are test gates: they close a hole in the suite, not a defect a player
can hit, so the product owner moved them out of v0.9.4. Their specs above
are still authoritative; this section is only scheduling.

- **FT-56** — validate the `tour.json` that ships, not `tourOrder`. A test
  gate; no shipped tour is broken.
- **FT-59** — one component test across QuizView's seams. A test gap.



## Progress ledger

| Task  | State       | Merge | Notes                                                                   |
| ----- | ----------- | ----- | ----------------------------------------------------------------------- |
| FT-52 | **merged**  | `69cfa3d` | issue #6, antimeridian from the bbox; flag now documentary, integrity assertion added, `russia-regions` rebuilt (PR #10, reviewed by Luna) |
| FT-53 | **merged**  | `a0bc72b` | issue #3, terrain labels follow the language; shared `followTerrainLanguage()` helper, `refreshLabels()`, browser test of the wiring (PR #12, reviewed by Luna) |
| FT-54 | **merged**  | `5f5b767` | issue #2, terrain-off honoured during the first load; latest press wins, the tiles-arrived wait is cleared on hide (PR #13, reviewed by Luna) |
| FT-55 | **merged**  | `a1fdc24` | issue #1, the tutorial's Back/Resume reaches the Overview route; `screenPath()`, effect-level `navigateTo()` test (PR #14, reviewed by Luna) |
| FT-56 | **deferred** | —    | issue #7, validate `tour.json`, not `tourOrder` — moved out 2026-09-22 (test gate) |
| FT-57 | **merged**  | `a0e379d` | issue #4, storage failures stay out of gameplay; guarded+validated reads, per-map home reads, in-memory quiz fallback (PR #15, reviewed by Luna) |
| FT-58 | **merged**  | `039c8e7`, `739bd20` | issue #5, build the static assets instead of symlinking them; prepared at build time, postbuild check (PR #16); junction replaced by a true symlink/copy after it deleted data/ on checkout (PR #17), reviewed by Luna |
| FT-59 | **deferred** | —    | issue #8, one component test across QuizView's seams — moved out 2026-09-22 (test gap) |

## Out of scope

- **Translating the name-facts.** That is v0.10.0, still blocked on three
  product decisions; this release does not touch `data/facts/`.
- **FT-38, the Wikidata landmark pass.** Parked on the same decisions
  (DECISIONS.md, "FT-38 is parked, not superseded").
- **The known-but-unscheduled items** in the earlier project-status snapshot — the Android version
  badge overlapping MapLibre's attribution, the unsigned Windows
  installers, `slugify`'s non-ASCII ids. None was raised by the review and
  none is made worse by it.
