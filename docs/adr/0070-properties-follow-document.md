# ADR-0070: Properties follow the document and inherited visibility

Status: authorized by release prompt 05; final integration verification pending.
Amends ADR-0060 visibility and ADR-0063 name dismissal; retains immediate style changes
and one undo per control.

## Context

At f95e005, captured outside pointerdown closes a card before blur can commit its name.
Label and numeric fields initialize local text once, so undo changes the figure but not
those fields. Image rows and selection actions inspect only own hidden attributes,
although the scene correctly inherits hidden from the source.

## Decision

- The card owner commits a valid pending name against the current document before every
  close or switch, including Escape. Blur/Enter/button recheck current state, making a
  second notification a no-op. Invalid or locked names keep the document unchanged;
  dismissal closes the draft and leaves a persistent refusal explaining the rejected change.
  Removed objects simply close; no rename can recreate them.
- A text control tracks both its local text and the document value it acknowledges.
  Local partial numeric input remains intact while that value agrees. Undo, redo, Reset
  and external style changes replace the text when the acknowledged value changes.
  Hiding/showing a label can remember its text locally; undo cannot resurrect older text.
  Controls stay mounted and ordinary typing retains focus/caret.
- `documentStyles` in scene/style wraps the existing scene inheritance algorithm. The
  property card, object rows and selection visibility use that same resolver. Show removes
  hidden for ordinary objects, but writes hidden=false when a source's hidden=true must
  be overridden. Hide/show are each one checked edit, with locked-layer refusal atomic.
- Layer visibility and opacity are separate restrictions. Rows describe hidden layers or
  zero opacity without changing layer settings through the object eye. Undefined values
  retain their own reason. Coincident-image suppression remains the scene's distinct rule.

## Consequences

No new language, dependencies, geometry, claim execution or persistence policy. Explicit
hidden=false already round-trips in canonical source. Existing immediate-apply and
coalesced-history paths remain in use. Style-card ownership moves to a focused hook file
so the existing file-size/function limits remain meaningful.

New regression files cover outside event ordering, stale fields and inherited visibility;
existing frozen assertions and tolerances are retained unchanged. Final composed checks
and any integration-only changes belong to the root verification record.

## Alternatives

Relying on blur loses the capture/unmount race. Remounting the card for every document edit
loses partial input and caret. Removing hidden from an inherited-hidden image reveals the
same hidden source again. Copying the inheritance rules into every caller risks drift.
