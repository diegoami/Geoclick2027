# Account progress journal (#313)

This is the production event/storage foundation for optional account sync. Its reducer and local storage
have no auth, network or Svelte dependency. The existing guest repositories and
tutorial sandbox are unchanged; native SQLite journal adapters are implemented. Native authentication/lifecycle
wiring and installed-device checks remain separate integration work. Browser
account UI and lifetimes are implemented; the initial live import/sharing and
guest-copy round has passed. Cloud transport/rules are implemented below but are
activated only by the explicitly configured browser account control. Quiz capture and its account adapter are implemented
without switching the default guest repository factory.

## Boundaries

`app/src/lib/progressEvents.ts` validates versioned operations, builds their
causal graph and projects one map through the existing scheduler/mix-up helpers.
`indexedDbProgressJournal.ts` implements browser durability and a pending-upload
queue. A journal copies/freezes its project/UID at construction. Switching
accounts creates another journal; an old asynchronous call cannot become a
write to the new account. The journal itself never reads or deletes guest data. The explicit import adapter
below receives a read-only guest repository.

Every immutable event has an ID, project/UID, device ID, device sequence,
Lamport time, causal parent frontier, caller operation key and typed operation.
The caller must reuse the same operation key for retries of one logical action
(for example a round/target answer) and use a new key for new practice. Reusing
a key with changed meaning is an error. Event identity is retained on upload
retry; remote receipt alone never acknowledges a local pending event.

## Merge and reset semantics

Input order and repeated delivery do not change the projection. Parents precede
children and actor sequences must continue their causal history. Concurrent
operations have a stable logical-time/device/sequence/ID order; dates do not
choose a winning snapshot. Answers retain their original scheduler date and
replay the actual grade/fading function. Round results update logical last score,
slipped count, minimum clean best time and learned mix-up removal.

A reset defeats any applicable operation that had not observed it. This includes
practice that was concurrent/offline and arrives afterward. Practice that sees
all relevant reset barriers can earn levels again. Concurrent resets retain
both barriers. Known reset clears cards/map learning records but retains the
last completed score; map clear removes the score too; account clear affects
all maps. A reset on another map does not clear this map.

Legacy import is an explicit baseline, not fake practice. Account history wins
preexisting/concurrent target conflicts. A reset is not an empty account.
Causally later practice may build on an accepted baseline. Map summary/records
follow the same conservative overlap policy; a later Known reset still retains
an already accepted imported score. The explicit import adapter normalizes legacy earned levels and previews
conflicts while preserving the original guest copy.

Malformed/unsupported records are quarantined, conflicting IDs/operation keys
or actor sequences cannot silently overwrite one another, and missing ancestors
are deferred until present. Unknown targets are not applied. The browser store
preserves bounded unsupported own-account JSON for future migration and never
stores foreign/unowned payloads in that account's quarantine.

## Durability

One IndexedDB transaction commits installation metadata and the event append.
Only then does append resolve successfully. The event is authoritative; a cache
or projection may be rebuilt after interruption. Simultaneous writers serialize
and retries return the committed event rather than allocating another attempt.
Failed/denied/closed storage is reported; there is no memory/guest fallback that
pretends an account write was saved.

Acknowledgement takes exact immutable envelopes, validates owner and contents,
and commits atomically. A stale account-A callback cannot acknowledge account-B
records. The transport must separately require current authenticated UID/project
to match the journal and publish owner-isolated rules; this storage boundary is
not a substitute for server authorization.

## Initial limits and follow-ups

The schema bounds IDs, numeric fields, dates (1970 through 9998) and 128 causal
parents per operation. Too many concurrent branches fails explicitly rather than
dropping reset knowledge. There is no history pruning/compaction: add it only
with a proved causal/reset retention policy. The initial browser implementation
reads the owner's history to derive the frontier on writes; incremental caches
can optimize this without changing the authoritative journal contract.

