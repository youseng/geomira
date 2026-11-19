# ADR-0079 Validate toolbar interactions across layouts

The browser reports from the merged toolbar exposed the same four failures on
the pull request and on main. The internal claim field competed with search
and pushed More beyond the viewport at 768 px. Give this internal field its own
row between 761 and 950 px. Keep the primary actions together and exercise
tool search with a native pointer at every tested width.

Three browser fixtures assumed a particular viewport or browser representation:

- The angle test now computes the expected angle from both coordinates of the
  delivered native pointer. It still checks the exact serialized endpoint, the
  undefined measurement after exact coincidence, and undo and redo when the
  drop missed the vertex.
- When replacing a style card, use the exposed control of the other object row.
  The native click must reach the row and replace the open card.
- Compare the document-space canvas origin to four decimal places in CSS pixels.
  Firefox adds a floating-point scroll offset to a viewport-relative rectangle.
  The observed difference was 0.000008 px. Width, height and camera state
  still require exact equality.

The existing screenshot references and the deployment workflow continue to
apply. Both browser reports identified the same four cases.
