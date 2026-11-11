# ADR-0063: The style card applies its changes at once

Status: accepted (maintainer's decision of 2026-11-10 on Request 3 of the GUI milestone:
"apply immediately"). Amends ADR-0029 decisions 3 and 5 (closing discards the draft; the card
edits a draft that "Write to script" applies as one style edit) and ADR-0046 decision 2 (name
and style written together). The style edit, the kernel's rename and every check are unchanged.
SPEC §12 and §15 are updated in this commit.

## Context

Every change in the style card was a draft: the canvas previewed it, the text did not change,
and nothing happened until "Write to script". Closing the card, a click elsewhere, or opening
another object's card threw the draft away. This is the opposite of what GeoGebra and most
drawing programs do, and it lost work silently.

## Decision

1. **Every change applies at once**, as a style edit of the object: a colour swatch, a slider,
   the label's text and "show", "shown", and everything under More. The text shows it as it
   happens, and the canvas draws the figure itself (no preview).
2. **One undo per control** (`liveStyle`, packages/editor `live-style.ts`). The edit carries a
   session: 'start' records a history entry and opens it; 'continue' replaces that entry's
   result while it is still the last action and the same object's. The card starts a session
   whenever the fields a change touches differ from the previous change's (`changedFields`),
   so dragging a slider or typing a label is one undo, and the next control is another. Two
   clicks on colour swatches in a row are one undo (the same control). A run that returns to
   where it began leaves no entry. Any other edit, undo or redo ends the session, as for the
   text panel's typing (ADR-0047) and drags (ADR-0012).
3. **Reset applies the default style at once**, as an entry of its own.
4. **The name** applies on Enter, on leaving the field, or with "Rename" (shown while a
   different name is typed). A name the kernel refuses is not applied; its reason stays under
   the field (ADR-0046 decision 3, unchanged). Name and style are now separate undos.
5. **Closing keeps everything.** ✕, Escape, a press elsewhere and another object's card close
   the card; nothing is discarded because nothing is pending (except a typed name that was
   never applied).
6. **The card follows the document.** It shows the object's style as the document has it, so
   an undo or a text edit while the card is open shows there at once.
7. **Locked layers** (ADR-0020): a change to a locked object is refused whole, with the
   store's notice; the card keeps showing the style that is in force.

## Consequences

- Frozen tests that asserted the draft changed for ADR-0063 (listed in STATUS): the style card
  e2e flows (`style-popover`, `flows-review`, `flows-persist`) and the name tests
  (`style-card-name`, `style-card-rename`, `flows-measurements`). Each asserts the same style
  and name lines; what changed is that they appear without "Write to script", and how many
  undos take them back.
- The pure helpers `writeEdit`, `canWrite`, `withDraft`, `cardWrite` and `previewDocument`
  are unchanged; `cardWrite` is now called with the object's own style, so it is the rename
  alone, and the preview shows only a typed name.
- `History` gains an optional `live` (the open session's object), like `typing`.

## Alternatives

- **Apply on release only** (no change while a slider is dragged): rejected; the point is to
  see the figure and the text change as the control moves.
- **One undo per card session** (everything done between opening and closing): rejected; a
  wrong colour after a good width would then take both back.
- **Keep "Write to script" for the name and style together**: rejected by the decision.
