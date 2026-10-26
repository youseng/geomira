# ADR-0031: v1.1 completion: the long-tail tools, arcs, building transformations alone, the views UI, mutation gates (Run 13)

Status: accepted (Run 13). Builds SPEC §1's v1.1 items "views UI, long-tail tools
(spiral_center, isogonal, symmedian, pole, radical_center, arc), mutation-testing gates"
(SPEC §6.2, §8.3, §15, §17 L15). Reads SPEC §4's `arc` field for the tools that put points on a
curve. Extends ADR-0024 (the map tools) at the maintainer's request. Adds nothing to SPEC's
runtime dependencies.

## Context

Run 13's brief: (1) the views UI (save, switch, rename, delete; a keyboard shortcut; every
action one document edit); (2) the six long-tail tools, each with the full tool checklist (one
compute<T>, degenerate tests, L3 where exact, a theorem test, an export mapping, docs) and its
argument symmetry declared (ADR-0029); `pole` the inverse of `polar` with its degenerate cases;
`arc` on the existing Circle `arc: {from, to}` field, drawn as the arc alone by every exporter;
(3) the mutation gates (num ≥ 80 %, kernel geometry and claims ≥ 75 %) made blocking in the
nightly job, computed over all shards by scripts/mutation-summary.ts. The maintainer added a
gap: the Reflect, Rotate, Homothety, Translate and Spiral palette tools only built one object's
image, so a standalone transformation (to apply or to make a layer from) needed typing.

SPEC names the six tools but not their arguments, results or degenerate cases, and it does
not say what an arc means to the tools that put a point on a curve (an intersection, a glider):
until now no tool built arcs, and every tool read a circle value as its full circle.

## Decision

### The six tools (packages/kernel/src/tools/conjugates.ts, poles.ts, arc.ts)

