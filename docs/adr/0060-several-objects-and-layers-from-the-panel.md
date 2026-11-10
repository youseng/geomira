# ADR-0060: Several objects at once, and layers from the panel

Status: accepted (maintainer request "GUI", first milestone, 2026-11-10: "this GUI is completely
dumb. And no option for even creating new layer"). Extends ADR-0012 (the editor core: the
selection is a UI edit, a batch is one history entry), ADR-0013 (the web app is a thin layer:
decisions 1 and 6) and ADR-0020 (locked layers). SPEC §12 and §15 are updated in this commit.
Nothing in the kernel, the language or the claims changes: every action below is built from
edits that existed.

## Context

Checked in the running app and in the code before any change (base: main = 1a6d663, `pnpm verify`
green, 4744 tests):

- **A layer could not be made in the GUI.** The kernel has `addLayer`, `updateLayer`,
  `removeLayer` (`packages/kernel/src/layers.ts`) and the language has `@layer name`, but the
  Layers panel only listed layers (shown, active, locked, remove). The only ways to get a layer
  were typing `@layer aux` in the text or the Layer-from-transform tool (a derived layer).
- **Only one object could be selected.** `EditorState.selection` is a list and the `select` UI
  edit has the modes `replace`, `add` and `toggle` (ui-edit.ts), but every caller passed
  `replace` with one id: the Move tool's click (machine.ts `moveClick`), the Objects panel, the
  style card. So hiding five construction lines was five right-clicks, five cards, five "Write
  to script".
- **Delete on several objects could not work.** The Delete key built one `remove` per selected
  id; with a point and something built from it both selected, the second `remove` names an
  object the first has taken, and the batch is refused whole. Unreachable while the selection
  held one object; reachable the moment it holds two.
- **Hiding or showing an object took the style card** (right-click, uncheck "shown", "Write to
  script"), and a hidden object could only be shown again from the Objects panel's row by the
  same three steps.

## Decision

1. **The extended click** (`ToolInput` click gains `extend?: true`; machine.ts). In the Move
   tool a click with Shift, Ctrl or Cmd held TOGGLES the clicked object in the selection, and on
   empty space keeps the selection (a plain click there still clears it). Every other tool
   ignores `extend`. It is a UI edit: no document change, no history entry. A press that moves
   past the click slop is still a drag of the point under it, whatever keys are held (ADR-0013
   decision 6 unchanged). The Objects panel's row does the same with Shift, Ctrl or Cmd.
2. **Select all**: Ctrl+A (Cmd+A) selects every object that is not hidden and is in a shown
   layer (`selectableIds`), in construction order. A key action in the keymap (`selectAll`), so
   the help lists it; never while typing in a field (the existing rule of `useShortcuts`).
3. **Selection actions** (`@geomira/editor/selection-actions`, `selectionEdit`): hide, show,
   labels off, labels on, move to a layer, remove. Each is ONE `batch` edit (one history entry,
   one undo) made of the kernel's `style`, `setLayers` and `remove` edits, so names, managed
   images and locked layers are judged by their owners (ADR-0020: a locked layer refuses the
   batch whole, with its own sentence).
   - An action touches only the objects it changes (`count`); when it changes none it is not an
     edit but a reason ("every selected object is hidden already"), so no empty history entry.
   - Hide / show write `hidden` and remove it (never `hidden=false`); labels off writes
     `label=""`, labels on removes that for a point (its name is its default label) and writes
     the name for another kind (`label="ω"`): the language's existing forms (ADR-0029), nothing
     new in the text.
   - Remove names each object once: an object that an earlier removal of the batch takes with
     it is left out, and so are managed images (they follow their sources). The Delete key uses
     this, which fixes the refusal described in the context.
   - Move to a layer puts each selected object in that layer alone; managed images are not
     moved (their rule places them); the selection bar and the panel offer only plain layers.
4. **The selection bar** (apps/web `SelectionBar.tsx`): while anything is selected, a toolbar
   named "Selection" floats at the top centre of the canvas: what is selected (up to
   `SELECTION_NAMES` = 3 names, else "n objects"), then only the actions that would change
   something (`selectionSummary`), a layer list when there is more than one plain layer,
   Delete, and ✕ (clear the selection). It shows the settled state (as the hint line does), so
   a drag frame does not rebuild it.
5. **The eye.** Each row of the Objects panel has an eye button: "Hide A" or "Show A" (its
   accessible name says what it will do), one `style` edit through `selectionEdit` on that
   row's object, selected or not. The row's "· hidden" note stays.
6. **Layers from the panel.**
   - "New layer": a name field offered the first free name of layer1, layer2, …
     (`nextLayerName`), and a button. The edit is the kernel's `addLayer` (one history entry;
     the text shows `@layer layer1`); then the new layer becomes the ACTIVE layer (a UI edit),
     since someone who makes a layer wants to build in it.
   - Each layer's name is a field: Enter or leaving it renames the layer (`updateLayer`),
     Escape restores it. The shown/hidden checkbox keeps the layer's name as its accessible
     name, so `getByLabel('aux', { exact: true })` of the frozen flows still finds it.
   - A name is checked while typing with the kernel's own rules (`layerNameProblem`:
     `nameProblem` and uniqueness, tested to refuse exactly what `addLayer` refuses); the
     message is shown in place and the button is disabled.
   - "← selection" on a plain layer's row moves the selection there (decision 3), shown only
     when it would move something.
7. **Where the logic lives.** Every decision is in packages/editor (pure, DOM-free, tested
   there); apps/web only draws the bar and the fields and passes Shift/Ctrl from the pointer
   event. apps/web still changes state only through `applyEdit` and `toolInput` (ADR-0013
   decision 1).

## Consequences

- No frozen test changes: the `extend` field, the keymap entry and the `./selection-actions`
  subpath are additions (`exports.test.ts` gains lines only).
- The Layers panel's layer name is now an `<input>`, not text in a `<label>`; the checkbox's
  accessible name is unchanged.
- A selection of several objects is not yet styled as one (colour, width, dash): the style card
  still opens on one object. Not done in this milestone; see STATUS.
- Box (marquee) selection is not done: a drag on empty canvas pans (ADR-0013 decision 6), and
  changing that is a decision for the maintainer (STATUS, Requests).

## Alternatives

- **Shift+click adds, never removes** (GeoGebra's Ctrl+click toggles): rejected; one gesture
  that toggles is what both Shift and Ctrl do in file managers and drawing tools, and a second
  click on a selected object has no other meaning in the Move tool.
- **A key for hide** (H in most tools): every letter and Shift letter is a tool's (ADR-0024 and
  later). The bar's button and the row's eye need no key; a key can be added when the tool keys
  are revisited.
- **Hide as `hidden=false` / show as removing the key only**: the language prints what the
  style holds, and `[hidden=false]` on every object ever hidden is noise in the text.
- **A dialog to name the new layer**: rejected; the field with an offered name is one click for
  the common case and still lets the name be typed first.
- **Rebuilding the editor core for this**: not needed. The state machine, the edit model and the
  history already carried multi-selection and batches; what was missing was the wiring.
