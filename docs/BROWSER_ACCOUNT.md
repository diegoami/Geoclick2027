# Optional browser account (#311 / #313)

Browser controls are implemented; Windows/Android remain on guest repositories
until their native adapters land. Guest play always works without account setup.
No version bump, release, web deployment or rule publication is part of this PR.

## Local setup and console prerequisite

1. The owner publishes the merged `firebase/firestore.rules` in project
   `geoclick2027`: Firebase Console → Build → Firestore Database → Rules,
   paste the complete file and Publish. It contains the game event paths and
   deliberately excludes old synthetic spike paths. Agent tests never publish.
2. Google sign-in must be enabled in Authentication and `localhost` authorized
   for local development (already used by the earlier browser spike).
3. Put the public `VITE_FIREBASE_CONFIG={...}` JSON in ignored `app/.env.local`,
   with apiKey, authDomain, projectId and appId. Reuse the spike's public config;
   no desktop OAuth client JSON, private key or native token belongs there.
   No config means no account controls. Native shells ignore this browser flow.
4. From the implementing worktree, run `npm run dev` and open
   `http://localhost:5187`. Click the labeled **Account** button in the home or map toolbar. Google account
   selection/consent is performed by the owner, not automated.

The standalone spike config's `VITE_FIREBASE_MODE` is unnecessary here. Public
config is bundled for browser use; it provides no authorization. Owner-scoped
rules and Google Auth provide the cloud boundary. Ordinary tests suppress runtime
initialization even when a real local config is present.

## Local tests

`npm run test:unit --workspace=app -- --run src/lib/browserAccountSession.browser.test.ts src/lib/AccountControls.svelte.test.ts --reporter=dot`

With Java 21 on PATH, `npm run test:firebase` runs the server rules/SDK suite,
real Chromium journal-to-cloud transport and account Auth-observer/import/logout
checks. These use fixed local demo emulators and synthetic provider identities.
They are separate from live Google/cloud evidence. The ordinary four gates remain
required and do not start emulators.

## Owner live checks (pending)

- Start without signing in, answer a question and reopen. Guest progress remains.
- Sign in with Remember unchecked. Account progress is separate; review guest
  additions/conflicts and decline once. Guest data remains. Preview again and
  confirm; only eligible data is added. Existing account history/resets win.
- In a second browser profile, sign into the same Google account, then use
  Sync now on both. Earned cards/results/best times/mix-ups converge. Unfinished
  rounds and appearance/favorites stay local.
- Make offline account attempts, close/reopen, sign into the same UID again and
  reconnect/Sync now. With Remember checked, local account restoration is also
  available offline; unchecked reload starts as guest. A stale offline device
  returning after a reset cannot undo it. Later practice observing it can earn.
- Sign out during a quiz, or cancel a pending popup. Guest view returns; old
  callbacks cannot write/upload to another UID. Switching Google accounts
  exposes neither old account progress nor its import preview. Sign-out forgets
  remembered identity; each account's local queue remains separate.
- Check EN/DE/IT, keyboard/Escape, touch and 50–300% text in all schemes. Retry
  denied network/storage/rules without losing guest/account data. Live denied
  anonymous/other-account reads and the full #311 matrix remain release checks.

No live Google, two-profile, native or production-cloud success is claimed by the
automated suite. Record actual owner results in plan #311 before completion.

## Initial read cost

There is no idle full-history polling. A sync reads the account's event history
again (N records, pages of 100) and writes at most 100 pending events. Local
commits debounce with a 30-second cooldown; opening account settings, Sync now
and reconnect/foreground also check the server. For example, an account with
300 events and ten explicit cycles reads about 3,000 event documents, plus
empty-query minimum charges, before concurrent additions/retries. Immutable
write retries also consume writes. This is a cost model, not a measured live
quota claim. The emulator suite exercises maximum bounded wire records; production
quota usage and larger histories remain acceptance work. Quota errors keep the
local journal and show a retry state. The 10,000-record stop remains explicit;
an incremental read/compaction design must be proved before expanding it.


The owner passed the first real Google sign-in and initial sync after replacing
outdated deployed rules with the merged game rules. This verifies live identity
and the initial account read, not yet cross-profile learning/import or native
sharing. The normal account control is a labeled toolbar button with its own
modal, outside Appearance and outside the map Settings disclosure. Runtime
Firestore URL diagnostics are silenced; app diagnostics expose only whitelisted
error codes, without account paths, tokens or public config values.
