# ADR-0051: Claims from the GUI: every kind, lines by two points, the claim bar, new kinds

Status: accepted (maintainer request "usability, items 1–10", item 7; not a kit run). Amends
ADR-0024 (the claim tool's steps and its number field), ADR-0016 (the header's claim box),
ADR-0025 (diagnostics of Geomdraw's claim forms), ADR-0008 and ADR-0035 (new claim kinds,
their NDG data, symmetries and finder hints), ADR-0009 (two claim forms in the grammar), SPEC
§10.1 and §15. Changes frozen test lines (listed under "Frozen tests changed").

## Context

The maintainer could not claim from the GUI that the cevians AP, BQ, CR of a triangle concur.
Reproduced first (packages/editor/test/claim-tool-lines.test.ts, through the real scene's
clicks), there were two failures of the claim tool and one of the claim box:

1. **Cevians not drawn.** A line parameter of a claim kind was a `line` pick: a click on a
   point was refused ("concurrent: line: click a line"), so a line could not be given by two
   points, although the claim language has always taken `line(A, P)` (and, since ADR-0025, the
   glued `AP`) as an argument.
2. **Cevians drawn as segments.** The three segments were picked (a segment is a line value
   with a range, and the line pick takes it), but `concurrent` takes three or more lines, so the
   tool waited for a fourth, and its status line kept saying "Claim: concurrent: line" without
   ever saying that Finish (Enter, or the Finish button) makes the claim.
3. **The claim box** read `AP, BQ, CR concurrent`, but a natural slip such as
   `AP, BQ, CR are concurrent` was refused with `expected "=", found ","`: the message named
   the comma, not what the box could not read, and the box offered no completions and no list
   of the forms it accepts.

Besides, only the kinds whose parameters are all objects were in the claim tool: `length`
(AB = k·CD), `ratio_value`, `dangle` (n∡ABC = ∡DEF), `dangle_lines` (∡(l, m) = θ),
`angle_sum`, `angle_diff`, `cross_ratio` and `cross_ratio_lines` could be claimed only in the
text, and a frozen test pinned that (`expect(claimToolKinds()).not.toContain('length')`).

## Decision

### The claim tool (packages/editor claim-tool.ts, tool-steps.ts, machine.ts)

1. **Every kind of the claim-kind registry is in the claim tool**, in the registry's order
   (`claimToolKinds()` is the registry's names; a test enumerates the registry and builds a claim
   of each kind through the tool, so a new kind cannot be forgotten).
2. **The number of a kind** (each kind has at most one literal parameter; a test checks it) is
   typed in the tool's number field, ADR-0024 decision 5's mechanism: `toolValue(tool, state)`
   is the claim kind's field (label and first text: k = 1 for AB = k·CD, k = 2 for AB/CD = k,
   n = 1, θ = 90 for ∡(l, m) = θ, θ = 180 for an angle sum, θ = 0 for a difference, k = −1 for a
   cross ratio), written at its place in the claim (n first in `dangle`). A trailing ° is
   allowed; `n` must be a whole number; an empty or non-exact field is refused at the last pick
   with what to type, the picks kept. The last number is kept per claim kind (`typed` is keyed
   `claim:<kind>`), since k = 2 and θ = 90 mean different things.
3. **A line parameter takes a line, a segment, a ray, or two points.** Its step is a
   `line_or_points` pick: a click on a line object picks it (segments and rays are lines with a
   range; ADR-0008 decision 4: concurrent, parallel, perpendicular, tangent and the line kinds
   judge carriers); a click on a point starts the line through it, and the next pick is its
   second point ("the second point of the line"); the claim gets `line(A, P)`. The two points
   share one step (`ToolState.pairs`); the second cannot be the first; a point may be in several
   lines (`perpendicular(line(A, B), line(A, C))`); a click on empty space makes no point for a
   line step (the refusal says "click a line, or a point"); Finish waits for a second point;
   Cancel drops a half-made line. Points are taken before the line under them, so the vertex A
   of segment AP is the point A.
4. **Canonical text of a two-point line: `line(A, P)`.** The claim stores the call
   `line(A, P)`; the printer writes it so: `claim concurrent(line(A, P), line(B, Q), line(C, R))`.
   The glued `AP` (ADR-0025) and `AP, BQ, CR concurrent` are read as the same claim, never
   printed. Nothing is added to the figure. P1–P3 hold unchanged (tested on the tool's output).
5. **Finish is said.** When a tool with a rest step (concurrent, collinear, concyclic,
   conconic, polygon) has enough picks, its status line ends with ", or Finish". Picking the
   first object again finishes a claim with a rest step (as a polygon closes), unless that
   first step was a two-point line.

## Frozen tests changed

- `packages/editor/test/machine.test.ts:283`: `expect(claimToolKinds()).not.toContain('length')`
  became `.toContain('length')`. The request makes every kind reachable from the claim tool
  (decision 1); the line pinned exactly the gap this ADR closes. The test's other lines are
  unchanged.

## Consequences

- The claim tool's steps differ by kind (lines take two points); the number field shows for the
  kinds with a number. Every claim made in the GUI is a statement of the text (CLAUDE.md).

## Alternatives considered

- **Draw the line first** (make line AP an object, then claim): adds objects the user did not
  ask for, and was the reason the maintainer gave up.
- **A literal pick of the number on the canvas**: the tool's number field already exists for
  rotate, homothety and the radius (ADR-0024 decision 5); one mechanism.
- **Print two-point lines glued (`AP`)**: changes the canonical text pinned by frozen tests and
  saved files; ADR-0025 keeps the glued forms read-only.