Quiz capture does not itself switch the game's repository factory; the optional
browser account bridge does so after sign-in. QuizView captures
grade operations and stable sitting/target identities through an optional account
writer, instead of reverse-engineering grades from saved snapshots. First sign-in
must show the approved import choice. Native adapters must provide the same atomic append and
owner boundaries. Game auth/sync lifecycle, error/status UI and the full cross-device
acceptance matrix remain under #311/#313. Login stays optional; normal local
play and existing guest progress require no account or backend availability.

Tests: `progressEvents.test.ts` exercises order permutations, concurrent reset/
practice, exact existing fading/score contracts and import conflicts;
`indexedDbProgressJournal.browser.test.ts` uses real Chromium IndexedDB for
reopen, retries, concurrent writers, aborted transactions, owner isolation,
quarantine and acknowledgement behavior.


## Explicit guest import adapter

`guestProgressImport.ts` prepares a preview from selected supported maps and a
read-only guest repository. Preparing or declining writes nothing. The UI must
first obtain the synchronized account history; this adapter cannot establish
cloud freshness or authorize transport. Quarantined/incomplete local account
history blocks import rather than treating unknown history as empty.

Only `confirm` of that importer's original preview can append the reviewed data.
The preview and private operation payloads are copied; later guest/catalog edits
cannot alter them. A callback checks the current project/UID before and after
awaited reads and between writes. Sign-out/account change stops the batch. An
already in-flight append may finish only in the original bound journal; it
cannot turn into a write to the newly active account.

Existing account targets/map records and reset barriers win. Confirmation checks
again for activity since preview; a reset racing the append still wins in the
reducer. Returned counts describe the final local projection, not a promise that
no offline remote activity can arrive later. The future UI must explain that
account progress wins conflicts and display skipped/unsupported items.

Legacy levels above three normalize to Known; missing old levels read as zero.
Other malformed values, duplicate/unknown target IDs and records referencing
unknown targets are skipped as unsupported. The original guest copy is never
rewritten or removed, including after success or an interrupted batch.

Each baseline has a deterministic SHA-256 operation key derived from its
validated contents. Each append is independently durable; the whole import is
not one transaction. If interrupted, retrying the same preview reuses committed
operations; preparing again leaves already-imported targets with the account.
No cleanup or fake rollback removes a baseline that committed before failure.
The browser tests cover interruption/retry, concurrent confirmations, account
switches during reads/writes, reset races and preservation of guest data.


## Quiz capture and account repository

`accountProgressRepository.ts` implements the repository's read/reset contract
against a bound journal. Replacement card/summary/record snapshots are rejected:
account writes must go through the per-map `quizOperations` capability. Commands
are copied before queuing and serialized, so a rapid final answer is committed
before its completed-round event. A failed command is reported to its caller;
subsequent commands may still attempt durable writes. No in-memory queue is
presented as durable storage and no failed append is acknowledged.

QuizView emits actual grades/dates, stable round/target answer keys, optional
chosen-target mix-ups and one completed-round operation with score, slipped
count and eligible elapsed time. Guest repositories continue receiving their
existing snapshots. Account-operation failures display the existing localized
storage warning. The authoritative projection uses the existing scheduler and
best-time/confusion rules; the view's immediate feedback remains optimistic.

A sitting has a random memory-only identity retained on trips to the Overview.
Its repository namespace must match before resuming; guest/account changes or a
different project/UID start a fresh sitting. Late timed-round cleanup can only
update that same sitting. This does not persist unfinished rounds across reload.
The tutorial delegates capabilities/namespaces per map to its captured sandbox,
so tutorial answers never become account events. If an opened account cannot
read, `loadPlayableCardStates` keeps that account destination and the warning;
it never substitutes a guest destination. Guest read failure still uses memory.

The factory defaults to guest stores. Configured browser sign-in can now bind
an account and remount views through the optional account bridge. Native auth/host wiring and full release verification remain required. Tests cover the real component-to-
IndexedDB path and reopen, queue order, idempotent retries, account isolation,
reset score retention, rejected snapshots/unknown targets and tutorial routing.


