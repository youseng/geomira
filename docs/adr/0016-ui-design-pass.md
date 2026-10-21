# ADR-0016: The UI design pass in Geomdraw's look; Randomize (Run 9b)

Status: accepted (Run 9b). Restyles apps/web after the maintainer's earlier prototype Geomdraw
(docs/design/geomdraw-reference.zip: its layout, CSS variables, colours, type and tool icons;
none of its JavaScript). Extends ADR-0013 (the web app: decisions 11 and 13 on internal errors
and accessible names) and ADR-0014 decision 3 (the export theme follows the canvas). Adds
Randomize to packages/claims and packages/editor, moves the exact decimal helpers of
packages/editor into packages/num, and changes one line of a frozen test (decision 14).

## Context

Run 9b's brief: Geomdraw's layout (brand; an icon top bar with undo/redo, claim box + Test,
View / Examples / Export menus, settings and help; a left tool palette with icons in labelled
groups, tooltips and shortcut letters; the right panel with tabs Text, Objects, Layers, Claims,
Style, Help; zoom and fit floating on the canvas; the status line; the command line), its
canvas style (italic serif labels with real subscripts, small points, thin strokes, its colours
for highlighted and selected objects) with the scene laws and the export theme kept in sync,
claim cards, live claim chips, developer items out of the main UI, a phone layout, a Randomize
button with a triangle type that samples through packages/claims, accessibility (accessible
names equal to the old labels, visible focus, WCAG AA), a README with a landing section and a
smoke test of the deployed site. Presentation only: no new geometry, editor, claims or export
behaviour, and no logic in apps/web. The frozen tests of Runs 7–9a pin parts of the old look:
the export theme's values (`frame-paint.test.ts`, `svg-tikz.test.ts`, `export-theme.test.ts`),
the canvas font string (`render.test.ts`: `15px <family>`), the dot radius 3.5 px and the stroke
width 1.5 px (scene and export tests), the brand markup (`App.test.tsx`: `<h1>Geomira</h1>`),
and the end-to-end selectors.

## Decision

### Layout and look (apps/web: styles.css, stage.css, panels.css, phone.css)

1. **Geomdraw's grid and tokens.** A grid of top bar, palette (96 px), stage, command line and
   side panel (360 px); Geomdraw's CSS variables (bg, panel, border, text, muted, accent, ok,
   amber, bad, info and their soft tints, the dark-scheme set) with three text colours darkened
   for WCAG AA on their tints (muted #62625d, ok #2b7530, amber #8a5800; the ratios are in
   STATUS); system-ui for the interface, Geomdraw's serif stack for math, a monospace stack for
   code and verdict details; `:focus-visible` draws a 2 px accent outline everywhere.
2. **Icons are data** (`icons.tsx`): Geomdraw's 24 × 24 tool icons written as static SVG, one per
   tool of the editor's tool table (`Record<ToolId, …>`, so a new tool does not compile without
   one), plus Unicode glyphs in the top bar (↶ ↷ ⚄ ◇ ▤ ⤓ ⚙ ?). Icons designed here where
   Geomdraw had none: point on object, polygon, layer from transform, text, claim.
3. **Tool groups are editor data** (`@geomira/editor/tool-groups`): Points, Lines, Circles,
   Transform, Marks, Measure / Claim, each tool in exactly one group (a Record over ToolId),
   in the tool table's order. Geomdraw's "Centers" group is left out: the editor has no centre
   tools (they are reachable from the command line), and adding tools is editor behaviour
   outside this run; an empty group would be a dead control.
