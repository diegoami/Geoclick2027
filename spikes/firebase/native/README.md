# Windows native sign-in proof (#313)

Isolated Tauri experiment for the Firebase-first plan #311. It never opens the
game's progress stores or reads/writes Firestore. Google authentication runs in
the system browser, with a random loopback port and authorization-code/S256 PKCE.
The resulting Google ID token is exchanged through Firebase's JavaScript SDK;
only a successful Firebase result establishes an authenticated UID.

Production game login, Android and progress synchronization remain outside this
harness. The Firebase SDK session stays in memory. An unchecked **Keep me signed
in on this Windows account** uses memory only. Opting in requests a renewable
Google grant, held natively and saved to Windows Credential Manager only after
Firebase confirms the UID. A later launch obtains and verifies a fresh identity;
it does not trust cached identity data as an authenticated session.

The downloaded Desktop client may contain Google's installed-app client secret;
keep that configuration outside Git, never use a service-account key and never
treat a distributed desktop app as a confidential OAuth client.

## Install and check

From your own worktree, install the root dependencies and then the isolated SDK:

```powershell
npm ci
npm ci --prefix spikes/firebase --workspaces=false
npm run build --prefix spikes/firebase/native
cargo test --manifest-path spikes/firebase/native/src-tauri/Cargo.toml --quiet
npm run test:ui --prefix spikes/firebase/native
```

The frontend/CLI borrow the root-installed Vite, Tauri CLI and Tauri API, as the
existing browser spike borrows root Vite. This package is deliberately outside
the root workspaces and the game's dependency/build paths. Rust has its own
manifest/lock. No emulator or cloud account is needed for the Rust tests.

## Real-provider setup (owner)

1. Reuse the dedicated Spark test project from the browser spike; no billing.
   In Google Auth Platform → Clients, create an OAuth client of type **Desktop
   app** in that same project. Download its JSON outside the checkout.
2. Configure `spikes/firebase/.env.local` as the parent README describes, with
   `VITE_FIREBASE_MODE=cloud` and that test project's public
   `VITE_FIREBASE_CONFIG`. Do not add credentials to tracked files.
3. Set the downloaded JSON's path in the terminal used to start the proof:

```powershell
$env:GEOCLICK_GOOGLE_DESKTOP_CLIENT_FILE = 'C:/path/outside/repo/desktop-client.json'
cd spikes/firebase/native
npm run native:dev
```

The proof window identifies the configured test project and rejects a Desktop
client from another project. Leave **Keep me signed in** unchecked to repeat the
original memory-only experiment. To test persistence, check it before clicking
**Open Google in system browser**, then complete account/consent yourself. Return to the
proof window. It must report Firebase accepted the credential and show a UID
with provider `google.com`. Compare that UID with the same real Google account
in the parent browser spike. A Google callback alone is not proof of a matching
Firebase account. An audience/configuration rejection is a failed native proof,
not a reason to enable billing or silently switch to a custom-token service.

For the compiled native shell:

```powershell
npm run native:build
```

It writes `src-tauri/target/release/geoclick-firebase-native-proof.exe` without
installing or replacing Geoclick. Start it from a terminal inheriting the config
path. The public Firebase web configuration is built into the local frontend;
do not publish this experimental executable as a Geoclick release.

## Checks and limits

- The browser UI test mocks native IPC and Firebase HTTP. It covers opt-in vs
  memory-only sign-in, restore/reload, late cancellation, wrong UID/project,
  network/revocation errors, failed vault writes/deletes and sign-out. No live
  cloud calls; this is separate from real provider testing.
- Rust tests cover the RFC PKCE vector, separate random secrets, callback host,
  method/path/state/duplicate rejection, provider denial, nonce/audience/expiry
  binding, a forged request followed by a valid one, one-use listener closure,
  cancellation and timeout. Claim parsing alone does not authenticate a JWT;
  Firebase must verify the credential before a UID is displayed.
- Each attempt binds only `127.0.0.1` at an OS-assigned port. The listener closes
  on completion/cancellation/timeout. Slow/oversized requests are bounded;
  callback responses are fixed, uncacheable text with no echoed code/token.
  Google endpoints are constants, not taken from downloaded JSON.
