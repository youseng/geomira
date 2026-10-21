# ADR-0014: Export: SVG, PNG, TikZ, Asymptote, TeX escaping, constructive mappings (Run 9a)

Status: accepted (Run 9a). Builds SPEC §14 in packages/export over packages/scene (ADR-0010,
ADR-0011). Supersedes ADR-0003 item 11 ("export mappings are 'numeric' for every tool") and
ADR-0004 item 17, ADR-0007 decision 4 ("exporters stay numeric"): the kernel's `ExportMapping`
gains constructive ops (decision 9). Changes one line of a frozen test (decision 18). Numbered
0014 (note H of the run).

## Context

SPEC §14 lists the formats (SVG, PNG, TikZ snippet and standalone with six-digit colours,
Asymptote `standalone` with self-contained helpers and named pairs, "constructive where mapped,
numeric otherwise", and `aops`), the escaping table `texText` with `?` + `% Warning` + a UI
message for unknown characters, and a CI job that compiles every example's TikZ and standalone
Asymptote and checks Asymptote's `write()` coordinates against the kernel (≤ 1e-6·scale). The
run's notes add: exports read the scene, so what is exported is what is drawn (note A); the
display values are exported, images included (note B); readable, constructive Asymptote for
at least midpoint, foot, the triangle centres, the three kinds of intersection (helpers that
pick the selector's candidate), circumcircle, incircle, reflect and rotate, every mapping
covered by the coordinate check (note C); names as math (note D); an Export dialog with no
export logic in apps/web (note E); olympiad.asy vendored only if its licence allows. SPEC leaves
open: which view an export shows, units, fonts, how a mapping is represented in the registry,
how a helper is proved to pick the kernel's candidate, and where a raster is made.

## Decision

### What is exported (note A)

1. **The export frame** (`frame.ts`): the document's scene (`buildScene`, the canvas's
   primitives) laid out in a VIEW (`layout`, the canvas's display list: clipped paths, placed
   labels). The view is the canvas's when the app exports; otherwise the document's
   `@viewport`, else the figure fitted into 640 × 480 px with the app's 40 px margin. So layers,
   opacity, z-order, hidden objects, derived-layer images, the coincident-image rule and the
   label placement (Run 8b's collision avoidance, explicit `label_angle` / `label_dist`) are
   the screen's by construction. A view the scene refuses, or a side above 8192 px (TikZ
   dimensions stay below TeX's 16383.99 pt), is refused with the reason.
2. **Size**: an export has the screen's size: one CSS pixel is 0.75 bp (1/96 in vs 1/72 in), so
   one world unit is zoom × 0.75 bp. Widths, dot radii, dash patterns (`dashPattern`, moved from
   apps/web to scene/style.ts so the canvas and every export share it), mark sizes and label
   offsets are the canvas's pixels in bp. Labels use the format's fonts (TeX: Computer Modern at
   11 pt, the canvas: 15 px ≈ 11.25 bp); their reference point and side are the canvas's, the
   glyph widths are TeX's.
3. **Theme**: the canvas's light theme (ink #1b1f24, paper #fbfbf8, fill alpha 0.08), checked
   against apps/web's LIGHT_THEME by a web test. A style colour is read as CSS (`color.ts`:
   named colours, hex, rgb()/rgba(), hsl()/hsla()); one the export cannot read is drawn in the
   ink, as the canvas draws an invalid colour, and reported (a newer CSS form such as hwb()
   would be drawn by the canvas: the warning says so).

### Formats

4. **SVG** (`svg.ts`): the display list in CSS px, drawn as `render.ts` draws it (fills at the
   fill alpha, round caps, dots outlined in the paper colour, opacity per element, labels with
   sub- and superscripts as tspans shifted as on the canvas). Text is Unicode; nothing is
   replaced.
5. **PNG** (`png.ts`, "PNG (via scene)"): a raster needs a font renderer, which a pure package
   has not; the export plans it (the frame's display list at 1×, 2× or 3× device pixels) and the
   app draws it with its own canvas renderer (`drawDisplay`), so the PNG is the canvas's
   picture. The package finishes the file: a pHYs chunk (96 × ratio dpi, so it prints at the
   screen's size) and an iTXt chunk `GEOMIRA` with the figure's text, so the file reproduces
   the figure (`pngFigureText` reads it back).
6. **TikZ** (`tikz.ts`): the display list in world coordinates (`x = y = zoom × 0.75 bp`),
   clipped to the view; colours `\definecolor{gmcN}{HTML}{RRGGBB}` (six digits) with alpha as
   opacity; labels as nodes `anchor=…, inner sep=0pt` at the canvas's reference point. When a
   coordinate would exceed TeX's dimensions (a view far from the origin), all are relative to
   the view's centre and a comment says so. Snippet (needs tikz and amssymb) and standalone
   (`\documentclass[11pt]{standalone}`).
7. **Asymptote** (`asy.ts`): header (unitsize, pens, the drawn region), the helpers used, the
   named objects in construction order (decisions 9–12), then the drawing back to front
   (points, lines, full circles and polygons through their variables; marks, texts and arcs
   from the display list) and the labels (`labelmargin = 0`, the side as an align vector), an
   invisible frame and a clip to the view (so the picture is the view). `toAsymptoteCheck`
   appends one `write` per variable at `%.17g`.

### TeX text and labels (SPEC §14, note D)

8. **`texText`** writes any string as text-mode LaTeX (with amssymb): printable ASCII passes,
   the table `TEX_TABLE` maps ASCII specials (`# $ % & _ { } ~ ^ \ < > |`, `"` as `''`), Greek
   (lower case to `\alpha`…, ε `\varepsilon`, ϵ `\epsilon`, φ `\varphi`, ϕ `\phi`, ο `o`; upper
   case with a Latin form to `\mathrm{A}`…), ′ ″ ‴ ⁗, ∩ ∪, ∠ ∡, ⟂ ⊥ ∥, — –, °, ≤ ≥ ≠, →, · × − ±,
   ℓ, sub- and superscript digits, √ (and `√(…)` balanced to `\sqrt{\mbox{…}}`) and tab/CR/LF
   to a space; neighbouring math characters share one formula, and a prime and a superscript
   never make a double script. Anything else becomes `?` with a warning (character, code
   point, position); TikZ and Asymptote write a `Warning` comment line and the dialog shows the
   message. **Labels** (`tex-label.ts`): a name-like label (letters, digits, Greek, primes,
   stars) is math (`M_a` → `$M_{a}$`, `A_{12}` → `$A_{12}$`, `H'*` → `$H^{\prime *}$`, `ω` →
   `$\omega$`), each star written as the option `star` (default `*`, e.g. `\ast`); other labels
   and every text object are prose (`\textsubscript`, `\textsuperscript`). Every name form of
   ADR-0009 round-trips (2000 random names read back to the scene's label runs; TeX writes
   omicron as o, so the two are compared equal) and the fixtures compile in CI.

### Constructive Asymptote (SPEC §14, note C)

9. **The mapping is registry data.** `ExportMapping = 'numeric' | { constructive: ExportOp }`,
   `ExportOp` a closed vocabulary; constructive: midpoint, foot, circumcenter, centroid,
   orthocenter, incenter, intersect, line, segment, ray, circle, circumcircle, incircle,
   polygon, reflect, rotate, homothety, translate, spiral, compose, inverse, apply, add, sub,
   mul, div, neg (each tool maps to the op of its own name; a test lists them). The exporter
   switches exhaustively over ExportOp and chooses the variant from the argument types and the
   overload the registry resolves, so nothing outside the registry enumerates tools.
10. **What maps**: a definition whose call, and every nested call, has a constructive mapping
    and arguments of the types an overload takes; references are the objects' variables,
    literals exact numbers. Selectors (intersect only): exactly one of other(P) (Vieta, or the
    reflection in the line of centres: the kernel's own formulas), along(±) / orient(±) (the
    kernel's structural labels: a range only removes candidates), near / far_from /
    same_side / opposite_side only when no line argument is bounded (a range could remove the
    candidate the helper ranks first). Everything else (on_arc, between, inside, outside, two
    selectors, a pair of curves without a selector, which the language refuses anyway) is
    written numerically. A numeric object that depends on others is marked `// numeric`.
11. **Helpers** (`asy-helpers.ts`): plain Asymptote, written only when used, dependencies
    first: `gmline` (p, d, range flags, as the kernel's Line), `gmcircle`, the constructions,
    `gm_lc` / `gm_cc` (candidate pairs in the kernel's label order), `gm_low`, `gm_near`,
    `gm_far`, `gm_side`, `gm_lc_other`, `gm_cc_other`, maps (`gm_reflect`, `gm_homothety`,
    `gm_spiral`, `rotate`, `shift`, `inverse`, `*`), `gm_apply` for lines and circles, `gm_path`
    (a line cut to the drawn region) and `gm_dot`.
12. **Names**: identifiers spell the names (`H'` → `Hp`, `A*` → `As`, `M_{ab}` → `M_ab`,
    `ω` → `omega`); keywords, types, the functions the export calls, olympiad's functions and
    the `gm` prefix get `_`, collisions `_2`, `_3`.
13. **The coordinate check** (`check.ts`, SPEC §17 L10): every variable's numbers against the
    kernel's float value, relative error ≤ `EXPORT_TOL` = 1e-6 (tolerance.ts; positions and
    lengths over the scale, numbers over max(1, |x|)); lines by two points on the carrier, the
    sense of d, the range flags and ends; circles by centre and radius; maps by the images of
    three points; paths by vertices; each variable written exactly once. The fixtures
    (tests/fixtures/export) plus the examples use every variant, helper and op, which a test
    asserts, so CI covers every constructive mapping; random documents of the language laws'
    generator are checked too.

### olympiad.asy and the `aops` dialect

14. **Source and licence.** The package circulates as `olympiad.asy`, header "Olympiad
    Asymptote Package / By Maria Monks and AoPS community / Last Updated: 08/26/2007", pointing
    to an AoPS forum thread (a copy is kept "for version control" in the GitHub repository
    jrjohansson/ipython-asymptote, examples/olympiad.asy). Neither that file nor anything found
    publicly states a licence; without one, copying is not permitted. **It is not vendored.**
15. **The `aops` dialect** is the standalone output with `import olympiad;`, no texpreamble
    (AoPS's own LaTeX setup is used; whether it has amssymb is an audit item), and olympiad's
    functions only where they are documented
    publicly: `foot(P, A, B)` (the foot from P to line AB, `pair F = foot(X, A, B);` in the AoPS
    forum's olympiad.asy tutorial), `circumcenter(A, B, C)` and `incenter(A, B, C)` (points of a
    triangle, in the AoPS wiki page "Asymptote: Useful commands and their Output"). The AoPS
    pages answered this environment with HTTP 403; these signatures were read from search
    excerpts of those public pages (recorded under "Uncertain" in STATUS). Everything else uses
    the `gm` helpers, whose names avoid olympiad's. The dialect is snapshot-tested only (CI cannot
    compile it without the file) and docs/audit-checklist.md has the manual AoPS check.

### Tests and CI

16. **tex.yml**: the TeX Live + Asymptote image (Run 0) gains Node 22 (base images from
    mirror.gcr.io: public.ecr.aws refused a pull with 429 in this run); the job runs
    `scripts/export-tex.ts`: every example and fixture's standalone TikZ and TikZ snippet through
    pdflatex, its standalone Asymptote through `asy -f pdf`, the coordinate check, and the check
    on random documents. Golden snapshots of every example and fixture in every text format are
    committed (`packages/export/test/__snapshots__`), compared byte for byte in `pnpm verify`.
17. Per format, the exported objects and labels equal the canvas's for the same view (note A),
    including hidden objects, z-order, layers, objects off the view and an image-only view; the
    display values and their images are in every format (note B).
18. **Frozen test changed**: `packages/kernel/test/registry.test.ts` line 98 asserted
    `t.export === 'numeric'` for every tool, which decision 9 replaces; it now asserts that the
    mapping is 'numeric' or names an op, and the new `export-mapping.test.ts` pins exactly which
    tools are constructive. Lines only added: the `./style` names of scene's export test
    (`dashPattern`) and the `./tolerance` names of num's export test (`EXPORT_TOL`).

### The drag-frame budget (note F of Run 9a)

19. **What a "drag frame" measures** (SPEC §17: ≤ 8 ms at 300 objects). `e2e/drag-frame.spec.ts`
    traces the full UI frame in Chromium: the real mouse presses on a free point of the
    300-object figure, then the page dispatches one pointermove per animation frame (marked
    with `performance.mark`, no Playwright action in the window), and a frame is the sum of the
    page's main-thread tasks between two marks: the event, the editor's applyEdit, the scene,
    the layout, React, the canvas drawing calls, the DOM's style, layout and paint, GC.
    Headless Chromium in CI has no GPU, so it also rasterises the 2D canvas in software ON THE
    MAIN THREAD (`CanvasResourceProviderSharedImage::ProduceCanvasResource`, about 16 ms for
    this figure); with a GPU (a desktop browser; also headless with SwiftShader GPU flags) that
    raster runs in the GPU process. The spec reports `app` (everything but that raster),
    `raster` and `total`, and asserts the budget on the app's median, the work the app
    controls. This is a reading of SPEC §17 (Run 7's frame benchmark timed only the
    JavaScript of evaluate, layout and draw); STATUS asks the maintainer to confirm it.
20. **Panels settle during a drag** (`apps/web/src/settled.ts`): the side panel, the tool bar and
    the header's printed text show the state from before the drag and update at its end (or
    cancel); the canvas draws every frame. Before, the Text panel printed and parsed the whole
    document on every frame and React rewrote its textarea (27 ms of app work per frame). The
    other savings keep every result identical: label placement skips curves by cheap exact
    pre-tests, `syncDerived` skips pruning and adding images when there is no rule and no
    image, and the canvas font is set only when it changes.

## Consequences

- A new constructive tool adds an ExportOp, a case in asy-map.ts (the compiler requires it), a
  helper if needed, and a fixture line; the coverage test fails until the fixture uses it.
- Labels look like TeX in TeX formats, at the canvas's positions; long labels may sit slightly
  differently because TeX's glyphs are not the canvas's.
- PNG export needs the app (a canvas); the package produces everything else.

## Alternatives considered

- **Vendoring olympiad.asy**: no licence; rejected. Re-implementing olympiad's functions under
  its names: the dialect's point is AoPS's own package.
- **Export mappings as a table in packages/export keyed by tool name**: a second enumeration of
  tools (SPEC §6.1) that could drift from the registry.
- **TikZ in screen pixels**: never overflows, but unreadable; world coordinates with a fallback
  origin keep both.
- **Exporting the scene's world shapes instead of the display list**: unclipped circles and lines
  overflow TeX dimensions, and the labels' placement lives in the layout.
- **A pure PNG encoder with a rasteriser**: needs fonts; the canvas already draws the picture.
- **Proving helpers equal to the kernel by a TypeScript mirror**: the CI check compares the real
  Asymptote output, which a mirror would not.
- **Mapping near / far_from / sides on segments**: the helper ignores the range and could rank a
  candidate the kernel removed; numeric is honest.
