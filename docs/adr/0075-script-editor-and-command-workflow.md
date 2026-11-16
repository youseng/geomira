# ADR-0075: Script editing and atomic command directives

Status: authorized by release prompt 10; combined implementation and verification pending.

## Context

The command bar replaces an existing title, author or viewport for a single statement,
but a batch appends duplicates and fails. Leading whitespace also shifts diagnostic
columns away from the actual command. Files retain one statement per line.

## Decision

Validate each batch prefix against the original editor state with one cumulative
source buffer. Replace singleton lines in statement order, including repeated
directives; append other statements. Keep an origin map from generated lines to
the source command. Only return the final successful replacement, so the batch
creates one history entry and any failure leaves the original state intact.
Validate every prefix so a later replacement cannot hide an earlier invalid input.
Use the existing statement splitter and grammar; a batch does not change file syntax.

The remaining Text-panel work will reuse the shared draft introduced by prompt 03.
Its input, completion, diagnostic and source-preservation decisions and evidence
must be recorded before this task is marked complete.

## Consequences

Batch behavior matches sequential singleton replacement while remaining atomic.
Prefix validation costs more than one parse; it uses the same bounded interactive
command path and keeps parser rules as the authority. No execution runtime or
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
  the innermost open registry call. A completion is one normal shared-draft change. Native keys
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
