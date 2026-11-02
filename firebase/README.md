# Game progress rules and emulator checks

The production path is `/users/{uid}/progressEventsV1/{id}`. These rules do not
include the old synthetic Firebase spike. The journal/transport wire contract,
limits and remaining integration work are in [PROGRESS_JOURNAL](../docs/PROGRESS_JOURNAL.md#immutable-cloud-delivery).

After the root `npm ci` and with Java 21 on PATH, run from the repository root:

```powershell
npm run test:firebase
```

This starts Auth (19110) and Firestore (18110) on 127.0.0.1 for the fixed
`demo-geoclick-sync` project, runs server rules/SDK tests and one real Chromium
IndexedDB-to-SDK integration test, then stops its emulators. The runner rejects
other emulator hosts before making requests. It reads no real Firebase env,
Google client JSON or sign-in credentials, and publishes no rules. Install
Chromium once with `npx playwright install chromium` if absent. Emulator logs are
ignored. Do not run alongside another test using browser port 5191.

Ordinary `npm run gates -- --quiet` runs the deterministic sync tests without
starting emulators; the emulator-only browser test is explicitly skipped there.
Google-provider identities in this suite are synthetic Auth Emulator tokens.
Real Google, cloud access boundaries, installed/native sync and two browser
profiles are separate acceptance checks before #311 is complete.

The game account controls are not connected in this change. Guest/offline play
continues using its existing stores. No deployment is part of this suite.