## Immutable cloud delivery

`progressSync.ts` runs explicit, serialized sync cycles against a journal and a
transport bound to one project/UID. It downloads server pages before publishing
pending events, commits incoming data locally, then checks the complete causal
graph. Unsupported/conflicting/incomplete history fails visibly instead of being
treated as an empty account for import. A successful cycle supplies the future
account UI with a server-history check; this is not a snapshot transaction with
other devices. Concurrent remote activity may arrive on the next cycle, and the
reducer's account-wins/reset-wins policies still apply.

`firestoreProgressTransport.ts` uses **Firestore Lite** with Firebase Auth from the
same app. It has no persistent cloud cache, listener or SDK-owned offline write
queue. Local writes never await sync. Each upload uses the original event ID;
server rules allow create or an exactly equal retry, never replacement/deletion.
Only a successful server write followed by an exact local acknowledgement clears
pending status. A crash or storage failure between those steps leaves the event
pending and safely retryable. Network/quota/permission errors leave local data
intact. The controller reports `error`; it never calls that state synced.

Reads use `/users/{uid}/progressEventsV1/{id}`, ordered by document ID, at most 100
records per query and 10,000 per cycle. Uploads stop after 100 pending events;
`pending` means another cycle is needed. Every cycle rescans from the beginning:
random event IDs are not a chronological change cursor. A concurrent insert
behind a page cursor is recovered by a subsequent cycle. There is no pruning,
compaction or incremental cursor yet; representative read/write usage and larger
histories must be measured before rollout. A history beyond the current bound
fails with `history-limit`, rather than declaring a partial account ready.

