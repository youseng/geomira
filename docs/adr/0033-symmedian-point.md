# ADR-0033: The symmedian point (maintainer request after Run 13)

Status: accepted (maintainer request, listed in STATUS as such, not Run 14 scope). Answers
Run 13's open question (ADR-0031 decision 3 and its STATUS "Uncertain": the symmedian point
had to be typed as isogonal(centroid(A, B, C), A, B, C)). Adds one tool; nothing else changes.

## Context

ADR-0031 built `symmedian(A, B, C)` as the symmedian LINE from A, and left the symmedian
(Lemoine) point K one `isogonal` call away. The maintainer asked for K as its own tool, with
the full tool checklist of CLAUDE.md: one compute<T>; exact over Q (K has barycentric
coordinates a² : b² : c²); registry entry with symmetry "any order of A, B, C, same value";
degenerate cases as the other triangle centres; a theorem test that it equals
isogonal(centroid(A, B, C), A, B, C) and lies on the three symmedians; export mapping;
docs/tools.md regenerated; a GUI tool next to Symmedian with a free shortcut.

## Decision

1. **symmedian_point(A, B, C)** = (a²·A + b²·B + c²·C)/(a² + b² + c²), a² = |B − C|²,
   b² = |C − A|², c² = |A − B|² (packages/kernel/src/tools/conjugates.ts, beside isogonal and
   symmedian). Rational in the coordinates: exact over Q and mod p, not `radical`
   (ADR-0008 decision 9). The denominator is a sum of squared side lengths, positive once the
   vertices are distinct.
2. **Degenerate cases**, as circumcenter and orthocenter (triangle.ts): coincident vertices →
   Undefined ("coincident points: symmedian_point needs three distinct vertices"); collinear
   vertices (the normalised cross product within EPS, ADR-0003 item 21) → Undefined
   ("collinear points: symmedian_point needs a non-degenerate triangle"), the same reasons as
   isogonal's. (For three distinct collinear points the formula is still a point; the maintainer
   asked for the triangle-centre behaviour, and a "symmedian point" of a flat triangle has no
   olympiad meaning.)
3. **Symmetry**: any order of A, B, C, `same: 'value'` (the formula is symmetric; tested exactly
   by construction-key.test.ts's sample).
4. **Export**: 'numeric' (ADR-0014's frozen test pins the constructive tools; ADR-0031 did the
   same for the v1.1 tools).
5. **Tests**: degenerate cases (helpers/degenerate-symmedian-point.ts, spread into
   degenerate.test.ts); a property test (helpers/symmedian-point-properties.ts, exactly over Q
   and in floats: K equals isogonal(centroid), the same for another order of the vertices, and
   lies on symmedian(A, B, C), symmedian(B, C, A), symmedian(C, A, B)); the same theorem on the
   theorem runner's figures (theorems-symmedian-point.test.ts, float and exact); the symmetry
   sample of construction-key.test.ts; L3 by the registry's oracle (it samples every tool).
   Frozen tests gain lines only (registry names, the symmetry sample, two spreads).
6. **GUI**: "Symmedian point" (three points), right after Symmedian in the Lines group (the
   palette groups by tool table order), key ⇧D: the free Shift letters were D, F, U, W
   (ADR-0032 took F, U, W); a test checks every key is bound once. Its icon is beside the
   inversion tools' (apps/web/src/icons-inversion.tsx: icons.tsx is at its line limit).

## Consequences

- K is one call; isogonal(centroid(…)) still works and gives the same point.
- docs/tools.md and docs/language.md list the tool.

## Alternatives considered

- **Changing symmedian(A, B, C) to the point** (ADR-0031's alternative): breaks the line every
  existing figure and claim uses.
- **A sugar in the language for isogonal(centroid(…))**: a second spelling of one construction;
  a registry tool is what CLAUDE.md asks for and the docs list.
