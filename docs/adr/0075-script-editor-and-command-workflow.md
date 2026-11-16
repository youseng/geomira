# ADR-0075: Script editing and atomic command directives

Status: authorized by release prompt 10; combined implementation and verification pending.

## Context

The command bar replaces an existing title, author or viewport for a single statement,
but a batch appends duplicates and fails. Leading whitespace also shifts diagnostic
columns away from the actual command. Files retain one statement per line.

## Decision

Assemble a cumulative source buffer and origin map against the original editor state.
Parse/evaluate ordinary batches once. Validate an earlier prefix only immediately before
overwriting a singleton directive already changed within this batch. Replace singleton lines in statement order, including repeated
directives; append other statements. Keep an origin map from generated lines to
the source command. Only return the final successful replacement, so the batch
creates one history entry and any failure leaves the original state intact.
Validate the endangered prefix so a later singleton replacement cannot hide an earlier
invalid input.
Use the existing statement splitter and grammar; a batch does not change file syntax.

The remaining Text-panel work will reuse the shared draft introduced by prompt 03.
Its input, completion, diagnostic and source-preservation decisions and evidence
must be recorded before this task is marked complete.

## Consequences

Batch behavior matches sequential singleton replacement while remaining atomic.
Repeated singleton replacements require extra prefix validation, while ordinary appended
batches keep one parse/evaluation. Parser rules remain the authority. No execution runtime or
new language is introduced. Public claim statements remain inert document data.

## Alternatives

Removing all but the last singleton before validation would conceal earlier syntax
errors. Committing each statement separately would fragment history and require
rollback. A separate parser would duplicate the language contract.

## Text editor decisions

- Keep a native textarea as the sole editable/announced source. Decorative, pointer-inert
  lexer highlighting and a synchronized line-number gutter use identical metrics and scroll
  offsets. Forced-colour mode exposes native text. No editor dependency or second grammar.
- Diagnostics are source-span buttons: pointer or keyboard activation selects the exact UTF-16
  span and scrolls it into view. The command/claim diagnostic component retains its plain-list
  form when there is no editable source target.
- Use the existing registry/command completion data against source before the current line;
  do not offer forward-reference objects or GUI Claim actions. Completion supports Ctrl+Space,
  arrows, Tab/Enter, pointer choice, Escape and an explicit no-match state. Signature help uses
  the innermost open registry call. A completion is one normal shared-draft change, inserted through a native insertText transaction
  so field Undo/Redo retains valid source offsets before React follows its value. Both the Text
  editor and command bar share this insertion boundary. Native keys
  remain native when assistance is inactive; comments and quoted text do not auto-open it.
- Native IME composition holds automatic apply and completion until its final text is committed.
  Unicode, primes and ordinary textarea selection are retained. The shared `TextApplier` and
  its 500 ms timer/coalesced history remain the authority, including file-dialog holds.
- Blur still applies valid non-stale text and ends its typing session, but preserves the source
  as typed instead of silently normalizing it. Explicit Apply text/Ctrl+Enter still formats;
  visible help explains this. GUI changes regenerate clean source with a notice; dirty drafts
  remain stale with the existing explicit Apply/Revert choice. Arbitrary formatting is not part
  of the canonical document format and is not promised across construction edits or saves.
- An explicit “Convert command separators to lines” action uses the existing top-level splitter.
  It preserves quoted/comment/nested separators and leaves the one-statement-per-line file
  grammar unchanged. Canonical save/export/share serialization is unchanged.

## Frozen-test adjustment

The blur test in `apps/web/test/text-apply.test.ts` retains its immediate application,
coalescing and history assertions; its normalization assertion now requires verbatim source
preservation. This is the intended stronger product contract above. The existing explicit
apply/format, invalid-draft, stale-draft and typing laws remain. Package lexer export coverage
is additive. No limits, count floors, numerical assertions or snapshot references are weakened.

The shared completion insertion uses the deprecated but interoperable `insertText` editing
command because plain value assignments corrupt or bypass native undo. Before the change,
Text Undo inserted old text at an invalid offset; Command Undo did nothing. The narrow lint
exception documents this browser API limitation. Native Undo/Redo in both fields is explicitly
covered in the supported-engine browser projects; no parser or document-history guard is bypassed.

Completion caret placement is now a shared layout effect bound to the exact requested source.
The former unconditional animation-frame callback could run after the next typed character
and move the caret back into that character's prefix. The effect runs before paint; if newer
source has superseded the expected value, the pending placement is discarded. Text and Command
share this policy while retaining native insertion/undo. The regression deliberately delivers
queued frames after immediate typing, rather than delaying user typing to conceal the race.

The phone editor keeps only a short completion hint by default. Keyboard/formatting guidance
lives in a native, initially collapsed “Editor help” disclosure; the conversion action appears
when top-level separators are present. Actionable diagnostics remain visible. The source notice
is compact and appears only when a figure edit actually normalizes clean user-authored source
that differs from the printer output. Canonical/generated source does not trigger it, and an
explicit document replacement clears it. Dirty source continues through the original stale-draft
path. A one-document printer cache avoids adding a second print to every drag update.
