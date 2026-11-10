# Changelog

What changed for someone using Geomira, newest first. The decisions behind each entry are in
docs/adr/; the test evidence is in docs/STATUS.md.

## Unreleased

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
