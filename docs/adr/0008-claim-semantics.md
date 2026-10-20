# ADR-0008: Claim semantics, hypotheses, samplers, verdict rungs and jobs (Run 5)

Status: accepted (Run 5). Extends ADR-0001 (item 9), ADR-0003 (item 5: claims and assumptions
stored as data), ADR-0004 (item 1: banded incidence), ADR-0006 (items 6, 12, 15: tangency on
the discriminant, other(P), isOrientationDependent) and ADR-0007 (images are plain objects).
Adds one field to SPEC §6.1's Signature (decision 9) and records the readings of SPEC §10 and
§16 listed under "Deviations and readings".

## Context

Run 5 builds packages/claims (SPEC §10, §16): claim kinds with field-generic conditions and
non-degeneracy (NDG) data, three-valued evaluation of the current figure, hypotheses,
the LOCAL and GLOBAL samplers, the three verdict rungs (exact over Q, exact mod p, numeric),
the local and global verdicts with the orientation flip test, and the `runJob` generator.
SPEC fixes the kinds, the complex form of directed angles, the POLYNOMIAL KINDS whitelist,
the noise floor, the sampler parameters, the rung order and the verdict names, but leaves
open: the exact conditions, NDG items and residuals of each kind; how a "sign-based selector
or sqrt" in a closure is detected statically (the registry had no such data); what the job
carries, given that claims may not import lang; and several details of sampling and of the
flip test. Notes A–D of the run add: use the kernel's orientation definitions; decide mod-p
eligibility statically; decide tangency and incidence claims with the construction's banded
length gaps; never throw, and never call a claim on Undefined objects true or false.

## Decision

### Claim kinds (packages/claims/src/kinds-*.ts)

1. **Kinds are data** (`CLAIM_KINDS`, `claimKind(name)`), each with parameters, a
   `polynomial` flag (the whitelist `POLYNOMIAL_KINDS` is derived from it), a float test,
   and three functions: `algebra<T>(F, args, ctx)` → { conditions (all must be 0), NDG items
   (all must hold), order items (signs that must hold) } over any Field; `residual(args)` →
   a dimensionless float ≥ 0; and, for incidence and tangency, `gap(args)` → the decisive
   length. Claim arguments are expressions: geometry is evaluated (through probe objects,
   decision 14); the literal parameters (n, k, θ) must be exact number literals.
