# Android optional account integration

The game uses the native Google Credential Manager picker, then verifies its ID
credential through the same Firebase JavaScript SDK as browser/Windows progress.
The native authentication bridge skips its own Firebase session. Guest play and
existing SQLite progress remain available without configuration or sign-in.

## Configuration and local build

Keep the downloaded Android `google-services.json` and public Firebase
`.env.local` outside the repository. They must select the same project, Android
package `com.geoclick.mobile`, and a Google web OAuth client. Register the release
certificate fingerprint in that project's Android app. The downloaded JSON may
predate that dashboard registration; its absence is not proof of missing setup.

With Java 21 and the Android SDK available, run `npm run build:android-account --`
with `--google-services-file`, `--firebase-env-file` and
`--signing-properties-file` absolute paths. Add `--check` for validation without
copying/building. Signing properties can be the existing main checkout's ignored
file; relative keystore paths resolve beside that properties file. The helper
copies only the ignored Android public config, builds the web app, runs Capacitor
sync and assembles the signed APK. It never installs, deploys, or selects Google
accounts. Logs are in `rendered/android-account/`.

Without Android configuration, Capacitor excludes the Firebase native plugin so
its startup cannot break the normal guest build. The shared frontend only
registers the native bridge; it does not bundle the bridge's Firebase 12 web
implementation. The mobile dependency satisfies that bridge's peer requirement;
the game and emulator fixtures consistently use Firebase 13.

## Identity, persistence and backups

Remember is unchecked by default. Session-only Firebase authentication stays in
memory; explicit opt-in uses Firebase IndexedDB persistence inside the Android
app sandbox. Tokens are never copied into progress SQLite, native metadata,
localStorage, logs or source files. Sign-out removes persisted SDK authentication
and the remembered identity, while keeping guest and account progress.

The native plugin stores only the last verified project/UID/display label and a
random writer actor in Android no-backup files. That identity enables opening its
local SQLite account journal offline before SDK/network initialization finishes.
Cloud access requires Firebase to verify the same UID and Google provider.
Temporary restore failures retain the local identity and saved session for retry;
a missing or mismatched SDK user cannot upload under the previous account.

Legacy backup and Android 12+ cloud/device-transfer rules exclude `app_webview`.
SQLite progress remains eligible for normal backup, while credentials, native
remember metadata and the installation actor do not migrate. A restored database
gets a new actor, preserving historical events without reusing their sequence.
Native request IDs and the shared epoch/SDK queue protect cancellation, stale
callbacks, sign-out and account changes.

## Verification

The normal gates cover the shared coordinator, guest/optional account UI, SQLite
adapters and migrations. `npm run test:firebase` adds real SDK/emulator credential
exchange, immutable cloud writes, remembered SDK restore, credential removal and
session-only durable-storage checks. Native picker/metadata are mocked in those
browser tests; SQLite has its own actual-file tests. Recreating an SDK app in one
JavaScript process does not model destruction of memory persistence, so the
session-only test inspects durable storage rather than claiming a process restart.

Still required before merge: the signed APK on the dedicated Android emulator,
real Google login, same-account cloud progress, unchecked cold restart, checked
remembered cold restart and sign-out/forget. These are separate from emulator SDK
coverage. Full installer/device/release checks remain part of the milestone.