4. **Canvas overlays** (`Stage.tsx`): the active tool's controls (claim kind, text, Finish,
   Cancel picks) top left with notices and internal errors under them; a developer box top right;
   live claim chips bottom left; zoom, zoom out and fit bottom right (a column on the desktop, a
   row on the phone); the status line (the tool's prompt) along the bottom, pointer-transparent.

### Accessible names and the frozen selectors (note 7 of the run)

5. **Names are visually hidden text, not aria-label.** Every icon button keeps its old label as
   its accessible name through a visually hidden span (`SrOnly`): Undo, Redo, Zoom in, Zoom out,
   Fit, Settings, Help, and every tool's label. aria-label would make the button match
   `getByLabel`, and the text tool's label "Text" would then collide with the text panel's field
   (`getByLabel('Text', { exact: true })` in the frozen helpers; ADR-0013 decision 13 records the
   same care). Labels shown beside a glyph on the desktop (Randomize, View, Export) are visually
   hidden on the phone, never `display: none`, so names do not change with the layout.
6. **The brand** is one heading whose text is "Geomira" (the frozen shell tests read it); the
   logotype, "Geom" upright and "ira" italic as Geomdraw's brand, is CSS generated content with
   empty alternative text (`content: 'Geom' / ''`), so the accessible name stays "Geomira".
7. **Menus are disclosures** (`Menu.tsx`): a button with aria-expanded and a popover of ordinary
   buttons and checkboxes, so each entry keeps the role and name it had as a bar button. The
   Examples menu is the page's native select (label "Example") laid invisibly over its button,
   so `selectOption` keeps working and the platform's own list opens on a phone.
8. **Moved controls.** Share link and Restore previous figure → the Export menu (with the four
   formats, each opening the Export dialog on that format); Debug report → the Help menu (every
   internal-error message keeps "Copy debug report", ADR-0013 decision 11); Measure frame time and
   the object counts → the Settings menu, both on from the start with `?dev=1`; the layers →
   the Layers tab, which also states "n coincident images hidden" (SPEC §13); Fit and zoom → the
   canvas.
9. **The claim boxes' button reads "▸Test"** (a glyph before the word), never exactly "Test":
   Run 8b's frozen long-task spec clicks the first button whose text content is "Test", which
   must stay a claim card's.

### Canvas style and the export theme (note 2 of the run)

10. **Italic serif labels.** The label family becomes `"Geomira Math", "Latin Modern Roman",
"CMU Serif", "Liberation Serif", "Times New Roman", serif`, where "Geomira Math" is an
    @font-face of local() italic faces (Latin Modern, CMU, Liberation Serif, Times New Roman,
    DejaVu, FreeSerif, in that order; Liberation Serif is the CI machines' and comes before Times
    so the screenshot baselines are deterministic). The renderer's font string stays
    `15px <family>` (frozen `render.test.ts`); the board redraws once the face has loaded. The
    export theme follows (EXPORT_THEME.fontFamily, checked by the web test), and SVG labels are
    written with `font-style="italic"` (TeX formats already set labels as math). Real sub- and
    superscripts were already drawn (scene label runs); the panels show names the same way
    (`MathText`, the scene's label grammar on each point name).
11. **Colours.** Hover and selection take Geomdraw's highlight blue (#1f6fd1) and selection blue
    (#2f5fb3, a light ring at the halo's opacity). Ink #1b1f24, paper #fbfbf8 and the fill alpha
    0.08 stay: frozen export tests pin them, and they are within a hair of Geomdraw's #111111
    and white. The dot radius 3.5 px and stroke width 1.5 px stay for the same reason (frozen
    scene and export tests); they are already small and thin at Geomdraw's scale.
12. **Fit margin.** The desktop layout fits a figure with a 72 px margin (`WIDE_FIT_MARGIN`), so
    labels at its edge stay clear of the floating zoom column; the phone layout (zoom buttons in
    a row) keeps FIT_MARGIN = 40, as does the export's default view.

### Claims (note 3 of the run)

13. **Cards and chips.** A card per claim: the statement in italic math (keyword "claim"
    kept, so the frozen `claimItem(page, 'claim')` finds it), its pill for the current figure with
    the unchanged badge texts ("true in this figure", "false …", "undefined: <reason>"; ✓ ✗ ?
    are CSS), Test and Test globally, the verdict line (SPEC §10.5 wording, unchanged) and its
    monospace detail line; results for an earlier figure are greyed (opacity) under the note
    "These results are for an earlier version of the figure." with Re-test. Global findings are
    the info colour, never the failure colour. Live chips (bottom left of the canvas) show every
    claim's pill; they read the settled state, so a drag frame evaluates no claim (note F of Run
    9a), and a click opens the Claims panel. The claim box (top bar; on the phone the Claims
    panel) adds `claim …` as one edit through the command path and starts its local test.

### Frozen tests changed (CLAUDE.md add-only rule)

14. **Modified line (1):** `packages/export/test/frame-paint.test.ts`, the theme's
    `fontFamily` (decision 10: the italic label family the brief asks for; Prettier writes the
    new value on two lines); nothing else in that test changes. **Added lines (11, no line removed):** `scene.spec.ts` opens Settings before
    Measure frame time and the Layers tab before reading the coincident count; `mobile.spec.ts`
    and `flows-build.spec.ts` open the Layers tab before using a layer's checkbox;
    `flows-export.spec.ts` chooses SVG in the Export menu after each click on Export (3);
    `flows-persist.spec.ts` opens the Export menu before Share link and before each Restore
    previous figure (3), and the Help menu before Debug report. The export golden files
    (`packages/export/test/__snapshots__/*/figure.svg`) change in their font line only; the
    screenshot and PNG baselines are regenerated for the new look.

### Randomize (note 6 of the run)

15. **`@geomira/claims/randomize`**: `randomFigure(doc, registry, type, seed)` draws a new figure
    of the same construction with the GLOBAL sampler (sampler.ts, never mirrored here) and accepts
    it with the tester's own hypothesis check: the document's `assume` lines plus the type on the
    triangle, the first three free points in construction order: acute → acute(A, B, C); obtuse →
    angle(B, A, C) > 100 (at the first vertex); right → no hypothesis can say it (right angles are
    constructed, never assumed, SPEC §6.2, §10.3), so C is moved onto the perpendicular to AB at A
    exactly over Q, a special position of this figure only; any → the document's hypotheses
    only. Typed choices also ask the other angles to exceed 15°, as the `triangle` sugar does
    (ADR-0009 decision 11). A sample is accepted only if every object defined now stays defined.
    Free inputs are rounded to short exact decimals (points and radii to 10^(⌊log10 scale⌋ − 2))
    before the check, so the text reads `A = (1.23, -0.5)`. Refusals carry their reason (no free
    input; a typed choice without three free points; no accepted sample in 500 attempts).
16. **`@geomira/editor/randomize`** turns it into one batch of `redefine` edits (one history
    entry; undo returns exactly) and refuses during a drag. apps/web draws the seed from Web
    Crypto (host code, as ADR-0013 decision 9), applies the edit and fits the view.
17. **`@geomira/num/decimal`**: the exact decimal helpers (pow10, floorLog10, roundTo,
    decimalText) move from editor's rounding.ts, which re-exports them unchanged.

### Phone (note 5 of the run)

18. At ≤ 760 px wide: the top bar shows glyphs only (the claim box and the triangle type are
    hidden; Randomize uses the last type chosen); under the canvas the tab row, then the tool
    strip (groups side by side, their labels vertical), then the command line. A tab opens its
    panel as a drawer from the top bar to the tool strip ("Hide panels" closes it), so the canvas
    keeps its size.

## Consequences

- apps/web gains no decision: the groups, Randomize, the claim and verdict texts and the badges
  are the packages'. A new tool needs an icon (the compiler asks) and a group (the Record).
- Screenshots and PNG goldens depend on the label face: CI and the development machine both use
  Liberation Serif Italic; a machine with Latin Modern or CMU draws those (as Geomdraw did).
- The developer readouts no longer take space in the panels; `?dev=1` restores them at once.

## Alternatives considered

- **aria-label on icon buttons** (the brief's wording): breaks the frozen text-panel selector
  for the Text tool; visually hidden text gives the same accessible name.
- **Changing the canvas font string to `italic 15px …`**: modifies `render.test.ts`; the italic
  face as its own family needs no change there.
- **Geomdraw's ink and paper**: modifies six frozen export assertions for a difference of a few
  levels of grey; kept for the next run that may need it.
- **Smaller dots and strokes**: modify frozen scene and export tests; not needed for the look.
- **An Export button that opens the dialog directly**: fewer test lines, but Share and Restore
  would need another place than Geomdraw's Export menu.
- **A Centers group with the triangle centres**: new GUI tools are editor behaviour, not
  presentation.
- **Randomize sampling in apps/web**: logic in the UI (note A of Run 8b); and an assumed right
  angle, which SPEC forbids.
