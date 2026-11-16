# ADR-0069: portable documents and checked sharing

Status: authorized by release prompt 03; final acceptance requires integration verification.
Extends ADR-0067 (persistence) and ADR-0068 (modal interaction).

## Decision

- Add File actions for New, Open, Save/Download and Save As/Duplicate, using canonical
  versioned `.geo` text. Document titles name downloads and the open document. Download
  requests and later edits are reported separately from IndexedDB save status.
- File opening validates complete text before replacement, with a 2 MiB UTF-8 limit.
  Parser errors and unsupported versions refuse the complete file; warnings retain data.
  Native file input and Blob downloads are the cross-browser baseline; no file-handle API,
  account, service or runtime dependency is required.
- Move the existing TextApplier to EditorStore.textDraft, shared by the text panel and file
  operations. File-menu/picker interaction pauses pending automatic application. Cancel
  before Continue does not edit the document, draft, history or recovery. A current valid draft is applied
  before saving. Invalid/stale drafts get explicit choices and a raw `.txt` backup.
  New/Open disclose unapplied drafts before an explicit replacement discards them.
- Continue enters a visible commit phase: all file controls, including Cancel, are disabled
  and Escape leaves the dialog open until saving completes or fails. This avoids claiming
  cancellation after an irreversible transaction or draft application has started. Failure
  unlocks the choices and preserves the latest usable figure and pending backup. Delayed
  file reads carry an operation token; cancellation or a newer action invalidates them.
- New/Open/Save As await existing recovery before replacing the editor. Save As opens a
  new file-origin editing identity; both original and duplicate stay recoverable. A failed
  recovery write leaves the figure open and requires an explicit discard choice to continue.
- All file replacement dialogs use Modal. Native text interaction and background shortcut
  isolation remain the contract of ADR-0068. There is no claim UI activation.
- `encodeShareChecked` validates both canonical-text and checksum-inclusive payload lengths
  against the decoder's unchanged 100,000/20,000 limits. The public UI uses that result,
  offers no rejected link and supplies the same canonical `.geo` fallback. The legacy encoder
  remains for source/API compatibility, while decoding old/checksummed links is unchanged.
- A `file:` sender uses the configured canonical HTTPS SITE_URL; hosted HTTP(S) senders
  retain their path/base. Query and old fragments are removed. Figure text stays in the
  fragment, without uploads or shortening services.

## Frozen-test changes

The old share-url unit assertions prescribed sender-local `file:` URLs. Replace only those
expectations with canonical HTTPS recipient URLs. Browser offline share tests now open the
same run's hosted artifact after asserting the public link, so they do not accidentally
validate an unrelated live website. Existing document/geometry assertions remain intact.

## Consequences

Portable files preserve language metadata, styles, layers, views, viewport, claims and
assumptions. Browser download APIs acknowledge only a request, not a filesystem write.
Local recovery remains constrained by ADR-0067's browser storage limits. Invalid draft
text is a distinct raw backup and is never silently called a valid `.geo` figure.

## Final audit follow-up: safe PWA updates

The final audit reproduced a reload discarding an invalid Text draft and an unfinished
Command draft even though the last valid document saved successfully. The update action
now refuses that transition and offers exact raw-text/command downloads plus review actions.
It never silently applies, executes or discards transient input. The editor exposes active
IME text to the same guard, including before compositionend. The Reload button preserves
editing focus on mouse activation so it does not finalize composition as a side effect.

The guard checks transient input and recovery conflicts before saving, then checks them
again after the awaited operation together with document identity and active dragging.
New work entered while IndexedDB is pending therefore blocks the reload as well. Failed
saving keeps its existing actionable state; settled saved documents still update normally.
Users explicitly Apply/Revert source or finish/clear a command and retry when ready.

Frozen `pwa.spec.ts` retains all five previous PWA/download contracts and adds four actual
controlled-worker transition regressions. Its unchanged serving/control helpers move to
pwa-site.ts to keep the file within 400 lines. No assertions, budgets or screenshots weaken.

Later dismisses both the version offer and its paused-update notice, preserving all raw
input. It also invalidates any asynchronous preparation so an obsolete completion cannot
reopen that notice or request a dismissed update.

## Multiple controlled clients during an update

The final audit found that a second client retained its draft safely after another client
activated the offered worker, but its later explicit Reload could wait forever for an
already-delivered controllerchange. Pwa.applyUpdate now handles that explicit action using
an available fresh waiting candidate, or reloads directly when its retained offer is already
activated or redundant, or already controls that client. An activating worker that has
not yet claimed the client retains the pending controllerchange path without another
skip-waiting message. The beforeReload callback still runs before either path.
A waiting installed worker keeps the existing skip-waiting/controllerchange sequence, with
its pending reload request consumed once. Passive controller changes still never reload a
non-initiating page. SafeUpdate's draft, conflict and durable-save guards remain ahead of
all explicit reload paths. Frozen PWA tests only gain regressions; none are weakened.

The internal `file-url.spec.ts` fixture also asserts the canonical SITE_URL prefix rather
than the sender's private file path. It adds a claim before sharing and retains the complete
byte-for-byte canonical recipient comparison against this run's hosted artifact, covering
claim data as well as the construction. `document-files.spec.ts` retains its exact public
Claims-count-zero assertion and explicitly expects one tab only in the internal engine mode.
