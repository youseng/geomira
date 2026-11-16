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
  does not edit the document, draft, history or recovery. A current valid draft is applied
  before saving. Invalid/stale drafts get explicit choices and a raw `.txt` backup.
  New/Open disclose unapplied drafts before an explicit replacement discards them.
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
