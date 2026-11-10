# Changelog

What changed for someone using Geomira, newest first. The decisions behind each entry are in
docs/adr/; the test evidence is in docs/STATUS.md.

## Unreleased

### GUI milestone 2: the selection box (ADR-0062)

- **Drag a box to select.** In the Move tool, drag on empty canvas with the left button:
  everything wholly inside the box is selected (Shift or Ctrl adds to the selection).
- **Pan with the right button** (or the middle one), in every tool. A right click on an
  object still opens its style card. Touch is unchanged: one finger pans.

### Script milestone: the short notation (ADR-0061)

- **The text panel keeps your short script.** `D = foot(A, BC)`, `O = circumcenter(ABC)` and
  `P, Q = tangents(X, w)` stay as written instead of being rewritten into
  `foot(A, line(B, C))` and two `tangent_from(…, orient(±))` lines. What the tools build
  appears in the same short form.
- **Both results on one line.** The two intersections or the two tangents of one construction
  are shown as `X, Y = intersect(ω, AB)` / `t, u = tangents(P, ω)`.
- **Several statements in the command bar**, separated by `;`, as one step of undo:
  `ABC triangle; O = circumcenter(ABC); D = foot(A, BC)`.
- **Also read now:** `ABC triangle`, and British spellings (`circumcentre`, `incentre`,
  `orthocentre`).
- Saved files, share links and exports are unchanged (the long canonical text), and old files
  open as before.

### GUI milestone 1: several objects at once, layers from the panel (ADR-0060)

- **New layer in the Layers panel.** Type a name (or take the offered `layer1`) and press
  "New layer"; it becomes the layer new objects are built in. A layer's name is now a field:
  click it, type, Enter.
- **Select several objects.** Shift+click or Ctrl+click adds an object to the selection or
  takes it out, on the canvas and in the Objects panel. Ctrl+A selects everything drawn.
- **Selection bar.** While anything is selected, a bar at the top of the canvas offers Hide /
  Show, Label off / Label on, move to a layer, Delete and clear, for the whole selection.
  Each is one step of undo.
- **Eye in the Objects panel.** Every object row has an eye: one click hides the object or
  shows it again.
- **"← selection" in the Layers panel** moves the selected objects to that layer.
- **Fixed:** Delete with several objects selected, one built from another, is no longer
  refused.