2. **The table.** u, v are the arms of an angle (u = A − B, v = C − B), z(A, B, C) =
   (u·v, u × v) = (C − B)·conj(A − B) (so arg z = ∡ABC), Im(z₁·conj z₂) = z₁.y z₂.x − z₁.x z₂.y.
   Every point list is pairwise distinct (NDG "X and Y coincide") unless said otherwise.

   | kind (poly?)        | arguments                     | conditions (= 0)                                                                                                                                                                            | NDG                                                                                       | float residual (dimensionless)                                                                                              |
   | ------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
   | collinear (yes)     | P₁, P₂, P₃, …                 | (P₂ − P₁) × (P_k − P₁), k ≥ 3                                                                                                                                                               | all points distinct                                                                       | max_k dist(P_k, P₁P₂) / diameter of {P₁, P₂, P_k}                                                                           |
   | concyclic (yes)     | A, B, C, P, …                 | Im(z(A, C, B)·conj z(A, P, B)) for each P (∡ACB = ∡APB mod 180°)                                                                                                                            | all distinct; SOME triple non-collinear (`any`)                                           | max_P \|sin(∡ACB − ∡APB)\|                                                                                                  |
   | concurrent (yes)    | l₁, l₂, l₃, …                 | det(row(l₁), row(l₂), row(l_k)), row(l) = (−d_y, d_x, d_y p_x − d_x p_y)                                                                                                                    | lines pairwise distinct (`any`: non-parallel or off each other); not all parallel (`any`) | max_k \|det\| / (\|d₁\|\|d₂\|\|d_k\|·scale)                                                                                 |
   | parallel (yes)      | l, m                          | d_l × d_m                                                                                                                                                                                   | l and m distinct lines                                                                    | \|sin∠(l, m)\|                                                                                                              |
   | perpendicular (yes) | l, m                          | d_l · d_m                                                                                                                                                                                   | none                                                                                      | \|cos∠(l, m)\|                                                                                                              |
   | equal (yes)         | P, Q                          | P_x − Q_x, P_y − Q_y                                                                                                                                                                        | none                                                                                      | \|PQ\| / scale                                                                                                              |
   | on (yes)            | P, curve                      | line: d × (P − p); circle: \|P − O\|² − r²; ORDER: lo·\|d\|² ≤ (P − p)·d ≤ hi·\|d\|² for a segment or ray, −(to − from) × (P − from) ≥ 0 for an arc                                         | none                                                                                      | \|gap\| / scale, gap = the kernel's incidence gap (distance to the line; \|P − O\| − r by rootGap)                          |
   | tangent (yes)       | line & circle, or two circles | ((O − p) × d)² − r²\|d\|²; circles: (s − R₁ − R₂)² − 4R₁R₂ (s = \|O₁O₂\|², R = r²)                                                                                                          | circles: not the same circle (`any`: distinct centres or distinct radii)                  | \|gap\| / scale, gap = the kernel's candidate-count gap: r − h (rootGap), or the smaller of r₁ + r₂ − d and d − \|r₁ − r₂\| |
   | length (yes)        | A, B, C, D, k > 0             | \|AB\|² − k²\|CD\|²                                                                                                                                                                         | C ≠ D                                                                                     | \| \|AB\| − k\|CD\| \| / (\|AB\| + k\|CD\|)                                                                                 |
   | ratio (yes)         | A, B, C, D, E, F, G, H        | \|AB\|²\|GH\|² − \|EF\|²\|CD\|²                                                                                                                                                             | C ≠ D, G ≠ H, not (A = B and E = F)                                                       | \|AB·GH − EF·CD\| / (AB·GH + EF·CD)                                                                                         |
   | ratio_value (yes)   | A, B, C, D, k > 0             | as length (AB/CD = k ⟺ AB = k·CD with CD ≠ 0)                                                                                                                                               | C ≠ D                                                                                     | as length                                                                                                                   |
   | dangle (yes)        | n ∈ 1..12, A, B, C, D, E, F   | Im(z₁ⁿ·conj z₂), z₁ = z(A, B, C), z₂ = z(D, E, F)                                                                                                                                           | A ≠ B, C ≠ B, D ≠ E, F ≠ E (z₁, z₂ ≠ 0)                                                   | \|sin(n·∡ABC − ∡DEF)\| (from unit z's)                                                                                      |
   | dangle_lines (yes)  | l, m, θ                       | Im((d_l·d_m, d_l × d_m)·conj w), w a direction of angle θ: exact (1,0), (1,1), (0,1), (−1,1) for θ ≡ 0, 45, 90, 135 (mod 180); else (cos θ, sin θ) from the field (Inexact in exact fields) | none                                                                                      | \|sin(∡(l, m) − θ)\|                                                                                                        |
   | angle_eq (no)       | A, B, C, D, E, F              | Im(w), w = (c₁ + i s₁)(c₂ − i s₂), (c, s) = (u·v, \|u × v\|); ORDER Re(w) > 0                                                                                                               | A ≠ B, C ≠ B, D ≠ E, F ≠ E                                                                | \|angle(ABC) − angle(DEF)\| in radians (folded to [0, π])                                                                   |
   | angle_sum (no)      | …, θ ∈ [0°, 360°]             | Im(w·conj e^{iθ}), w = (c₁ + i s₁)(c₂ + i s₂); ORDER Re(w·conj e^{iθ}) > 0                                                                                                                  | as angle_eq                                                                               | \|α + β − θ\| (radians, folded)                                                                                             |
   | angle_diff (no)     | …, θ ∈ [−180°, 180°]          | as angle_eq with conj e^{iθ}                                                                                                                                                                | as angle_eq                                                                               | \|α − β − θ\|                                                                                                               |

   The undirected forms are exact over Q at θ a multiple of 90° (e^{iθ} rational; the
   absolute value \|u × v\| needs an order, which Q has), Inexact over Q otherwise, and never
   use the mod-p rung (not polynomial). A θ outside the reachable range is an invalid claim
   (Undefined with the reason), never "false by wrap-around". The SPEC forms map as
   `AB = k·CD` → length, `AB/CD = EF/GH` → ratio, `AB/CD = k` → ratio_value,
   `n∡ABC = ∡DEF` → dangle, `∡(l, m) = θ` → dangle_lines, `angle(…) ± angle(…) = θ` →
   angle_sum / angle_diff (the language run parses the notation into these kinds).

3. **NDG items** are a small vocabulary of predicates (ndg.ts): distinct(P, Q),
   noncollinear(A, B, C), nonparallel(u, v), off_line(P, line), distinct_radii and `any`
   (one of its items holds). Exact fields test the polynomial for exact zero (mod p,
   p ≡ 3 mod 4, so x² + y² = 0 only for x = y = 0). FloatField measures each as a length
   (\|PQ\|; the smallest height 2·area / longest side; the distance to the line;
   \|r₁ − r₂\|) or a dimensionless sine (nonparallel), and decides with num's banded sign:
   within EPS → degenerate, inside the band → ambiguous, beyond → holds. NDG messages name
   the arguments as written (`{i}` placeholders filled in by the claim evaluation): "degenerate:
   M and B coincide".
4. **Order items** cover the only order-based parts of claims: on() honours segment, ray and
   arc ranges (a point of the carrier outside the range is NOT on it), and the undirected
   forms need Re(…) > 0. Exact fields decide them by exact sign; mod p they are not
   evaluable (the exact decision is Inexact and the rung falls through); FloatField
   decides value/√norm with the band. tangent, parallel, perpendicular and concurrent judge
   carriers (ranges and arcs play no role), as written in each kind's doc.

### Deciding one figure (decide.ts, rungs.ts, eval-claim.ts)

5. **Before any rung**, the float figure decides: an Undefined argument → undefined("X is
   undefined (reason)"); an argument of the wrong kind → invalid; an NDG item degenerate →
   undefined("degenerate: …"), ambiguous → undefined("ambiguous: …"). A claim on Undefined
   objects or with failing NDG data is therefore never true or false (note D). Exact fields
   can still find an exact degeneracy the floats did not (→ undefined).
6. **Float decision** (SPEC §3.1): the residual on the figure and on FLOOR_SAMPLES = 3
   perturbed figures (every free input moved by a Gaussian of FLOOR_DELTA·scale in its unit:
   lengths for points, scale/\|d\| for line gliders, radians for angle gliders, the range for
   params, 1 for (u : v)) gives the floor and num's classifyResidual. ILL-CONDITIONED (floor
   > FLOOR_MAX, or an undefined perturbation) is invalid, never false. For incidence and
   > tangency (note B) the kernel's banded gap decides first: on → a gap within EPS·scale is
   > TRUE (as incidence.ts calls it on); a gap inside the band is TRUE only if the floor says
   > so (never false); beyond the band it is FALSE only if the floor says so (never true).
   > tangent → a gap inside the band is TRUE (the kernel counts one double point there);
   > beyond, FALSE only if the floor agrees. A claim and a construction therefore never
   > disagree about whether a point lies on a curve or two curves touch.
7. **evalClaim** (current figure, live badges, no sampler): exact over Q within the budget,
   else numeric (perturbations from a seeded stream, default seed 0, so badges are
   deterministic). The mod-p rung needs random values and does not apply to one given
   figure.
8. **The exact rung's budget** is EXACT_BUDGET_BITS = 4096 bits (numerator + denominator) per
   value, enforced by `budgetField`: RationalField whose operations record the first result
   over budget and then answer 1, so the evaluation stays cheap and never divides by zero
   (the kernel tests a divisor on the value it divides by); the run is discarded and the
   sample falls through. The claim's own algebra counts against the budget too.

### The mod-p rung: static eligibility (analysis.ts) and values

9. **`Signature.radical`** (kernel, new optional field): the overload's VALUE needs √ or a
   trigonometric function, even of an exact argument (sqrt(9/4), rotate(O, 90), whose values
   ARE representable mod p). Square roots taken only to normalise a decision do not count.
   Flagged: dist (both), ratio, angle, dangle, radius, sqrt, sin, cos, tan, incenter,
   excenter, incircle, excircle, bisector, ext_bisector, on(round, number), every rotate
   overload. `packages/kernel/test/radical.test.ts` checks the flags both ways on random
   input (unflagged overloads never give a root/trigonometry Inexact over Q or mod p;
   flagged ones do over Q). SPEC §6.1 lists the ToolSpec fields; this one is added here.
10. **A closure is eligible** iff the kind is a POLYNOMIAL KIND, its algebra needs no
    trigonometry for its literals (`needsTrig`: dangle_lines off the multiples of 45°), and
    no call of the closure (the objects the claim's arguments depend on, selector
    expressions included) has: a sign-based selector (every selector except other(P):
    filters, near, far_from, along, orient); an overload that is `radical` for some
    combination of its arguments' static kinds (kernel `exprKinds`, resolved through the
    registry); or an overload with two candidates (BranchShape) and no other(P) (its
    candidates are square roots). Decided from the document alone, before any evaluation,
    never by waiting for an Inexact (note A). other(P) keeps a closure eligible (Vieta).
