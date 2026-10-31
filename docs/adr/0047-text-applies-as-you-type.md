# ADR-0047: The text applies as you type

Status: accepted (maintainer request "usability", item 3, 2026-10-30). Changes ADR-0013
decision 5 (when the text panel applies) and extends ADR-0012 decisions 3 and 9 (replaceText
as one history entry; coalescing). SPEC §12 and §15 get a sentence each. The language and the
file format are unchanged.

## Context

ADR-0013 decision 5 applied the text panel only on Apply, Ctrl+Enter or leaving the field: a
user editing a coordinate saw nothing move until they left the field. Its "Alternatives"
rejected applying on every keystroke: a history entry per character, and the printed text
rewriting the line being typed. The maintainer asked that, after a pause, a text without errors
applies by itself, with:

- the caret and the scroll kept;
- the automatic applies of one typing session as one history entry, until the user leaves the
  field or pauses longer;
- a text with errors not applied, its diagnostics shown as before;
- a drag or tool action while a pause is pending winning: the pending apply dropped, never
  applied over the newer figure (the audits' hunt item "text debounce racing a drag", open
  since audit 2026-10-23);
- Apply text and Ctrl+Enter kept as "apply now" (frozen e2e tests use them);
- no parse per keystroke beyond the one the diagnostics already make, on the 150-object figure.

The frozen e2e test of the Run 10 audit (W3, `flows-audit.spec.ts`, first test) fixes one
interaction: a press on the canvas leaves the text field first (Board.tsx blurs it), so a text
typed and then a drag both end up in the figure, and one undo takes back the drag only.

## Decision

1. **The pause.** Every change of the field restarts a pause of `TEXT_APPLY_PAUSE_MS` = 500 ms
   (apps/web/src/text-apply.ts). When it ends, the text is applied (one `replaceText`) if it
   has edits, has no errors, is about the figure shown (decision 4) and no drag is in progress.
   The decision is pure (packages/editor/src/text-draft.ts, `atPause`) and is taken against the
   editor's state at the moment the pause ends, not at the moment it started.
2. **The field is not rewritten while typing.** After an automatic apply the field keeps the
   text as typed, even when the document prints differently (`C = (2,3)` prints
   `C = (2, 3)`): React does not touch the field's value, so the caret, the selection and the
   scroll stay. Apply text, Ctrl+Enter and leaving the field "settle": they apply at once
   (Apply text and Ctrl+Enter as `onApplyNow`, leaving as at the end of a pause), end the typing
   session and show the printed figure. Ctrl+Enter keeps the caret on the same line and column
   (at the end of its line if it was there; apps/web/src/caret.ts) and the scroll.
3. **A typing session is one history entry.** `replaceText` takes `typing` = 'start' or
   'continue' (packages/editor/src/text-edit.ts). 'start' records an entry and marks the
   history's last entry as an open typing session (`History.typing`); 'continue' replaces that
   entry's `after` while it is open and still the last action, as a drag's moves do. Every other
   entry, undo, redo and drag closes it (history.ts returns histories without the mark). A
   'continue' that returns to the document before the session drops the entry (no undo that
   changes nothing). A 'start' that changes nothing still closes a session left open. The page
   continues a session when an automatic apply comes at most `TEXT_MERGE_MS` = 3000 ms after the
   previous apply of the session (typing resumed within about 2.5 s of the last apply); a longer
   pause starts a new entry, and settling (decision 2) ends the session: the next apply is a new
   entry. Apply text or Ctrl+Enter right after automatic applies joins their entry. One undo
   after a typing session returns to the document before it; redo restores it.
