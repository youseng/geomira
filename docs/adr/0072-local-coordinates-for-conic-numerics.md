# ADR-0072: Retain local coordinates for translated conics and area

Status: authorized by release prompt 07; final integration acceptance requires verification.

## Context

At base `f95e0056c9e2cb73d23c6dac900acaf9e7f1a06a`, a unit triangle translated to
(100000000, 100000000) has FloatField area 0 instead of exactly 1/2. The raw
world-coordinate shoelace terms cancel. A radius-5 circle constructed as a conic
at (1000000, 1000000) rejects its own defining points and tangents; at 100000 the
incidence decision is already ambiguous. Construction initially uses local
coordinates but discards them in a rounded world polynomial. A better incidence
formula cannot recover the lost constant term from that polynomial alone.

## Decision

- Area uses the same field-generic unsigned shoelace formula on vectors relative
  to its first vertex. This is a translation identity over every field; orientation,
  collinear behavior and exact arithmetic retain their existing semantics.
- A FloatField conic may carry immutable optional `chart = { origin, q }`:
  the six coefficients of `Q(origin + Y)`, in the same scale as its canonical world
  coefficients. Constructors retain this local polynomial instead of attempting
  to reconstruct it later from the rounded world constant. Float construction
  uses an exact power-of-two local scale, avoiding unnecessary rounding of all five
  defining points by an irrational square root. Rational/ModP construction is unchanged.
- The existing `a,b,c,d,e,f` normal-form coefficients remain available. Exact-field
  values, serialized expressions, the language, object IDs and selectors are unchanged.
  The optional chart is derived numeric precision data, not document data. Canonical
  `numbersOf` ordering remains suitable for cross-field oracles; evaluator range checks
  also inspect every chart element and its origin.
- Coefficient tuples from `coeffsOf` retain the chart. `qValue`, half-gradient,
  determinant, homogeneous center and pole calculations use its local coordinates;
  homogeneous positions/covectors are translated back. Incidence still uses the
  unchanged EPS/BAND contract. Type/semi-axis decisions use the local polynomial.
- A transformed conic retains an output chart. Frame conjugation and the
  cancellation-prone `conic_to_circle` matrix products use exact binary-rational dot
  products and round each matrix entry once. This retains the existing eccentric
  conic regressions without enlarging their bounds. Other field products remain exact.
- Line/conic intersection uses a positive rescaling of the float direction before
  solving the quadratic; this preserves candidate labels and avoids amplified root
  rounding for a direction only 10^-5 long. The exact-field path remains unchanged.

## Consumer inventory

| Consumer                                                 | Precision boundary                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Incidence, tangent, polar, pole, center                  | Chart-aware polynomial/gradient/dual helpers; polar foot uses stable Q(P) directly                                             |
| Glider evaluation/drag, selectors, retained conic claims | Existing helpers now retain/use the chart                                                                                      |
| Similarity and projective images                         | Local input/output charts; origin at infinity falls back to directly mapping local coefficients                                |
| Conic-to-circle                                          | Rounded-once frame products; retains stable coefficients in the resulting conic                                                |
| Line/conic and conic/conic intersections                 | Stable local evaluation; field-to-number conversion retains chart metadata; anchorless reference selection uses local vertices |
| Dual/common tangents and foci                            | Stable local frames, chart-preserving number conversion and local foci translated back                                         |
| Scene geometry, clipping, bounds, hit-testing            | Scene parametrization is derived locally and its center/vertex translated back; downstream paths use that shape                |
| SVG, PNG, TikZ, Asymptote                                | Share scene geometry; numeric export objects use corrected evaluator results                                                   |
| Printing, saving, sharing, undo                          | Store construction expressions, never evaluated conic coefficients or charts                                                   |
| Canonical coefficient display and numeric oracle         | Retain the six world coefficients; chart is additional precision data                                                          |

## Frozen snapshot changes

No existing mathematical assertion, count floor, tolerance or browser screenshot is
weakened. The conic export fixture's SVG and two Asymptote references are regenerated
and inspected: SVG changes are only 0.001-pixel decimal-rounding boundaries in the
parabola; Asymptote changes are final floating digits in the clipping rectangle,
glider, tangent, polar and pole values (e.g. 5.000000000000004 becomes 5). TikZ
references are unchanged. Frozen files:

- `packages/export/test/__snapshots__/fixture-conics/figure.svg`
- `packages/export/test/__snapshots__/fixture-conics/standalone.asy`
- `packages/export/test/__snapshots__/fixture-conics/aops.asy`

## Limits and alternatives

A chart cannot recover differences already unrepresentable in supplied double inputs,
make a genuinely degenerate conic valid, or remove the conditioning limits of a
rounded projective map. Existing Undefined/Inexact decisions and range guards remain.
No point is snapped onto a curve and no input name receives special membership.
Increasing EPS/BAND or accepting a named point unconditionally would hide the defect;
compensating world polynomial evaluation alone cannot restore coefficients already lost
at construction. No dependency or general exact-field extension is introduced.