11. **Values** are drawn uniformly mod p from a cryptographic source supplied by the host
    (`env.entropy`, e.g. num's cryptoSource over crypto.getRandomValues; pure packages read
    no globals); without one, the rung is skipped. Every free point coordinate, glider
    parameter and param value is replaced; explicit radii and other literals stay (they
    are constants of the construction). Hypotheses play no role. An Inexact (a segment
    range, an order item) or an Undefined argument mod p → the rung does not apply.

### Hypotheses (hypotheses.ts)

12. Kinds: acute, scalene, convex (turns of one sign and a fan from P₁ of the same sign, so a
    star is not convex), inside(P, polygon) (strictly; boundary within EPS fails, the band
    is ambiguous; crossing number), in_order(P₁, …, Pₙ, curve) (along a line: projections
    strictly monotone either way; on a circle: the fan from P₁ of one orientation, i.e.
    cyclic either way), less / greater / not_equal of angle(…) or dist(…) measures or
    numbers (lengths decided as lengths; angles in degrees divided by 180, dimensionless).
    Every deciding quantity uses the band: clearly satisfied → holds, inside the band →
    ambiguous (the sample is rejected and counted), otherwise fails. Equality assumptions
    are refused with "construct it": equal, eq, equals, right, isosceles, equilateral and
    every claim kind name. Unknown kinds, wrong arity and mixed measures are reported
    (`assumptionProblem`; the language run turns them into parse errors).

