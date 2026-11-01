# Android native Google sign-in proof (#313)

Separate Capacitor experiment for plan #311. It obtains a Google credential
through the native Android bridge and exchanges it through the Firebase web
SDK. It does not import game code, open learning stores or write Firestore.
Guest mode is available without signing in; remembered sign-in is opt-in.

## Scope and safety

- This APK uses `com.geoclick.mobile` to prove the actual Android OAuth package
  and release certificate. Its name is Geoclick Firebase Proof and version code
  is **1**, below normal Geoclick releases. Use only the owned, isolated
  `Geoclick_Firebase_API35` or `Geoclick_Firebase_API36` emulator. The install helper rejects physical devices,
  other emulators and any existing game with a different version code. It never
  uninstalls an app or requests a downgrade. Never install this APK over a game.
- The bridge is `@capacitor-firebase/authentication` 8.6.0 with Capacitor 8.5.2.
  Its declared Firebase peer is 12.x, so this experiment pins Firebase 12.19.0
  in its own package/lock rather than forcing peer resolution or changing the
  browser/Windows spike's SDK. Production dependency selection is separate.
- Native auth is skipped in the bridge; only the Google credential is delivered
  to the common Firebase credential flow. A UID is shown only after Firebase
  verifies the credential. No tokens are printed or shown. Capacitor logging
  is disabled. Google/account/consent/MFA dialogs are completed by the owner.
- Remembered Firebase SDK auth uses IndexedDB inside the Android app's private
  WebView data. The Android app sandbox/device storage protects it; app backup
  is disabled in this proof. This is a different platform mechanism from the
  Windows credential vault. Memory-only is the default. Forgetting first clears
  the current session before changing storage type, so it never copies a
  memory-only credential to disk while signing out.
- Remembered account metadata is project-scoped. Restore verifies a fresh token
  and checks the UID. A mismatch clears the remembered session. Native picker
  reset and local SDK sign-out are distinct; failures are reported.
- WebView debugging is enabled **only in this developer proof**, for inspection
  on the isolated emulator. This configuration is outside the game's mobile
  project and is not a production debug setting.

## Install, configure and build

From an isolated implementing worktree:

```powershell
npm ci
npm ci --prefix spikes/firebase/android --workspaces=false
npm test --prefix spikes/firebase/android
```

The Vite/Playwright tools are supplied by that worktree's root dependencies.
The Android package is outside root workspaces and owns its native dependencies.

Reuse the dedicated test project's public web config in the ignored
`spikes/firebase/.env.local` (parent spike README). Register Android package
`com.geoclick.mobile` in the same Firebase project and add the release SHA-1
`44:5A:7D:E7:3D:75:A3:52:B8:F8:7B:A1:58:31:70:53:BF:75:71:FB`.
Download `google-services.json` outside Git. The helper validates project,
package and Google web client, then copies it to the ignored native location.
Also check Google Auth Platform -> Clients for an Android OAuth client with
that same package/SHA-1. In this test, the Firebase fingerprint was listed but
no Android OAuth client existed. The downloaded configuration had only a web
client; creating the Android OAuth client resolved native sign-in without an
APK rebuild. Firebase app registration and the OAuth registration are distinct
checks; adding a fingerprint alone was not sufficient here.

```powershell
$env:GEOCLICK_FIREBASE_ANDROID_CONFIG_FILE = 'C:/outside/repo/google-services.json'
$env:GEOCLICK_ANDROID_SIGNING_PROPERTIES = 'C:/existing/android/keystore.properties'
# JAVA_HOME points at the compatible JDK; Android SDK must be installed.
npm run build:android --prefix spikes/firebase/android
npm run install:emulator --prefix spikes/firebase/android -- emulator-5580
```

Signing properties/key remain outside this checkout. Relative key paths resolve
beside the properties file. The APK signature must match the real release key.
Output is `rendered/firebase-android-proof/Geoclick-firebase-auth-proof.apk`
with a project/package/certificate/version/hash report. The installer verifies
that report and APK hash before the guarded emulator install.

## Verification

Automated tests validate configuration and installation guards and use mocked
native/Firebase responses for guest/optional sign-in, cancellation, memory-only
restart, remembered fresh-token restore, UID mismatch and sign-out. They do not
contact the cloud or prove Android native login. The mocked bridge is restricted
to Vite test serve mode and cannot be packaged by the build command.

The real signed APK was installed on the owned API 36 emulator. With Wi-Fi and
mobile data disabled, a fresh app process reached guest mode, showed Signed out,
left Keep unchecked and enabled the sign-in control. Continue without signing
in also worked offline without a Google prompt. These are native guest-startup
checks, not a real Google-login result.

ADB on Windows returned CRCRLF line endings for the AVD name. A regression test
now covers that parsing and rejects ambiguous installed-package output, while
retaining the strict emulator/name/version guards.

## Real native evidence (2026-11-01)

The owner completed native Google sign-in on the owned API 35 Google Play
emulator using the release-signed APK. Firebase verified the credential and
reported `google.com`. The UID was compared privately with the already verified
browser/Windows identity: exact match. No UID, email, tokens or configuration
contents are published here.

- With Keep unchecked, force-stop/relaunch returned to Guest mode and Signed
  out, with no remembered identity.
- The owner then checked Keep and signed in. Force-stop/relaunch restored the
  account and verified a fresh Firebase token without another Google prompt;
  the UID still exactly matched browser/Windows.
- The owner selected Sign out and forget. The app confirmed removal, and a
  further fresh process stayed in Guest mode/Signed out with Keep unchecked.
- The emulator was stopped after the completed test. No phone, OS reboot or
  production-game progress-sync result is claimed. Failure cases are covered
  by mocked tests separately from the live provider checks.

Guest play in the eventual game remains optional-account/local-first. This
experiment contains no game progress and does not complete Firebase integration.
Primary setup: https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md


The visible API 36 emulator reproduced clipped/black frames and gfxstream GLES
errors on this Windows host. Software rendering did not resolve API 36. The
owned API 35 Google Play image with `-gpu swiftshader` rendered correctly and
completed the live auth lifecycle above. The guard accepts
only these two explicitly named proof AVDs, never arbitrary emulators/phones.

Native bridge exceptions may have no message/code. The proof maps known error
text to fixed, credential-free categories and retains a generic safe category
when no detail exists. The generic failure in this run was resolved by the
missing Android OAuth client registration; repeated blind login retries did
not establish that configuration.
