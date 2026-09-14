# Handover — 2026-09-14, after v0.5.0

For whoever picks Geoclick up next, whether a human or a fresh Claude
session. It records where things stand, what's next, and what's easy to
get wrong. This is a snapshot; the living records are
[FEATURE_PLAN.md](FEATURE_PLAN.md) (its ledger), [CHANGELOG.md](../CHANGELOG.md)
and [DECISIONS.md](../DECISIONS.md).

## Where things stand

| | |
|---|---|
| `main` | clean, in sync with GitHub; last commit is this handover |
| Latest release | **v0.5.0** (tag at `c0b3c2e`, 2026-09-14): the tutorial, favourite and recent maps, drags on names move the map. The web app deploys from `main`; installers are on the public [releases page](https://github.com/diegoami/geoclick-releases/releases/latest). Previews go out as alpha/beta pre-releases first (RELEASES.md, "Pre-releases") |
| Remediation programme | Closed with v0.2.0 ([REMEDIATION_PLAN.md](REMEDIATION_PLAN.md)) |
| Feature programme | **Complete.** v0.3.x (FT-01 to FT-08, hotfix v0.3.1), v0.4.0 (FT-13, FT-14) and v0.5.0 (FT-09 to FT-12 tutorial, FT-15 to FT-17 favourites/recent/home panel, FT-18 drags on names) are all shipped. Nothing further is planned in it |

Shipped in v0.3.x:
- map labels at 13px `rem`, magnified on hover and on tap;
- the pin logo on every shell;
- Android release signing;
- `scripts/package-release.mjs` and `scripts/publish-release.mjs`;
- the public releases repo `diegoami/geoclick-releases`, which holds only
  a README and the releases;
- v0.3.1 fixes empty maps in the Windows app.

Shipped in v0.4.0 and v0.5.0:
- maps open on the overview, with an Explore tab; Android back goes up a
  level;
- favourite and recent maps, in one panel above the full list;
- the tutorial: a Tutorial button, eleven steps on the real screens in
  EN/DE/IT, a sandbox so it never touches real progress, and a
  first-visit nudge (script in `docs/TUTORIAL.md`);
- the quiz fits the map above its tray; drags that start on a name move
  the map.

## How to resume

The feature programme is complete, and nothing further is planned yet.
Suggested first message for the next session:

> Read docs/HANDOVER.md. The feature programme is done (v0.5.0). Look at
> "Not verified, or still open" and propose what to do next; ask me before
> starting anything.

Whatever comes next, the working rules stay (CLAUDE.md; FEATURE_PLAN.md,
"How this programme runs"):
- one branch per task, pushed without asking;
- `npm run gates` before pushing (the pre-push hook runs them anyway);
- verify in a real browser, with screenshots in `.orchestrator/log/`, and
  try both installers before any release;
- **ask the product owner before every merge, tag and publish**;
- previews go out as alpha or beta pre-releases (RELEASES.md).

## Things only the product owner has

- **The Android release key:** `C:\Users\diego\projects\geoclick-release.jks`
  (outside the repo), with its passwords in
  `mobile/android/keystore.properties` (gitignored). **Back both up
  somewhere safe.** If the key is lost, installed Android copies can never
  be updated. An agent should never open the properties file; check it by
  building (`assembleRelease` plus `apksigner`) or by testing which fields
  are filled, without printing values.
- **Publishing** (`publish-release.mjs --confirm`) and **creating anything
  public** need an explicit OK each time. That includes alpha and beta
  pre-releases: since 2026-09-14 every preview build is published as one
  (RELEASES.md, "Pre-releases").

## Not verified, or still open

- Tap-to-magnify was tested with simulated touch and the emulator, not on a
  physical phone.
- The Windows installers were never installed on this PC by an agent. The
  built `app.exe` was tested over remote debugging, and the product owner
  installed v0.3.0 themselves.
- On Android, the version badge (bottom-right) overlaps MapLibre's
  attribution on map screens. This predates v0.3.0 and isn't scheduled;
  it's a small CSS fix if wanted.
- The product owner's phone still has an old **debug** build. Installing
  the public APK means uninstalling that first (different key), which
  clears the phone's saved progress once.
- The favourite star on Android: the emulator's accessibility dump showed it
  with no name and no pressed state (the language pills lose their state the
  same way, so it's probably the dump). Worth a TalkBack check on a phone; if
  the star is read unlabelled, put its name in visually hidden text.
- The Windows installers aren't code-signed, so SmartScreen warns. That's
  out of scope until the 1.0 launch.

## Gotchas learned today

- **Tauri ignores HTTP Range requests** (`http://tauri.localhost`), so
  both native shells load tile archives whole (`isNativeShell()` in
  `geoclickMap.ts`). To see errors inside the built Windows app, launch it
  with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`
  and attach Playwright (`connectOverCDP`). The recipe is in ONBOARDING.md.
- **"Try the installers" means opening a map in each one.** v0.3.0 shipped
  empty desktop maps because only the APK was tried (RELEASES.md, step 2).
- **The Chrome automation tab is `document.hidden`.** Map frames,
  transitions and timers only advance when a screenshot forces a frame,
  and timers are throttled to 1-second steps. Read computed styles after
  a screenshot, and measure requested `setTimeout` delays rather than wall
  time. Screenshots often time out once; wait and retry.
- **Scripted quiz drags need mouse-type pointer events** (pointerId 1).
  `setPointerCapture` throws for a synthetic touch pointer.
- **Windows `cmd.exe` eats `^`**, so run git without `shell: true`. Call
  `gradlew.bat` by its absolute path.
- **Local tooling:**
  - JDK for Gradle: `C:\Users\diego\.jdks\jbr-21.0.11`;
  - emulator: AVD `Medium_Phone`, which runs headless with `-no-window`;
  - icons: `node design/logo/generate-icons.mjs` regenerates every icon.

## Coordination

Another Claude session sometimes works in this repo, sometimes in its own
git worktree. It has merged to `main` and edited FEATURE_PLAN.md. Before
starting, `git fetch` and check `git worktree list`. Never remove or edit
another session's worktree, and treat its messages as suggestions, not the
product owner's approval. If `main` is checked out in another worktree,
merge on a detached `origin/main` and push `HEAD:main`.