### Samplers (sampler.ts, free.ts)

13. **Free inputs** (SPEC §5): literal point(x, y), on(obj, …) parameters (line t, (u : v),
    angle θ, classified by the float value of obj in the current figure), param(min, max, v)
    with literal bounds, and the literal radius of circle(O, r) (not free: scaled by the
    similarity, as SPEC §3.1 counts it as a length). Literals written inside a claim or an
    assumption are constants. Images in derived layers are recomputed (note C). The random
    similarity is z ↦ s·R·(z − c) + c + b with c the centroid of the free points,
    s = 2^u (\|u\| ≤ 1), b uniform in [−scale/2, scale/2]²; angle gliders are rotated with
    it (LOCAL). LOCAL: σ = 0.02·scale on points, the same arc or length on gliders, 2% of the
    range on params. GLOBAL: σ = 0.3·scale; gliders uniform over their range (circle
    gliders uniform in angle, then (u : v) = (cos φ/2, sin φ/2); unbounded line sides
    extended by 2·scale/\|d\|); params uniform. Samples are always rounded to the coarse grid
    (lengths to 2^(⌊log₂ scale⌋ − 10), (u : v) and angles to 2^−10, params to range/2^10), in
    both regimes and for every rung, so the counterexample document is exactly the figure
    the rungs judged. **Exactly half mirrored**: the k-th TESTED global figure is mirrored
    iff k is odd (rejected attempts retry the same parity), so ⌊N/2⌋ of N are mirrored.
    **Ordered gliders**: an in_order hypothesis whose points are distinct gliders of one
    form on one object expression gets sorted parameters. **Rejection** budget 50·N
    attempts; below 5% acceptance the verdict says "hard to satisfy", and fewer than N
    tested figures are always stated ("only m of N figures satisfied the hypotheses").

### Verdicts and the flip test (verdict.ts, job.ts)

