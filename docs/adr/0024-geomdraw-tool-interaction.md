# ADR-0024: GUI tools that work like Geomdraw's

Status: accepted (maintainer request of 2026-10-22, between Run 10 and Run 11). Extends ADR-0012
(the editor core: tools as data, the GUI selector choice) and ADR-0016 (the palette, its groups,
icons and keys). No kernel, claims or scene behaviour changes: every tool here builds a call the
language already writes.

## Context

The maintainer compared Geomira's tools with their earlier prototype Geomdraw and found
Geomira's rigid: (1) a perpendicular through a point needed the point first, then the line;
(2) the tangent tool needed the point first, then the circle, and built only one of the two
tangents from an outside point, after a further click choosing it; and Geomdraw's palette had
tools Geomira's kernel supports but its GUI did not offer. The request: Geomdraw's tools,
interactions and UI, with Geomira's engine underneath (its kernel, selectors and laws), so that
Geomdraw's edge-case bugs do not come back.

Geomdraw's behaviour (read from its source in youseng/geomdraw-old, `src/js/ui.js`): tools
whose inputs differ in kind (point and line, point and circle) accept them in either order; the
tangent tool from an outside point writes `t1, t2 = tangents(P, w)`; the intersection tool writes
`X, Y = intersect(a, b)`; numbers (rotation angle, homothety ratio, radius) are asked for in a
small prompt; its keys are V P I E M F, L S H J B N T, C K D, X R Z, A Q.

## Decision

1. **Order-free picks** (`ToolUI.anyOrder`). A tool whose steps differ in kind takes its picks
   in any order: parallel, perpendicular and foot (point, line), tangent, polar and power
   (point, circle), second intersection (curve, curve, point). A click fills the first open step
   that takes the first hit it can (the scene's hit order, so a point under the cursor wins over
   the line through it, as before); when no hit fits and a point step is open, the click creates
   a point (free, glider or intersection: unchanged, ADR-0012 item 15) for that step. Panel picks
   follow the same rule. The tool state records the step each pick filled (`ToolState.slots`),
   and the call is built in the order of the steps, so `perp(C, l)` is written whichever was
   clicked first. Tools whose steps have one kind keep their order (ray A→C is not ray C→A), and
   so do the map tools, whose object may itself be a point (rotate X about O).
2. **Both tangents.** The tangent tool with a point on the circle builds `tangent(P, c)` as
   before. With a point outside it builds BOTH `tangent_from(P, c, …)` lines at once, as one
   batch edit (one history entry, one undo), each written with the GUI selector choice of SPEC §7
   for its own candidate (the choice's "click" is that candidate's touch point). The choice's
   order is unchanged, so a reflection-equivariant selector is written whenever the construction
   offers one (`same_side(C, l)` / `opposite_side(C, l)` in the tests) and `orient(±)` only when
   none decides (law L16 unchanged). A point inside the circle is refused with the reason.
3. **Every new intersection.** The intersection tool on two curves that can meet twice builds
   every common point that is not a point of the figure yet (within the decision band), as one
   batch, each with the GUI choice for its candidate. A common point that exists already makes
   the new one `other(P)` (tier 1 of the choice: exact, and the reason the GUI prefers it, SPEC
   §10.5). Both existing: refused ("every intersection of these curves is a point already");
   not meeting: refused. Two lines: the one point, as before. The click that chose a candidate
   (`ToolState.choosing`) is gone: no tool waits for it any more. Clicking one intersection with
   the point tool still creates that one alone (unchanged).
