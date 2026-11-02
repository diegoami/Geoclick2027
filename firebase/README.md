# Game progress rules and emulator checks

The production path is `/users/{uid}/progressEventsV1/{id}`. These rules do not
include the old synthetic Firebase spike. The journal/transport wire contract,
limits and remaining integration work are in [PROGRESS_JOURNAL](../docs/PROGRESS_JOURNAL.md#immutable-cloud-delivery).

After the root `npm ci` and with Java 21 on PATH, run from the repository root:

```powershell
npm run test:firebase
```

This starts Auth (19110) and Firestore (18110) on 127.0.0.1 for the fixed
`demo-geoclick-sync` project, runs server rules/SDK tests, two real Chromium IndexedDB-to-SDK checks and
three separate persistent-browser-profile scenarios, then stops its emulators. The runner rejects
other emulator hosts before making requests. It reads no real Firebase env,
Google client JSON or sign-in credentials, and publishes no rules. Install
Chromium once with `npx playwright install chromium` if absent. Emulator logs are
ignored. Do not run alongside another test using browser port 5191.

Ordinary `npm run gates -- --quiet` runs the deterministic sync tests without
starting emulators; the emulator-only browser tests are explicitly skipped there.
Google-provider identities in this suite are synthetic Auth Emulator tokens.
Real Google/two-profile learning, production cloud access boundaries and
installed/native sync remain separate acceptance checks before #311 is complete.

The game has optional browser account controls; native integration remains
pending. Guest/offline play continues using its existing stores. No deployment
is part of this suite.


## Independent persistent profiles

`browser-profiles.test.mjs` starts a test-only Vite server on an ephemeral loopback
port, with env/config loading disabled, explicit HTML dependency-scan entry,
no public directory and no filesystem watcher. It launches two separate Chromium
processes with newly created profile directories. The fixture imports the real
browser factory, controller, journal, game repository and import/replay code.
Only provider entry is synthetic: the session sign-in action obtains an Auth
Emulator Google credential and explicitly selects the requested SDK persistence.
No real Google picker or credentials are automated. Application requests to
non-loopback origins are aborted and cause the suite to fail.

The three scenarios verify:

- Separate guest originals, explicit preview/decline/confirmation, account-wins
  card/map conflicts, real SRS fading, clean best times, scores and learned
  confusion removal followed by a new mix-up; both profiles converge without
  double grading on repeated sync.
- Remembered sign-in and pending mistakes survive closing/restarting the browser
  process while Auth/Firestore requests are blocked. The other profile resets;
  reconnect discards stale practice, and new practice observing the reset earns.
- Session-only login is absent after browser restart while the guest copy and
  account journal survive. Signing into another UID cannot see/upload the old
  queue or retain its preview; returning to the original UID resumes it once.
  Remembered login restores, and explicit sign-out is still forgotten after restart.

The backend outage leaves the test app's loopback assets available; it is not a
claim that the production website can cold-load all game assets without a network.
The browser fixtures are outside game routes/build output. All browser processes
are closed, and cleanup verifies the resolved temporary root before recursively
removing only the directories this suite created. Owner profiles are never used.