All six are rational in their arguments (no square root, no trigonometry), so each is exact
over Q and mod p (arc's orientation aside, below), and L3 compares it with the exact oracle.
Each one's export mapping is `'numeric'`: ADR-0014's frozen test pins exactly which tools are
constructive, and a constructive mapping needs an Asymptote helper checked by tex.yml.

1. **spiral_center(A, B, C, D)**: the center O of the spiral similarity taking A to C and B to
   D (the fixed point of SPEC's `spiral(A, B, C, D)`). From C − O = k(A − O), D − O = k(B − O):
   O = (AD − BC)/(A + D − B − C) in complex numbers, computed relative to A. The formula is
   symmetric in B ↔ C and A ↔ D, so O is also the center of the similarity taking A to B and C
   to D (the classical fact), and both are declared `'value'` symmetries. Degenerate:
   D − C = B − A (a translation) → Undefined; two points of a pair coinciding → that point (the
   other map of the pair fixes it). Theorem test: O lies on the circles ABX and CDX, X = AC ∩ BD.
2. **isogonal(P, A, B, C)**: the isogonal conjugate, (a²vw : b²wu : c²uv) in barycentrics with
   u, v, w the signed areas of PBC, PCA, PAB (as cross products along the sides, so a far P
   loses no digits), and the denominator a²vw + b²wu + c²uv = −(2[ABC])²·pow(P) taken from the
   power of P with respect to the circumcircle (the sum cancels badly for a flat triangle: four
   digits were lost on a figure of the float theorem test). Symmetry: A, B, C in any order
   (`'value'`). Degenerate: a degenerate triangle → Undefined; P a vertex → Undefined; P on the
   circumcircle → Undefined (the conjugate is at infinity); P on a side line → the opposite
   vertex (the reflected cevians meet there).
3. **symmedian(A, B, C)**: the symmedian from A, the line through A and D on BC with
   BD : DC = AB² : AC² (the median reflected in the bisector at A), achiral; B ↔ C symmetric
   (`'value'`). The symmedian point is `isogonal(centroid(A, B, C), A, B, C)` (property test:
   it lies on the three symmedians). Bisector-style tools take the vertex in the middle
   (`bisector(A, B, C)` is at B); this one takes it first, as a cevian from A is written.
4. **pole(l, c)**: the inverse of `polar` (tangents.ts): with n = rot90(d) and k = n·(p − O), the
   point O + (r²/k)·n. Degenerate cases, mirroring polar's: l through the center → Undefined
   ("its pole is at infinity", polar's "P is the center" case read backwards); l tangent → the
   touch point (polar's "P on c → the tangent"); a segment or ray → its carrier line. Symmetry:
   explicitly none (`symmetry: []`).
5. **radical_center(c1, c2, c3)**: the point with equal powers, from two radical axes;
   any order (`'value'`). Degenerate: two concentric circles; collinear centers (parallel
   axes); coaxal circles (the axes coincide) → Undefined with the reason.
6. **arc(A, B, C)**: the arc from A through B to C of the circle through them, a Circle whose
   `arc` runs counter-clockwise (SPEC §4): from A to C when A, B, C turn counter-clockwise, else
   from C to A, so it passes through B either way, and `arc(C, B, A)` is the same arc
   (`'figure'` symmetry: only the anchor, A, differs). It is reflection-equivariant (the
   mirror image of arc(A, B, C) is arc(A′, B′, C′), tested exactly), so it adds no orientation
   dependence (L16). As a point set it is continuous when B crosses line AC (it tends to the
   segment, or to the two rays outside it), so the orientation needs no band; only collinear
   points (within EPS, as cline decides) and coincident points are Undefined. Mod p the
   orientation needs an order: Inexact.

### What an arc means to other tools (packages/kernel/src/tools/arc-range.ts)

7. A point X of the carrier lies on the arc iff it is on the right of the chord from → to, the
   side test the claims' `on` already uses (ADR-0008 decision 4), decided as a length with the
   band, like a segment's range (ADR-0003 item 15): outside → not on it; within the band (near
   an end) → ambiguous; mod p → Inexact. Tools whose result is a point ON the curve honour it:
   - intersect (line ∩ arc, arc ∩ circle) and tangent_point / tangent_from: a candidate off the
     arc is not a candidate (none left → "no intersection: it lies outside the arc"); as for
     segments, a two-candidate call on an arc computes its list before asking for a selector;
   - other(a, b, P) and the `other(P)` selector: the other point off an arc → Undefined;
   - on(arc, …): the glider's point is clamped to the arc, at the nearer end (as a segment
     glider's t is clamped); the choice of end flips where both are equally far, on the far
     side of the circle, so there it is Undefined within the band.
     Tools that use the circle as a whole (center, radius, power, tangent(P, c), polar, pole,
     radical_axis, radical_center, inside / outside) use the carrier circle, as foot and parallel
     extend a segment to its line. Arcs mod p only arise from hand-built values (arc() itself is
     Inexact there); those cases are tested by calling compute directly.
8. The scene, the canvas and every exporter already drew arc values (images of arcs, ADR-0007;
   marks); `export/test/arc-tool.test.ts` checks that SVG, TikZ, Asymptote and the PNG plan draw
   only the arc, with the style card's colour, width, dash and opacity, and the mirror image.

### Building a transformation alone (packages/editor; the maintainer's note)

9. The five map tools (Reflect, Rotate, Translate, Homothety, Spiral similarity) get a
   **"Transformation only"** switch in the tool's hint box (`ToolUI.map`, `ToolState.mapOnly`,
   the UI edit `toolMapOnly`, outside history like the typed number). With it on, the tool
   leaves out its object step and builds the map itself, named as a transformation:
   `f = reflect(l)`, `f = rotate(O, 60)`, `f = translate(A, B)`, … (one document edit, in the
   text). The switch stays on across builds and while switching between map tools; toggling
   clears the picks (the steps change).
10. A new tool **Apply transformation** (⇧G, Transform group) builds `apply(f, X)` from a
    transformation (picked in the Objects panel, where maps are listed: they are not drawn) and
    an object, in either order. "Layer from transform" already takes such a map.

### GUI tools over the six kernel tools

11. Arc (3 points) ⇧K (Circles; K is the circle through three points), Symmedian ⇧Y (Lines),
    Isogonal conjugate ⇧I, Spiral center ⇧Z, Radical center ⇧X (Centers), Pole ⇧E (Points;
    line and circle in either order). Every lowercase letter was taken (ADR-0024); these Shift
    letters were free, and a test checks that no key is bound twice. Each has an icon.

### The views UI (SPEC §8.3, §15; packages/kernel, packages/editor/src/views.ts, apps/web)

12. **Renaming** is a new document edit `renameView { from, to }` (kernel, internal module
    `view-rename.ts`: the frozen exports test pins `views.ts`'s names): the name grammar and
    uniqueness are checked, an unknown view is refused, the view keeps its place, comments
    anchored to it follow it, and renaming to the same name changes nothing.
13. **The actions are editor data** (`@geomira/editor/views`): `saveView` (every layer's
    visibility and the canvas's current viewport, as `addView`), `switchView` (`applyView`:
    the layers and the document's `@viewport`), `cycleView`, `renameView`, `deleteView`, and
    `viewShown` / `currentView` / `suggestedViewName` (view1, view2, …). Each action is ONE
    document edit: in the text, one history entry, one undo. A view counts as shown when its
    listed layers have its visibilities and, if it has a viewport, the document's `@viewport`
    is it.
14. **The canvas follows a switch**: after the `applyView` edit, a viewport UI edit (outside
    history, ADR-0012 decision 4) moves the canvas to the view's viewport. Switching to the
    view already shown adds no history entry and only moves the canvas. Undo restores the
    document exactly and, as always, leaves the canvas where it is. Locked layers do not block
    a switch (ADR-0020 keeps visibility edits allowed).
15. **UI**: a "Views" section under the layers in the Layers tab: a name field (the next free
    name suggested; Enter or "Save view"), one row per view (click to show it, ✎ to rename in
    place, × to delete), the shown view highlighted. Accessible names ("Show view X", "Rename
    view X", "Delete view X", "New view name") avoid the substrings the frozen end-to-end
    lookups match.
16. **Shortcuts**: `]` shows the next view and `[` the previous one (the help's View section).
    Every letter and the Shift letters of item 11 are taken; no binding used the brackets.
    With no views the shortcut is refused with the reason.
17. **The single file** (ADR-0030): views live in the document, so they travel in the
    autosave and the share link; `e2e/file-url.spec.ts` gains a test that saves and shows a
    view from file://, reloads, and opens a share link with it.

### The mutation gates (SPEC §17 L15; scripts/mutation-summary.ts, nightly.yml)

18. **The gate is per package over all its shards**: `tsx scripts/mutation-summary.ts --gate
    <dir>` reads each shard's `mutation-report-<id>/mutation.json` (the layout
    actions/download-artifact writes), tallies each shard's own mutants with the existing
    `inScope` rule (incremental reports carry other shards' old mutants; those never count),
    sums detected (Killed, Timeout) and undetected (Survived, NoCoverage) per package — num;
    kernel = every kernel-* shard, the scope of stryker.kernel.json as it is plus the new tool
    files; claims — and compares in integers: num ≥ 80 %, kernel ≥ 75 %, claims ≥ 75 %. A shard
    whose report is missing or malformed fails its package: the gate never passes by omission.
    It prints one line per package and one per shard.
19. **A new job `mutation-gate`** (`needs: [plan, mutation]`, `if: always() &&
needs.plan.result == 'success'`) downloads every `mutation-report-*` artifact and runs the
    gate, so the nightly workflow fails when a score is below its threshold. It runs on the
    schedule, on dispatch (also with `full`) and on every push to main (ADR-0022); branch
    pushes still run no mutation. The per-shard summary step and its frozen tests are unchanged.
20. **The new tool files get their own place in the shards**: their 554 mutants include 256
    static ones (ToolSpec literals, each running the whole kernel suite), which would have
    pushed the catch-all shard past its time limit. `conjugates.ts` and `poles.ts` join
    kernel-a, `arc.ts` and `arc-range.ts` kernel-b (the two lightest shards); a listed file
    that does not exist at a commit stays in the catch-all, so no file can drop out.
21. **Survivors are killed by behaviour tests** (new files only: `packages/num/test/
mutation-kills.test.ts`, `precondition-reasons.test.ts`, `packages/kernel/test/
mutation-kills.test.ts`, `arcs.test.ts`, `packages/claims/test/mutation-kills.test.ts`,
    `mutation-kills-sampler.test.ts`), never by snapshots of messages. Survivors judged
    equivalent are listed in STATUS.

## Frozen tests changed

None modified. Lines were added to frozen files only: `packages/kernel/test/registry.test.ts`
(the six names), `degenerate.test.ts` (the table's new entries and arc cases),
`construction-key.test.ts` (a third circle in the fixture, the samples of the five symmetric
tools), `tools.property.test.ts` (the property spread), `packages/editor/test/exports.test.ts`
(the `./views` subpath) and `apps/web/e2e/file-url.spec.ts` (one test appended).

## Consequences

- A figure can hold an arc, and nothing built on it silently leaves it: an intersection, a
  second intersection, a touch point or a glider is on the arc or Undefined with the reason.
- The palette has seven more tools (56); its column scrolls, as before. The page-level
  screenshot baselines change with it (CI's own renders, ADR-0016 decision 19).

## Alternatives considered

- **symmedian as the symmedian point**: one call less for K, but the line is what a figure
  draws and what the claims use (AK, the tangents' meeting point on it); K is one isogonal
  call away.
- **arc(c, P, Q)** (an arc of a given circle from P to Q counter-clockwise): which of the two
  arcs it is depends on the orientation, so mirroring a figure would change it, an
  orientation dependence outside the selectors that L16 could not see. arc(A, B, C) names
  the arc by a point on it.
- **Arcs ignored by intersect and gliders (the carrier circle)**: an intersection or a glider
  could lie off the drawn arc while the figure says it is on it: silently wrong.
- **Five more palette tools that build maps alone**, instead of a switch: seven buttons more
  for the same five constructions; the switch keeps one tool per map, and Geomdraw's palette.
- **Constructive Asymptote for the new tools**: needs new helpers and tex.yml checks, and the
  frozen export-mapping test; numeric coordinates are exact to the figure.
