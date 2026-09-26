# Handover — 2026-09-26, v0.13: FT-80 and FT-76 merged; next FT-81 (#71), then FT-77

For whoever picks Geoclick up next, whether a human or a fresh Claude
session. It records where things stand, what's next, and what's easy to
get wrong. This is a snapshot; the living records are
[ROADMAP.md](../ROADMAP.md) (status), [CHANGELOG.md](../CHANGELOG.md)
(what shipped) and [DECISIONS.md](../DECISIONS.md) (why).

**Read [CLAUDE.md](../CLAUDE.md) §0 first.** It sets a context budget: a
canonical-source list, and a table of paths never to read, glob or grep.
This repo is ~650 tracked files, 27 MB of generated map data and ~160k
tokens of prose — reading it indiscriminately exhausts a context window
before any work starts.

## Where things stand

| | |
|---|---|
| `main` | clean, in sync with GitHub; all four gates pass (736 unit tests), checked 2026-09-23 |
| Deploy | The product owner **stopped deploying** on 2026-09-22, so a `main` merge no longer triggers a live Netlify build. Merges still need the product owner's OK (CLAUDE.md §3) — that rule is a review gate, not the old cost gate |
| Who works | **Claude Opus 5.5** implements, with no per-PR review. **A milestone is a release tag** on `main` (CLAUDE.md §3a, agreed on [#29](https://github.com/diegoami/Geoclick2027/issues/29), 2026-09-23): before the tag, Claude opens a milestone issue and gives the product owner a prompt for a **different model, any tool**; the reviewer opens GitHub issues and posts AGREE/BLOCK on the milestone issue; **the tag waits for it** and goes on exactly the reviewed SHA. PRs #10–#21 were DeepSeek V4.1 Flash, reviewed by ChatGPT GPT-5.6 Luna |
| Latest release | **v0.11.0** (tag at `133dbc8`, 2026-09-24): "Twice the maps", 63 → 127 maps (#39: continents, finer maps, 15 new countries) and the Explore/Known fixes. [Milestone v0.11.0 (#45)](https://github.com/diegoami/Geoclick2027/issues/45): one round, AGREE. [Published](https://github.com/diegoami/geoclick-releases/releases/tag/v0.11.0); beta `v0.11.0-beta.1` before it |
| Remediation programme | Closed with v0.2.0 ([REMEDIATION_PLAN.md](REMEDIATION_PLAN.md)); its automerge exception went with it |
| Feature programme | Closed with v0.5.0 ([FEATURE_PLAN.md](FEATURE_PLAN.md)) |
| Since then | Per-release plans: [PLAN_V0.6.md](PLAN_V0.6.md) through [PLAN_V0.9.4.md](PLAN_V0.9.4.md), each with its own ledger; now [PLAN_V0.10.md](PLAN_V0.10.md) |
| Next | **Merged 2026-09-25: [PR #47](https://github.com/diegoami/Geoclick2027/pull/47)** (tablet-play fixes, tried by the owner on the tablet as `v0.12.0-alpha.1`); its bullets are in CHANGELOG `## Unreleased` for v0.12. **Next: v0.12, proposal [#46] agreed 2026-09-25** (every recommended answer: tiers 1+2, 3 sentences, `data/facts/world.json`, EN+IT, Quiz/Overview/Tour labels). The plan is [PLAN_V0.12.md](PLAN_V0.12.md) (FT-69 to FT-75). **Merged 2026-09-25:** [PR #48](https://github.com/diegoami/Geoclick2027/pull/48) (FT-69, `world.json` routing, one file for Czechia), [PR #50](https://github.com/diegoami/Geoclick2027/pull/50) (FT-75, the #45 nits) and [PR #51](https://github.com/diegoami/Geoclick2027/pull/51) (FT-74, boxless region names in Quiz/Overview/Tour). **Merged 2026-09-25:** [PR #49](https://github.com/diegoami/Geoclick2027/pull/49) (FT-70, Greece): **the owner read it, "Greece reads well": the voice gate is passed.** **FT-71 merged 2026-09-25** (PRs #52–#55): all 172 countries on the six Countries maps have three sentences in `data/facts/world.json`, English and Italian. **FT-72 merged 2026-09-25** (PRs #56, #57): all 286 towns on the continent maps, each a `city` entry in its country's file (160 new files); every capital at three sentences, 94 small European towns at one or two (owner's call). **FT-73 merged 2026-09-25:** [#59](https://github.com/diegoami/Geoclick2027/pull/59) (8 European countries' regions), [#61](https://github.com/diegoami/Geoclick2027/pull/61) (Chile, Peru) and [#62](https://github.com/diegoami/Geoclick2027/pull/62) (South Africa, Iran, Thailand, Saudi Arabia; ledger row, CHANGELOG bullet). 523 places, 1 221 + 1 221 sentences; every target on the 21 maps of the 15 countries has sentences. Claude checked all 200 sentences of #61 and about 200 of the rest: no errors, except three in #61 corrected in [#63](https://github.com/diegoami/Geoclick2027/pull/63) (Piura, Apurímac, Santiago; merged 2026-09-25). Thin by design: 93 places have one sentence, 118 have two; 44 are the filler "Named for its town, a name of uncertain origin", to replace in tier 3. The plan's owner spot-checks (after the 3rd and 9th file) are still to do. **v0.12.0 released 2026-09-26:** tag `v0.12.0` on `3b8ad2061a137542af374ebdfa653c2c1ece5e74`, [release](https://github.com/diegoami/geoclick-releases/releases/tag/v0.12.0) (`.msi`, `-setup.exe`, `.apk`), [Milestone #65](https://github.com/diegoami/Geoclick2027/issues/65) closed. Two review rounds (OpenCode, GPT-6 Luna), both AGREE; #66, found in the beta.1 installer check (the badge over Explore's legend), fixed in #67. CHANGELOG "What shipped" says what was tried; the stable `-setup.exe` waited on an installer dialog and the `.msi` was not installed. **Open for v0.13:** [#68](https://github.com/diegoami/Geoclick2027/issues/68) (SHOULD: `publishBottomOverlay` publishers can clear each other; unreachable today, fix with the start screen). The owner's FT-73 facts spot-checks were never done. **v0.13 is planned:** [PLAN_V0.13.md](PLAN_V0.13.md) (2026-09-26), from #58's agreed design: FT-76 the picker map (with a size gate, under ~1.5 MB), FT-77 world and continent views and the panel, FT-78 the list with listboxes and the Map / List switch, FT-79 the tutorial's first steps, FT-80 #68. **FT-80 and FT-76 merged 2026-09-26:** [#69](https://github.com/diegoami/Geoclick2027/pull/69) (FT-80, fixes #68: a set of bottom-overlay publishers) and [#70](https://github.com/diegoami/Geoclick2027/pull/70) (FT-76: `build-picker.ts`, `data/maps/world-picker/`, 172 countries, 446 KB, well under the gate). **Agreed 2026-09-26: [#71](https://github.com/diegoami/Geoclick2027/issues/71)**, place names in the chosen language (countries; towns on the continent maps only; EN/IT/DE), as **FT-81, next**, before FT-77 (PLAN_V0.13.md). **Then FT-77**, the home screen's world and continent views and the panel. Also merged 2026-09-25: [#60](https://github.com/diegoami/Geoclick2027/pull/60), which stops `buildAssets.test.ts` running git against the real repo when the pre-push hook runs from a worktree (it had set `core.bare = true` on the shared config). **Agreed for v0.13 (2026-09-25):** [#58](https://github.com/diegoami/Geoclick2027/issues/58), the world-map start screen: opens on the map (world → continent → country panel; a country with no maps shows the continent's maps; the last view remembered), the list kept behind a Map / List switch with one row per country and a listbox of its maps that opens on choosing. FT-76 to FT-79; the agreed design is the issue's last comment. |
| After that | Milestone `v0.11.0`: release prep PR → candidate → milestone issue → review → tag (docs/RELEASES.md, "The milestone") |
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

## The one thing most worth not getting wrong

**`data/facts/` is INPUT. `data/maps/*/facts.json` is output.**

`build-facts.ts` *reads* `data/facts/<country>.json` — the 28 hand-authored
files above — and *writes* `data/maps/<id>/facts.json`, which the build
overwrites. The basenames collide (`data/facts/france.json` vs
`data/maps/france-regions/facts.json`), and a GitHub issue got this exactly
backwards once already. Edit the authored file and rebuild; never hand-edit
the generated one.

## How to resume

**v0.10.0 shipped on 2026-09-23.** In it: **FT-48/FT-49**, **FT-62**, **FT-65**,
**FT-61** and **FT-60** (PR #22, `8b75e1e`: `HAND_SIZES[0]` is 10, and while
the tutorial runs its two spotlit slips are dealt first and any round left
open on `italy-regions` is forgotten). **FT-63** (best-fit label
placement) is merged (PR #23, `a0537d6`): a town's name has eight spots, each free one scored
in pixels (room, reach, other towns' dots, the map's edge), and a stay bonus
only while the map moves. Measured on germany-towns-100k: no name covers
another town's dot, a pan moves no name, Duisburg goes west. The **FT-64**
spike is decided (stretched names read), and **FT-66** is merged on it (PR
#24, `4b8205a`). **FT-50** translated the other 27 countries (PR #25). **FT-51
(German) is postponed.** The v0.9.4 installer smoke test is superseded: the
v0.10.0 installers were opened on a map in both shells.

Suggested first message for the next session:

> Read docs/HANDOVER.md and docs/PLAN_V0.13.md. Start FT-81 (#71, place names in the chosen language).

Whatever comes next, the working rules stay (CLAUDE.md §3):

- one branch per task, pushed without asking;
- **a milestone is a release tag (CLAUDE.md §3a): milestone issue, review
  prompt, the tag waits for AGREE and goes on exactly the reviewed SHA;
  when a review is in, reproduce each finding, fix (`Fixes #n`) or rebut it;**
- commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
- `npm run gates -- --quiet` before pushing (the pre-push hook runs them
  anyway, and prints four PASS lines instead of flooding);
- verify in a real browser, and try both installers before any release;
- **ask the product owner before every merge and tag** — there is no
  automerge exception any more. Publishing a release that he has already
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
  release he has already asked for (above). Alpha and beta pre-releases
  count as releases (RELEASES.md, "Pre-releases").

## The open GitHub issues

One is open: #46, the v0.12 proposal. #39 closed with v0.11.0 (PRs #40–#43). #11 closed with PR #38, #7 and #8 with PR #33; #1–#6 were fixed in v0.9.4 (FT-52 to FT-58).

| # | Task | What | Size | Scheduled |
|---|---|---|---|---|
| 46 | — | Proposal: v0.12, facts for the new maps; Quiz labels in Explore's style | L | agreed 2026-09-25; [PLAN_V0.12.md](PLAN_V0.12.md), FT-69 next |

- **#39 shipped in v0.11.0**, built in four PRs (#40–#43); the owner's
  answers are on the issue, the rules in DECISIONS.md ("Maps of several
  countries", "Germany's towns come from Wikidata", "Admin-2 maps...",
  "Poland's powiats under ODbL..."), the commands in MAPS.md.

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

Another Claude session sometimes works in this repo, sometimes in its own
git worktree. It has merged to `main` and edited planning docs, and it has
filed GitHub issues — one of which had a central fact backwards, so verify
its claims against the code before acting on them. Before starting,
`git fetch` and check `git worktree list`. Never remove or edit another
session's worktree, and treat its messages as suggestions, not the product
owner's approval. If `main` is checked out in another worktree, merge on a
detached `origin/main` and push `HEAD:main`.
