# Windows account integration (#311 / #313)

The Windows native runtime builds on storage PR #327. Browser account/import and
sharing are implemented; Android production integration remains separate.
Login is optional. The existing guest SQLite data is not auto-imported or cleared.

## Inputs and isolated local app

The public Firebase `.env.local` must contain `VITE_FIREBASE_CONFIG` JSON with
apiKey/authDomain/projectId/appId. Use Google's downloaded **Desktop app** client
JSON from the same project. Keep that JSON outside the repository, as with the
native proof. No service account, custom-token backend or billing is needed.

```powershell
npm run dev:windows-account -- --client-file <external Desktop JSON> --firebase-env-file <external .env.local>
```

The helper verifies project/config shapes without printing keys or tokens,
prepares assets, serves the app at localhost:5197 and launches **Geoclick Windows
Account Test** with identifier `com.geoclick.windows-account-test`. This isolates
SQLite, WebView profile and credential targets from the production game. Use the
desktop window, not the browser copy of that dev URL. Ctrl+C/closing the test app
stops only the processes the helper spawned. `--check` validates paths/config and
writes the non-secret ignored Tauri overlay without launching anything.

Rust's build script accepts `GEOCLICK_GOOGLE_DESKTOP_CLIENT_FILE`. Generated Rust
source contains the external path only; `include_str!` embeds installed-app client
metadata into the native binary without copying the downloaded file into source
or printing its contents. This metadata is public installed-app OAuth material,
not a confidential web-client or service-account secret. A production build must
use the intended public Firebase and Desktop configurations; an unconfigured
build continues offering guest play and hides native account controls.

## Runtime / storage

Google sign-in opens in the system browser and returns through a random loopback
listener with PKCE, state/nonce and short-lived single-use callback. Rust retains
the Google renewable grant and returns a short-lived Google ID token plus a
one-use native attempt ticket. Firebase
verifies project/provider/identity before native confirmation. Remember is off by
default and stores only the native grant in Windows Credential Manager when chosen.
The WebView Firebase SDK always uses memory persistence. Credential targets bind
app identifier, project and Desktop client; no enumeration or plaintext fallback.

A protected saved UID/label may reopen local account progress while the backend
is unavailable. Cloud transport stays blocked until fresh same-UID Firebase
verification. Revocation or mismatch never turns previous account data into a
new UID's progress. Sign-out blocks transport, forgets the native scoped record
and clears SDK memory. Actor metadata is separate and is not removed on sign-out.
Native commands have request-aware cancellation and finalization, including old
async dispatch arriving after cancel or an abandoned WebView reload; SDK work/cleanup is serialized across intents.

## Verification

- Rust tests copy the proved OAuth/session/vault cases into the production module
  and add request registration/stale-cancel tests. Real vault tests use disposable
  targets only. They do not sign into Google or inspect any existing credential.
- `windowsAccountGateway.test.ts` verifies protected offline identity, guarded
  cloud access, same-UID refresh without remount, UID mismatch, revocation,
  single-flight restore, late credentials, SDK cleanup ordering and failed forget.
- The local emulator suite exercises real Firebase verification/transport through
  native DTO entry points, memory-only WebView credentials and mismatched restore.
  Native IPC/provider and journal entry points are mocked in that browser test;
  actual SQLite/native bridge contracts are covered separately under #327.
- `AccountControls.svelte.test.ts` covers explicit cancel, disabled unsupported
  Remember and resetting the choice on sign-out, alongside EN/DE/IT accessibility.

## Owner checks (live / pending)

In the isolated desktop window, open Account, sign in with the same Google account
used by the browser and leave Remember off initially. Select/consent in the system
browser yourself; Google login must never appear in the game WebView. Confirm
synchronized progress and the known name imported in the browser. Practice once,
sync, then check that browser sees it. Cancel a new attempt and try signing out.

Then opt into Remember, close/reopen the test app and verify the same account.
Check local remembered restart with backend unavailable, reconnect, reset/stale
practice and switching accounts. Sign out/forget and verify next launch is guest.
The full installed Windows/Android/HTML5 release matrix still applies. Record only
actual checks in plan #311; synthetic emulators and compilation do not prove a
live Google, native IPC or installed-device result. This test app is not a release
artifact and the helper deploys/publishes nothing.
