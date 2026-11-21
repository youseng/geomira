# Write-up editor

A solver should be able to drag a point, jot down why two angles are equal, and reopen the figure with that explanation intact. Add **Write-up** to the figure panels. Keep **Text** for construction commands. The toolbar panel button returns to whichever tab the solver last used.

## Writing beside the figure

Open **Panels → Write-up** and write directly in **Live**. Typing the closing dollar sign typesets a completed formula immediately. Click a formula or move the caret inside it to edit the LaTeX. When the caret leaves, the equation typesets again. Markdown headings, emphasis, quotes, lists and code are formatted in the same writing area. The current line exposes its Markdown markers. **Source** shows the entire document as Markdown. Both modes share selection and writing Undo. **Download .md** exports the original text.

The existing resizable sidebar on desktop and sheet on phones keep the figure within reach. Opening a different tab preserves the editor. Dollar signs in code and escaped dollars remain literal. Math uses native MathML, and each heading exposes its level to assistive technology.

## What the Geomdraw reference tells us

Geomdraw's `neCommit` copies the source into `app.solution` and schedules a save before typesetting. Its Live editor intercepts input, rebuilds the editable HTML and maps the selection back to source offsets. It maintains its own Undo and clipboard handling. Geomira uses CodeMirror for those editing operations, markdown-it for syntax and KaTeX for math. The original Markdown reaches the document store before formatting runs.

## Document, file and recovery contract

- Own the raw write-up in the document session, outside the tab component. Each input, including deletion to an empty string, updates memory and marks the document dirty immediately. A first note on a linked figure or example starts an editable local revision. Keep geometry history and writing history independent. Applying construction text, dragging a point or undoing a geometry edit must use the latest write-up.
- Extend the portable `.geo` format. Continue emitting version 1 for geometry alone. Use version 2 for documents with notes, with one `@writeup` directive containing a JSON-escaped string on one physical line. The codec handles quotes, backslashes, control characters and newlines. A bad LaTeX expression is ordinary string content. The Text panel edits the construction projection and preserves the write-up during Apply or Revert. Write-up is edited through its own tab. Full-file Open validates the format before replacing the current document. Older readers already reject an unknown version. Keep old files, recovery records and links readable.
- Serialize the latest settled geometry and raw write-up into **one** revision through Geomira's existing IndexedDB queue. Track the local edit generation on every input. A completed transaction may acknowledge only the generation it captured. Coalesce intermediate writes, queue newer inputs during an in-flight write, and limit the delay during continuous typing. Keep the last durable revision on abort. A stale second tab produces recoverable conflict revisions under the existing compare-and-write policy.
- Show the existing save state in the toolbar. Mark a change pending immediately, including when the only change is in Write-up. A browser reload or navigation while a write-up is pending prompts the writer to stay until the transaction completes. On storage denial, quota exhaustion or a conflict, keep the text editable and offer Retry, Recovery and a raw Markdown download. A download request has its own status. Never truncate oversized content to satisfy file, share or local-retention limits. Offer the complete Markdown and a geometry backup if the combined portable file exceeds the existing import budget.
- On New, Open, example selection, link navigation, restore or PWA update, flush pending work and recheck the document identity and edit generation after the asynchronous save. Preserve the active session if the save fails or input arrives during the switch. Guard active IME composition and disclose unapplied construction drafts separately. Save As copies both parts into a new identity. On backgrounding, start a flush. Abrupt termination can recover only a completed write, so display **Saved locally** only after the corresponding transaction completes.
- Start share links in figure-only mode. Offer **Include write-up** before copying and show what the recipient will receive. Apply the existing decoded text and encoded fragment limits to the chosen payload. An oversized share gets a complete downloadable file within the import budget. Geometry image exports continue to show the drawing.

## Live formatting and recovery

Parse the current editor document after its source has been accepted for saving. Each formatting pass belongs to the mounted document. Use a locally bundled, reviewed math renderer for hosted, offline and standalone use. Limit expansions, rendered size and work per formatting pass. Keep renderer macros scoped to the current expression. Disable trusted commands, raw HTML and remote resources. Emit ordinary Markdown as safe text and elements. Provide accessible math output.

An unfinished delimiter stays visible as source. An invalid expression shows its original source and a nearby diagnostic while surrounding paragraphs and valid formulas still render. If formatting fails or exceeds its budget, keep Write, Save, Recovery and Download Markdown available. Show formula diagnostics beside the failed expression. Selecting a diagnostic focuses its source range.

## Release checks

| Exercise | Required result |
| --- | --- |
| Type incomplete math, an unknown command and an unmatched brace. Force the renderer to throw. | Save completes. Reload, restore and Markdown download all reproduce the input, including the final newline. The figure stays editable. |
| Paste code containing dollars, escaped dollars, quotes, Unicode and blank lines. Compose text with an IME. | The source round-trips exactly through the file codec. Live leaves code literal. Opening another tab and returning preserves selection and writing Undo. |
| Type only in a link or example, then close the panel and draw. Reverse the order. Run geometry Undo. | The same document contains both edits. A write-up edit alone starts local recovery, and geometry Undo preserves the notes. |
| Stall the first transaction, type again and finish the first write. Inject an abort, quota error and denied storage. | The older write cannot acknowledge the latest text. Failed writes preserve memory and the last durable revision. Retry recovers the latest input. |
| Edit one document in two tabs, then restore and duplicate it. | Both conflicting revisions remain recoverable with their own geometry and notes. Editing the duplicate leaves the original intact. |
| Switch documents or request a PWA update while composing, while a save is in flight and with an invalid construction draft. | No silent replacement. Cancel retains all input. A successful switch after acknowledgement opens only the selected document's content. |
| Import legacy and new files, round-trip sharing with and without notes, and exceed file, share and storage bounds. | Old figures open normally. Notes survive full-document transport. Figure-only links omit them. Size errors leave the active session intact and offer exact backups. |
| Exercise keyboard, touch, mobile viewport resize, offline hosting and the standalone HTML in Chromium, Firefox and WebKit. | The writer can always reach the figure, editor, save status and download. Native typing, IME and geometry shortcuts use the intended focus. |

KaTeX produces native MathML locally. Markdown-it parses the supported Markdown syntax. The browser supplies math fonts. Both the hosted app and the standalone HTML include their dependency notices.
