# Geoclick — Release Process

How work reaches `main` and becomes a versioned, tagged release across all three
shells. Roadmap: [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md).
Execution: [`ORCHESTRATION.md`](ORCHESTRATION.md).
The log itself: [`CHANGELOG.md`](../CHANGELOG.md).

> **Third draft (2026-09-13).** Draft 1 built this whole document around one
> constraint — a push to `main` costs a paid Netlify build — and invented
> `release/*` branches to ration them. **That constraint is gone** (AGENTS.md,
> confirmed by the product owner). Release *tracking* is still wanted, so it
> stays, now local: an annotated git tag plus a `CHANGELOG.md` entry, no GitHub
> Releases, no milestones, no release branches. Draft 3 changes only who does it
> — one Opus agent in a loop rather than an orchestrator directing others — and
> what each batch contains, since the nice-to-have tier came back in.
>
> **Fourth change (2026-09-23, [#26](https://github.com/diegoami/Geoclick2027/issues/26)),
> amended the same day ([#29](https://github.com/diegoami/Geoclick2027/issues/29)).**
> A release is a **milestone** (`AGENTS.md`, *Releases*): an annotated tag on `main`,
> on exactly the commit an independent review agreed with, and the release
> is built from that tag. The short-lived `release/X.Y.Z` PR of #26 was
> dropped: its stable tag landed on a merge commit nobody had reviewed.

## The shape of it

```
  task branch ──merge (owner OK)──► main
  release prep PR (X.Y.Z + CHANGELOG) ──merge (owner OK)──► main = candidate ──► milestone issue
  candidate ──► review (AGREE | BLOCK → fix PRs → candidate moves → re-review)
            ──► beta from the candidate (optional) ──► owner's checks
            ──► tag vX.Y.Z on exactly the reviewed SHA ──► package from the tag ──► publish
```

`main` is the integration branch. Task branches merge into it one at a time, as
each is approved. A release is a **tag on `main`** plus the `CHANGELOG.md` entry
that explains it.

## The milestone (from v0.10.0)

1. **Release prep.** Once everything for the release is merged, an ordinary
   PR carries `node scripts/sync-version.mjs X.Y.Z` and the `CHANGELOG.md`
   entry, headed `## vX.Y.Z — <date> — <theme>` ("Release notes" below).
   Gates; the owner merges. That merge commit on `main` is the
   **candidate**.
2. **Milestone issue.** Open `Milestone vX.Y.Z` with the proposed tag, the
   candidate's full SHA, the previous tag, the PRs merged since and the
   gate results on a clean checkout of the candidate (the `review-handoff`
   skill has the full list). Until the tag, `main` takes only fixes for this
   milestone's findings.
3. **Review.** Start it from OpenCode, on a model the owner picks:
   `/review-release <milestone issue>` in the desktop app or the TUI, or
   `opencode run -m <provider/model> --command review-release <issue>` from a
   shell. The reviewer follows `.opencode/agents/release-reviewer.md`: it
   fetches first (`git fetch origin --tags <candidate SHA>`, not `git pull`),
   works in a fresh detached worktree of its own at the candidate SHA, never
   the checkout it started in (`AGENTS.md`, *Releases*; under
   `<project>-review/review-<SHA first 12>-<stamp>` beside the main
   checkout), installs the dependencies there before any check, and reviews
   `git diff <previous tag>..<candidate>`. Its verdict names that worktree,
   as a relative path, and the SHA. It posts AGREE or BLOCK on the milestone
   issue. **The tag waits.** On BLOCK the fixes land as ordinary PRs, the
   candidate moves to the new `main` commit, and a re-review starts unasked;
   a third round without AGREE goes to the owner. The owner may also
   tag without a review, and the issue records that.
4. **Beta, if one is wanted** (it can run alongside the review). On a
   throwaway commit on top of the candidate, carrying only
   `sync-version.mjs X.Y.Z-beta.N`, tag `vX.Y.Z-beta.N`; it is never merged,
   and the tag keeps it. Package from that tag, try both installers, and
   publish ("Build and publish the installers"). The code is the candidate's,
   so the owner tests what the reviewer reviews. Record the beta tag and its
   `SHA256SUMS.txt` on the milestone issue. If the candidate moves, the next
   beta is `beta.N+1` on the new candidate.
5. **Before the tag:** the installer check (open a map in each shell) and
   any device check the release names, on the candidate or its beta.
6. **On AGREE:** `git tag -a vX.Y.Z <reviewed sha> -m "vX.Y.Z — <theme>"` —
   exactly the SHA the verdict names, never a later commit; push the tag;
   check it out, package from it and publish. `publish-release.mjs` refuses
   to run unless HEAD is the tag, and the notes name the tagged commit. Work
   merged after the candidate waits for the next milestone. Close the
   milestone issue with the tag and the release link.

## What counts as a batch

AGENTS.md asks for a tag "whenever a meaningful batch of work lands — not every
merge, but not left informal either." For this programme:

**A batch is a completed wave.**

Why a wave, rather than "every N tasks" or "whenever the product owner says so":

- A wave boundary is already defined, in `tasks.yaml`, by the dependency DAG. It
  needs no fresh judgement call and no negotiation — the loop can see it arrive. "Every N tasks" would cut the tree at an arbitrary point, possibly
  mid-dependency.
- At a wave boundary the tree is **quiescent**: every branch of that wave is
  merged, and nothing of the next wave has started. That is exactly the state
  you want to tag and to smoke-test, because `main` is not half-way through a
  dependent pair.
- It gives three releases over nineteen tasks. One tag per merge would be noise;
  one tag at the end would lose the traceability the product owner asked for.

Two adjustments, both because a wave is a DAG artefact and not automatically a
shippable unit:

- **Wave 0 ships with wave 1.** Wave 0 is one task (GC-001, the lint-gate
  repair) that lands alone for conflict reasons, not release reasons. A tag of
  its own would describe a line-ending renormalization.
- **Waves 3 and 4 ship together as the closing milestone.** Wave 4 is one task
  (GC-033), and it is the last one; tagging it separately and then immediately
  tagging the milestone would mean two tags on adjacent commits.

The product owner can ask for a tag at any other point, and that override needs
no justification — it is their call. The default above is what happens when
nobody says anything.

## Versioning

**Scheme: `0.MINOR.PATCH`.** Current baseline is `v0.1.0`, tagged 2026-09-13.

- **`PATCH` — one remediation batch.** Nothing in this programme adds user-facing
  capability; every task fixes a known defect or a latent one. That is what a
  patch release is. `v0.1.1`, `v0.1.2`.
- **`MINOR` — a milestone.** Bumped once here, at the end, for "the review is
  closed out": `v0.2.0`.
- **`1.0.0` is reserved and this programme does not touch it.** `DECISIONS.md`'s
  "SSO/cross-device sync deferred" entry identifies the real 1.0: domain
  purchased, app-store submission, the product presented as finished. Fixing a
  review's findings is not that, however thoroughly it is done.

### Why the closing milestone is `v0.2.0`

It needs to be (a) clearly larger than the interim batches, (b) clearly under
the reserved `1.0.0` ceiling, and (c) honest about what it delivers. `v0.2.0`
is the smallest number that satisfies all three: the minor bump says "this is a
milestone, not another fix batch", and staying at `0.x` says "still pre-launch".

Its `CHANGELOG.md` entry is titled **"Known issues from the 2026-09-13 review
resolved"** — and as of draft 3 that claim is literally true: all 30 punch-list
items are assigned, including the nice-to-have tier the product owner restored.
The entry must still be explicit about the two things it does *not* cover: the
review's own meta-observation about converting prose invariants into assertions
is only partly discharged (GC-030 and GC-021 do it; nothing forces it to
continue), and `feature/supabase-sso-sync` remains parked. A milestone that
implies more than it delivers is a worse record than no milestone.

**This is the release the product owner ships**, so its checklist is the strict
one: gates green on `main`, a local smoke test of the built app, `doctor` clean,
version synced across all seven manifests, changelog written, tag pushed, and
one prod-check of the live site afterwards.

### Keeping the version in sync across the shells

**Root `package.json` is the single source of truth.** `scripts/sync-version.mjs`
propagates it to the other six manifests (`app`, `desktop`, `mobile`,
`tauri.conf.json`, `Cargo.toml`, `build.gradle`'s `versionName`).

```bash
node scripts/sync-version.mjs --check   # fail if any of the seven disagree
node scripts/sync-version.mjs 0.1.1     # set root + propagate
```

The three-way drift the review found (`0.0.1` / `0.1.0` / `1.0` across seven
files) was **resolved at `v0.1.0`**; `--check` is now a release-checklist step
that keeps it resolved. Individual task branches must not touch version numbers.

Android's `versionCode` is derived from the version too, and it must rise
with every build a phone might install:
`(major·10000 + minor·100 + patch)·100 + stage`. The stage is N for
`alpha.N`, 50+N for `beta.N`, and 99 for stable. For example
`0.4.0-alpha.1` → 40001, `0.4.0-beta.2` → 40052, `0.4.0` → 40099.
(Until 2026-09-14 it was `major·10000 + minor·100 + patch`, so v0.3.1
shipped 301. Every code in the new scheme is higher, so updates keep
working.)

## Pre-releases: alpha and beta (from v0.4.0)

**Project rule (product owner, 2026-09-14): anything a player might try
before it's final is published on the public releases page as an alpha
or beta pre-release, and clearly marked so.**

| Stage | When | Version and tag | Tested by |
|---|---|---|---|
| **alpha** | a preview of work that isn't merged yet, for example to try a feature on a phone | `X.Y.Z-alpha.N` | the developer only |
| **beta** | everything for the release is merged to `main`, the milestone candidate is on `main` and the gates pass; waiting for the product owner's test | `X.Y.Z-beta.N` | the developer; product owner testing |
| **stable** | the product owner has tried it (the "Cutting a release" checklist below) | `X.Y.Z` | both |

- **Published as GitHub pre-releases** on
  [`diegoami/geoclick-releases`](https://github.com/diegoami/geoclick-releases):
  - `publish-release.mjs` adds `--prerelease`, puts "(alpha)" or "(beta)"
    in the title, and opens the notes with a warning banner;
  - GitHub never marks a pre-release as "latest", so the website's
    download link and the README keep pointing at the last stable
    release;
  - the in-app version badge shows the stage, for example
    `v0.4.0-alpha.1 · 1a2b3c4`.
- **Desktop and Android both ship:** the Windows `-setup.exe` and the APK.
  Pre-releases skip the `.msi`, because the MSI format only takes numeric
  versions and WiX rejects "alpha".
- **Notes** come from the version's CHANGELOG entry. Each task adds its
  player-facing bullet to a `## Unreleased` section under "For players:"
  as it merges; the release prep PR renames it to `## vX.Y.Z — …`. A beta
  uses that entry; an alpha, which has none yet, uses `## Unreleased`.
- **Where an alpha is built from:** a *throwaway commit* on top of the
  task branch, carrying only the version bump. It's tagged
  `vX.Y.Z-alpha.N` and never merged; the tag keeps it. The task branch
  stays free of version numbers.
- **Where a beta is built from:** a *throwaway commit* on top of the
  milestone candidate, carrying only the version change to
  `X.Y.Z-beta.N`, tagged and never merged ("The milestone", step 4). The
  candidate itself already carries `X.Y.Z`, and the stable tag goes on it.
- **Same checks as stable.** Package from the tag with
  `package-release.mjs`, then try both installers by opening a map in
  each (step 2 below). Show the product owner the `publish-release.mjs`
  dry run, and publish only on their OK. Alphas and betas are public too.
- **Numbering:** start at `.1`, and bump N for each new build of the same
  stage: alpha up to 49, beta up to 48.

## What a release is

One source tree, three artefacts, one tag.

| Shell | Built from | Shipped as |
|---|---|---|
| Web | `app/build` via Netlify, on the `main` push | the live site |
| Desktop | `desktop/` Tauri, wrapping the same `app/build` | `.msi`/`.exe`/`.deb`/`.rpm`/`.AppImage` |
| Android | `mobile/` Capacitor, wrapping the same `app/build` | `.apk` (POC quality) |

A release is **one annotated tag on `main`**: `v0.1.1`. Not per-shell tags — the
shells are three packagings of one commit, and per-shell tags would imply they
can diverge. Desktop and Android artefacts are built by the human on a machine
with the Rust / Android Studio toolchains; no agent builds or attaches them, and
a release whose desktop/Android binaries were not rebuilt says so in its
`CHANGELOG.md` entry rather than implying they were.

## Release contents

| Release | Batch | Tasks | Delivers |
|---|---|---|---|
| `v0.1.1` | waves 0 + 1 | GC-001, 002, 003, 010, 020, 030, 040, 050, 060, 070 | The lint/ESLint gate actually runs, and a pre-push hook keeps it running; component tests are possible at all again; the SRS scheduler stops silently retiring cards and lets ease recover; QuizView stops throwing on two real races and stops shipping a debug handle to users; map-data invariants are enforced by a test; Android gets a migration path; `<html lang>` follows the UI language; asset fetches survive a base path; docs match the repo. |
| `v0.1.2` | wave 2 | GC-021, 031, 041, 071 | The drop-correctness decision becomes a tested pure function (Essen/Duisburg included); the build scripts stop hardcoding one user's `$HOME` and flag Chukotka's inverted bbox; progress can be cleared and a full localStorage no longer breaks a session; the home page stops pulling 484 KB on every mount. |
| `v0.2.0` | waves 3 + 4 + close, plus GC-080 (held back by product-owner override — DAG-ready in wave 1, but it's a decision document, not a fix, so it ships with the milestone instead) | GC-004, 022, 032, 033, 080 | Adjacent regions stop sharing a colour and the palette is legible again; tours on 100+ target maps become watchable; popup text stops going through `setHTML` and the popup CSS lives in one place; `data/scripts` is typechecked and linted; the pmtiles storage question gets a decided answer. **Milestone: the 2026-09-13 review is closed out.** |

## Cutting a release

*Historical: this is the v0.1.x–v0.2.0 loop's checklist. From v0.10.0 the
steps run through "The milestone" above; its smoke test (step 4) and the
two-step labelling still apply.*

Run by the loop agent once a wave closes. Steps 1-5 and 7-8 are mechanical;
step 6 is the product owner's, and it is the one that cannot be skipped. Since
the automerge change (2026-09-13) task merges no longer wait for anyone, so this
is the **only routine human gate left in the programme** — three times in total.

1. Confirm every task in the batch is `integrated`
   (`node scripts/task.mjs status`) and that the ledger table in
   REMEDIATION_PLAN.md agrees with it. If any task is `escalated` or `blocked`,
   either resolve it or move it to the next batch — do not ship a half-wave
   silently, and say in the entry that it moved.
1b. `node scripts/task.mjs doctor` — clean. No stray branches, no orphan
   worktrees, no dev server still running. A release is the wrong moment to
   discover a zombie.
2. `node scripts/sync-version.mjs 0.1.1` on `main`; commit.
3. Run all four gates on `main` from a clean checkout.
4. Serve `app/build` locally and smoke-test: home page loads; one polygon map's
   quiz, tour and overview; one towns map's quiz. This is the **"test locally"**
   half of AGENTS.md's two-step rule, and it is labelled as such in the report.
5. Write the `CHANGELOG.md` entry (format below).
6. **Ask the human to approve.** Wait. Tags are cheap; a tag on the wrong commit
   is not.
7. On approval: push `main`, then
   `git tag -a v0.1.1 -m "v0.1.1 — <theme>"` and push the tag.
8. **Do not watch or check the deploy.** The product owner tracks Netlify deploy
   status themselves (confirmed again when cutting v0.1.1). The **"test the
   deployment"** half of AGENTS.md's two-step rule is theirs; the loop's report
   says plainly that the deploy was pushed and not checked. Only check the live
   site if the product owner asks for it for a specific release.

Do **not** trigger a manual deploy at any point. If the git-triggered build looks
stuck, that is the human's dashboard button, not an agent's problem (AGENTS.md's
debugging-rabbit-holes rule).

## Build and publish the installers (from v0.3.0, FT-07/FT-08)

The web app ships itself when `main` is pushed. The Windows and Android
installers are built locally and published by hand, after the tag exists.
There is no CI (FEATURE_PLAN.md, decision 2).

1. **Package from the tag.**

   ```bash
   git checkout vX.Y.Z
   node scripts/package-release.mjs
   ```

   Before building, the script refuses to run unless all of these hold:
   - the working tree is clean and HEAD is the tag;
   - `sync-version --check` passes (which also keeps Android's `versionCode`
     rising, so phones accept the new APK as an update);
   - Rust, the Android SDK and a JDK 17–24 are present;
   - an Android signing key is configured (ONBOARDING.md, "Release (signed)
     APK").

   It builds the desktop installers and a release APK. It refuses an APK
   whose signature doesn't verify. The output goes to `dist-release/vX.Y.Z/`
   (gitignored):
   - `Geoclick-X.Y.Z-windows-x64.msi`
   - `Geoclick-X.Y.Z-windows-x64-setup.exe`
   - `Geoclick-X.Y.Z-android.apk`
   - `SHA256SUMS.txt`

   `--allow-untagged` does a dry run on any clean commit.

   **The Android signing key changed on 2026-09-19.** Everything from
   v0.3.0 to the first v0.7.0 upload was signed with a key whose SHA-256
   fingerprint was `3c275b69…dc30d2d4`; everything from the v0.7.0 re-upload
   onwards is signed with `6aa706e6…71710a84`
   (`CN=Diego, OU=Amicabile, …`). Android only accepts an update signed by
   the same key as the installed app, so **an install from any earlier
   download cannot be updated in place** — it has to be uninstalled first,
   which clears that device's saved progress. v0.7.0's APK was rebuilt from
   its own tag and re-uploaded with the new key, and its notes say so;
   earlier releases were deliberately left on the old key as historical
   artifacts. If a future install mysteriously refuses with
   `INSTALL_FAILED_UPDATE_INCOMPATIBLE` or "App not installed", this is why.

   Two ways this can waste an afternoon, both hit on the day:
   - `mobile/android/keystore.properties` **takes precedence over the
     `GEOCLICK_*` environment variables** (`app/build.gradle`, the
     `signingValue` helper falls back to the environment only when the
     property is *absent*). A stale line in that file silently beats a
     correct environment variable.
   - A JKS keeps the **store** password and the **key** password
     separately. A wrong store password fails with "keystore password was
     incorrect"; a wrong key password gets past that and fails with "Get Key
     failed: Given final block not properly padded", which does not sound
     like a password problem at all.
2. **Try them.** Install the APK on a phone or emulator, and the setup
   `.exe` on Windows. In each, **open a map and check that its regions
   draw**; launching isn't enough. v0.3.0's desktop installers opened
   every map empty, and only the APK had been tried. To see errors inside
   the Windows app, use ONBOARDING.md's WebView2 remote-debugging recipe.
   The Windows installers aren't code-signed, so SmartScreen shows
   "unknown publisher". That's expected.
3. **Publish: the product owner's OK first.** It is standing for a release
   the owner has already asked for ("nobody apart me is downloading it
   anyway"); the notes still say plainly what was not verified. Publishing is public
   and outward-facing. `node scripts/publish-release.mjs` is a dry run:
   - it checks the files against `SHA256SUMS.txt`;
   - it builds the release notes from the player-facing part of the
     version's `CHANGELOG.md` entry;
   - it shows exactly what it would upload to
     [`diegoami/geoclick-releases`](https://github.com/diegoami/geoclick-releases).

   Only `--confirm` creates the GitHub Release. The public repo's front
   page is kept in `docs/releases-repo/README.md`. When that file changes,
   copy it over to the releases repo.
4. **Say what shipped** in the release's `CHANGELOG.md` entry: which
   installers, and any shell that was not rebuilt.

## Release notes

There is no `gh release create` and no `--generate-notes`. The notes **are** the
`CHANGELOG.md` entry, written by hand, matching the `v0.1.0` entry's shape:

- an `## vX.Y.Z — YYYY-MM-DD` heading,
- one bolded lead sentence saying what this release is,
- bullets in **player-facing terms first** — "cards no longer disappear from
  review forever" before "clamped `interval` in `packages/srs`" — because a list
  of task ids does not tell the product owner whether the quiz got better,
- the review findings closed, by their original tags (`C1`, `D8`, `#14` …), so
  `CODE_REVIEW_2026-09-13.md` stays traceable to shipped work,
- anything deliberately not done in this batch.

Generate the raw material with
`git log --oneline v0.1.0..HEAD` and the `review_refs` fields in `tasks.yaml`;
curate from there. Then mark each task `released` with `task.mjs state`.

## Hotfixes

If something ships broken: branch `hotfix/x.y.z` from `main`, fix it, run the
gates, get the human's OK, merge to `main`, then ship the next patch as its
own milestone ("The milestone" above). No forward-merge
step and no release branch to reconcile — that complexity existed only to serve
the release-branch model. An extra build costs nothing now; shipping broken
still does, which is what step 4 above is for.

## Doc maintenance at release time

Per AGENTS.md, docs are updated as part of the work, not afterwards — each task
already writes its own `DECISIONS.md` entry in its DoD. At release time the loop
only:

- checks off the batch's tasks in `ROADMAP.md` and updates its Status section,
- confirms `ARCHITECTURE.md` still describes the code (GC-010, GC-021, GC-030,
  GC-032 and GC-040 all change things it documents),
- confirms `ONBOARDING.md`'s gotchas are current (GC-001, GC-002, GC-003 and
  GC-040 all change what a new contributor needs to know),
- writes the `CHANGELOG.md` entry,
- confirms the progress ledger in `REMEDIATION_PLAN.md` matches what actually
  merged, and fills in the release row (tag + date).

If a task skipped its doc obligation, say so rather than papering over it in the
release commit — with no separate reviewer, an unreported gap is one nobody sees.
