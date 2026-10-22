# ADR-0020: Locked layers protect their objects from GUI edits (Run 10, P3)

Status: accepted (Run 10, the maintainer's decision on audit proposal P3). It defines the
`locked` flag of SPEC §5's Layer, which until now had no behaviour.

## Context

SPEC §5 gives every layer a `locked` flag, and the text has written and read it since Run 6
(`@layer given [locked]`). Nothing used it: objects of a locked layer could be dragged,
restyled, renamed, redefined and deleted like any other. The audit (P3) asked what "locked"
means. The maintainer's decision: objects in a locked layer cannot be dragged, edited or removed
through the GUI (tools, palette, drag, delete); text edits still apply.

## Decision

1. **Which objects are locked.** An object is locked when one of its layers is locked. A
   managed image is never locked itself: it follows its rule, and decision 4 protects that
   rule.
2. **GUI edits are checked by their effect, not their kind.**
   - Every document edit and batch except `replaceText` is compared before and after
     (`packages/editor/src/locked.ts`, called from `applyEdit`).
   - It is refused, with the state unchanged, when:
     - it removes a locked object, including through a cascade of removed dependents, or by
       removing its layer;
     - it changes a locked object's name, definition, style or layers;
     - it adds a new, non-managed object to a locked layer;
     - it changes a locked derived layer's rule.
   - The reasons name the object and the layer:
     - "A is in the locked layer given: unlock the layer to remove it" (or "… to change it");
     - "the layer given is locked: unlock it to add objects to it";
     - "the layer img is locked: unlock it to change its rule".
   - This covers the tools (machine.ts), the style palette (a batch of `style` edits),
     Delete (a batch of `remove`), the objects panel, Randomize (a batch of `redefine`, refused
     as a whole when it would move a locked point) and the layer controls.
3. **Drag.** `dragStart` is refused when the dragged object, or the object the drag rewrites,
   is locked: "A is in the locked layer given: unlock the layer to drag it". The rewritten
   object can be an image's source, or the anchor of a text dragged through it.
4. **Derived layers.** When a derived layer is locked, its rule cannot be changed or removed
   through the GUI. Its images still follow edits of their sources, as the rule says.
5. **What stays allowed.**
   - **The text.** `replaceText` is exempt, so the text panel and the command bar (which
     appends to the text) still edit locked objects and add to locked layers.
   - **Undo and redo.** They restore whole documents exactly (L6).
   - **The layer itself.** Changing its visibility, lock, opacity or name, and building new
     objects FROM locked ones into an unlocked layer.
6. **The Layers panel** gets a "locked" checkbox per layer ("Lock layer N"). It is an
   `updateLayer` edit: in the text, undoable, never refused.

## Consequences

- Tests:
  - `packages/editor/test/locked-layers.test.ts` covers each refusal with its exact reason
    and an unchanged state, the cascade, the layer's removal, a locked derived layer's rule,
    the tools with a locked active layer, the text panel and the command bar, and unlocking
    with undo.
  - `apps/web/e2e/flows-audit.spec.ts` locks in the Layers panel, presses Delete and sees the
    refusal; Apply text still changes the object.

  All failed before the change.

- A GUI edit that touches a locked object is refused whole: a style batch over a selection
  with one locked object changes nothing, and Randomize is refused while a free point it
  would move is locked. The reason says which object and how to proceed.
- No kernel or language change. The kernel's applyDocEdit stays unaware of locks, so
  documents built from text and the claims samplers are unaffected.

## Alternatives considered

- **Lock in the kernel (applyDocEdit).** That would also block the text, which the decision
  keeps open. It would also block derived-layer sync and the samplers' figures.
- **Check edit kinds and ids instead of effects.** That misses cascades (removing B removes a
  locked N = midpoint(B, C)), layer removal and drag-through. Comparing documents is total.
- **Skip locked objects silently (Randomize, multi-object styles).** Rejected: an edit that
  silently applies to some of what it names breaks "nothing silently wrong".