14. A verdict other than INCONCLUSIVE needs at least N/2 valid (true or false) figures.
    Texts state the verdict, the rungs with counts ("exact over Q, 200/200"; "exact over Q
    150, numeric 50" when mixed), rejected and mirrored counts, and the seed; INCONCLUSIVE
    lists the most frequent reasons. Local FALSE adds "true in the current figure only" when
    evalClaim is true there; MIXED and FALSE carry example and counterexample documents (the
    user's document with the sample's free inputs; probes removed).
15. **Flip test** (SPEC §10.5): for each failing global figure, the orientation-dependent
    sites are the along/orient selectors of the claim closure for which the kernel's
    `isOrientationDependent(selector, line)` holds, `line` being the evaluated line of the
    along call in that figure (its chirality flag); k + 1 evaluations follow (all k flipped,
    then each alone; one when k = 1). A figure is REPAIRED when one of them holds.
    ORIENTATION-DEPENDENT iff k > 0 and every failing figure is repaired; the verdict names
    the selector whose flip alone repaired every failing figure, with its object and the
    equivariant alternative (same_side / on_arc for orient; same_side / between / on_arc for
    along on a chiral line). Otherwise CONFIGURATION-DEPENDENT with an unrepaired example.
    With no orientation-dependent selector the verdict can never be ORIENTATION-DEPENDENT
    (law L16 by construction, and tested on random scripts).

### Jobs (job.ts), probes and surfaces

16. `runJob(job, env)` is a generator yielding `{ kind: 'progress', regime, done, n,
attempts }` after every attempt; `next('cancel')` or `return()` stops it
    (`{ kind: 'cancelled', … }`); it returns `{ kind: 'verdict', verdict }` or `{ kind:
'invalid', reason }`. **The job carries the parsed Document and a claim id**, not
    docText: SPEC §2 makes lang depend on claims, so claims cannot parse text; the host
    (worker or editor) parses with lang first. `env` = { registry, entropy?, budgetBits? }.
    `testClaim` runs a job to completion.
17. **Probes**: every expression the tester needs a value of (claim and assumption
    arguments, glider objects, the arguments of along calls) is appended as a hidden object
    named `#probe…` (no user name can start with `#`); probes never leave the package.
    The exact rungs evaluate only the claim's closure; the float run the closure of claim,
    hypotheses and orientation sites.
18. Surfaces: kernel gains the subpaths `./geom` and `./incidence` (claims reuse rootGap,
    circleGap, signNormalized, abs). packages/claims exports `./kinds`, `./kind`, `./ndg`,
    `./hypotheses`, `./eval-claim`, `./job`, `./verdict`, `./rungs`, `./constants` (root:
    VERSION only, ADR-0002); `packages/claims/test/exports.test.ts` lists every name.

## Deviations and readings (each recorded here, none silent)

- SPEC §16's job field `docText` is replaced by `doc` (decision 16, dependency rule).
- SPEC §6.1's Signature gains `radical` (decision 9).
- SPEC §10.1 says NDG quantities "must all be non-zero"; `any` items (one of a group
  non-zero) are added for concyclic, concurrent, parallel, tangent and ratio, whose honest
  NDG ("not all collinear", "not the same line") is a disjunction.
- SPEC §10.4 lists hypotheses under GLOBAL only; LOCAL enforces them too (a local figure
  that leaves the declared configuration is rejected, not judged).
- SPEC §10.5's flip test says a failing sample must hold "when those selectors are
  flipped"; a figure counts as repaired when all-k OR a single flip holds (decision 15), so
  noise that reverses only one site of a figure is recognised.
- on() honours segment, ray and arc ranges (decision 4).

## Consequences

- The language run maps the claim and assume notation to these kinds, reports
  `assumptionProblem` and claim argument problems as parse errors, and keeps `#` out of
  names. The editor and web app call evalClaim for badges and runJob in a worker,
  supplying cryptographic entropy.
- A tool added later whose value needs √ or trigonometry must set `radical` on its
  overloads (radical.test.ts fails otherwise).
- Phase 2's prover reuses the field-generic conditions and NDG items unchanged (E6).

## Alternatives considered

- Detecting sqrt by logging F.sqrt calls in a mod-p run: decisions normalise with √
  everywhere, and an exact argument (sqrt(9/4)) bypasses F.sqrt, so the log is both too
  wide and too narrow; it would also decide eligibility by evaluation, against note A.
- A list of radical tool names in packages/claims: "nothing outside the registry
  enumerates tools" (SPEC §6.1).
- Throwing from the budget field and catching around evaluate: evaluate is total by
  construction (ADR-0003); a sticky "answer 1" wrapper keeps it so.
- Classifying incidence and tangency claims by the noise floor alone: a claim could call
  two circles disjoint while intersect() returns their double point (note B).
- Parsing docText inside the job: impossible without a dependency cycle (claims → lang →
  claims).
- Mirroring exactly the odd attempt indices: rejections would make the mirrored share of
  TESTED figures drift away from one half.
