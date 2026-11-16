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
