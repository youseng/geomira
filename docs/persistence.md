# Local persistence integration (release prompt 02, ADR-0067)

The public app uses `Autosave` in `apps/web/src/persist.ts`, backed by native IndexedDB
`geomira.recovery.v2` / object store `recovery` / key `state`. The editor package's
`persistence` subpath owns revision, conflict, restore and retention policy. DOM, UUIDs,
clocks, storage, downloads and lifecycle events belong to the web host.

## Interface for prompt 03

- Construct once per editor. `initialize(): Promise<string | null>` loads/migrates startup
  content; even a failed migration returns valid legacy text for the current editor.
  `EditorStore.open` calls `opened(origin, canonicalText)` to adopt the loaded revision's
  document ID, with a new editing-session ID. Examples, links and files have new document
  IDs. IDs are persistence metadata and do not alter the `.geo` language.
- `edited()` marks a committed change dirty. `save(text | producer): Promise<boolean>`
  queues a revision, retaining its text/producer on failure. Unedited examples/links return
  true without writing; inspect their Browsing phase. A successful operation can still leave
  a newer edit dirty, so use flush/retry when deciding whether a whole session can leave. Producers let serialization
  failures stay inside persistence error handling. Callers must not acknowledge a save
  from scheduling it, firing a timer, or receiving an IndexedDB request-success event.
- `getStatus()` reports phase, persistent message, document/session IDs, acknowledged
  revision ID, active-document dirty flag and global pending count. `subscribe` / `getVersion` notify observers; that version
  is a notification counter, not a durable revision. A later successful operation on
  another document does not erase a failed pending edit.
- `schedule(task, ms)` debounces; `flush(): Promise<boolean>` starts the scheduled task and
  waits for queued transactions. `retry(): Promise<boolean>` retries failed pending work
  and migration. A false result keeps the figure and notice. A true result means all
  pending work completed; it does not resolve a conflict or mean a file was downloaded.
- `EditorStore.retrySaving()` captures the latest settled document and retries persistence,
  including work pending in earlier editing sessions. Use it for explicit Retry and PWA
  updates; it refuses reload during an unfinished drag.
- `entries()` exposes durable versions and pending in-memory text, with source/time,
  document/session/revision IDs and conflict flags. `legacyEntries()` exposes originals,
  including invalid text. `refresh()` reads external commits without changing the editor's
  contents or base revision. Notifications are advisory, never a concurrency lock.
- `EditorStore.restoreRevision(id?, resolve=false): Promise<boolean>` preserves the current
  figure and restores the chosen version. It refuses to replace an editor changed during
  the async operation. Normal restores keep conflict protection. Explicit resolution
  unpins the chosen document's known conflicts; an unseen concurrent change can still
  produce a fresh conflict. The legacy header action chooses the newest different text.
- `downloadGeo(document)` in `apps/web/src/backup.ts` is the reusable canonical `.geo`
  action, using `@geomira/lang/print`, with no storage or document-switch side effects.
  Catch download/serialization exceptions and keep the figure open. A browser download
  request is distinct from confirmation that the user kept a file. `downloadText` also
  supports raw legacy recovery; invalid originals use `.txt`.

For document switching, flush/start pending work before changing the session. Failed work
is retained per editing session in memory; surface the persistent warning and recovery list.
Do not treat that memory as surviving navigation. Deliberate reload/update flows must await
flush/retry and keep the page open on failure. Prompt 03 owns full New/Open/Save/Save As and
sharing, including the user decisions around leaving unsaved work.

## Guarantees and bounds

Each read/compare/write is one IndexedDB readwrite transaction, serialized across tabs.
Both requests can hold the same base revision before either transaction starts: the second
transaction sees the first committed head and stores a protected conflict, preserving both
canonical figures. Aborted/partial writes preserve the old record. The pointer and revisions
commit together. A third tab and resumed stale tabs read the same recovery record.

Retain ten ordinary revisions per document, the latest revision of every document,
unresolved conflicting revisions, and the predecessor of a document whose head is a
restoration. The whole record, including original legacy text and metadata, is capped at
128 revisions and 8 MiB of UTF-16 JSON. Evict oldest eligible history deterministically.
When protected minima cannot fit, fail the write with a backup/resolution notice. Routine
cleanup never deletes a document's sole durable figure or unresolved conflicts. Explicit
document deletion is left to a later document manager; enough distinct documents can fill
the protected budget.

Legacy current and previous slots are parsed whole, copied with raw originals in one
transaction, then conditionally removed only if unchanged. Invalid text is never imported
as a partial figure. Valid current wins at startup, else valid previous. Failure keeps the
originals, valid startup figure and retry path. The previous slot becomes its own recoverable
document. Claim/assumption data, styles, layers, views, metadata and document viewport use
the existing canonical language; public claim testing remains disabled.

## Platform limits

Visibility/pagehide starts valid pending work; browsers do not guarantee asynchronous
completion on unload or process termination. Only completed transactions are promised after
reopening. Quota, privacy policy, storage eviction/clearing, separate browser profiles and
browser-specific `file:` origins limit local persistence. Denied hosts remain editable and
can download `.geo` backups. Moving/renaming the single HTML file can change its storage
origin. Already running pre-upgrade builds still use legacy slots and do not participate in
the new transaction protocol; close/update them before relying on cross-tab protection.
No cloud storage, collaborative merge, portable automatic backup or publication is implied.
