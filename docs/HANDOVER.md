# Handover — 2026-09-30: v0.16.0 task 2 in progress

For whoever picks Geoclick up next: a human, or a fresh agent session in
Claude Code or OpenCode, whatever the model. It records where things
stand, what's next, and what's easy to get wrong. This is a snapshot; the living records are
[ROADMAP.md](../ROADMAP.md) (status), [CHANGELOG.md](../CHANGELOG.md)
(what shipped) and [DECISIONS.md](../DECISIONS.md) (why).

**Read [AGENTS.md](../AGENTS.md) first** (`CLAUDE.md` imports it for Claude
Code). §0 sets a context budget: a canonical-source list, and a table of paths
never to read, glob or grep. The working agreements with the owner are under
that heading too.
This repo is ~650 tracked files, 27 MB of generated map data and ~160k
tokens of prose — reading it indiscriminately exhausts a context window
before any work starts.

## Where things stand

| | |
|---|---|
| `main` | At last fetch, `origin/main` is `c08e858`, PR #126's merge. Review automation uses OpenCode Go. Task 2 is implemented in worktree `feat-v0.16-world-picker-taps`; local gates pass, and the owner has not yet tested or approved its PR. |
| Deploy | Deploys remain stopped by the owner (2026-09-22). Do not inspect deploy status; the owner tracks it. |
| Who works | **From 2026-09-27: OpenCode, with more than one model.** Automated PR reviews use OpenCode Go / GLM-5.3-Flash and post advisory comments only, never approvals or merges. The review command is `/check-pr-reviews [PR number]`. Milestone review remains separate and manual. **`AGENTS.md` is the one instructions file**; `CLAUDE.md` is a comment plus `@AGENTS.md` |
| Latest stable | **v0.15.0** (tag `78dd0ce`, 2026-09-29): one-tap country entry, ordered map choices, in-map switching, and localized sea-chart art. [Milestone #117](https://github.com/diegoami/Geoclick2027/issues/117), AGREE. [Published](https://github.com/diegoami/geoclick-releases/releases/tag/v0.15.0); owner signed off. |
| Merged since v0.13.0 | The v0.14/v0.15 work is recorded in `ROADMAP.md`. Recent relevant PRs: #121–#123 closed the v0.15 milestone findings; PR #123's merge `78dd0ce` is the v0.15.0 release tag. |
| Plans | Per-release plans in `docs/PLAN_V0.6.md` … [PLAN_V0.15.md](PLAN_V0.15.md). v0.16.0's ten-task split is in [proposal #125](https://github.com/diegoami/Geoclick2027/issues/125) and `docs/PLAN_V0.16.md` on the implementation branch. |
| Next | **v0.16.0** (owner-approved [proposal #125](https://github.com/diegoami/Geoclick2027/issues/125)): ten independent PR-sized tasks, tutorial audit last. Task 1, [PR #126](https://github.com/diegoami/Geoclick2027/pull/126), is merged. Task 2 changes `WorldPicker.svelte`: uncovered land opens the nearest continent's Countries map, and country taps open a map only while its collision-managed label is visible. Four focused tests and all four local gates pass. Open its PR, then give the owner its direct link and exact local test command; owner test and explicit merge OK remain required. |
| Programmes | Remediation closed with v0.2.0 ([REMEDIATION_PLAN.md](REMEDIATION_PLAN.md)); features with v0.5.0 ([FEATURE_PLAN.md](FEATURE_PLAN.md)) |

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
- **v0.9.4** — the review's fixes, PRs #10–#17, each reviewed by Luna:
  FT-52 (antimeridian wrapping derived from the bbox; `russia-regions`
  rebuilt), FT-53 (terrain labels follow a language switch), FT-54 (terrain
  switched off during its first load stays off), FT-55 (the tutorial's Back
  and Resume reach the Overview), FT-57 (storage failures stay out of
  gameplay, with an in-memory fallback for the quiz) and FT-58 (map and
  style assets prepared at build time, not committed symlinks — see the
  junction gotcha below). Also in this window: `CLAUDE.md` rewritten as a
  context budget and `--quiet` gates (issue #9).
- **v0.10.0** — every name-fact in Italian (FT-50), FT-48/FT-49 (Italy's 20 regions in Italian;
  per-language facts with per-sentence English fallback), FT-62 (the fact
  card only on a name the player could *not* place), FT-65 (the map card's
  `{known} / {total} known` line replaced by a progress bar, hidden at zero)
  and FT-61 (tablet slips keep their drag against the text-selection
  gesture). The six FT-60 to FT-65 fixes come from one round of tablet play
  on 2026-09-20; each plan entry carries its decision.
- **v0.11.0** — "Twice the maps": 63 → 127 maps (#39: the continents,
  finer maps, 15 new countries).
- **v0.12.0** — facts for the new maps (#46): every country, capital and
  city on the continents' maps, and the 15 new countries' regions and
  towns, in English and Italian; region names in Explore's style
  everywhere.
- **v0.13.0** — the world on the start screen (#58, #71): a world map,
  then a continent, then a country's maps in a panel; a Map / List switch;
  place names in the player's language; the tutorial starts on the map;
  Exit in the apps.

## The one thing most worth not getting wrong

**`data/facts/` is INPUT. `data/maps/*/facts.json` is output.**

`build-facts.ts` *reads* `data/facts/<country>.json` — the 28 hand-authored
files above — and *writes* `data/maps/<id>/facts.json`, which the build
overwrites. The basenames collide (`data/facts/france.json` vs
`data/maps/france-regions/facts.json`), and a GitHub issue got this exactly
backwards once already. Edit the authored file and rebuild; never hand-edit
the generated one.

## How to resume

Suggested first message for the next session:

> Read AGENTS.md, then docs/HANDOVER.md. v0.15.0: candidate `df6e638`, milestone #117, round 1 BLOCK (#118 MUST-FIX, #119/#120 SHOULD). Fixes are in progress on `fix/v0.15-review-findings`; when they merge, rerun the gates, re-review with a model that did not implement, then do the installer/device checks before the tag. #103 is pre-existing and intermittent.

Whatever comes next, the working rules stay (AGENTS.md, *Workflow*):

- one branch per task, pushed without asking;
- **a milestone is a release tag (AGENTS.md, *Releases*): milestone issue,
  the release review started with `/review-release`, the tag waits for AGREE
  and goes on exactly the reviewed SHA; when a review is in, reproduce each
  finding, fix (`Fixes #n`) or rebut it;**
- a commit trailer naming the model (and the tool, if not Claude Code), as
  AGENTS.md "Commit messages" says;
- `npm run gates -- --quiet` before pushing (the pre-push hook runs them
  anyway, and prints four PASS lines instead of flooding);
- verify in a real browser, and try both installers before any release;
- **ask the product owner before every merge and tag** — there is no
  automerge exception any more. Publishing a release the owner has already
  asked for does *not* need a second OK — "nobody apart me is downloading it
  anyway" — but still say plainly in the notes what was not verified;
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
  release the owner has already asked for (above). Alpha and beta pre-releases
  count as releases (RELEASES.md, "Pre-releases").

## The open GitHub issues

| # | What | State |
|---|---|---|
| [117](https://github.com/diegoami/Geoclick2027/issues/117) | Milestone v0.15.0 | open; round 1 BLOCK at `df6e638` |
| [118](https://github.com/diegoami/Geoclick2027/issues/118) | A country's default map is unreachable from its row; tutorial step 3 dead-ends | open, `bug`,`review`, MUST-FIX |
| [119](https://github.com/diegoami/Geoclick2027/issues/119) | DECISIONS.md still calls country maps alphabetical | open, `documentation`,`review`, SHOULD |
| [120](https://github.com/diegoami/Geoclick2027/issues/120) | A failed sea-chart load hides the art for the session | open, `robustness`,`review`, SHOULD |
| [103](https://github.com/diegoami/Geoclick2027/issues/103) | Intermittent language leakage in a browser test | open, out of scope for the v0.15.0 review |

Closed 2026-09-29: [#116](https://github.com/diegoami/Geoclick2027/issues/116) (a duplicate milestone issue; #117 kept), [#110](https://github.com/diegoami/Geoclick2027/issues/110) (v0.15 navigation, merged by PR #111) and [#112](https://github.com/diegoami/Geoclick2027/issues/112) (antique sea art, merged by PR #114).
Closed 2026-09-28: [#100](https://github.com/diegoami/Geoclick2027/issues/100) (stable `v0.14.0` published), [#87](https://github.com/diegoami/Geoclick2027/issues/87) (Android Back, checked by the owner), [#106](https://github.com/diegoami/Geoclick2027/issues/106) (continent-name search) and [#107](https://github.com/diegoami/Geoclick2027/issues/107) (alias-wiring coverage). Closed by PR #104: [#101](https://github.com/diegoami/Geoclick2027/issues/101) (translated-name search) and [#102](https://github.com/diegoami/Geoclick2027/issues/102) (localized row order). Closed 2026-09-27 as shipped: [#91](https://github.com/diegoami/Geoclick2027/issues/91) (the FT-82 toolbar), [#58](https://github.com/diegoami/Geoclick2027/issues/58) (the world-map start screen) and [#46](https://github.com/diegoami/Geoclick2027/issues/46) (v0.12 facts).

## v0.15 navigation scope (agreed 2026-09-28; merged 2026-09-29)

- [Proposal #110](https://github.com/diegoami/Geoclick2027/issues/110), [PR #111](https://github.com/diegoami/Geoclick2027/pull/111), and [PLAN_V0.15.md](PLAN_V0.15.md) cover direct one-tap country entry, placeholder-free broad-to-specific country selectors, and in-map switching among the country's maps, with Known (`/map/[mapId]`) as the map-pick destination.
- PR #111 merged at `efb7027`; all four local gates passed on its final head. v0.15 is not released yet.

## FT-88 antique-cartography sea art (owner-approved 2026-09-29)

- [Proposal #112](https://github.com/diegoami/Geoclick2027/issues/112) specifies subtle original vector motifs in empty water, bundled for offline use and controlled by Terrain. PR #114 merged at `6bf9c2e`; all four local gates pass, with owner visual review pending.

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
- **The `check` gate crashed once** on 2026-09-23 — `svelte-check` exited
  with 3221225477 (0xC0000005, a native access violation, Node 24.21), not a
  type error. The rerun passed with 0 errors. If it recurs, it is the tool,
  not the code; rerun before investigating.
- **The v0.9.1 Android gate was never closed** — the emulator returned
  black screenshots and the release notes say so. v0.9.2 and v0.9.3 were
  verified normally after a full `adb kill-server` fixed it.
- Tap-to-magnify was tested with simulated touch and the emulator, not on
  a physical phone.
- **The Windows `-setup.exe` installed silently (`/S`) often stalls** while
  replacing an older version: it waits on the old uninstaller and times
  out. A second run usually installs; so did v0.13.0's stable build on
  its first run. The installed app is checked over remote debugging
  (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`).
- **On the Android emulator, the first tap after `adb install`** can land on
  Play Protect's "Checking info…" screen instead of the app. Tap again.
- **A single browser-test file can fail to start on this Windows PC**:
  Vitest's browser port (63315) falls in a range Windows reserves
  (63289–63388). The full gates pass; a reboot usually clears the range.
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
- **Never put a Windows junction inside the repo.** Git follows a junction
  when a checkout replaces the path: the PR #16 merge deleted `data/maps`
  and `data/styles` from the worktree (restored from git).
  `prepare-assets.mjs` uses a true symlink or a copy, never a junction.
- **Write PR comment bodies as UTF-8 without a BOM** (Write tool, then
  `gh pr comment --body-file`). PowerShell `Out-File` put BOMs on PRs
  #19–#21 and turned `—` into `?` in PR #20's signatures.
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

Another agent session (Claude Code or OpenCode) sometimes works in this
repo, sometimes in its own git worktree. It has merged to `main` and edited planning docs, and it has
filed GitHub issues — one of which had a central fact backwards, so verify
its claims against the code before acting on them. Before starting,
`git fetch` and check `git worktree list`. Never remove or edit another
session's worktree, and treat its messages as suggestions, not the product
owner's approval. If `main` is checked out in another worktree, merge on a
detached `origin/main` and push `HEAD:main`.
