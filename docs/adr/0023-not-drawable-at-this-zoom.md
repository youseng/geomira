# ADR-0023: Curves that cannot be placed at the zoom are listed, not silently missing (Run 10, W10)

Status: accepted (Run 10, the maintainer's decision on the audit's finding W10). It extends
SPEC §13 (the scene, law L9) and ADR-0010 (the display list).

## Context

The audit found that a circle whose radius is about 10¹⁶ times the view or more was not drawn
where it crosses the view: for example, center (0, 10¹⁶) through the origin, seen 20 units
wide, or center (10⁶, 0) through the origin at zoom 2⁴⁰. The circle exists, but it was not
drawn and not listed. At 10¹⁶ the layout drew a span 2 ulps wide, and at 10¹⁸ it drew nothing.

This is a limit of doubles, not a logic error. A point of the circle is computed as
c + r·(cos θ, sin θ), and is off by about ε·(|c| + r) world units: for r = 10¹⁶ that is a few
units, or many pixels at that zoom. No drawing of it would be right. The maintainer's decision:
an object that exists but cannot be placed at the current zoom is listed as "not drawable at
this zoom" in the Objects panel, and counted in the developer readout, never silently missing.

## Decision

1. **Placement** (`packages/scene/src/placement.ts`, `curvePlacement`). For a circle (or arc)
   and a line (or segment or ray), the layout estimates the world error of the points it would
   compute near the view:
   - a circle: 4ε·(|c.x| + |c.y| + r);
   - a line p + t·u: 4ε·(|p.x| + |p.y| + |t|), at the parameter t nearest the view's center,
     clamped to a segment's or ray's range.

   It also takes the curve's distance from the view's center, which for a circle is
   | |center − c| − r |. Then:
   - **outside**: the distance exceeds the view's half diagonal plus the error. The curve
     cannot pass through the view, so it is not drawn and not listed.
   - **ok**: the error times the zoom is at most PLACEMENT_PX = ½ px. The curve is drawn as
     before.
   - **unplaceable**: otherwise. The curve is not drawn and is listed.

   Points, polygons, marks and text are placed at their exact coordinates and are not affected.

2. **The display list** gains `undrawable: { id, name }[]`, the unplaceable curves, each
   once. It is empty for a view with a problem. Hit-testing reads the drawn items only (L8),
   so an undrawable curve is not hit, consistently with not being drawn.
3. **The web app.** The board reports its display list's undrawable curves, and the page keeps
   their ids (the same array while they do not change, so the memoised panels do not re-render
   every frame):
   - the Objects panel appends "· not drawable at this zoom" to such a row;
   - the developer readout (Settings or `?dev=1`) reads "N drawn · M undefined · K not
     drawable at this zoom".
4. Zooming out, or editing the figure, makes the curve placeable again, and the listing goes
   with it.

## Consequences

- Tests:
  - `packages/scene/test/placement.test.ts`. A circle of radius 10¹⁶ and one of 10¹⁸ at zoom 20,
    and the audit's case at zoom 2⁴⁰, are listed. 10¹² and the same circle at zoom 2²⁰ are
    drawn. A huge circle passing 10⁶ from the view is neither drawn nor listed. A line given
    by a point 10¹⁷ away is listed. Ordinary figures at zooms from 2⁻²⁰ to 2³⁰ list nothing.
    The three placement results of `curvePlacement` are each checked.
  - `apps/web/e2e/flows-audit.spec.ts`: a circle through the origin with center (0, 10¹⁶),
    wheeled in to zoom 20, shows in the Objects panel and the dev readout. It failed before.
- The frozen display and clip tests are unchanged and pass. A circle of radius 10⁶ at zoom 10³
  is still drawn as a polyline: its error is about 10⁻⁶ px.
- `scene/test/hunt-extreme.test.ts` (Run 10) keeps checking that everything drawn is finite
  and near the surface. Its doc comment now points here.
- The DisplayList type gains a required field. Every producer is `layout`.

## Alternatives considered

- **Draw the best guess.** That is garbage when the error is many pixels, against "undefined
  is shown as undefined, never as garbage".
- **List them in the Scene's `unavailable`.** The Scene is independent of the view, but
  placement depends on the zoom. The display list is the view-dependent part.
- **Recompute the curve near the view from exact data.** The kernel's float value of the
  circle is all the scene has, and its center and radius are already rounded by about the
  same error. An exact recomputation would need the exact rung in the renderer.
