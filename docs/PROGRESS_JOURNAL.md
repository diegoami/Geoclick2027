# Account progress journal (#313)

This is the production event/storage foundation for optional account sync. It
has no auth, network or Svelte dependency. The existing guest repositories and
tutorial sandbox are unchanged; account UI, quiz operation capture, cloud
transport/rules and native SQLite journal adapters are separate integration work.

## Boundaries

`app/src/lib/progressEvents.ts` validates versioned operations, builds their
causal graph and projects one map through the existing scheduler/mix-up helpers.
`indexedDbProgressJournal.ts` implements browser durability and a pending-upload
queue. A journal copies/freezes its project/UID at construction. Switching
accounts creates another journal; an old asynchronous call cannot become a
write to the new account. Guest data is never read, imported or deleted here.

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
an already accepted imported score. Import normalization/preview and preservation
of the original guest copy belong to the integration adapter.

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

This module does not yet switch the game's repository factory. Quiz integration
must capture grade operations and stable logical action keys instead of trying
to reverse-engineer grades from saved snapshots. First sign-in must show the
approved import choice. Native adapters must provide the same atomic append and
owner boundaries. Firestore delivery, error/status UI and the full cross-device
acceptance matrix remain under #311/#313. Login stays optional; normal local
play and existing guest progress require no account or backend availability.

Tests: `progressEvents.test.ts` exercises order permutations, concurrent reset/
practice, exact existing fading/score contracts and import conflicts;
`indexedDbProgressJournal.browser.test.ts` uses real Chromium IndexedDB for
reopen, retries, concurrent writers, aborted transactions, owner isolation,
quarantine and acknowledgement behavior.
