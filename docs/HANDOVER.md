# Handover — end of 2026-09-13

For whoever picks Geoclick up next, whether a human or a fresh Claude
session. It records where things stand, what's next, and what's easy to
get wrong. This is a snapshot; the living records are
[FEATURE_PLAN.md](FEATURE_PLAN.md) (its ledger), [CHANGELOG.md](../CHANGELOG.md)
and [DECISIONS.md](../DECISIONS.md).

## Where things stand

| | |
|---|---|
| `main` | clean, in sync with GitHub; last commit is this handover |
| Latest release | **v0.3.1** (tag at `fd04733`). The web app deploys from `main`; installers are on the public [releases page](https://github.com/diegoami/geoclick-releases/releases/latest) |
| Remediation programme | Closed with v0.2.0 ([REMEDIATION_PLAN.md](REMEDIATION_PLAN.md)) |
| Feature programme | v0.3.0 shipped (FT-01 to FT-08), plus hotfix v0.3.1. **Next is v0.4.0, navigation:** FT-13 (maps open on the overview, plus an Explore tab) and FT-14 (Android back goes up a level). The tutorial (FT-09 to FT-12) follows as **v0.5.0** |

Shipped in v0.3.x:
- map labels at 13px `rem`, magnified on hover and on tap;
- the pin logo on every shell;
- Android release signing;
- `scripts/package-release.mjs` and `scripts/publish-release.mjs`;
- the public releases repo `diegoami/geoclick-releases`, which holds only
  a README and the releases;
- v0.3.1 fixes empty maps in the Windows app.

## How to resume

Suggested first message for the next session:

> Read docs/HANDOVER.md and docs/FEATURE_PLAN.md. Continue the feature
> programme with FT-13, one task at a time, asking me before every merge.

The programme's rules are in FEATURE_PLAN.md, "How this programme runs":
- one branch per task, `feat/ft-NN-…`;
- `npm run gates` before pushing (the pre-push hook runs them anyway);
- verify in a real browser, with screenshots in `.orchestrator/log/`;
- **ask the product owner before every merge**; there is no automerge in
  this programme;
- tick the ledger after each merge.

🧑 steps always stop and wait: product copy review in FT-09, anything
public, and anything involving secrets.

**FT-13 and FT-14 come first** (added 2026-09-14, decisions 10–12 in
FEATURE_PLAN.md). FT-14 needs the `@capacitor/app` plugin, and its check is
`adb shell input keyevent KEYCODE_BACK` on the emulator, using the release
APK. Then **FT-09** writes `docs/TUTORIAL.md`, the step script and interaction spec.
Another session added a zoom/pan step to FT-09's spec, so read the current
text. The product owner reviews the copy at the merge request. FT-10 (the
sandboxed in-memory progress store), FT-11 (engine and overlay) and FT-12
(first-visit nudge and a three-language walkthrough) follow.

## Things only the product owner has

- **The Android release key:** `C:\Users\diego\projects\geoclick-release.jks`
  (outside the repo), with its passwords in
  `mobile/android/keystore.properties` (gitignored). **Back both up
  somewhere safe.** If the key is lost, installed Android copies can never
  be updated. An agent should never open the properties file; check it by
  building (`assembleRelease` plus `apksigner`) or by testing which fields
  are filled, without printing values.
- **Publishing** (`publish-release.mjs --confirm`) and **creating anything
  public** need an explicit OK each time.

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
