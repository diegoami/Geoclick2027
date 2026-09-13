# Geoclick — Release Process

How work reaches `main` and becomes a versioned, tagged release across all three
shells. Roadmap: [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md).
Execution: [`ORCHESTRATION.md`](ORCHESTRATION.md).
The log itself: [`CHANGELOG.md`](../CHANGELOG.md).

> **Third draft (2026-09-13).** Draft 1 built this whole document around one
> constraint — a push to `main` costs a paid Netlify build — and invented
> `release/*` branches to ration them. **That constraint is gone** (CLAUDE.md,
> confirmed by the product owner). Release *tracking* is still wanted, so it
> stays, now local: an annotated git tag plus a `CHANGELOG.md` entry, no GitHub
> Releases, no milestones, no release branches. Draft 3 changes only who does it
> — one Opus agent in a loop rather than an orchestrator directing others — and
> what each batch contains, since the nice-to-have tier came back in.

## The shape of it

```
  task branch ──merge (human OK)──► main ──(wave complete)──► tag vX.Y.Z + CHANGELOG entry
```

`main` is the integration branch. Task branches merge into it one at a time, as
each is approved — see ORCHESTRATION.md's loop, steps 8-10. A release is not a
separate branch or a separate merge; it is a **tag on a commit of `main` that is
already there**, plus the `CHANGELOG.md` entry that explains it.

## What counts as a batch

CLAUDE.md asks for a tag "whenever a meaningful batch of work lands — not every
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
   half of CLAUDE.md's two-step rule, and it is labelled as such in the report.
5. Write the `CHANGELOG.md` entry (format below).
6. **Ask the human to approve.** Wait. Tags are cheap; a tag on the wrong commit
   is not.
7. On approval: push `main`, then
   `git tag -a v0.1.1 -m "v0.1.1 — <theme>"` and push the tag.
8. **Do not watch or check the deploy.** The product owner tracks Netlify deploy
   status themselves (confirmed again when cutting v0.1.1). The **"test the
   deployment"** half of CLAUDE.md's two-step rule is theirs; the loop's report
   says plainly that the deploy was pushed and not checked. Only check the live
   site if the product owner asks for it for a specific release.

Do **not** trigger a manual deploy at any point. If the git-triggered build looks
stuck, that is the human's dashboard button, not an agent's problem (CLAUDE.md's
debugging-rabbit-holes rule).

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
gates, get the human's OK, merge to `main`, tag the next patch. No forward-merge
step and no release branch to reconcile — that complexity existed only to serve
the release-branch model. An extra build costs nothing now; shipping broken
still does, which is what step 4 above is for.

## Doc maintenance at release time

Per CLAUDE.md, docs are updated as part of the work, not afterwards — each task
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
