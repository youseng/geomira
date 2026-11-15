# ADR-0067: Transactional local revisions, recovery and honest save state

Status: authorized by release prompt 02; implementation acceptance requires verification.
Supersedes the two-slot host policy in ADR-0012 decision 16, ADR-0013 decision 8,
ADR-0028 decision 22 and ADR-0030 decision 10. The old pure slot helpers remain compatible
for existing consumers; the public host uses the revision interface below.

## Context

Base: a81917cd862c9c9083e8fa85a6ca44c4cf01bc5b (main including merged PR #38).
The old host silently catches localStorage failures, then acknowledges the save anyway.
Two tabs loaded from A overwrite each other's A+B and A+C without a backup. A storage
listener cannot fix simultaneous writers that both read A before either writes.

## Decision

- Use native IndexedDB, with one recovery record in one object store. Every save reads,
  compares and writes inside a single readwrite transaction. IndexedDB serializes these
  transactions across connections/tabs; success means transaction `complete`, never request
  `success`. Aborts, quota errors, blocked opens and unavailable APIs do not acknowledge edits.
- Give each document, editing session and revision a separate host-generated UUID. Store
  canonical language text, parent/base revision, source, timestamp and restored-from identity.
  The pure editor policy compares the request's base with the document's latest revision
  inside the transaction. A stale writer adds its version and protects both conflicting
  versions. Delayed/missing notifications and suspended tabs do not change this guarantee.
  Notifications refresh the recovery list and conflict notice; they never advance a tab's
  editing base or replace its in-memory figure. This is recovery, not live collaboration.
- Status is persistent and separate from drawing notices: Saving, Saved locally, Not saved,
  Conflict, or browsing an unedited example/link. Local success never implies a downloaded
  file or cloud backup. Retain failed save producers/text in memory, including when another
  document opens. Retry reuses pending work and still checks for conflicts.
- Recovery is inspectable, with source, local time, document/session/revision identity and
  canonical text. Restore preserves the replaced figure and writes the selected contents
  in one transaction; a failed restore leaves the current editor usable. Resolving conflicts
  is an explicit choice of version; normal restore does not unprotect conflicts.
- Keep the newest ten ordinary revisions per document, each document's latest revision,
  the global current pointer, every unresolved conflicting revision, and the replaced
  predecessor of a document whose current head is a restoration. Cap the record
  at 128 revisions and 8 MiB (UTF-16 JSON size, including metadata/raw legacy originals).
  Prune oldest eligible history deterministically. Never evict a document's sole durable
  version or unresolved conflicts. If protected data cannot fit, abort the save, keep it
  pending, and offer backup and explicit conflict resolution. More documents eventually
  require exporting and explicit removal in a future document manager; no silent expiry.
- Migrate legacy `geomira.autosave.current` and `.previous` together. Parse each whole text;
  reject any error rather than storing a partial figure. Keep raw originals in the recovery
  record, including malformed text, so it can be downloaded. Prefer valid current, then valid
  previous. Commit before conditionally removing unchanged legacy keys. A failed transaction
  leaves both original slots and the valid startup figure available for retry. A cleanup
  failure does not erase the committed record. No runtime dependency is added.
- Document switching captures the latest settled figure before changing editing identity,
  even before the debounce effect runs. Recovery opens avoid a duplicate capture because
  their transaction already preserves the replaced figure. Invalid pending text cannot be
  restored as a partially parsed construction.
- Browsing examples/links writes nothing. Editing one creates a new document while retaining
  each personal document's latest revision. Restoring from browsing preserves that example
  too. A canonical `.geo` backup uses the existing printer and a narrow reusable web download
  action; damaged raw legacy text is downloadable separately without claiming it is valid.
- Start pending work on visibility hidden/pagehide and resume notifications on pageshow/focus.
  Browsers do not guarantee asynchronous unload completion. The PWA's deliberate update waits
  for an explicit flush/retry result and does not reload after a failed save. Sudden process
  death may lose pending edits; the last completed transaction remains the recovery boundary.
  Browser eviction/clearing and file-origin storage policies remain platform limitations.
- Claim/assumption data stays in canonical text and remains inert in the public build.
  No New/Open/Save As/sharing UI or claim-testing capability is introduced.

## Frozen-test migration

Web persistence tests must move from synchronous two-slot implementation assertions to
awaited transaction completion and inspectable revision contents. Keep their meaningful
contracts: notification/unsubscribe, first-write preservation, unedited examples/links,
restore-back, flush-before-switch, pagehide/visibility cleanup and no blank page when storage
is denied. Invalid placeholder text such as `yesterday` becomes valid commented `.geo` text.
The browser share test reads the revision store rather than obsolete localStorage writes.
The PWA offline test now waits for Saved locally before navigating away; its figure assertion
is unchanged. Unload cannot guarantee an asynchronous transaction completes.
PWA/update assertions stay intact; async flushing adds completion/failure regressions.
No pure slot tests, geometry assertions, thresholds or test-count floor are weakened.
Every changed frozen file is listed in STATUS; commits cite this ADR.

## Consequences

Writes have an atomic concurrency and crash boundary. A browser that cannot use IndexedDB
still edits and exports, with a persistent warning; it never silently falls back to unsafe
last-writer-wins saving. An unresolved conflict can exhaust protected capacity and then needs
an explicit choice or portable backup. The recovery record is bounded, while failed in-memory
work lasts only for the current page. The legacy originals are retained once inside the bound.
Document IDs are persistence metadata, not a change to the `.geo` language.

## Alternatives

A storage-event listener alone cannot serialize writers. Independent localStorage revisions
can preserve races, but concurrent cleanup needs an additional lock protocol. Web Locks
alone would exclude unsupported hosts. IndexedDB supplies native transactions without a new
runtime dependency. Automatically picking a conflict winner or expiring sole document copies
would silently discard user work. Cloud services and full file management are outside scope.
