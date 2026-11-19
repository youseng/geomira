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

The existing screenshot references continue to apply. On the repair branch the
default Ubuntu mirrors returned HTTP 503 during Playwright installation. Browser
jobs now add Ubuntu's Azure archive to the runner's APT mirror list if it is
reachable. APT verifies the Ubuntu signatures and retains the original mirrors
as fallbacks. Validation, publication and smoke tests use the same pinned
Playwright version and dependency installer.
