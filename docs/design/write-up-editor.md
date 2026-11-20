# Proposal for a Write-up panel

A solver should be able to drag a point, jot down why two angles are equal, and reopen the figure with that explanation intact. Add **Write-up** to the figure panels. Keep **Text** for construction commands. The toolbar panel button returns to whichever tab the solver last used.

## Writing beside the figure

Start in **Write**, with one labelled native textarea. Offer **Preview** in the same space and **Download Markdown** from either mode. Preserve the caret, selection, scroll position and undo history while the user visits another tab or the canvas. Use the existing resizable sidebar on desktop and the existing sheet on phones. Opening Preview should keep the mobile keyboard closed. Give keyboard and screen reader users named controls and a route from a formula diagnostic to its exact source.

Support paragraphs, headings, lists, emphasis, code spans and fenced code, inline math such as `$\\angle ABC$`, and display math between `$$` delimiters. Code and escaped dollar signs stay literal. Preserve indentation, blank lines, trailing spaces, Unicode and the final newline in the editable source. Treat pasted text as plain text. Give native input control of composition, selection and undo. Canvas shortcuts should resume when focus returns to the canvas.

## What the Geomdraw reference tells us

Geomdraw's `neCommit` copies the source into `app.solution` and schedules a save before typesetting. Keep that ordering. Its `save` returns while the link guard is active, and editing the solution alone does not release that guard. Its delayed storage write also catches and discards storage errors. Both paths leave the writer without a reliable acknowledgement. Its live editor rebuilds a contenteditable DOM and maps the caret back through formatted math. A native source field with a separate read-only preview removes that dependency on DOM reconstruction.

## Document, file and recovery contract

- Own the raw write-up in the document session, outside the tab component. Each input, including deletion to an empty string, updates memory and marks the document dirty immediately. A first note on a linked figure or example starts an editable local revision. Keep geometry history and native writing history independent. Applying construction text, dragging a point or undoing a geometry edit must use the latest write-up.
- Extend the portable `.geo` format. Continue emitting version 1 for geometry alone. Propose version 2 for documents with notes, with one `@writeup` directive containing a JSON-escaped string on one physical line. The codec handles quotes, backslashes, control characters and newlines. A bad LaTeX expression is ordinary string content. The Text panel edits the construction projection and preserves the write-up during Apply or Revert. Write-up is edited through its own tab. Full-file Open validates the format before replacing the current document. Older readers already reject an unknown version. Keep old files, recovery records and links readable.
- Serialize the latest settled geometry and raw write-up into **one** revision through Geomira's existing IndexedDB queue. Track the local edit generation on every input. A completed transaction may acknowledge only the generation it captured. Coalesce intermediate writes, queue newer inputs during an in-flight write, and limit the delay during continuous typing. Keep the last durable revision on abort. A stale second tab produces recoverable conflict revisions under the existing compare-and-write policy.
- Show the existing save state in the toolbar. Mark a change pending immediately, including when the only change is in Write-up. On storage denial, quota exhaustion or a conflict, keep the text editable and offer Retry, Recovery and a raw Markdown download. A download request has its own status. Never truncate oversized content to satisfy file, share or local-retention limits. Offer the complete Markdown and a geometry backup if the combined portable file exceeds the existing import budget.
- On New, Open, example selection, link navigation, restore or PWA update, flush pending work and recheck the document identity and edit generation after the asynchronous save. Preserve the active session if the save fails or input arrives during the switch. Guard active IME composition and disclose unapplied construction drafts separately. Save As copies both parts into a new identity. On backgrounding, start a flush. Abrupt termination can recover only a completed write, so display **Saved locally** only after the corresponding transaction completes.
- Start share links in figure-only mode. Offer **Include write-up** before copying and show what the recipient will receive. Apply the existing decoded text and encoded fragment limits to the chosen payload. An oversized share gets a complete downloadable file within the import budget. Geometry image exports continue to show the drawing.

## Preview contract

Parse and render a derived snapshot after the source has been accepted for saving. Tag preview jobs with the document identity and edit generation. Discard stale results. Use a locally bundled, reviewed math renderer for hosted, offline and standalone use. Limit expansions, rendered size and work per preview. Keep renderer macros scoped to the current expression. Disable trusted commands, raw HTML and remote resources. Emit ordinary Markdown as safe text and elements. Provide accessible math output.

An unfinished delimiter stays visible as source. An invalid expression shows its original source and a nearby diagnostic while surrounding paragraphs and valid formulas still render. If the whole preview fails or exceeds its budget, keep Write, Save, Recovery and Download Markdown available. Announce errors on demand or when entering Preview so typing does not trigger an alert on every keystroke.

## Release checks

| Exercise | Required result |
| --- | --- |
| Type incomplete math, an unknown command and an unmatched brace. Force the renderer to throw. | Save completes. Reload, restore and Markdown download all reproduce the input, including the final newline. The figure stays editable. |
| Paste code containing dollars, escaped dollars, quotes, Unicode and blank lines. Compose text with an IME. | The source round-trips exactly through the file codec. Preview leaves code literal. Switching modes preserves selection and native Undo. |
| Type only in a link or example, then close the panel and draw. Reverse the order. Run geometry Undo. | The same document contains both edits. A write-up edit alone starts local recovery, and geometry Undo preserves the notes. |
| Stall the first transaction, type again and finish the first write. Inject an abort, quota error and denied storage. | The older write cannot acknowledge the latest text. Failed writes preserve memory and the last durable revision. Retry recovers the latest input. |
| Edit one document in two tabs, then restore and duplicate it. | Both conflicting revisions remain recoverable with their own geometry and notes. Editing the duplicate leaves the original intact. |
| Switch documents or request a PWA update while composing, while a save is in flight and with an invalid construction draft. | No silent replacement. Cancel retains all input. A successful switch after acknowledgement opens only the selected document's content. |
| Import legacy and new files, round-trip sharing with and without notes, and exceed file, share and storage bounds. | Old figures open normally. Notes survive full-document transport. Figure-only links omit them. Size errors leave the active session intact and offer exact backups. |
| Exercise keyboard, touch, mobile viewport resize, offline hosting and the standalone HTML in Chromium, Firefox and WebKit. | The writer can always reach the figure, editor, save status and download. Native typing, IME and geometry shortcuts use the intended focus. |

Start with codec round-trip and persistence fault-injection tests. Then add a source-only editor and pass switching, recovery and export tests. Add typeset preview last and rerun the same tests with the renderer unavailable. Review renderer and font licences, accessibility, offline package size and dependencies before implementation.
