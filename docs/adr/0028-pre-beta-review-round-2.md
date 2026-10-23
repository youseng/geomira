# ADR-0028: Pre-beta review, round 2 (medium bugs)

Status: accepted (pre-beta review round 2, 2026-10-23). Amends ADR-0019 decision 3, ADR-0023
(polygons) and ADR-0008's verdict texts; clarifies SPEC §5 (free gliders), §7 (the static
selector check), §10.4 (the samplers' random similarity) and §12 (autosave, the debug log).

## Context

A second review hunted medium bugs on main after ADR-0027: about thirty new defects across every
package and the web app, plus the ten medium bugs ADR-0027 left open. Each is fixed by a commit
whose test failed before it. This ADR records the decisions those fixes took; the commits and
their tests are listed in docs/STATUS.md.

## Decision

### Language (packages/lang)

1. **Division chains.** No glued fraction is read right after `/` (or `/-`): `a/2/3` is
   (a/2)/3, as ADR-0009 decision 8 says. The printer writes `a / (2/3)` for a division by a
   fraction literal. Text written by earlier printers as `a / 2/3` (meaning a/(2/3)) now reads
   as (a/2)/3 with the warning "x / 2/3 is read as (x / 2) / 3". Lexer warnings no longer fail
   a line.
2. **`triangle ABC <type>` on existing points.** New vertices are drawn from the line's seed on
   a grid centred on the existing points (two existing points at distance d: d counts as 4 units;
   the step is a power of ten, so coordinates stay exact decimals), with ADR-0009's margin; the
   side between two existing points is not length-checked. Three existing points must already
   have the type (strict sign test). Coinciding, undefined or non-point vertices, a triangle
   without the type, or no draw found is an error, and nothing of the line is applied.
3. **Equality claims.** `length(…)` and `distance(…)` read as `dist` in claims and assumptions,
   so `length(A, B) = length(C, D)` is the length claim. An `x = y` claim of non-points gets a
   WARNING with the tester's own message (not an error: a frozen language test requires
   `claim equal(dist(A, B), dist(A, B))` to parse cleanly, and the editor's P1 fuzz test prints
   such claims without a registry). The claim then reports "invalid" when tested, as before.
4. Glued forms `dist(AB)`, `length(AB)`, `angle(ABC)`, `∠(ABC)`, `∡(ABC)` are spread in claims
   and assumptions as in definitions (ADR-0025 decision 4); count errors point at the call.
5. `circle(O, AB)` keeps ADR-0025's reading (the circle through O, A, B) with a non-blocking
   warning naming `circle(O, dist(A, B))`. Warnings never make an expression fail.
6. A line with an error applies nothing (ADR-0009 decision 14 now holds for `triangle`, `points`
   and `X, Y = …`); its new names are marked failed. A leading BOM is ignored. Hints name what
   to write for products, calls, powers, roots, `×`, `÷`, glued names and `AB/2`. Comment CRs,
   negation depth, non-BMP characters, the `@version` comment in migrations and a triangle line's
   comments are fixed as reported.

### Claims (packages/claims)

7. **The samplers' random similarity is applied only to figures it maps consistently.** A static
   check per prepared figure (`frame.ts`) looks at every object the claim and hypotheses use,
   the claim and the assumptions:
   - point coordinates and `on(c, θ)` angles must be free literals, else neither the random
     similarity nor mirroring is used;
   - a `circle(O, r)` radius must be a free literal, else no similarity (mirroring keeps
     lengths, so it stays);
   - a non-free `on(c, u, v)` built from literals, params and arithmetic turns mirroring off;
     otherwise both are off;
   - every other number argument (`on(l, t)`, divide, rotate, homothety, marks) must be built
     from literals, params and arithmetic, else no similarity;
   - an assumption comparing a length with a number turns the similarity off;
   - claim literals (k, n, θ) are dimensionless constants and safe.
     Without the similarity a sample is the identity plus ADR-0017's size-relative noise; the
     verdict says so ("no random similarity (C has the fixed coordinates …)"). Randomize applies
     the same rule. The rule is conservative (e.g. `circle(O, dist(A, B))` also loses it). This
     restores what ADR-0027 item 2 relies on: every sample is the same figure up to a similarity.
8. **Verdict texts** state invalid figures ("100/100; 100 of 200 figures undefined") and rejected
   counts. The verdict LINE adds rejected counts for the global orientation and configuration
   results only (a frozen test pins the local line). Inline claim sites are named "the claim's
   `…`", never an internal probe.
9. **Orientation test (L16).** Global undefined, degenerate and ambiguous figures enter the flip
   test; one that holds when flipped is a repaired failure. ORIENTATION-DEPENDENT requires at
   least one orientation-dependent selector, every false figure repaired, at least one false or
   repaired figure, and true + false + repaired ≥ N/2.
10. **Acceptance per orientation.** The global test counts attempts and acceptances per
    orientation; when only one is below 5%, the text names mirroring and the fixed-orientation
    construction, not "hard to satisfy". Exactly half of the tested figures stay mirrored (SPEC
    §10.4), so a shortfall is stated, not filled.
11. The badge and the local test judge the current figure with the same seed; the noise floor's
    step for `on(c, u, v)` is relative to |(u, v)|.

### Kernel (packages/kernel)

12. A `Signature` may declare `preserves: k` (the result has the kind of argument k: the image
    sugar and `apply`). Static checks use it, so an image of a line is a line and
    `intersect(l*, k)` needs no selector; an image of a circle still does.