4. **New GUI tools over existing kernel tools** (Geomdraw's palette): second intersection
   (`other`), external bisector, polar, radical axis, circle (center, radius), circle on a
   diameter, rotate, translate, homothety, spiral similarity, ratio, area (of a triangle) and power
   of a point. The ratio tool may pick a point twice (AB / AC; `ToolUI.repeats`). They join the
   existing groups (Points, Lines, Circles, Transform, Measure / Claim); the group list is
   unchanged. Each has a Geomdraw icon (`apps/web/src/icons.tsx`).
5. **Typed numbers** (`ToolUI.value`): rotate (angle in degrees, initially 60), homothety
   (ratio, 2) and circle (center, radius) (1) show a field in the tool's hint box. Its text is in
   the tool state (`ToolState.value`), changed by the UI edit `toolValue` (outside history; the
   picks stay), and read at the last pick as an exact literal (num's `parseRational`: `90`,
   `-1/2`, `0.5`; a trailing `°` is allowed), written as the call's last argument with its text
   as typed. Anything else is refused at the last pick with the reason, the picks kept. This
   replaces Geomdraw's modal prompt: a field can be filled before or between the clicks and keeps
   the last number for the next use.
6. **Keys after Geomdraw** where Geomdraw had a letter for a tool Geomira has: V move, P point,
   I intersection, E second intersection, M midpoint, F foot, L line, S segment, H parallel,
   J perpendicular, B perpendicular bisector, N angle bisector, T tangent, C circle, K circle
   through three points, D circle on a diameter, X reflect, R rotate, Z homothety, A angle,
   Q distance (the digits stay with the centers and triangle circles, ADR-0016). Geomira's tools
   that Geomdraw had no letter for keep G (glider), Y (polygon), W (right-angle mark) and U
   (segment mark); the others take a Shift letter: ⇧L ray, ⇧B external bisector, ⇧P polar,
   ⇧R radical axis, ⇧C circle (center, radius), ⇧V translate, ⇧S spiral, ⇧M angle mark, ⇧T
   text, ⇧Q ratio, ⇧A area, ⇧O power, ⇧H claim, ⇧J layer from transform, ⇧N nine-point circle.
7. **The status line's text is editor data** (`@geomira/editor/prompt`, `toolPrompt`): the open
   steps of an order-free tool are joined ("point and line, in either order"). It replaces the
   function apps/web had (note A of Run 8b: no logic in the UI).

### Frozen tests changed (CLAUDE.md add-only rule; each commit cites this ADR)

8. `packages/editor/test/machine.test.ts`, two tests whose assertions were the removed
   behaviour:
   - "mark_right only on a right angle; tangent …": the five lines asserting the
     `choosing` state and the click on one tangent are replaced by two assertions that both
     tangents exist; the existing check that a tangent lies above OP now names `l_2` (the
     upper one) instead of `l_1`.
   - "intersection tool: …": the title (which named the click), and the three lines asserting
     the `choosing` state, a refused panel pick and the choosing click, are replaced by an
     assertion of the second point, `F = intersect(l, c, same_side(B, m))`. The test's last
     assertion, `E = intersect(l, c, opposite_side(B, m))`, is unchanged and still holds: the
     same GUI choice gives the same selector.

   No assertion is weakened: each removed one asserted the old interaction, and the new
   assertions are stronger (both objects, with exact definitions).

9. `packages/editor/test/exports.test.ts`: two added lines (the `./prompt` subpath).

## Consequences

- A tangent or a pair of intersections is one undo, as in Geomdraw, and never a bare index or
  an orientation-dependent selector where a semantic one decides.
- `tool-steps.ts` holds the steps logic (machine.ts re-exports `stepsOf` and `claimToolKinds`,
  so its public names are unchanged); `machine-build.ts` holds what tools build.
- The palette is taller (49 tools); its column scrolls on small screens, as Geomdraw's did.

## Alternatives considered

- **Keep "click the one you mean"** for intersections and tangents: rejected by the maintainer's
  request (two tangents) and Geomdraw's behaviour; the point tool still makes one intersection.
- **Order-free picks for every tool**: ambiguous when two steps have one kind (ray, segment
  marks, the map tools whose object may be a point); kept to tools whose steps differ in kind.
- **Geomdraw's index-based `X, Y = intersect(a, b)`**: an index flips when the figure changes
  orientation; SPEC §7 forbids it. Each object gets the GUI choice's selector instead.
- **A modal prompt for numbers** (Geomdraw's popover): a field in the hint box needs no async
  step in the machine and keeps every input an edit or a tool input.
