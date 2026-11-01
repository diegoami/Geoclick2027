# Windows native sign-in proof (#313)

Isolated Tauri experiment for the Firebase-first plan #311. It never opens the
game's progress stores or reads/writes Firestore. Google authentication runs in
the system browser, with a random loopback port and authorization-code/S256 PKCE.
The resulting Google ID token is exchanged through Firebase's JavaScript SDK;
only a successful Firebase result establishes an authenticated UID.

This is not production login, Android integration, durable account storage or
progress synchronization. It deliberately uses in-memory Firebase persistence.
Closing/reopening starts signed out; secure native persistence remains a later
proof item. The downloaded Desktop client may contain Google's installed-app
client secret; keep the configuration outside Git, never use a service-account
key and never treat a distributed desktop app as a confidential OAuth client.

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

The proof window identifies the configured test project. Click **Open Google in
system browser**, then complete the account/consent flow yourself. Return to the
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

- The browser UI test mocks native IPC and Firebase HTTP responses; it checks denial, cancellation before/during exchange, UID/provider display, sign-out and reload without real cloud calls. It does not prove native or Google sign-in.
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
  the local Tauri IPC; Google access/refresh tokens are discarded. No token is
  written to logs or shown in the UI.
- Test cancellation while the browser is open, denial, close/restart, repeated
  attempts, a second account and sign-out. Cancel must prevent an in-flight
  result from leaving the proof signed in. No automated Google/MFA interaction.
- Record emulator/local tests separately from actual provider/native success.
  Android, protected native persistence and installed-game integration remain
  separate proof items after the initial Windows credential exchange.

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
