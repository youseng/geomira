# ADR-0029: The style card, per-object opacity, and repeated constructions

Status: accepted (maintainer request, 2026-10-23). Changes SPEC §15 (no Style panel); adds a
style attribute to §11 and the Style of §5; adds argument symmetries to the ToolSpec of §6.1.

## Context

The maintainer asked for two changes before the beta:

1. Replace the Style panel with a style card like their earlier Geomdraw's: right-click an
   object, change its style in a small card next to it (colour swatches, point size, opacity,
   label, visible, Reset, Write to script).
2. "Objects such as line(A, B) and line(B, A) are considered different things and can be
   constructed multiple times. Same goes for circle. If two objects are identical by
   construction, then only allow constructing one of them."

## Decision

### The style card (apps/web)

1. **No Style tab.** The side panel's tabs are Text, Objects, Layers, Claims, Help.
2. **Opening.** A right-click on an object on the canvas, or on its row in the Objects panel,
   opens the card next to it and selects it. On touch, a 500 ms press within the click slop
   does (or the browser's own touch contextmenu); on a point it cancels the drag the press
   started. The canvas never shows the browser menu, and the right button starts no press,
   drag or click. The card is placed right of the object, else left, below, above, else
   clamped into the viewport.
3. **Closing.** ✕, Escape, a press outside the card, or opening another object's card. If the
   object is removed (for example by undo), the card closes.
4. **Fields by kind.** Points and curves (lines, circles, polygons, marks): colour (swatches and
   a custom colour), width ("Point size" 1–7 for points, "Line width" 0.4–5 for curves; a range
   widens to hold a value set in the text), opacity, label (show + text), visible. "More" holds
   the rest of the former panel: dash (curves), z, label angle and distance, noimage. Texts get
   colour, opacity and visible; numbers, strings and maps show "Not drawn".
5. **Draft and Write to script.** The card edits a draft that the canvas previews (a scene
   built with the draft swapped in, not a document edit, like ADR-0024's tool preview). "Write
   to script" applies it as ONE `style` edit (one history entry; the text shows it), enabled
   only when it changes the object; "Reset" returns the draft to the default style, enabled
   only when that changes the draft. A control set to the value the object shows anyway
   (inherited or default) removes the attribute instead of writing it. Closing discards an
   unwritten draft: every state the user keeps is in the text (CLAUDE.md).
6. **Label "show"** uses the existing representation: `label=""` hides a label (what `@nolabel`
   writes); an absent label shows a point's name and nothing for other kinds.
7. **Images** show the values they inherit from their source, as the scene's effective style.

### Per-object opacity (kernel, lang, scene, export)

8. A new style attribute `opacity` in [0, 1] (absent = 1), in definitions and `style` lines,
   printed after `dash`. It multiplies the layer's opacity in the scene, the canvas and every
   export. Documents without it export byte-identically (the golden snapshots are unchanged).
   The editor refuses NaN or values outside [0, 1]; the scene treats a non-finite value as 1.
   ADR-0009's GRAMMAR comment on style keys is not edited; docs/language.md (generated) lists
   the attribute.

### Repeated constructions (kernel, lang, editor, web)

9. **Construction keys.** `@geomira/kernel/construction-key` decides, without evaluating,
   whether two definitions are the same construction: references by id (no alias following),
   literals by exact value, nested calls recursively, selectors in order, and the symmetries of
   item 10. A definition containing a free input anywhere (`point`, `on`, `param`; ToolSpec
   `input: true`) is never a repeat: free inputs move independently. `circumcircle` is
   `circle` (ToolSpec `sameAs`); `cline` is not (it differs on collinear points). Managed
   images are not compared.
10. **Symmetries are registry data**, per Signature (`symmetry`: `permute` positions, with
    `flipsOrient`, or `dihedral`), each marked `same: 'value'` (identical value) or `'figure'`
    (the same point set; a direction, anchor or vertex order may differ). Only symmetries
    declared by every overload the call's static argument kinds can match apply (`dist(A, B)`
    is symmetric, `dist(P, l)` is not). Inside a nested call only `'value'` symmetries apply,
    since a direction or anchor matters there (`along(+)` on `line(A, B)` is `along(-)` on
    `line(B, A)`): this misses some repeats but never refuses a different construction.
    Declared: midpoint, dist (two points), foot(P, ·, ·), the triangle centres, excenter and
    excircle (B ↔ C), intersect (a ↔ b, flipping `orient(±)`) as `'value'`; circle through
    three points, circumcircle, incircle, ninepoint_circle (`'value'` for B ↔ C, `'figure'` for
    any order); line, segment, perp_bisector, radical_axis, diameter_circle, cline, bisector and
    ext_bisector (A ↔ C), polygon (dihedral) as `'figure'`. Not declared yet: angle, area of
    points, other(a, b, P), mark_segment. docs/tools.md lists each tool's symmetry.
11. **GUI tools never add a repeat.** A tool that would add an object (or two in one batch)
    the same construction as an existing one reuses it: selects it, returns its id so a
    continuing tool uses it, adds no history entry, and says so in an information notice
    ("l is line(A, B) already"), answered by the next document edit or tool action. The
    editor's generic `add` edit is unchanged (the model-based fuzz test, L14, adds freely).
12. **The command bar refuses a repeat** (a new or redefined object the same construction as
    another), with the language's message on the command's line. Repeats already in the
    figure do not block other commands.
13. **The text** reports a repeat as a WARNING in the page's text panel ("m is the same
    construction as l (line(A, B)): use l"); the text is still applied. The language's
    `ParseOptions.sameConstruction` is `'error'`, `'warning'` or absent; absent (no report) is
    the default, because an error or a warning breaks frozen tests: the language laws require
    zero diagnostics on generated documents, and `tests/fixtures/export/constructions.geo`
    contains two repeats on purpose. An error in the page would also make an older file with a
    repeat impossible to edit.

## Frozen tests changed under this ADR

- `apps/web/e2e/flows-persist.spec.ts` ("objects panel lists Undefined reasons; style panel
  edits the text"): the lines that drove the Style tab now open the card for B, choose red,
  tick noimage under More and Write to script; it still expects
  `B = (2, 0) [color=red, noimage]` (3 lines changed or removed, 2 added; commit a8f76ea).
- Added lines only: `packages/kernel/test/exports.test.ts`, `packages/lang/test/exports.test.ts`
  (new subpaths), `packages/lang/test/helpers/gen-doc.ts` and the editor's fuzz commands
  (opacity draws).

## Consequences

- SPEC §15's "Style" panel is replaced by the card; every former field is reachable from it.
- Commit 19f0bbd removes StylePanel.tsx before 078ef00 adds the card, so apps/web does not build
  at that single commit (history is not rewritten).
- Repeats are prevented where the user builds (tools, command bar) and pointed out in the text;
  a file with repeats still loads and edits.

## Alternatives considered

- **Keeping the Style tab beside the card**: two places to edit the same thing.
- **Live edits instead of a draft**: Geomdraw's "Write to script" and the disabled buttons in
  the maintainer's screenshot ask for an explicit write; the draft never leaves a state outside
  the text.
- **Refusing repeats in the kernel's add edit**: breaks the editor fuzz model and every caller
  that builds documents programmatically; the rule belongs to where the user builds.
- **Value comparison (two objects equal after evaluation)**: would merge objects that coincide
  only in this figure, not by construction.
