# Geoclick — Changelog

Release notes, newest first. See [`ROADMAP.md`](ROADMAP.md) for the
day-to-day build log and [`DECISIONS.md`](DECISIONS.md) for the reasoning
behind product/design choices — this file is the release-facing summary,
one entry per tagged version on `main`.

## v0.1.2 — 2026-09-13

**The second remediation batch: a faster home page, safer saving, and the
quiz's trickiest logic finally under test.** Wave 2 of the plan — four tasks.

For players:

- **The home page loads without downloading every map.** It used to fetch
  all 44 map files (~484 KB) on every visit just to count what's due; that
  information now ships with the page itself — 0 extra requests. Due counts
  are exactly the same as before. (GC-071)
- **A full or blocked browser storage no longer breaks a quiz.** Saving
  progress in Safari's private mode, or with storage full, used to throw
  mid-drag; now the save is skipped quietly and the quiz carries on.
  (GC-041)

Under the hood:

- The drop-scoring decision — including the Bremen tolerance rescue and the
  Essen/Duisburg "closest city" rule, both bugs found by real play — is now
  a pure, unit-tested function instead of inline component code, checked on
  the real maps before and after (GC-021).
- Progress can be cleared per map or entirely, on all three storage
  backends — groundwork only, no reset button yet (GC-041).
- Map build scripts find the `pmtiles` CLI via `PATH` / `PMTILES_BIN`
  instead of one machine's hardcoded path, and flag targets that cross the
  date line (today: Chukotka) (GC-031).
- The loop's `doctor` no longer force-removes other git worktrees — it
  would have deleted a parallel planning session's live work.

Review findings closed: C9, D8, D10, and punch-list #10, #13, #16, #22, #26,
#27, #28.

Known, documented, not changed: five shipped Polish map ids are mangled by
the id generator (`wroc-aw` for Wrocław, and similar) — players only ever
see the correct names, and changing ids would wipe saved progress (see
MAPS.md). At a large window's zoom, Bremen's edge sits beyond the 24px drop
tolerance from its centre — noted in GC-021's ledger row. GC-080's pmtiles
storage decision is already on `main` but belongs to the v0.2.0 milestone
notes.

## v0.1.1 — 2026-09-13

**The first remediation batch: the review's correctness bugs fixed, and the
quality gates actually running again.** Waves 0 and 1 of the plan in
`docs/REMEDIATION_PLAN.md` — ten tasks, each merged on green gates.

For players:

- **Regions you know well no longer vanish from review forever.** After about
  20 clean reviews the scheduler used to overflow into an invalid date and
  silently retire the card; review intervals are now capped at a year. A
  region you once fumbled can also climb back to full ease with clean
  answers, instead of carrying that one mistake forever. (GC-010)
- **Two quiz crashes fixed:** clicking "Practice all regions" before the map
  finished loading, and leaving the quiz within a moment of a wrong drop.
  Both were reproduced before being fixed. (GC-020)
- **A practice round no longer overwrites your real last score** on the home
  page. (GC-020)
- **Screen readers pronounce German and Italian correctly** — the page
  language now follows the language switcher. (GC-050)
- **Android: saved progress now has a proper upgrade path.** Future database
  changes apply exactly once per phone, and existing installs keep every
  saved answer (tested against a real SQLite; still needs a check on a real
  device — plan in the GC-040 commit). (GC-040)

Under the hood:

- `npm run lint` passes for the first time in weeks — Windows line endings
  had been failing it silently, so ESLint never ran (GC-001). A pre-push
  hook now runs all four gates before every push (`npm run setup-hooks`
  once per clone; GC-002).
- Component tests run again, in a real headless Chromium
  (`npx playwright install chromium` once per machine; GC-003). A
  map-data integrity test guards all 44 maps (unique names and ids, valid
  geometry, tour order, and that every map is listed on the home page), and
  `data/maps/index.json` is generated from the map files (GC-030).
- Asset loading works under a subpath, e.g. GitHub Pages (GC-070); the
  `window.__map` debug handle no longer ships to users (GC-020); docs now
  state the real 44 maps / 22 countries (GC-060).
- The version is kept in step across all three shells *and* both lockfiles
  by `scripts/sync-version.mjs`, which had been missing `Cargo.lock` and
  `package-lock.json`.

Review findings closed: C1, C2, C3, C4, C5, C6, C7, C11, C12, C13, D1, D2,
D7, S1, S2, S3, S4, and punch-list #1-7, #9, #11, #12, #14, #15, #18, #19,
#20, #23, #24.

Not in this release: the GC-040 Android check on a real device; the map
palette and tour tuning (v0.2.0); GC-080's pmtiles storage decision, which is
ready but held for the v0.2.0 milestone on the product owner's call.

## v0.1.0 — 2026-09-13

**The first tracked release.** Everything built through Iteration 8+ before
the remediation work below begins, now given a version number, a tag, and
a visible build identifier in the app itself (bottom-right corner on every
screen: `vX.Y.Z · <commit>`).

- **22 countries, 44 maps** — regions/states/provinces plus a
  population-thresholded towns map per country, point- and polygon-target
  support, tour + quiz + spaced repetition (SM-2) on every one.
- **Three shells**: the live web app (Netlify), a Tauri desktop app
  (`.msi`/`.exe`/`.deb`/`.rpm`/`.AppImage`), and a Capacitor Android APK
  (POC quality).
- **UI in English, German, and Italian.**
- **Visual refresh**: warm background palette, opacity-driven
  solved/unsolved contrast on the map.
- **Local-first persistence** — `localStorage` in the browser, SQLite on
  desktop and Android, no accounts, no backend.
- Supabase-backed optional sign-in / cross-device sync was built and
  reconciled with `main` but is deliberately **paused**, not shipped — see
  `DECISIONS.md`'s "SSO/cross-device sync deferred" entry.
- An independent Opus code review (`CODE_REVIEW_2026-09-13.md`) found real
  correctness issues — most notably an uncapped SRS interval that can
  silently retire a card forever, and an ease factor that never recovers
  once lowered. None of those fixes are in this release; they're the
  subject of the remediation work that follows it.

Versions are kept in sync across all three shells' manifests by
`scripts/sync-version.mjs`; the root `package.json` is the source of truth.