4. **Any other document change wins (the race).** A draft holds the document it is about (the
   one shown when it started or followed, or the one its own apply made). When the document
   shown is another one (identity) while the field holds edits not applied, the draft is STALE:
   a drag (also a label drag: any gesture through dragStart … dragEnd), a tool action, undo,
   redo, the style card, the claim bar, the command bar, Randomize, an example, a restored
   figure or a link opened. Then:
   - the pending pause is dropped at once, and its end would not apply anyway (decision 1 checks
     the state then);
   - the typed text is KEPT (not lost: W4 of the Run 10 audit kept a draft with errors for the
     same reason) with the note "The figure changed meanwhile: this text is not applied as you
     type. Apply text puts it in place of the figure; Revert text shows the figure's text.";
   - neither a pause nor leaving the field applies a stale text; only Apply text or Ctrl+Enter,
     the user's explicit choice, applies it, as an entry of its own (one undo returns to the
     newer figure); Revert text shows the figure's text.

   Undo then redo back to the very document the text was typed on is that figure again (the
   history restores documents by identity, ADR-0012 decision 8): the text is not stale and
   applies. A draft without edits of its own (nothing typed since the last apply) follows the
   figure: the field shows the new figure's text and the session ends.

   Leaving the field is an apply (ADR-0013, kept): a press on the canvas leaves the field first
   (W3), so a text typed and not yet applied when a drag starts with the mouse or a finger is
   applied before the drag (nothing is lost, one undo takes back the drag), and the pause that
   was pending then never applies afterwards. The race itself is therefore reached by changes
   that do not take the focus from the field: a link opened (hashchange), a drag already in
   progress when the pause ends, keyboard or programmatic edits, and browsers whose buttons do
   not take the focus. It is tested at both levels: `apps/web/test/text-apply.test.ts` (fake
   timers: a drag, a drag in progress, a tool action, undo, redo, the style card's write, a
   claim, the command bar, Randomize, a link or example opened) and
   `apps/web/e2e/flows-typing.spec.ts` (a drag while a pause is pending; a link opened while a
   pause is pending). The label drag of item 5 (dragStart, dragLabel, dragEnd) is not on this
   branch; its test belongs with the merge (Consequences).

5. **One parse per text.** The panel's diagnostics parse (`parseText` in the new
   `@geomira/lang/parse-text`, repeated constructions as warnings, ADR-0029) is cached per text
   by the TextApplier and handed to `replaceText` as `parsed`; the editor keeps ids with `rebase`
   (parseInto from a parse already made: `parseInto` is now `rebase(old, parse(text))`). The
   editor uses `parsed` only when its text and registry are the edit's; otherwise it parses. The
   debug log records the text, not the parse.
6. **Errors.** A text with errors is never applied (not by a pause, not by leaving, not by
   Apply text, which is disabled); the figure stays and the diagnostics stay listed. Apply text
   is enabled when the field holds edits without errors, or while a typing session is open (it
   then settles it).

## Consequences

- Measured on the 150-object stress figure (apps/web/src/stress.ts):
  - Node 22, median of 40 (p90): the diagnostics parse per keystroke (unchanged, already there)
    11.8 ms (18.5); an automatic apply with the parse reused 4.1 ms (5.0) for 'start' and
    3.2 ms (4.2) for a merged 'continue', against 12.2 ms (16.1) for a plain replaceText that
    parses again (the parse it no longer makes: 5.8 ms).
  - Chromium (headless, this machine), 20 keys typed in the field with two automatic applies:
    the input event's handler 6.8–20.3 ms (about 10 ms typical), key to next paint 24–48 ms
    (the Event Timing API's 8 ms steps), and no long task (≥ 50 ms) during the typing or the
    applies.
- The history after a typing session has one entry per session, not one per Apply.
- A draft can now differ from the printed figure without holding edits (after an automatic
  apply); the printed text comes back when the session settles.
- A label drag (maintainer request item 5, merged separately: dragStart with part 'label',
  dragLabel, dragEnd) is a drag through the editor's drag protocol: while it is in progress
  `state.drag` is not null (decision 1 does not apply) and its end changes the document
  (decision 4 drops the pause and keeps the typed text, stale). This branch cannot see that
  code; after the merge, a label drag belongs in the list of other changes of
  `apps/web/test/text-apply.test.ts`.
- The Ctrl+Enter caret restore had a bug found while measuring (a Ctrl+Enter that changed
  nothing made the NEXT key jump the caret back); fixed with its failing e2e test first
  (dae661b).

## Frozen tests changed

None. `packages/editor/test/exports.test.ts` and `packages/lang/test/exports.test.ts` gained
lines only (the new subpaths `./text-draft` and `./parse-text`).

## Alternatives considered

- Re-basing the pending text on the newer figure (applying the typed difference): the text has
  no diff semantics; a merge could silently undo the drag.
- Dropping the typed text when the figure changes: simplest, but loses typing (a draft with
  errors can hold minutes of it; W4 of the Run 10 audit was that bug).
- Replacing the field with the printed text after every automatic apply: moves the caret and
  rewrites the line being typed (ADR-0013's reason against applying per keystroke).
- A merge window measured in the editor: the editor has no clock (pure packages may not read
  one); the page decides 'start' or 'continue', the editor decides whether the history allows
  merging.
- Putting the parse into the edit unconditionally (a Document instead of a ParsedText): the
  editor could then commit a document that is not its text's.
