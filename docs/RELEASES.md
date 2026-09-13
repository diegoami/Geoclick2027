# Geoclick — Release Process

How work reaches `main` and becomes a versioned, tagged release across all
three shells. Roadmap: [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md).
Execution: [`ORCHESTRATION.md`](ORCHESTRATION.md).

## The constraint that shapes everything

Per CLAUDE.md, **a push to `main` triggers a real Netlify build that costs
credits.** So `main` is not an integration branch. Merging 19 task branches to
`main` individually would mean 19 paid builds for 19 fixes.

Instead:

```
  task branch ──merge──► release/0.2.0 ──merge──► main ──tag──► v0.2.0
   (19 of them)           (free, local)          (1 paid build)
```

Feature branches merge into a release branch — free, unlimited, as many
rebases and fixes as needed. The release branch merges to `main` **once**, when
the human approves it. Three releases, three paid builds, nineteen tasks.

That is the single structural reason this plan uses release branches at all.

## Versioning

**Scheme: `0.MINOR.PATCH`.** Pre-1.0, so:

- `MINOR` — a shipped release batch. Bumped per release in this plan.
- `PATCH` — a hotfix cherry-picked onto a released `main`. Not used unless
  something ships broken.
- `1.0.0` is reserved for the first public launch (domain purchased, app-store
  submission), which DECISIONS.md's "SSO/cross-device sync deferred" entry
  already identifies as the real milestone. Not this programme's business.

### Resolving the existing version drift

The repo currently disagrees with itself:

Measured by `node scripts/sync-version.mjs --check` at `c5c786e` — three
distinct versions across seven files:

| File | Version |
|---|---|
| `package.json` | `0.0.1` |
| `app/package.json` | `0.0.1` |
| `desktop/package.json` | `0.0.1` |
| `mobile/package.json` | `0.0.1` |
| `desktop/src-tauri/tauri.conf.json` | `0.1.0` |
| `desktop/src-tauri/Cargo.toml` | `0.1.0` |
| `mobile/android/app/build.gradle` (`versionName`) | `1.0` |

The Android shell claiming `1.0` is the worst of the three: it is POC quality
and would present itself to a user as a finished product.

**Root `package.json` is the single source of truth.** `scripts/sync-version.mjs`
propagates it to the other six. The first release cut normalises everything to
`0.2.0`, which is ahead of every current value and therefore unambiguous.

```bash
node scripts/sync-version.mjs --check   # CI-style: fail if any file disagrees
node scripts/sync-version.mjs 0.2.0     # set root + propagate
```

Version drift is checked as part of the release checklist, not per task —
individual task branches must not touch version numbers.

## What a release is

One source tree, three artefacts, one tag.

| Shell | Built from | Shipped as |
|---|---|---|
| Web | `app/build` via Netlify, on the `main` push | the live site |
| Desktop | `desktop/` Tauri, wrapping the same `app/build` | `.msi`/`.exe`/`.deb`/`.rpm`/`.AppImage` attached to the GitHub Release |
| Android | `mobile/` Capacitor, wrapping the same `app/build` | `.apk` attached to the GitHub Release |

A release is **one tag on `main`**: `v0.2.0`. Not per-shell tags — the shells
are three packagings of one commit, and per-shell tags would imply they can
diverge. If a shell is not rebuilt for a release (likely for Android, which is
POC quality), the GitHub Release says so explicitly rather than shipping a
stale artefact silently.

Desktop and Android artefacts are built by the human on a machine with the
Rust / Android Studio toolchains. No agent builds or attaches them.

## Tags and milestones

| Object | Format | Example |
|---|---|---|
| Git tag | `vMAJOR.MINOR.PATCH`, annotated, on `main` | `v0.2.0` |
| Release branch | `release/MAJOR.MINOR.PATCH` | `release/0.2.0` |
| GitHub Milestone | `vMAJOR.MINOR.PATCH` | `v0.2.0` |
| GitHub Release | title `vMAJOR.MINOR.PATCH — <theme>` | `v0.2.0 — Correctness & gates` |