The 2026-11-03 boundary regression uses 10,000 distinct causal events and the
real Chromium IndexedDB journal with a simulated transport. Exactly 10,000
remote events synchronize through 101 pages (the last is empty). A subsequent
local upload can take cloud history to 10,001; the next cycle then fails with
`history-limit`. A later local mistake remains pending with its projection
unchanged after close/reopen. This is a final-release limitation tracked in
[#332](https://github.com/diegoami/Geoclick2027/issues/332), not a completed scale
gate. Quota failure partway through upload separately proves that only successful,
exactly acknowledged events leave the queue; the remaining suffix resumes after
reopening without double grading.

Run `node --import tsx firebase/measure-history.ts` for a credential-free synthetic
wire/query budget using the production encoder and UUID-sized answer envelopes:

| Events | Queries/full scan | Minimum document reads/full scan | Encoded JSON bytes |
| --- | --- | --- | --- |
| 100 | 2 | 101 | 48,448 |
| 1,000 | 11 | 1,001 | 486,750 |
| 10,000 | 101 | 10,001 | 4,887,752 |

The query budget includes the empty terminal query; it excludes dependent-rule
reads and concurrent changes. JSON size is not Firestore storage or measured
network transfer. These are synthetic measurements and query-shape estimates,
not emulator billing or production-usage observations. No cloud requests are
made. Firebase's documented [free quota](https://firebase.google.com/docs/firestore/quotas)
is 50,000 document reads/day per project, and [empty queries cost at least one
read](https://firebase.google.com/docs/firestore/pricing#minimum-charge-for-queries).
Five 10,000-event scans exceed that read allowance even without other usage.
Automatic retrying of a deterministic history limit also needs bounding under
#332. Incremental delivery or compaction needs its own agreed design preserving
causality/reset barriers, crash recovery, account ownership and legacy migration;
raising the cap alone does not settle read cost.

Wire version 1 retains all envelope fields, with two canonical representations
that let Firestore rules validate every bounded element within their evaluation
budget: parents are a comma-separated string of at most 128 token IDs (empty
string for no parents); each imported confusion is a tab-separated target ID,
chosen ID and decimal count, with at most 20 entries separated by newlines
in one bounded string (empty string for an empty list). Valid target IDs
cannot contain tabs/control characters. Encoding/decoding is confined to the
transport; the local journal/reducer retain their typed arrays/maps. Document ID
substitution and malformed wire entries are rejected/quarantined locally.

`firebase/firestore.rules` denies unauthenticated users, Firebase anonymous users,
other UIDs, foreign project envelopes, unbounded queries and unrelated paths.
Google identity is required. Closed operation shapes, nested bounds and maximum
frontiers are enforced on creation. Full calendar, causal and catalog semantics
are still checked by the client parser/graph: authorization does not replace
replay validation. These rules are **not published** by the test or the app.
The existing synthetic spike paths are deliberately absent from production rules;
its synthetic data must never be imported as game progress.

The caller must stop the controller on sign-out/account change, discard it and
create a new bound lifetime after sign-in (including the same UID). Auth user
identity is also checked around every SDK call. `stop()` is irreversible and
prevents subsequent pages, uploads or acknowledgements. An already issued SDK
request cannot be cancelled: it may finish against the original fixed path, but
cannot become a write/acknowledgement for a different account. The future UI must
capture the same repository scope and remount views across identity changes.

Tests: `progressSync.browser.test.ts` uses real IndexedDB with an injectable
network for offline/reopen, exact retry, reset convergence, pagination, bounded
batches, malformed histories and account-switch/cancellation races.
`npm run test:firebase` needs Java 21 and runs only a fixed demo project on
loopback emulators. It tests real Auth/Firestore SDK calls and rules, followed by
`firestoreProgressTransport.browser.test.ts`: two synthetic Google clients,
real Chromium IndexedDB, offline append/reopen, stale reset, later practice and
guest-copy preservation through the actual transport. This is **local emulator
evidence**, not real Google, production cloud, installed Windows or Android
sharing. The four ordinary gates do not start emulators; their browser suite
skips those explicitly opt-in integration tests.

The game starts as a guest. Configured browser controls now connect localized
status/import UI, auth lifetimes and sync scheduling/backoff; native SQLite/auth
integration and the full #311 acceptance matrix follow.
No account, cloud availability or network is required for existing local play.


## Optional browser account lifetime

`browserAccountSession.ts` binds a separate repository only after an owner-matched
local journal opens successfully. Cloud failure does not remove locally saved
account progress or block play. Storage failure retains guest play with an
explicit warning. Sign-out detaches the view immediately, stops sync and forgets
SDK login; if forgetting fails, the UI retains a retryable sign-out warning.
Late popup completions after explicit sign-out cannot reactivate the account.
Old captured quiz callbacks can finish only in their original journal, which is
not closed underneath them. Existing guest data is never automatically imported.

`account.svelte.ts` is browser-only, gated by a valid `VITE_FIREBASE_CONFIG` JSON
and shell detection. Ordinary tests skip runtime initialization even if a local
public config is present. SDK imports initialize no default project. Browser
Auth uses the named game app and can restore a previously explicit remembered
choice. Every new login sets the selected persistence: memory when unchecked,
IndexedDB when checked. Google account selection is always explicit. Native
shells never launch this popup; their proved native adapters must be integrated
separately. No tokens are logged or copied into game storage.

The layout keys its child view by account ownership revision, not sync status;
quizzes are not remounted by ordinary background synchronization. Home and Known
refresh their earned progress when a completed sync/import is published. Quiz
feedback stays local during a sitting; replayed journal history remains the
authority for future reads. Import preview and confirmation each require a
successful server-history cycle. Incoming concurrent changes still follow the
account-wins/reset-wins reducer, and guest originals survive partial retries.

Automatic cycles run after local commits (debounced with a 30-second cooldown),
on foreground/online events and when opening the account dialog. There is no idle
full-history polling. Failures
back off up to five minutes; **Sync now** forces an immediate retry. Hidden/offline
pages do not issue scheduled requests. Pending events remain authoritative in
IndexedDB; a tab must remain open to upload. With session-only sign-in, reopening
offline starts as guest until the same account signs in again. Remembered login
can reopen its local account journal offline. The initial full-history read limit
and quota/scale follow-up above still apply; no deployment is performed here.

See [BROWSER_ACCOUNT](BROWSER_ACCOUNT.md) for console/config and manual checks.
`browserAccountSession.browser.test.ts` covers real IndexedDB/factory lifecycle
and hostile timing; `AccountControls.svelte.test.ts` checks EN/DE/IT, explicit
confirmation, keyboard behavior and 300% wrapping. The emulator-only suite also
uses the real Auth observer through this session, game factory, import and logout.


Account controls have a dedicated, labeled toolbar button on home, map and
auxiliary pages. They open `AccountDialog.svelte`, independently of Appearance
or the map Settings disclosure. The native dialog contains keyboard focus,
stops quiz/navigation key propagation, returns focus to its opener and closes
on Escape, its close button or Android Back. The owner requested this placement
after the first live sign-in/sync check because the Appearance location hid it.
`AccountDialog.svelte.test.ts` protects direct discoverability with Settings
collapsed, modal focus/Escape behavior and the labeled 44px target at large text.


`firebase/browser-profiles.test.mjs` adds three acceptance scenarios with two
independent Chromium profile directories/processes, the real production browser
factory and repository boundary, and loopback Auth/Firestore emulators. It checks
guest/account import conflicts and originals, SRS fading, scores/best times/mix-ups,
remembered offline-backend process restart, stale-reset convergence, session-only
restart and account-switch queue/preview isolation. The fixture calls the actual
session sign-in intent; only provider credentials are synthetic. It does not load
real env/config or automate Google authentication. Non-loopback application
requests fail the suite. App assets remain locally served during backend outage;
full production-site asset caching is not established by these tests.


## Native SQLite journal

`sqliteProgressJournal.ts` implements the same journal/sync contract using one
versioned, owner-scoped row in `account_progress_journal_v1`. Migration 4 adds
only that table in both the Tauri and Capacitor migration lists; existing guest
cards, summaries and map records are untouched. Neither migration nor opening
an account automatically imports guest data. The established explicit importer
works with the native journal and original native guest repository.

The row stores typed immutable event history, per-ID variants, the writer actor,
local/acknowledged markers and bounded own-account quarantine. Replay/projection
and pending-upload eligibility derive from this committed history. There is no
separate state/outbox write. Each mutation reads a revision/payload, computes the
change, then performs one bound SQL INSERT or conditional UPDATE. Revision AND
payload must still match; a concurrent winner causes re-read/recompute (up to
32 attempts), never overwrite. This works through Tauri's pool without issuing
BEGIN/COMMIT on separate connections. A batch acknowledgement also commits as
one row, or not at all. A failed/lost success response is safely retried by the
original operation key and immutable envelope.

Owner/project and inputs are copied before asynchronous work. Both native
factories capture owner before opening the existing migrated guest database,
reuse that app-owned pool/connection and require an explicit opaque host writer
actor ID. Closing a journal handle never closes the shared database or erases
other account/guest data. An already issued commit may finish only in the
original namespace. Unsupported/corrupt/foreign local payloads fail visibly
without being replaced by an empty journal; foreign remote data is not retained.
Android query error envelopes and non-0/1 affected-row results are failures,
not evidence of an empty account or an ordinary CAS retry.

The host actor must be installation-scoped native metadata, not an ID copied
blindly from a restored database, a Google UID or a shared OAuth client ID.
Native integration must keep it outside copied/restoreable journal data (for
example protected Windows metadata or Android no-backup storage) and rotate it
when restoring data onto another installation. Historical actors/events stay
immutable; the next event under a new actor starts its sequence at one and
observes the retained frontier. The factories require this argument so later
integration cannot silently reuse a database's actor on another device.

Both browser and native append paths now check the current actor's recorded
sequence against its replayable graph clock. Reproduced conflicting-actor
history previously allowed another event to commit even though it could not be
replayed. Such writes now reject with `actor-history-unavailable`; their input
is not falsely reported as saved and existing data is retained for diagnosis.
Other actors' unsupported/conflicting data still follows the common graph/
quarantine rules, and unknown parents remain deferred.

Initial native limits: one owner payload is at most 16 Mi UTF-16 code units;
exceeding it fails without overwriting the previous commit. Each mutation
currently reads/serializes the full owner row and replay still reads history.
There is no pruning or unproved compaction. The cloud's bounded-read/quota and
large-history acceptance work above remains required before #311 completion.
This limit is not a throughput or power-loss claim beyond the SQL engine's
normal committed-statement semantics.

Tests use real Node SQLite, including file close/reopen and competing connections,
response loss before acknowledgement, exact atomic ack, migration from populated
v3 guest tables, account/SQL binding isolation, unsupported local data, deferred/
conflicting remote events, changed host actor, handle-close races and reset-wins
sync. Adapter tests exercise the actual guest repositories and import code against
SQLite while mocking only Tauri/Capacitor bridge entry points. They verify migrated
connection reuse and Android result envelopes; they do not claim an installed
Windows or Android IPC/device result.

The browser bridge still skips native shells. Before enabling native account
controls, integrate the proved system-browser/native Google adapters, secure
remember/forget and host actor storage, then verify installed app restart and
same-UID sharing. Remembered offline startup must reopen the correct local
account while cloud transport remains guarded by fresh authenticated ownership;
the auth-only spikes alone do not establish that complete progress lifecycle.
Guest play remains optional/account-free throughout.


## Windows account runtime

`windowsFirebaseAccount.ts` connects the game controller to the native
`windows_account` Rust module, memory-only Firebase Auth and native SQLite journal.
`windowsAccountGateway.ts` keeps protected local identity separate from permission
to use cloud transport. A cached native UID/label can reopen the same account's
local journal offline; every cloud call waits for Firebase to verify that UID in
the configured project. A mismatched/restored/revoked UID is never published or
uploaded under the previous owner. Same-UID refresh does not remount a quiz.

Rust reuses the proved loopback PKCE/state/nonce/issuer/audience/expiry validation,
with a separate production app/project/client credential scope. Renewable Google
grants stay native and are saved only after Firebase confirmation and explicit
Remember. Firebase credentials stay in WebView memory. Actor metadata uses an
app/project-scoped protected native entry, separate from sign-in/forget; an
unavailable actor store uses a fresh process actor, never a copied database actor
or plaintext credential fallback. Non-Windows native shells remain guest-only
until their separate adapter is connected.

Each async OAuth operation is preceded by a synchronous request registration.
Cancellation/finalization are bound to that request; a delayed old command cannot
open Google again or cancel a newer operation. SDK exchanges and cleanup serialize,
so a cancelled exchange cannot clear another account that signed in later. Cloud
transport blocks immediately during sign-out; native forget finishes before a
new login is offered. A failed forget remains retryable and is not called forgotten.
Cancel is explicit in the shared account UI; the Remember choice resets after
completed sign-out and unavailable protected storage disables that option.

Downloaded Desktop OAuth JSON stays outside the repository. The build script
writes only its path into generated Rust include source and never prints its
contents. Installed-app OAuth client metadata is embedded at build time; it is
not a confidential web-client/service-account secret. No configuration means
account controls stay unavailable while guest play remains. The public Firebase
project and native Desktop client's project must match before native controls open.

Use `npm run dev:windows-account -- --client-file <external JSON> --firebase-env-file
<external .env.local>` for the isolated interactive test app. It uses its own app
identifier and therefore separate SQLite, WebView profile, credential/actor scope
from the production game. See `docs/WINDOWS_ACCOUNT.md`. Unit/emulator tests do not
automate Google account selection; real native Google/device checks are labelled
separately in plan #311.
