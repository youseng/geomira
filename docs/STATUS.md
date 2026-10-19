# STATUS

## Run 2: ACCEPTED (2026-10-19)

Kernel core (SPEC §4, §5, §6.1, §9; the line-based tools). Base check first: Run 1 was
ACCEPTED, `pnpm install && pnpm verify` was green locally on dc215a6 (= `run-1`, `main`),
and ci, deploy and nightly were green in CI on that commit
(https://github.com/youseng/geomira/actions/runs/39233995711), so there was no red base
to repair.

Every criterion holds: verify green locally, in a clean clone and in CI (ci run
https://github.com/youseng/geomira/actions/runs/39241926737 on 1cf0ead); L1–L3 counts
below; kernel coverage 99.9% lines (gate 90%); mutation testing of kernel geometry wired
into nightly.yml, 98.82% in CI (target 75%; reported, gated from v1.1). All workflows in
the table under "CI on GitHub".

## Done (each item → the test file that proves it)

1. **value.ts** (SPEC §4): `Value<T>` generic over the field: Point, Line (`p`, `d`, `lo`,
   `hi`, `chiral`; unbounded ends are `null`, ADR-0003), Circle (arc, anchor), Num (with
   `exact`), Polygon, Transform (similarity), Undefined, Inexact; capabilities point,
   curve, linear, round, number, transform, polygon; reserved kinds IdealPoint, Conic,
   Locus documented only. → `packages/kernel/test/value.test.ts`; unknown kinds are
   rejected by every tool, also through `evaluate` (E2) → `registry.test.ts`.
2. **document.ts, invariants.ts, edit.ts, layers.ts** (SPEC §5): the document type,
   `checkInvariants`/`assertInvariants` for I1–I8, immutable helpers `addObject`,
   `removeCascade` (+ `dependents`: objects, claims, assumptions, cleared rules),
   `renameObject` (images follow), `redefineObject` (cycle check, stable topological
   reorder), `setStyle` (`[noimage]` removes images), `setObjectLayers`, `addLayer`,
   `updateLayer`, `removeLayer`. → `invariants.test.ts` (each invariant violated on a
   crafted document), `edit.test.ts`, `layers.test.ts`, `names.test.ts`, `expr.test.ts`;
   property: `document.property.test.ts` (400 random sequences of 12 helper calls, valid
   and invalid, from fuzzed documents and from a document with a derived layer: 3,158 edits
   applied, 1,642 refused, invariants hold after every edit, inputs never mutated).
3. **registry.ts** (SPEC §6.1): `createRegistry(extra)` returns a frozen value (no
   singleton); overloads resolved by capability; a rejected call reads
   "foot does not accept (point, number); signatures: foot(point, linear) ·
   foot(point, point, point)". → `registry.test.ts`.
4. **evaluate.ts, context.ts** (SPEC §9, §3.1): `evaluate(doc, registry, F, ctx)` over
   Float, Rational and ModP, total; `evaluateFrom` re-evaluates changed objects and their
   dependents only (falls back to a full evaluate for another field, registry or scale);
   `evalContextFor(doc)`: scale = diameter of the free points (≥ 1). →
   `evaluate.test.ts`, `context.test.ts`, laws below.
5. **Tools**, each with one `compute<T>`, registry entry, degenerate cases, a property or
   theorem test, `export: 'numeric'` and generated docs: point, param, midpoint, divide,
   foot (both signatures), intersect (line-like × line-like), parallel, perp,
   perp_bisector, circumcenter, centroid, orthocenter, line, segment, ray, polygon, area,
   dist, dangle, angle, ratio, add, sub, mul, div, neg. → `degenerate.test.ts` (45 tests,
   one per declared case, the table must equal the registry's lists),
   `tools.property.test.ts` (35 tests, every tool covered, checked by a meta-test),
   `tools.direct.test.ts` (compute is total on any argument list), `docs.test.ts`.
   The chirality flag (line, segment, ray achiral; perp toggles; parallel keeps;
   perp_bisector chiral) is checked against actually mirrored figures, over Q and floats.
   → `chirality.test.ts`.
6. **Laws.** L1 → `laws/l1-total.test.ts`; L2 → `laws/l2-determinism.test.ts`; L3 (with
   the band exclusion and a mod-p differential check) → `laws/l3-oracle.test.ts`. Counts
   under "Acceptance command output".
7. **Theorems** on 200 random triangles each, over FloatField and over RationalField
   (exact): O, G, H collinear; OG : GH = 1 : 2; the altitudes concurrent (at the
   orthocenter); each median divided 2 : 1 by the centroid. O, G, H come from three
   independent formulas (H is not A + B + C − 2O). → `theorems.test.ts`. Sanity check:
   with the orthocenter's sign flipped, 6 of the 8 tests fail.
8. **Generated docs**: docs/tools.md from the registry (`pnpm docs:tools`); the "exact
   run" column is discovered by running each tool's examples over RationalField. →
   `docs.test.ts` (fails when the file is stale).
9. **Coverage gate** for packages/kernel (90% lines, 85% branches) in `pnpm verify`;
   **mutation testing** of kernel geometry (`geom.ts`, `tools/`): `stryker.kernel.json`,
   `vitest.kernel.config.ts`, `pnpm mutation:kernel`, nightly.yml job `mutation-kernel`
   (a matrix with `mutation-num`). The first run (CI, c26fb17) scored 90.93%; its
   survivors pointed at real gaps (exact Undefined reasons, arity checks reached only
   with line or polygon arguments, polygon vertex numbering, intersect with only the
   first line degenerate, param at v = min, dangle's mod-p reason), closed by tests in
   f520cce/14e4095: 98.82% in CI on 1cf0ead.
10. ADR-0003 (kernel representation choices); packages/kernel/README.md;
    docs/test-count.txt raised from 309 to 517.

## Not done

Nothing in Run 2's scope. Not started (later runs): circles, transforms, selectors and
branchable tools, claims, language, scene, editor, export. The `run-2` tag is for the
maintainer to place on the commit that records acceptance.

## Known bugs

None known. Fixed in this run, each with its regression test in the same commit:

- Found by L1 on its first run: a construction with coordinates near 1e200 (for example
  `divide(A, B, 1e200)` then `dist`) overflowed |d|² to ∞ and `FloatField.sqrt(∞)` threw,
  so `evaluate` was not total. FloatField arguments beyond 2^200 now give Inexact
  (ADR-0003 item 19). → `evaluate.test.ts` "regression (found by L1)".
- `div(1, (1e17 + 1) − 1e17 − 1)`: the exact value of the divisor is 0 while the float
  value is −1, so `Rational.div` would have thrown. `div` now also checks the exact
  value. → `degenerate.test.ts` (div).
- A value of an unknown kind reached `numbersOf`'s `assertNever` in the evaluator's range
  check. → `registry.test.ts` (E2).

## Uncertain

- "arithmetic" in the Run 2 tool list is read as `+ − × ÷` and unary minus (add, sub,
  mul, div, neg). SPEC §6.2 also lists sqrt/sin/cos/tan on numbers; they are not built
  here and belong to the run that lists them.
- SPEC §11.2 allows a trailing `*` only after a point name, but derived layers (§8.2)
  also image lines and circles (`l*`). The kernel accepts `source name + suffix` for any
  kind (I4); the language run has to decide how `l*` is lexed.
- L3's "inputs within BAND of a degeneracy" is implemented as: some zero test or sign
  decision of the float run saw a non-zero quantity with |x| < BAND·scale^k. Exact zeros
  are compared rather than excluded (stricter). At most 1.5% of a tool's samples are
  excluded.
- L3 compares numbers with a relative tolerance of 1e-9·max(1, |exact|, scale). All
  comparisons pass with this tolerance; SPEC does not fix one.
- Angle-type degeneracies (parallel lines, collinear vertices, the `dangle` decision) are
  decided on sin θ (ADR-0003 item 21) instead of the raw cross product against EPS·scale².
  This is my reading of SPEC §3.1's "dimensionless otherwise".
- Mod p, ordered decisions (segment and ray ranges, unsigned area, undirected and
  directed angles) are Inexact; `param`'s range is not checked mod p (ADR-0003 item 16).
  The claims run may refine this when it builds the mod-p rung.
- The FloatField argument bound 2^200 relies on every v1 formula being of degree ≤ 4 with
  divisors ≥ (EPS·scale)². Tools added later with higher-degree formulas must re-check it.
- Mathematical facts used (I am confident of each): the Euler line with OG : GH = 1 : 2;
  the altitudes meet at the orthocenter; the centroid divides each median 2 : 1; for a
  triangle, ∡BAC + ∡CBA + ∡ACB ≡ 0 (mod 180°) for directed angles.

## Changed frozen tests

None. Every test file frozen at `run-1` is unchanged (`add-only: frozen tests compared
with run-1, 0 violation(s)`); packages/kernel/test/index.test.ts still passes because the
kernel API lives in subpath modules (ADR-0002).

## Acceptance command output

### Clean clone (commit 14e4095; 1cf0ead adds only docs/STATUS.md)

```
$ git clone … && pnpm install --frozen-lockfile        # Done in 1.9s using pnpm v10.28.0
$ pnpm verify
> pnpm typecheck && pnpm lint && pnpm depcruise && pnpm rules && pnpm test:coverage
All matched files use Prettier code style!
✔ no dependency violations found (101 modules, 404 dependencies cruised)
ok   tolerance: 171 files scanned, 0 violation(s)
ok   file-length: 171 files scanned, 0 violation(s)
ok   test-count: 517 tests, floor 517, 0 violation(s)
ok   disabled-tests: 171 files scanned, 0 violation(s)
ok   add-only: frozen tests compared with run-1, 0 violation(s)
ok   forbidden-words: 171 files scanned, 0 violation(s)
L1 FloatField: 2000 documents, 53437 objects, 20145 Undefined, 476 Inexact, 0 throws, 0 non-finite; reached: parallel lines 22, coincident lines 359, coincident points 4337, collinear points 60, ambiguous 40, division by zero 176, outside the 30
L1 RationalField: 2000 documents, 53437 objects, 16548 Undefined, 5456 Inexact, 0 throws, 0 non-finite; reached: parallel lines 29, coincident lines 409, coincident points 3116, collinear points 55, ambiguous 0, division by zero 69, outside the 40
L1 ModPField: 2000 documents, 53437 objects, 14680 Undefined, 8891 Inexact, 0 throws, 0 non-finite; reached: parallel lines 29, coincident lines 405, coincident points 3092, collinear points 55, ambiguous 0, division by zero 35, outside the 0
L2 FloatField: 1200 incremental evaluations equal to full ones
L2 RationalField: 1200 incremental evaluations equal to full ones
L2 ModPField: 1200 incremental evaluations equal to full ones
L3 point: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 param: 402 defined + 1998 Undefined agree, 0 not exact, 0 excluded (band); mod p 402
L3 midpoint: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 divide: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 foot: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 intersect: 1577 defined + 792 Undefined agree, 0 not exact, 31 excluded (band); mod p 968
L3 circumcenter: 2155 defined + 221 Undefined agree, 0 not exact, 24 excluded (band); mod p 2155
L3 centroid: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 orthocenter: 2140 defined + 225 Undefined agree, 0 not exact, 35 excluded (band); mod p 2140
L3 line: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 segment: 2397 defined + 3 Undefined agree, 0 not exact, 0 excluded (band); mod p 2397
L3 ray: 2398 defined + 2 Undefined agree, 0 not exact, 0 excluded (band); mod p 2398
L3 parallel: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 perp: 2399 defined + 1 Undefined agree, 0 not exact, 0 excluded (band); mod p 2399
L3 perp_bisector: 2399 defined + 1 Undefined agree, 0 not exact, 0 excluded (band); mod p 2399
L3 dist: 922 defined + 1 Undefined agree, 1477 not exact, 0 excluded (band); mod p 0
L3 ratio: 665 defined + 3 Undefined agree, 1732 not exact, 0 excluded (band); mod p 0
L3 angle: 403 defined + 7 Undefined agree, 1953 not exact, 37 excluded (band); mod p 0
L3 dangle: 397 defined + 3 Undefined agree, 1963 not exact, 37 excluded (band); mod p 0
L3 area: 2387 defined + 4 Undefined agree, 0 not exact, 9 excluded (band); mod p 0
L3 polygon: 2387 defined + 13 Undefined agree, 0 not exact, 0 excluded (band); mod p 2387
L3 add: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 sub: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 mul: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 div: 2335 defined + 65 Undefined agree, 0 not exact, 0 excluded (band); mod p 2335
L3 neg: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
invariants: 3158 edits applied, 1642 refused, all valid
 Test Files  50 passed (50)
      Tests  517 passed (517)
 kernel/src        |     100 |    98.76 |     100 |     100 |
 kernel/src/tools  |   99.62 |    98.41 |     100 |   99.55 |
Statements   : 99.92% ( 1344/1345 )
Branches     : 98.98% ( 977/987 )
Lines        : 99.9% ( 1106/1107 )
verify exit=0
$ pnpm build
✓ built in 1.22s
build exit=0
```

"defined" = both fields defined and equal within 1e-9 relative; "Undefined agree" = both
Undefined with the same reason; "not exact" = the exact run is Inexact (no comparison);
"excluded (band)" = a float decision saw a non-zero quantity within BAND of zero; "mod
p" = mod-p results equal to the reduction of the exact ones. Every tool has ≥ 50 defined
comparisons (asserted).

### Mutation testing of kernel geometry (`pnpm mutation:kernel`)

```
                | % Mutation score |          |           |            |          |          |
File            |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
All files       |  98.62 |   99.01 |      497 |         3 |          5 |        2 |      720 |
 tools          |  98.80 |   99.20 |      490 |         3 |          4 |        2 |      686 |
 geom.ts        |  87.50 |   87.50 |        7 |         0 |          1 |        0 |       34 |
```

(local, 14e4095 tests; CI on 1cf0ead: "kernel mutation score: 98.82% (501 detected, 6
undetected; target 75%, gated from v1.1)".) The remaining survivors, analysed one by one,
are equivalent: in `abs`, dropping `case -1` falls through to √(x²) = |x|; `pts.length ===
n` → `true` in `pointsOf` still ends in badArgs through the destructuring; no v1 line
has `lo = null` with `hi` set (segment/ray label); mod p every `param` check is skipped
either way; the `chiral` flag of the line `foot` builds internally is never observed;
the `assertNever` message of an impossible sign. "errors" are mutants rejected by the
TypeScript checker.

### CI on GitHub

| Workflow | Run                                                         | Result                                                                          |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ci       | https://github.com/youseng/geomira/actions/runs/39241926737 | success on 1cf0ead (push): verify, build, Playwright 2/2                        |
| ci       | https://github.com/youseng/geomira/actions/runs/39241931201 | success on 1cf0ead (pull_request, PR #3)                                        |
| deploy   | https://github.com/youseng/geomira/actions/runs/39241926639 | success on 1cf0ead (build job; deploy job skipped off the default branch)       |
| nightly  | https://github.com/youseng/geomira/actions/runs/39242037616 | success on 1cf0ead (dispatched): test; mutation-num; mutation-kernel 98.82%     |
| nightly  | https://github.com/youseng/geomira/actions/runs/39240829013 | success on c26fb17 (first kernel run, full: 90.93%, before the test-gap commit) |

The CI run on f520cce failed (`max-lines`: degenerate.test.ts had 417 lines); b5782f1
split the file. Runs on other intermediate commits were cancelled by the next push
(ci.yml `cancel-in-progress`).

## Requests

- None. No dependency was added (`@geomira/num` is a workspace dependency of the kernel).

## Notes for later runs

- Import the kernel through its subpaths (`@geomira/kernel/value`, `/evaluate`, …); see
  packages/kernel/README.md and ADR-0003.
- A new tool needs: a ToolSpec in packages/kernel/src/tools/ (added to tools/index.ts),
  its degenerate cases in degenerate.test.ts (the table must equal the registry), a
  property test (meta-checked), examples, and `pnpm docs:tools`. L1 and L3 fuzz it
  automatically through the registry's signatures.
- Branch selection must add `candidates` and evaluated selectors to ToolSpec by ADR
  (ADR-0003 item 10); until then a call with selectors is Undefined.

---

## Run 1: ACCEPTED (2026-10-19)

packages/num (SPEC §3). Base check first: Run 0 was ACCEPTED, `pnpm install && pnpm verify`
was green locally on e413a0f, and ci, tex, deploy and nightly were green in CI on that commit
(`main` and the `run-0` tag), so there was no red base to repair.

Every criterion holds: coverage of num is 100% lines and 100% branches (gate: 95%,
enforced by `pnpm verify`); mutation score 89.56% (target 80%; reported, gated from
v1.1), the same locally and in CI; verify green locally, in a clean clone and in CI
(ci run https://github.com/youseng/geomira/actions/runs/39224402956; all workflows
in the table under "CI on GitHub").

## Done (each item → the test file that proves it)

1. **tolerance.ts** (SPEC §3.1): EPS, BAND, FLOOR_MIN, FLOOR_MAX, FLOOR_DELTA,
   FLOOR_SAMPLES, TRUE_FACTOR, FALSE_FACTOR, FALSE_ABS, MAX_SCALE; `toleranceContext`
   (scale = max(1, diameter)); `isZeroLen`/`isZeroArea`/`isZeroDimless`/`isZero`
   (inclusive at EPS·scale^k); `sign3` (0 up to EPS·scale^k, `'ambiguous'` below
   BAND·scale^k, ±1 from there); `noiseFloor`; `residualThresholds`;
   `classifyResidual` → `'true' | 'false' | 'ambiguous' | 'ill-conditioned'`.
   → `packages/num/test/tolerance.test.ts`: every threshold tested at, one ulp below and
   one ulp above, at figure diameters 1e-3, 1 and 1e3 and for length, area and
   dimensionless quantities; floor = 0 (clamped by FLOOR_MIN, residual 0 → true);
   FALSE_ABS vs 1e4·floor; FLOOR_MAX boundary; the laws "a residual of 1e-10 is never
   FALSE whatever the floor" (5,000 floors) and "the class is monotone in the residual";
   "no decision flips from −1 to 1 without passing through 0 or ambiguous"; decisions
   invariant under rescaling; NaN/±Infinity → RangeError (zero tests) or ill-conditioned
   (classification).
2. **rng.ts** (SPEC §3.2): xoshiro128\*\* with explicit state (`createRng`, `state`,
   `restoreRng`), `deriveSeed` for per-sample streams, `nextFloat` (53 bits), unbiased
   `nextInt`, `uniform`, `gaussian` (Box–Muller), `uniformBigInt`, and `cryptoSource`
   wrapping a host-supplied `getRandomValues` (pure packages read no globals).
   → `packages/num/test/rng.test.ts`: reproducible streams, hand-checked xoshiro128\*\*
   outputs from state [1, 2, 3, 4], pinned outputs for several seeds (a verdict's seed
   must reproduce across versions), resume from a snapshot, independence of generators,
   chi-square and moment checks (uniform, nextInt, bits, gaussian mean/variance/68–95),
   rejection-sampling bias check, crypto wrapper with a fake and with Node's webcrypto.
3. **rational.ts** (SPEC §3.3, §3.4): BigInt fractions in normal form, `parseRational`
   ("0.1", "2/3", "-3/4", "+5"; rejects "1/0", "1e3", ".5", whitespace…), arithmetic,
   `compare`, `toNumber` (correctly rounded: ties to even, gradual underflow, RangeError
   beyond the double range) and `tryToNumber`, exact `fromNumber`, `bitSize`,
   `sqrtExact`. → `packages/num/test/rational.test.ts`: `toNumber` equals IEEE division
   for operands below 2^53 (5,000 cases: IEEE division is correctly rounded, so this is an
   independent oracle); nearest-double check done exactly in rational arithmetic on
   [1e-12, 1e12] with numerators and denominators of 80 to 190 bits (so within half an ulp,
   better than the one ulp asked); ties, carries into the next binade, subnormals,
   MAX_VALUE and overflow;
   `fromNumber` round trip of 3,000 random bit patterns.
4. **field.ts and the three fields** (SPEC §3.3): `Field<T>` with partial `sqrt`,
   `sin`/`cos`/`atan2` (degrees) returning `Inexact`; `FloatField` (tolerance-aware
   `isZero`/`sign`), `RationalField` (exact; sqrt of squares of rationals; exact trig at
   multiples of 30° where rational, atan2 on axes and diagonals), `ModPField`
   (p = 2^61 − 1, `sign` → `'none'`, sqrt/trig `Inexact`); `Complex<T>` (complex.ts);
   `withDivisorLog`, `withSqrtLog`; `mapExact`/`allExact` for propagation. QuadExt,
   PolyFractionField, DegreeBoundField are documented as reserved in
   packages/num/README.md (no code).
   → `packages/num/test/field-conformance.test.ts` (one generic suite run against all
   three fields: addition and multiplication axioms, distributivity, inverses, division
   by zero, zero/one/sign, `fromRational` homomorphism, sqrt of squares, trig at 0,
   `Inexact` propagation with its first reason, both logs and their composition,
   Complex<T> ring laws, conjugation, multiplicative norm, division, powers);
   `float-field.test.ts`, `rational-field.test.ts`, `modp.test.ts`, `field.test.ts`.
5. **Stryker** for packages/num: `stryker.num.json` (vitest runner, TypeScript checker,
   per-test coverage analysis, incremental) on `vitest.num.config.ts`; `pnpm
mutation:num`; nightly.yml job `mutation-num` restores and saves the incremental
   result through the Actions cache, writes the score to the job summary and uploads the
   HTML/JSON report. First CI run: "num mutation score: 89.56% (609 detected, 71
   undetected; target 80%, gated from v1.1)", incremental result saved to the cache,
   report uploaded as artifact `mutation-report-num`.
6. **Coverage gate**: `pnpm verify` now runs `pnpm test:coverage`; vitest.config.ts
   fails the run if packages/num drops below 95% lines or branches. Checked by adding a
   60-branch uncovered function to an internal num module: the run failed with "Coverage
   for lines (84.5%) does not meet … threshold (95%)" (exit 1); the probe was removed.
7. **Public surface** (ADR-0002): one subpath export per module (`@geomira/num/field`,
   …); the root entry still exports only `VERSION`, so the frozen
   `packages/num/test/index.test.ts` is untouched. → `packages/num/test/exports.test.ts`
   (exact names per module, export targets exist, exported constants and fields frozen).
8. `assertNever` shared from `@geomira/num/assert` → `packages/num/test/assert.test.ts`;
   internal BigInt helpers → `packages/num/test/bigint.test.ts`.
9. docs/test-count.txt raised from 73 to 309.

## Not done

Nothing in Run 1's scope. Not started (later runs): any kernel, claims or other package
code. The `run-1` tag is for the maintainer to place on the commit that records
acceptance, as with `run-0`.

## Known bugs

None known.

## Uncertain

- "Tests … at scales 1e-3, 1, 1e3": SPEC §3.1 says `ctx.scale` is the bounding-box
  diameter and "≥ 1", so a figure of diameter 1e-3 gets scale 1 and absolute thresholds
  (EPS = 1e-9 for lengths). The tests read "scale 1e-3" as "figure diameter 1e-3"
  under that clamp. If very small figures should get relative thresholds, SPEC needs to
  drop the clamp.
- MAX_SCALE = 1e100 is new (ADR-0002); SPEC sets no upper bound. Above it EPS·scale²
  heads towards the double range, so the context constructor rejects it.
- The exact special values rely on Niven's theorem (at a rational number of degrees, sin
  is rational only for 0, ±1/2, ±1; tan only for 0, ±1). I am confident of both
  statements; the tests check every integer angle in [−720°, 720°] against FloatField.
- FloatField's sign is the banded `sign3` (0 ≤ EPS·scale^k < ambiguous < BAND·scale^k ≤
  ±1). SPEC fixes EPS for zero tests and BAND for decisions but not this exact layering;
  ADR-0002 records it.
- Mutation score: of the 71 undetected mutants, 43 are error-message strings or `''`
  defaults of regex groups that always participate (a `noUncheckedIndexedAccess`
  artefact); the other 28 were analysed one by one and are equivalent (examples:
  `×(±1)` vs `÷(±1)`; `<` vs `≤` where equality cannot occur; removing a zero-divisor
  check that `rational(…, 0)` repeats; `t ≥ 0` → `false` in `tryToNumber`, since a
  negative BigInt shift is a right shift and ⌊n/2^t⌋ < d ⟺ n < d·2^t). Two mutants are
  equivalent only on V8 (Math.atan2 is exact on diagonals there) or only with
  probability 1 − 2^−32 per draw (`w < limit` vs `w ≤ limit` in `nextInt`).

## Changed frozen tests

None. (`packages/num/test/index.test.ts`, frozen at run-0, is unchanged; ADR-0002
explains why the API lives in subpath modules.)

## Acceptance command output

### Local (commit cc502d8)

```
$ pnpm verify
> pnpm typecheck && pnpm lint && pnpm depcruise && pnpm rules && pnpm test:coverage
(8 workspace projects + tests: typecheck Done)
All matched files use Prettier code style!
✔ no dependency violations found (51 modules, 85 dependencies cruised)
ok   tolerance: 115 files scanned, 0 violation(s)
ok   file-length: 115 files scanned, 0 violation(s)
ok   test-count: 309 tests, floor 309, 0 violation(s)
ok   disabled-tests: 115 files scanned, 0 violation(s)
ok   add-only: frozen tests compared with run-0, 0 violation(s)
ok   forbidden-words: 115 files scanned, 0 violation(s)
 Test Files  29 passed (29)
      Tests  309 passed (309)
=============================== Coverage summary ===============================
Statements   : 100% ( 391/391 )
Branches     : 100% ( 248/248 )
Functions    : 100% ( 120/120 )
Lines        : 100% ( 339/339 )
```

The same in a clean clone (`git clone` → `pnpm install --frozen-lockfile` → `pnpm
verify` → `pnpm build`, all exit 0; build: "✓ built in 1.23s").

### Mutation testing (`pnpm mutation:num`, local, commit cc502d8)

```
-------------------|------------------|----------|-----------|------------|----------|----------|
                   | % Mutation score |          |           |            |          |          |
File               |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
-------------------|--------|---------|----------|-----------|------------|----------|----------|
All files          |  89.56 |   90.22 |      580 |        29 |         66 |        5 |      242 |
 assert.ts         | 100.00 |  100.00 |        2 |         0 |          0 |        0 |        1 |
 bigint.ts         |  92.16 |   92.16 |       38 |         9 |          4 |        0 |       13 |
 complex.ts        |  95.24 |   95.24 |       17 |         3 |          1 |        0 |       20 |
 field.ts          | 100.00 |  100.00 |        8 |         0 |          0 |        0 |       31 |
 float-field.ts    |  86.76 |   86.76 |       59 |         0 |          9 |        0 |       30 |
 modp.ts           |  91.30 |   91.30 |       21 |         0 |          2 |        0 |       16 |
 rational-field.ts |  86.36 |   86.36 |       19 |         0 |          3 |        0 |       22 |
 rational.ts       |  87.56 |   89.55 |      196 |         1 |         23 |        5 |       53 |
 rng.ts            |  92.50 |   92.50 |       95 |        16 |          9 |        0 |       23 |
 tolerance.ts      |  89.52 |   89.52 |       94 |         0 |         11 |        0 |       30 |
 trig.ts           |  88.57 |   88.57 |       31 |         0 |          4 |        0 |        3 |
-------------------|--------|---------|----------|-----------|------------|----------|----------|
```

"errors" are mutants rejected by the TypeScript checker (not counted in the score). The
first full run scored 86.72%; reviewing its survivors found real gaps (rounding carry
at a non-maximal exponent, `sin(30/7°)` taken for `sin(30°)` if the integer check were
dropped, the −180° fold in atan2 asserted only with ≤, `sqrt(Infinity)`, MAX_SCALE in a
hand-made context, zero words in a restored RNG state, a rejection-sampling bias
invisible at n = 2^31 + 1, a 4th bucket hiding in a chi-square, `isInexact` on other
tagged values), each closed by a test in this run. An incremental re-run takes ~15 s.

### CI on GitHub

Commit cc502d8 (branch claude/gallant-brahmagupta-nce2a2):

| Workflow | Run                                                         | Result                                                                        |
| -------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ci       | https://github.com/youseng/geomira/actions/runs/39224402956 | success (verify incl. coverage 100% on every num file, build, Playwright 2/2) |
| deploy   | https://github.com/youseng/geomira/actions/runs/39224402795 | success (build job; deploy job skipped off the default branch)                |
| nightly  | https://github.com/youseng/geomira/actions/runs/39224402905 | success (`test`; `mutation-num`: 89.56%, cache saved, report uploaded)        |

From the ci log (verify step):

```
> pnpm typecheck && pnpm lint && pnpm depcruise && pnpm rules && pnpm test:coverage
All matched files use Prettier code style!
✔ no dependency violations found (51 modules, 85 dependencies cruised)
ok   tolerance: 115 files scanned, 0 violation(s)
ok   file-length: 115 files scanned, 0 violation(s)
ok   test-count: 309 tests, floor 309, 0 violation(s)
ok   disabled-tests: 115 files scanned, 0 violation(s)
ok   add-only: frozen tests compared with run-0, 0 violation(s)
ok   forbidden-words: 115 files scanned, 0 violation(s)
 Test Files  29 passed (29)
      Tests  309 passed (309)
 % Coverage report from v8
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |     100 |      100 |     100 |     100 |
 (every file of packages/num/src: 100 | 100 | 100 | 100)
✓ built in 1.02s
  2 passed (2.7s)
```

## Requests

- None. Dev-only dependencies added (allowed runtime dependencies unchanged):
  @vitest/coverage-v8 4.1.12, @stryker-mutator/core, @stryker-mutator/vitest-runner and
  @stryker-mutator/typescript-checker 10.0.0.

## Notes for later runs

- Import num through its subpaths (`@geomira/num/field`, `@geomira/num/tolerance`, …);
  see packages/num/README.md and ADR-0002. Field preconditions throw RangeError: test
  divisors and radicands with `F.isZero` / `F.sign` first and return Undefined.
- Add each new package to `coverage.include` / `coverage.thresholds` in vitest.config.ts
  and, for L15, a `stryker.<pkg>.json` + `vitest.<pkg>.config.ts` pair and a nightly job.
- Stryker needs its plugins listed explicitly (`plugins` in the config): pnpm's isolated
  node_modules hides them from auto-discovery.

---

## Run 0: ACCEPTED (2026-10-19)

Scaffold and guardrails. Everything is in place and green locally, in a clean clone and in
CI (ci, tex, deploy and nightly all succeeded on commit 76fb8bd). The last open criterion,
the GitHub Pages deployment, is now met: after PR #1 was merged, deploy.yml ran on `main`
(commit 50ee23d) and both its `build` and `deploy` jobs succeeded:
https://github.com/youseng/geomira/actions/runs/39219324273
Live site: https://youseng.github.io/geomira/ (serves the "Geomira" shell).

Starting point: no previous run, no `run-*` tag, no docs/adr/, no package.json, so there
was no `pnpm verify` to run and no red base to repair. This run creates both.

## Done (each item → the test file that proves it)

1. pnpm workspace per SPEC §2: packages num, kernel, claims, lang, scene, editor, export
   (each exports only `VERSION`) and apps/web (Vite + React + TypeScript). Shared
   tsconfig.base.json: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes (plus
   noImplicitReturns, noUnusedLocals/Parameters, verbatimModuleSyntax). Package `src/` is
   compiled with `lib: ES2022` and `types: []` (no DOM, no Node globals).
   → `packages/*/test/index.test.ts` (exports exactly `VERSION`, equal to package.json).
2. ESLint 10 (typescript-eslint strictTypeChecked, `@vitest/eslint-plugin`
   no-disabled-tests / no-focused-tests, ban on `.skip/.only/.todo/.fails/.skipIf/.runIf`
   in tests, purity bans in `packages/*/src`: Math.random, Date, performance, window,
   document, process, timers, module-level `let`/`var`, module-level Map/Set caches,
   react/react-dom/zustand and `node:*` imports; no `any`; no `as` casts outside tests;
   eslint-disable comments need a description), Prettier, dependency-cruiser generated
   from the SPEC §2 table, Vitest `test.projects`, Playwright in apps/web.
   → `scripts/lint-guards.test.ts`, `scripts/depcruise.test.ts` (all 42 ordered package
   pairs: exactly the SPEC-forbidden ones are flagged; Node built-ins and npm imports in
   pure packages flagged, lz-string allowed in editor; packages → apps flagged).
3. `pnpm rules` (scripts/check-rules.ts, rules in scripts/check-rules/), each rule with
   bad/good fixtures under scripts/check-rules/fixtures/:
   - (a) tolerance-like literals → `scripts/check-rules/tolerance.test.ts`
   - (b) files > 400 lines → `scripts/check-rules/file-length.test.ts`
   - (c) test count below docs/test-count.txt → `scripts/check-rules/test-count.test.ts`
   - (d) disabled/focused/todo/expected-failure tests → `scripts/check-rules/disabled-tests.test.ts`
   - (e) add-only guard → `scripts/check-rules/add-only.test.ts` (throwaway git repos:
     modified line, deleted line, deleted file, uncommitted change, missing ADR, one of
     several commits without ADR, version-ordered tags, shallow clone all fail; added
     lines and ADR-cited commits pass)
   - (f) proved/proof/proven → `scripts/check-rules/forbidden-words.test.ts`
   - CLI exit code and report → `scripts/check-rules/cli.test.ts`
4. `pnpm verify` = typecheck + lint (ESLint + Prettier) + depcruise + rules + test.
5. Workflows: `ci.yml` (install, verify, build, Playwright), `tex.yml` (GHCR-cached Debian
   image with texlive-latex-base, texlive-pictures, texlive-latex-extra, asymptote;
   compiles tests/fixtures/hello-tikz.tex and hello.asy and checks Asymptote's `write()`
   output), `deploy.yml` (build with base `/<repo>/`, base-path check, Playwright under
   that base, Pages artifact, deploy job on the default branch), `nightly.yml` (test
   suite with NIGHTLY=1, daily and on changes to the workflow).
6. apps/web renders "Geomira" and an empty canvas → `apps/web/test/App.test.tsx`,
   `apps/web/e2e/shell.spec.ts` (desktop and 390×664, no page errors, canvas > 100 px).
7. docs/STATUS.md (this file), docs/adr/0001-baseline.md, docs/test-count.txt (73).
8. Clean clone in a temp directory: `git clone` → `pnpm install --frozen-lockfile` →
   `pnpm verify` → `pnpm build` → `pnpm e2e`, all exit 0 (output below).
9. GitHub Pages deployment from the default branch (deploy.yml run 39219324273 on
   `main`, commit 50ee23d: `build` and `deploy` jobs both succeeded).

## Not done

Nothing for Run 0. The `run-0` tag is placed on the `main` commit that records this
acceptance; from then on the add-only guard freezes every test file present at that tag.

## Known bugs

None known.

## Uncertain

- No mathematical content in this run.
- Rule (a) is a textual check, as CLAUDE.md describes it ("greps for float literals"):
  it scans comments and strings too, and it does not catch tolerances written as
  expressions (for example a power of two with a negative exponent). Rule (f) uses a
  word match with camelCase boundaries; `improved`, `waterproof`, `provenance` are not
  hits, `unproven` and `isProven` are.
- Rule (d) bans the six test modifiers anywhere in code, as CLAUDE.md says
  ("anywhere"). A future method named `skip` (for example in a lexer) would have to be
  named differently.

## Changed frozen tests

None (no `run-*` tag existed).

## Acceptance command output

### Clean clone (temp directory, commit 76fb8bd)

```
$ git clone -q /home/user/geomira clean && cd clean
$ pnpm install --frozen-lockfile        # Done in 1.4s using pnpm v10.28.0
$ pnpm verify
> pnpm typecheck && pnpm lint && pnpm depcruise && pnpm rules && pnpm test
> pnpm -r run typecheck && tsc -p tsconfig.tests.json      (8 projects + tests: Done)
> eslint . --max-warnings 0 && prettier --check .
All matched files use Prettier code style!
> depcruise packages apps/web/src --config .dependency-cruiser.cjs
✔ no dependency violations found (24 modules, 17 dependencies cruised)
> tsx scripts/check-rules.ts
ok   tolerance: 87 files scanned, 0 violation(s)
ok   file-length: 87 files scanned, 0 violation(s)
ok   test-count: 73 tests, floor 73, 0 violation(s)
ok   disabled-tests: 87 files scanned, 0 violation(s)
ok   add-only: no run-* tag yet: nothing frozen, 0 violation(s)
ok   forbidden-words: 87 files scanned, 0 violation(s)
> vitest run
 Test Files  17 passed (17)
      Tests  73 passed (73)
$ pnpm build
dist/index.html                   0.55 kB │ gzip:  0.33 kB
dist/assets/index-C6lbls-J.css    0.76 kB │ gzip:  0.45 kB
dist/assets/index-Df2v0Kg9.js   193.95 kB │ gzip: 60.98 kB │ map: 912.63 kB
✓ built in 1.28s
$ pnpm e2e
  ✓  2 [desktop] › e2e/shell.spec.ts:3:1 › shows the title and an empty canvas (333ms)
  ✓  1 [mobile] › e2e/shell.spec.ts:3:1 › shows the title and an empty canvas (328ms)
  2 passed (2.5s)
```

### Every check-rules fixture fails as intended

The fixture tests above assert the exact `file:line` list of each bad tree and an empty
list for each good tree. The same trees through the real CLI
(`tsx scripts/check-rules.ts scripts/check-rules/fixtures/<rule>/bad`; every run exits 1;
test-count also fails there because a fixture tree has no floor file):

```
FAIL tolerance: 3 files scanned, 7 violation(s)
     apps/web/src/zoom.ts:1  tolerance-like literal 1e-3
     packages/kernel/src/eps.ts:1  tolerance-like literal 1e-9
     packages/kernel/src/eps.ts:2  tolerance-like literal 0.0000001
     packages/kernel/src/eps.ts:3  tolerance-like literal 2.5E-7
     packages/kernel/src/eps.ts:4  tolerance-like literal 1e-12
     packages/kernel/src/eps.ts:5  tolerance-like literal .0001
     scripts/tool.ts:1  tolerance-like literal 3E-5
FAIL file-length: 3 files scanned, 3 violation(s)
     apps/web/src/long.css  401 lines (max 400)
     packages/kernel/src/long.ts  401 lines (max 400)
     packages/kernel/test/long.test.ts  401 lines (max 400)
FAIL disabled-tests: 8 files scanned, 14 violation(s)
     apps/web/e2e/fixme.spec.ts:2  `test.fixme(`
     apps/web/e2e/fixme.spec.ts:3  `test.describe.fail(`
     packages/kernel/test/conditional.test.ts:2  `.skipIf(`
     packages/kernel/test/conditional.test.ts:3  `.runIf(`
     packages/kernel/test/conditional.test.ts:4  `.skip(`
     packages/kernel/test/fails.test.ts:2  `.fails(`
     packages/kernel/test/jasmine.test.ts:1  `xit(`
     packages/kernel/test/jasmine.test.ts:2  `fdescribe(`
     packages/kernel/test/only.test.ts:2  `.only(`
     packages/kernel/test/only.test.ts:3  `.only(`
     packages/kernel/test/skip.test.ts:2  `.skip(`
     packages/kernel/test/skip.test.ts:3  `.skip(`
     packages/kernel/test/todo.test.ts:2  `.todo(`
     packages/lang/src/lexer.ts:1  `.skip(`
FAIL forbidden-words: 3 files scanned, 8 violation(s)
     apps/web/index.html:2  "Proofs" in apps/
     apps/web/src/Verdict.tsx:1  "Proved" in apps/
     apps/web/src/Verdict.tsx:2  "proven" in apps/
     apps/web/src/Verdict.tsx:3  "proof" in apps/
     packages/claims/src/verdict.ts:1  "proved" in a user-facing string
     packages/claims/src/verdict.ts:2  "unproven" in a user-facing string
     packages/claims/src/verdict.ts:3  "PROOF" in a user-facing string
     packages/claims/src/verdict.ts:4  "Proven" in a user-facing string
```

Rules (c) and (e) need injected counts and git history; they are covered by
test-count.test.ts and add-only.test.ts (all cases listed under Done).

### TeX fixtures (local, Ubuntu 24.04 TeX Live + Asymptote 2.87)

`sh tests/fixtures/compile-tex.sh` → hello-tikz.pdf written, Asymptote prints `(2,0)`,
"TeX and Asymptote fixtures compiled.", exit 0. With the expected coordinate changed to
`(9,9)` the script exits 1.

### CI on GitHub

On the branch (commit 76fb8bd, claude/run-0-scaffold-guardrails-crjyx4), tex.yml's
compile job ran inside `ghcr.io/youseng/geomira-tex`, wrote hello-tikz.pdf, and
Asymptote printed `(2,0)` ("TeX and Asymptote fixtures compiled."). tex and nightly have
path filters (TeX inputs, their own workflow file) and run again only when those change
or on their schedule / manual dispatch.

| Workflow      | Run                                                         | Result                                                          |
| ------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| ci            | https://github.com/youseng/geomira/actions/runs/39218199380 | success (verify, build, Playwright)                             |
| tex           | https://github.com/youseng/geomira/actions/runs/39218199382 | success (image built and pushed to GHCR; fixtures compiled)     |
| deploy        | https://github.com/youseng/geomira/actions/runs/39218199443 | success (build job; deploy job skipped off the default branch)  |
| nightly       | https://github.com/youseng/geomira/actions/runs/39218199640 | success                                                         |
| deploy (main) | https://github.com/youseng/geomira/actions/runs/39219324273 | success (merge of PR #1, commit 50ee23d; build and deploy jobs) |

## Requests

- None open. (Done: GitHub Pages enabled, branch merged as PR #1, deploy green on
  `main`.)

## Notes for later runs

- Dependencies: none beyond the allowed runtime set (react, react-dom). Dev tooling only:
  TypeScript, ESLint + plugins, Prettier, dependency-cruiser, Vitest, Vite,
  @vitejs/plugin-react, Playwright, tsx, @types/\*, globals.
- Deviations from the run text (not from SPEC), recorded in ADR-0001: Vitest
  `test.projects` instead of a workspace file (removed in Vitest 4);
  `@vitest/eslint-plugin` instead of `eslint-plugin-vitest` (renamed package, same
  rules).
- The tex image is based on `public.ecr.aws/docker/library/debian:trixie-slim` (the
  official Debian image via ECR Public) to avoid Docker Hub rate limits; GHCR package
  `geomira-tex` was created by the first tex.yml run.
- CI checks out full history (`fetch-depth: 0`) so the add-only guard can compare
  against the `run-*` tags.
