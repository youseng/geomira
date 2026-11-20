# Portable documents and sharing

Use **File → New document** to start a named figure, **Open .geo file** to open a portable
figure, and **Save / Download .geo** to request a canonical copy. **Save As / Duplicate**
creates a new named document with a distinct local recovery identity and downloads it.
The original stays in Recovery. The document name is its `@title` metadata.

`.geo` files use Geomira's existing versioned language. They preserve geometry, styles,
layers, views, viewport, metadata, claims and assumptions. Public builds keep claim data
inert. Files up to 2 MiB of UTF-8 text are accepted only when the entire document parses.
Malformed/truncated files, unavailable reads and unsupported versions leave the figure open.
The existing language migration chain is used; the first format is version 1, so there is
currently no genuine version-0 format to migrate. Unversioned legacy text remains readable.

Current valid pending text is applied before saving. A draft with errors, or written against
an older figure, is presented separately. Download its raw `.txt` text, explicitly apply a
valid stale draft, or download the last valid figure. No download silently pretends an invalid
draft was saved. New/Open show a replacement confirmation; Cancel before Continue keeps the session. Continue
discards any explicitly disclosed unapplied draft and first preserves the valid figure in
local recovery. While the confirmed operation is saving, a visible progress message replaces
cancellable choices; Cancel and all other file actions are disabled, and Escape leaves the
dialog open. A failed operation unlocks the choices. A storage failure keeps the editor open and offers a backup or explicit discard.

**Saved locally** means an IndexedDB transaction completed in this browser. **Download
requested** means the browser was asked to download the displayed revision. The browser API
cannot confirm a disk write or whether the user kept the file. Further edits change that
message to **Changed since download**. An unapplied draft has a separate visible label and
is never included in a downloaded-revision acknowledgement. Downloads and clipboard copies do not resolve conflicts.
Keep independent copies of important work; clearing browser storage can remove local recovery.

Share links carry compressed canonical text in the URL fragment. Before offering Copy link,
the encoder checks the decoder's existing 100,000-character text and 20,000-character payload
limits, including checksum characters. A too-large figure gets a complete `.geo` download
instead. Old valid links, checksums and bounded decompression remain supported.

Hosted HTTP(S) links preserve the current deployment path. Links created from the standalone
HTML use `SITE_URL` from build-info.ts: the recipient opens the public HTTPS app, without
requiring the sender's local directory or an existing service worker. Query parameters and old
fragments are removed. Sharing and downloading perform no upload and use no shortening service.

Implementation contracts: `EditorStore.textDraft` is the shared TextApplier. Its `hold()` method
returns a release callback for a pending automatic apply while file choices are open. FileSession
coordinates intent, validation and explicit replacement; `replaceDocument` awaits existing
recovery and checks the figure did not change. `encodeShareChecked` is the public offer API;
`downloadGeo` is shared with storage-error backup. New file dialogs reuse Modal.

PWA updates also protect transient source and unfinished commands. **Reload to update**
pauses if there is an unapplied/stale/invalid draft, active IME composition, an unfinished
command, failed saving or an unresolved recovery conflict. Download the exact draft text,
then explicitly Apply/Revert source or finish/clear the command and retry. The update checks
again after asynchronous saving, so work entered while saving cannot be silently dropped.

An already-running older copy still uses its older Reload handler. Before its first upgrade,
copy or download unfinished Text and Command input and keep a `.geo` backup of the valid
figure. Installing the new build does not retroactively protect drafts held only by old
JavaScript. Subsequent updates initiated from the new build use the guard described above.

Save As downloads a portable copy and starts a new local editing identity. Its completion
alone does not acknowledge the duplicate's local durability: wait for **Saved locally** to
confirm that independent write. Storage-denied sessions can still keep the downloaded copy.

## Write-ups

Open **Write-up** in the figure panels to type Markdown and LaTeX. The live preview updates as you type. Use `$…$` for inline formulas and `$$…$$` for display math. An invalid formula remains editable and autosaves. Select its diagnostic to return to the formula.

A document with a write-up downloads as version 2 with one JSON-quoted `@writeup` field. Geometry alone continues to use version 1. **Download .md** saves just the source. Share links start with the figure alone. Select **Include write-up** to send the notes too. The local save indicator covers geometry and write-up together.