- Token exchange follows no redirects, has a timeout and returns fixed errors
  rather than credential-bearing responses. Only the Google ID token crosses
  the local Tauri IPC. Google access tokens are discarded; the optional Google
  refresh grant stays native and is stored only in the Windows vault. Firebase
  still has its own in-memory SDK credentials. No token is logged or shown.
- Test cancellation while the browser is open, denial, close/restart, repeated
  attempts, a second account and sign-out. Cancel must prevent an in-flight
  result from leaving the proof signed in. No automated Google/MFA interaction.
- Record emulator/local tests separately from actual provider/native success.
  Android and installed-game integration remain separate proof items after
  the Windows credential and protected-persistence experiments.

## Real-provider evidence (2026-11-01)

The owner completed Google sign-in in the system browser from this native Tauri
development shell, using a Desktop-app OAuth client in the same Firebase test
project as the browser spike. Firebase accepted the returned credential and
reported provider `google.com`. The owner then signed into the browser spike;
its UID was compared exactly with the native UID captured from the proof UI:
**MATCH**. No UID, email, tokens or client JSON are published in this record.

After closing and reopening the native proof, the UI was ready and signed out,
with the provider cleared, as required by this experiment's in-memory policy.
The separate Windows executable builds; the live Google check above was on the
development shell, not a release installer. Real-provider cancellation/second
account/sign-out checks, protected native persistence, Android and game progress
sync remain pending. Automated UI tests cover cancellation/sign-out separately.

The first real Windows startup reproduced a Vite `EBUSY` watcher error against
the Rust executable. The native Vite server now excludes `src-tauri`; the parent
browser demo excludes the `native` subtree. Tauri watches its Rust sources
separately, and both live local servers started successfully after the fix.

Primary references: [Google desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app),
[Firebase Google credentials](https://firebase.google.com/docs/auth/web/google-signin).
The approved policy/design lives in #313; release ordering/acceptance in #311.


## Protected Windows session storage

`src-tauri/src/vault.rs` uses Windows generic credentials through `CredWriteW`,
`CredReadW` and `CredDeleteW`, with a current-user/local-machine persistence
scope. Its target is `Geoclick/FirebaseProof/v1/<project>/<client-id-sha256>`;
it never enumerates or touches other apps' credentials. At-rest protection is
provided by Windows for this Windows account; this is not protection against
malicious code already running as that same account. Unsupported/unavailable
storage has no plaintext fallback.

`session.rs` stages the native grant in memory, waits for Firebase confirmation,
and binds the saved record to the project, Desktop client, verified Firebase
UID and Google subject. Google refresh grants never enter the WebView or
browser local/session storage. The SDK's Firebase credentials remain in memory.
Saved schema/configuration and returned identities are checked on restore;
expired/revoked grants require sign-in again, while network failures retain the
saved record for retry. A failed native delete is shown explicitly.

Generations invalidate cancelled/forgotten attempts and prevent late callbacks
from saving a session or clearing a newer account. Only one proof instance runs
at a time. Sign out removes this proof's saved grant and the in-memory Firebase
session, without revoking the account's other browser/device grants.

Automated tests include real Windows vault roundtrip/overwrite/deletion using
unique disposable entries, oversize rejection, saved-record validation,
confirmation/commit/cancel races, interrupted staging and failure reporting.
They do not use the actual account's saved credential.

### Live protected-session evidence (2026-11-01)

- The owner first signed in with Keep unchecked. The proof correctly reported
  session-only mode; nothing was saved by that sign-in.
- The owner then explicitly selected Keep before the real Google flow. Firebase
  verified the account and the proof confirmed Windows vault storage.
- Closing and reopening the native development shell refreshed the native Google
  grant, obtained a new verified Firebase session without a Google popup, and
  restored exactly the same UID. No token or UID is published here.
- The owner clicked Sign out and forget this device. The proof confirmed removal;
  a further fresh process was ready and signed out, without restoring a session.

The compiled standalone executable also started ready and signed out with no
saved grant. Launching it twice left exactly one proof process; the second
launch exited successfully. Both proof windows/preview servers were closed
after testing.

The real Google lifecycle above used the development shell. These results do
not claim a Windows reboot or release-installer test. Offline/revoked-grant, write/delete failures and late
cancellation are exercised by automated tests; those failures were not induced
against the real account. Android and production progress integration remain
pending. Sign-in in the eventual game remains optional: guest/offline play and
existing local learning progress require no account.