**Every issue carries exactly one milestone.** That is the tie between a
feature/fix and a concrete release, and `scripts/seed-forge.mjs` sets it from
`tasks.yaml`'s `release` field at creation time. An issue with no milestone is
a scheduling bug — the orchestrator should refuse to lease it.

## Release contents

| Release | Theme | Tasks | Delivers |
|---|---|---|---|
| `v0.2.0` | Correctness & gates | GC-000, 001, 002, 003, 010, 020, 021, 030, 050, 060 | The parallel-execution model is proven (or abandoned); the lint/ESLint gate actually runs; the SRS scheduler stops silently retiring cards; QuizView stops throwing on two real races; map data invariants are enforced; `<html lang>` is correct; docs match reality. |
| `v0.3.0` | Storage & platform | GC-004, 022, 031, 040, 041, 070, 071 | Android gets a migration path; the repository can delete; asset paths work under a base path; the home page stops pulling 484 KB; build scripts stop hardcoding one user's `$HOME`. |
| `v0.4.0` | Map palette & pipeline | GC-032, 033, 080 | Adjacent regions stop sharing a colour; the unsolved-opacity regression is revisited; tours on 100+ target maps become watchable; the pmtiles storage question gets an answer. |

## Cutting a release

Run by the **orchestrator in Release Manager mode**, with the human approving
step 6. Steps 1–5 and 7–9 are mechanical.

1. Confirm every task in the milestone is `state:integrated`. If any is
   `state:escalated` or `state:blocked`, either resolve it or move it to the
   next milestone — do not ship a half-milestone silently.
2. `node scripts/sync-version.mjs 0.2.0` on the release branch; commit.
3. Run all four gates on the release branch from a clean worktree.
4. Serve `app/build` locally and smoke-test: home page loads; one polygon map's
   quiz, tour and overview; one towns map's quiz. This is the "test locally"
   half of CLAUDE.md's two-step rule.
5. Draft the release notes (below) and post them on the milestone.
6. **Ask the human to approve the `main` merge.** Wait. This is the only paid
   step and the only irreversible one.
7. On approval: merge `release/0.2.0` into `main` (merge commit, not squash —
   the release branch's history is the audit trail), push.
8. Tag: `git tag -a v0.2.0 -m "v0.2.0 — Correctness & gates"` and push the tag.
9. Once Netlify reports the build green, prod-check the live site **once**
   (CLAUDE.md: the "test the deployment" half, explicitly labelled as such,
   and once only). Then close the milestone and create the GitHub Release.

Do **not** trigger a manual deploy at any point. If the git-triggered build
looks stuck, that is the human's dashboard button, not an agent's problem
(CLAUDE.md's debugging-rabbit-holes rule).

## Release notes

Generated, then curated:

```bash
gh release create v0.2.0 \
  --title "v0.2.0 — Correctness & gates" \
  --generate-notes \
  --notes-file docs/release-notes/v0.2.0.md
```

`--generate-notes` groups merged PRs; the curated file leads with a short
"what actually changed for a player" paragraph, because a list of 9 PR titles
does not tell the product owner whether the quiz got better. Group the
generated section by the `type:` labels (`type:fix`, `type:feat`, `type:perf`,
`type:refactor`, `type:chore`, `type:docs`).

Each release note must name the review findings it closes (the `review_refs`
in `tasks.yaml`), so the original review stays traceable to shipped work.

## Hotfixes

If something ships broken: branch `hotfix/x.y.z` from the tag, fix, gate,
merge to `main`, tag `v0.2.1`, and forward-merge into the active release
branch so the fix is not lost at the next release. One extra paid build —
which is the cost of shipping broken, and an argument for step 4.

## Doc maintenance at release time

Per CLAUDE.md, docs are updated as part of the work, not afterwards — each task
already writes its own `DECISIONS.md` entry in its DoD. At release time the
orchestrator only:

- checks off the release's tasks in `ROADMAP.md` and updates its Status section,
- confirms `ARCHITECTURE.md` still describes the code (GC-010, GC-030, GC-032
  and GC-040 all change things it documents),
- confirms `ONBOARDING.md`'s gotchas are current (GC-001, GC-002 and GC-040 all
  change what a new contributor needs to know).

If a task skipped its doc obligation, that is a review miss — file it, do not
paper over it in the release commit.