13. **Free gliders** are only `on(obj, <literal parameters>)` (SPEC §5). A glider whose parameter
    is computed is not draggable ("X is not draggable: its parameter is computed"), in the
    editor and through drag-through; moving a referenced `param` instead was rejected (it would
    rewrite another, possibly shared object).
14. After every edit the kernel re-checks each derived-layer rule's transformation kind and
    refuses an edit that would break a working rule (ADR-0007 decision 11 through aliases).
15. **Amends ADR-0019 decision 3:** a valid float similarity needs |a|² and 1/|a|² finite
    (about 1e-154 ≤ |a| ≤ 1e154), so valid maps are closed under inversion; a map beyond that is
    Inexact where it is built.
16. `syncDerived` leaves the document in text order (each image right after the later of its
    source and its map), so P1 holds after moving a map.

### Scene and export

17. **Hit-testing a tangency.** Two curves drawn at most 0.5 CSS px apart count as touching; the
    virtual hit is their double point (the middle of the gap), so a click on a drawn tangency
    builds the intersection, not a glider. Only a hit on a point object (not a text's handle)
    blocks the virtual hit.
18. **Curves that cannot be drawn at the zoom** give an `undrawable` export warning in every
    format (ADR-0023's "never silently missing" for exports). **Extends ADR-0023:** a polygon
    with an edge that cannot be placed is not drawn and is listed undrawable.
19. **Asymptote curve accuracy.** A circle or arc whose `unitcircle` approximation would be off
    by more than 1/16 px is written as explicit cubic pieces from the display list (error per
    piece r·(2/27)·sin⁶(θ/4)/cos²(θ/4)); a circle the canvas samples as a polyline is exported as
    that polyline. Every example circle is below the threshold, so no golden changed.
    **TikZ** arcs of screen radius ≥ 4000 bp are written as cubic pieces (TeX's \maxdimen).
20. A segment mark's label sits at the centre of its ticks (the middle tick, or between the two
    middle ticks). A text's invisible handle is not exported. Asymptote draws a dashed polygon
    edge by edge, as the canvas and TikZ do.
21. **PNG:** pHYs precedes the first IDAT (the PNG specification); iTXt stays before IEND.

### Editor and web app

22. **Autosave.** Examples open with a new origin `example`: like a link, not saved until their
    first edit, so browsing examples never pushes the user's figure out. `file` is unchanged. A
    pending save is flushed before another figure opens, before a restore, and when the page is
    hidden; the header re-renders when the slots change.
23. **Tools.** The claim tool allows a repeated pick for `angle_eq` and `ratio`, and is order-free
    when its steps differ in kind (`on`). The glider tool takes polygon sides and refuses a click
    on an existing point. A refused build after a click-created pick refuses the whole click (no
    stray point). Two lines that do not meet are refused. `tangent(P, c)` is written only when P
    stays on c in every local response, as ADR-0027 item 5 for other(P); a point there by
    coincidence is refused with a hint. A hidden side segment is reused. Moving an object into a
    locked layer is refused. A command-bar `@viewport`, `@title` or `@author` replaces the
    existing one. A typed tool number is kept per tool across switches.
24. **Debug log.** At most 50 entries; when full, UI edits (viewport, hover, select, tool) leave
    first, so they never push document edits out (a frozen test keeps UI edits logged).
25. **Keys and focus.** Backspace deletes as Delete does (one help row). Enter and Space on a
    button, link or tab are left to the control. After choosing an example the canvas takes
    focus. Escape closes dialogs, which take focus and return it.
26. **Test runs** keep the document of each regime; each run is shown, or greyed as stale, by its
    own document. Opening a counterexample or an example fits the view.
27. **Notices.** A refusal stays until a successful change of the document, the tool or its
    state, or Dismiss; on the phone it is drawn above the open drawer.
28. **Gestures.** Escape during a drag ends the press. The canvas's wheel listener is native and
    non-passive (a line counts 100/3 px, a page 800 px, at most ten notches per event). A
    device-pixel-ratio change redraws the canvas.

## Frozen tests changed under this ADR

- `packages/export/test/png-utf8.test.ts`: four lines (the test's name, two chunk lists, one
  index) asserted pHYs after IDAT, which is decision 21's bug.
- `packages/export/test/__snapshots__/fixture-display/{snippet.tikz.tex,standalone.tex,`
  `standalone.asy,aops.asy}`: six deleted lines each, the text handle's speck (decision 20).

## Consequences

- Behaviour pinned by frozen tests was kept where the fix would have changed them, and is listed
  in STATUS.md: `intersect(line(A, B), line(A, C))` from the tool still builds a point on A
  (ADR-0024's tests); a cancelled drag still clears redo (the fuzz model, L6); the local verdict
  line omits rejected counts; label placement still falls back to the first direction when every
  direction collides (Run 8b note C).
- The 0.5 px tangency and 1/16 px curve bounds are pixel constants beside the existing hit and
  sampling constants, not tolerances of the kernel.

## Alternatives considered

- **Mapping every absolute quantity through the samplers' similarity** (radii in claims, computed
  coordinates): needs a symbolic rewrite of arbitrary expressions; the static check is simple and
  provably safe.
- **An error for non-point `x = y` claims**: breaks two frozen tests and the printer's P1 for
  editor-made claims; the warning plus the tester's "invalid" keeps every claim honest.
- **Refusing to read old `a / 2/3` text**: old files must load (SPEC §11.4); the warning says how
  the text is now read.
