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

### The claim box (packages/editor claim-bar.ts; apps/web ClaimBox.tsx draws it)

6. **The box's logic is the editor's.** `runClaimText` writes `claim ` in front when the user
   did not, runs the line as a command (the text's parser, one edit), and returns its
   diagnostics with the columns of the box's own text. `claimForms()` lists every form it reads:
   Geomdraw's short forms (ADR-0025; a test parses each) and every form of the notation table of
   packages/lang (one per kind at least; a test checks every registry kind has one).
   `claimCompletions` completes the word at the cursor: at the start the claim kinds (with their
   forms as the detail) and the objects; after objects and a space, outside a call, the words of
   the short forms (`collinear`, `concurrent`, `cyclic`, `⟂`, …); inside a call the objects. The
   box shows the forms while empty and focused, the completions while typing (Tab or a click),
   and what it could not read in the box (as well as the notice, as before).
7. **What a claim line could not read** (packages/lang, parse-geomdraw.ts `geomdrawProblem`):
   after a list of objects, a word that is not a list word (`AP, BQ, CR are concurrent`): `could
not read "are": after a list of objects write collinear, concyclic, cyclic or concurrent`, at
   the word, with the form as the hint; objects without commas before a list word (`AP BQ CR
concurrent`): `could not read "BQ": separate the objects of a list with commas`; one object
   and an unknown word before a relation word (`AP is perpendicular to BC`). Every other text
   reads, or is refused, as before (`O, G, H are collinear`, which a frozen e2e test types, is
   still refused at line 1, now naming "are").

### New claim kinds (packages/claims kinds-triangles.ts, kinds-lengths.ts)

8. **Triangles.** Vertices correspond in order, A ↔ D, B ↔ E, C ↔ F. NDG for every kind: both
   triangles proper (A, B, C not collinear; D, E, F not collinear), so a flat triangle is never
   similar or not. Field-generic conditions:
   - `similar` = directly OR oppositely similar (the olympiad △ABC ∼ △DEF): proportional sides,
     |AB|²|EF|² = |DE|²|BC|² and |CA|²|EF|² = |FD|²|BC|² (with proper triangles the third ratio
     follows; SSS is exactly "similar in some orientation");
   - `similar_direct`: (B − A)(F − D) − (C − A)(E − D) = 0 as complex numbers (two conditions);
   - `similar_opposite`: (B − A)·conj(F − D) − (C − A)·conj(E − D) = 0;
   - `congruent` = directly or oppositely congruent: |BC|² = |EF|², |CA|² = |FD|², |AB|² = |DE|²;
   - `congruent_direct` / `congruent_opposite`: that orientation's similarity and |AB|² = |DE|².
     All are POLYNOMIAL KINDS. A reflection of the whole figure keeps each (it reverses both
     triangles), so the global sampler's mirrored half never makes them orientation-dependent
     (L16). Residuals: the worst relative mismatch (lengths, or |z₁w₂ − w₁z₂| over
     |z₁||w₂| + |w₁||z₂|). Symmetries: the same permutation of both triangles (A ↔ B with D ↔ E;
     A → B → C with D → E → F) and the swap of the triangles. Notation: `similar(ABC, DEF)` (two
     glued runs, spread into six points by ADR-0025 decision 4), printed glued when all six are
     point names, else as the call.
9. **`length_product`: AB·CD = EF·GH**, a POLYNOMIAL KIND: lengths are ≥ 0, so the claim is
   |AB|²|CD|² − |EF|²|GH|² = 0 with no sign lost. NDG: the four segments proper (a zero length
   makes it 0 = 0, or says only that another segment is null). Symmetries: A ↔ B, the two
   segments of a side, the two sides. Notation `AB·CD = EF·GH` (also `AB * CD` with spaces, and
   dist(…) segments).
10. **`length_sum`: AB + CD = EF, NOT a polynomial kind.** With a = AB, c = CD, e = EF, the
    condition (e² − a² − c²)² − 4a²c² = 0 also holds when e = |a − c|; the ORDER item
    e² − a² − c² ≥ 0 keeps exactly a + c = e (if e = |a − c| then e² − a² − c² = −2ac, negative
    unless ac = 0, where |a − c| = a + c). An order item is not evaluable mod p and the kind is
    off the whitelist, so the mod-p rung never applies (L17, tested with a budget that makes
    every eligible sample fall through to mod p). The request said "numeric rung only"; the exact
    rung over Q applies as for the undirected angle sums (Q has an order, and the condition and
    order item are exactly the claim), else the numeric rung. NDG: the three segments proper.
    Notation `AB + CD = EF`, also read as `EF = AB + CD`.
11. **Discovery** picks the kinds up through the claim-kind registry (ADR-0035) and does not
    search them, saying why in its caps: triangles similar or congruent by construction (a map's
    images, the medial triangle) would flood "What is special?" and no closure rule hides them
    yet; length_product has eight points (as ratio); length_sum is not a measure the finder
    pairs. A test in ADR-0039's style checks that the facts reported are exactly those of the
    registry without these kinds, on figures full of similar and congruent triangles.
12. **The claim tool** offers every new kind (decision 1); their points may repeat (PA·PB =
    PC·PD, ABD ∼ ACE share points).

## Frozen tests changed

- `packages/editor/test/machine.test.ts:283`: `expect(claimToolKinds()).not.toContain('length')`
  became `.toContain('length')`. The request makes every kind reachable from the claim tool
  (decision 1); the line pinned exactly the gap this ADR closes. The test's other lines are
  unchanged.

Lines only added (no frozen line modified or deleted): `packages/claims/test/kinds.test.ts` (the
kind list and the whitelist gain the new kinds), `packages/discovery/test/find.test.ts` (the
not-searched list gains them), `packages/editor/test/exports.test.ts` (the subpaths
`./claim-tool` and `./claim-bar`).

## Consequences

- The claim tool's steps differ by kind (lines take two points); the number field shows for the
  kinds with a number. Every claim made in the GUI is a statement of the text (CLAUDE.md).
- SPEC §10.1 lists the new kinds and the whitelist; §15 the claim tool and the claim box.
- The grammar (ADR-0009's block, GRAMMAR) gains `AB·CD = EF·GH` and `AB + CD = EF`;
  docs/language.md is regenerated.
- Similar triangles are not found by "What is special?" yet: a closure rule for triangles similar
  by construction would be needed first (ADR-0039's rule: hide only what is derived).

## Alternatives considered

- **Draw the line first** (make line AP an object, then claim): adds objects the user did not
  ask for, and was the reason the maintainer gave up.
- **A literal pick of the number on the canvas**: the tool's number field already exists for
  rotate, homothety and the radius (ADR-0024 decision 5); one mechanism.
- **Print two-point lines glued (`AP`)**: changes the canonical text pinned by frozen tests and
  saved files; ADR-0025 keeps the glued forms read-only.
- **One `similar` kind with an orientation flag literal**: a literal that is not a number in the
  claim's arguments, and a field in the claim tool for it; separate kinds keep the claim
  language's literals numeric and each kind's algebra plain.
- **`similar` as directly similar only**: an oppositely similar pair (the common case of
  antiparallels, AEF ∼ ABC) would be reported FALSE: silently wrong for the olympiad meaning.
- **Search similar triangles** with an angle measure hint: candidates by the thousand on the
  request's figures, each by construction; reported, they would undo ADR-0039.
