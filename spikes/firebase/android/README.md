# Android native Google sign-in proof (#313)

Separate Capacitor experiment for plan #311. It obtains a Google credential
through the native Android bridge and exchanges it through the Firebase web
SDK. It does not import game code, open learning stores or write Firestore.
Guest mode is available without signing in; remembered sign-in is opt-in.

## Scope and safety

- This APK uses `com.geoclick.mobile` to prove the actual Android OAuth package
  and release certificate. Its name is Geoclick Firebase Proof and version code
  is **1**, below normal Geoclick releases. Use only the owned, isolated
  `Geoclick_Firebase_API36` emulator. The install helper rejects physical devices,
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
Some configuration downloads omit Android OAuth-client metadata; the actual
native Google check establishes whether the console registration is usable.

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

Real native Google sign-in is **pending**. The owner then signs in
through the native Google prompt; compare the Firebase UID with the previously
proved browser/Windows identity. Check default session-only restart, opt-in
remembered restart, and sign-out followed by restart. Keep real-device, emulator,
mocked and compiled-APK results distinct. No phone/device success is claimed.

Guest play in the eventual game remains optional-account/local-first. This
experiment contains no game progress and does not complete Firebase integration.
Primary setup: https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md
