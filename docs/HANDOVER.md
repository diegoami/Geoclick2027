# Handover — 2026-09-23, v0.10.0 under way (FT-50 built, PR #25 awaiting PO test)

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
| Who works | **Claude Opus 5.5** implements, with no per-PR review. **At milestones** (before a release tag, or on request) Claude hands the product owner a prompt for an **independent model** to review the repository (product owner, 2026-09-23 — [REVIEW_LOOP.md](REVIEW_LOOP.md)). PRs #10–#21 were DeepSeek V4.1 Flash, reviewed by ChatGPT GPT-5.6 Luna |
| Latest release | **v0.9.4** (tag at `5387ff2`, 2026-09-22): the review's six fixes (FT-52 to FT-58). Installers are on the public [releases page](https://github.com/diegoami/geoclick-releases/releases/latest) — **published but not smoke-tested** (no map was opened in either shell). Previews go out as alpha/beta pre-releases first (RELEASES.md, "Pre-releases") |
| Remediation programme | Closed with v0.2.0 ([REMEDIATION_PLAN.md](REMEDIATION_PLAN.md)); its automerge exception went with it |
| Feature programme | Closed with v0.5.0 ([FEATURE_PLAN.md](FEATURE_PLAN.md)) |
| Since then | Per-release plans: [PLAN_V0.6.md](PLAN_V0.6.md) through [PLAN_V0.9.4.md](PLAN_V0.9.4.md), each with its own ledger; now [PLAN_V0.10.md](PLAN_V0.10.md) |
| Next | **FT-50 is built: [PR #25](https://github.com/diegoami/Geoclick2027/pull/25)** on `feat/ft-50-italian`, awaiting the product owner's test and merge OK. Every name-fact is in Italian (5 448 of 5 448, 28 countries, one commit each); ~180 English facts corrected along the way (DECISIONS.md, "Translating fact-checked the English"); three sentences are new writing (Paraíba, Wonju, Sukabumi) for the product owner to read. Tools: `npm run translate-facts`, `npm run refresh-facts-hooks`, brief `docs/TRANSLATION_STYLE_IT.md`. After the merge, v0.10.0's remaining work is the release itself (RELEASES.md) and the milestone review prompt (REVIEW_LOOP.md); FT-51 (German) stays postponed. Outstanding: the v0.9.4 installer smoke test, the FT-61 tablet check, FT-66 on a real phone/tablet; a leftover Cloudflare check fails on every PR (dashboard job) |
| After that | **FT-51 (German) is postponed** until the Italian has been read; the two v0.9.4 test gates (FT-56, FT-59) wait in a hardening batch |
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
- **v0.10.0, in progress** — FT-48/FT-49 (Italy's 20 regions in Italian;
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

**v0.10.0 is under way.** Merged: **FT-48/FT-49**, **FT-62**, **FT-65**,
**FT-61** and **FT-60** (PR #22, `8b75e1e`: `HAND_SIZES[0]` is 10, and while
the tutorial runs its two spotlit slips are dealt first and any round left
open on `italy-regions` is forgotten). **FT-63** (best-fit label
placement) is merged (PR #23, `a0537d6`): a town's name has eight spots, each free one scored
in pixels (room, reach, other towns' dots, the map's edge), and a stay bonus
only while the map moves. Measured on germany-towns-100k: no name covers
another town's dot, a pan moves no name, Duisburg goes west. The **FT-64**
spike is decided (stretched names read), and **FT-66** is merged on it (PR
#24, `4b8205a`). Next is **FT-50** (the other 27
countries, ~5,388 sentences, batched by country with spot-checks). **FT-51
(German) is postponed.** Two things wait for the release gate: the v0.9.4
installer smoke test (the published Windows and Android installers were
**not opened to confirm a map draws**), and the FT-61 check on a real tablet.

Suggested first message for the next session:

> Read docs/HANDOVER.md, then docs/PLAN_V0.10.md. If PR #25 (FT-50) is merged, prepare the v0.10.0 release per docs/RELEASES.md and hand the product owner the milestone review prompt (docs/REVIEW_LOOP.md). (The v0.9.4 installer smoke test is still outstanding.)

Whatever comes next, the working rules stay (CLAUDE.md §3):

- one branch per task, pushed without asking;
- **no per-PR review; at a milestone, hand the product owner the
  independent-model review prompt ([REVIEW_LOOP.md](REVIEW_LOOP.md)) and
  answer every finding that comes back;**
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

Three are open. Issues #1–#6 were fixed in v0.9.4 (FT-52 to FT-58).

| # | Task | What | Size | Scheduled |
|---|---|---|---|---|
| 7 | FT-56 | The integrity suite validates `tourOrder`, not the shipped `tour.json` | S | Hardening batch |
| 8 | FT-59 | No component test crosses QuizView's persistence/resume seams | M | Hardening batch |
| 11 | — | On the Known map an explicitly tapped name keeps its earned colour instead of **Chosen** | S | Backlog |

- **#7 — no shipped tour is currently broken.** All 63 `tour.json` files
  were checked on 2026-09-20: correct `mapId`, steps a permutation of the
  target ids, all `dwellMs` finite and positive. This is a gate that guards
  the wrong artifact, not a live defect.
- **#11 was decided on 2026-09-22** — an explicit tap is Chosen regardless of
  the streak, and the choice is **session-only** (it resets on reopen; this
  changes FT-39's persisted override). Not started; `visibleTier` in
  `shownNames.ts` is the place, and the reasoning is on the issue.

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
