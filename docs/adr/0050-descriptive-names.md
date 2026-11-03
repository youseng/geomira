# ADR-0050: Names that say what an object is

Status: accepted (maintainer request "usability", item 6, 2026-10-30). Extends ADR-0012 (the
editor's names.ts) and ADR-0016 decision 23 (conventional names); adds a sentence to SPEC §12.
The language (SPEC §11.2, ADR-0009) is unchanged: names typed in the text are the user's.

## Context

GUI tools named every line l, l_1, l_2, … and every circle c, c_1, … (names.ts), so a figure
built by mouse read `l_3 = perp(D, l_1)`: the text said nothing about what l_3 is. The
maintainer asked that lines, segments, rays and circles built from named points get names
from those points: line(A, C) → l_AC, segment → s_AC, ray → r_AC, circle through A, B, C →
c_ABC (the circumcircle keeps ω), circle(O, A) → c_O, tangent at A → t_A, perpendicular or
parallel through P → l_P (then l_P_2 …); grammatical, with today's names as the fallback,
never renaming existing objects, conventional names winning. Plain `AC` cannot be an object
name: it is a point name glued to another (ADR-0009), and in claims and calls a run of two
point names means the segment or the line AC (ADR-0025).

What the grammar allows (kernel `nameProblem`, SPEC §11.2): a name that does not start with
an uppercase letter starts with a lowercase Latin or Greek letter, then any of
`[A-Za-z0-9_α-ωΑ-Ω]`, then primes. So `l_AC`, `l_A_1B_1`, `l_M_aB`, `l_BH'` and `l_AC_2`
are grammatical; braces (`l_{AC}`), a prime inside the name (`l_H'B`) and a star (`l_AA*`) are
not. The lexer reads such a name as one name token (lexName), and the printer writes the name
as stored, so P1–P3 hold unchanged.

How it is shown: the Text panel shows the name as written. The panels draw names with
MathText, which typesets the POINT names inside a string (`l_A_1B_1` shows l_A₁B₁, `l_AC`
shows l_AC as written, as `l_1` was shown before). The canvas draws no label for lines and
circles by default (scene `labelOf`); a label the user turns on is drawn with the label
grammar (ADR-0010), where `_` takes one character or a `{…}` group, so `l_AC` as a label reads
l with a subscript A, then C. That is the user's label text, editable in the style card; it is
not changed by this ADR (see Alternatives).

## Decision

1. **The form**: the tool's letter, `_`, then the names of its points glued in pick order:
   - Line(A, C) → `l_AC`; Segment → `s_AC`; Ray(A, C) → `r_AC` (the order matters for a ray
     and is the order of the definition); Circle (3 points) → `c_ABC`.
   - Circle (center, point) circle(O, A) and Circle (center, radius) circle(O, 2) → `c_O`
     (the circle centered at O; the radius tool is included because it is the same circle
     tool of the language, circle(O, …), and the same reading).
   - Tangent at A → `t_A`; both tangents from an outside point P → `t_P`, `t_P_2` (the lines
     through P, as l_P is the line through P; built in one batch, named in turn).
   - Perpendicular and Parallel through P → `l_P` (then `l_P_2`, …).
   - A polygon side made by a click where a line is wanted (ADR-0024 decision 8) is
     segment(A, B): `s_AB`, as the Segment tool names it (one rule for the same object).
     The letter is the generic base of the kind (l, c) or the tool's own key letter (s, r, t).
     `s_AC` rather than `seg_AC`: short, and s is the Segment tool's key.
2. **Which points**: each point must be named by the point grammar (an uppercase letter, then
   digits or `_` + digits | one letter | `{alnum+}`, then primes: A, A1, A_1, M_a, H'). A point
   with any other name (a lowercase name such as `p`, a managed image `A*`) gives no descriptive
   name, nor does a missing name.
3. **Grammatical**: the result must pass `nameProblem`. Subscripted points glue grammatically
   (`l_A_1B_1`, `l_M_aB`, `l_A1B`); a brace subscript (`M_{ab}`) and a primed point anywhere but
   last (`l_H'B`) do not, so they fall back. A primed last point is kept (`l_BH'`, `t_H'`).
4. **Length**: at most `MAX_DESCRIPTIVE_NAME` = 12 code points for the name before any
   collision suffix: `c_A_1B_1C_12` (12) is used, `c_A_12B_12C_12` (14) falls back. Twelve keeps
   three subscripted points with one-digit indices, and keeps the Objects panel's column usable.
5. **Collisions**: a name is taken when an object, a claim or a layer has it (as in names.ts).
   A taken name gives the first free of `base_2`, `base_3`, … (`l_P`, `l_P_2`, `l_P_3`). A base
   ending in a prime has no grammatical variant (`l_BH'_2` is not a name), so it falls back.
   Known ambiguity, accepted: `l_P_2` may be the second line through P or the line through a
   point P_2; a name is a mnemonic, the definition (`l_P_2 = parallel(P, m)`) is the meaning, and
   both the text and the Objects panel show it.
6. **Fallback**: no descriptive name → the usual rule of names.ts (l, l_1, …; c, c_1, …),
   unchanged.
7. **Order with conventional names**: a free conventional name wins (ADR-0016 decision 23:
   the circumcircle and the incircle are ω, the centers O, G, I, H, N, I_a). The circumcircle
   with ω taken keeps ADR-0016's stated rule (c, c_1, …); it is not given `c_ABC`, so ADR-0016
   stays as written and none of its tests change.
8. **Scope**: only the tools above. Tools whose points would misname what they build keep the
   usual names: the perpendicular bisector of A, B (`l_AB` would read as the line AB), the
   angle bisectors and the symmedian, the polar, the radical axis, the circle on a diameter
   (`c_AB` reads as a circle through A and B, not on AB as diameter), the excircle, the
   nine-point circle, the incircle when ω is taken, conics, arcs, images under maps. The
   command bar is the language: its statements keep the names typed; its tool switching runs
   the same state machine, so a tool started from it names as above.
9. **Never renamed**: a descriptive name is chosen only for a new object. Renaming A later
   leaves `l_AC = line(X, C)` as it is (renaming is the user's, through the rename edit), and
   a construction already in the figure is reused, not named again (ADR-0029).
10. **Where**: `packages/editor/src/descriptive-names.ts` (the rule; pure data in, a name out),
    `Build.describe` on the GUI tool table (`described(…)` in tool-ui.ts), machine-build.ts
    (calls, the tangent and both tangents) and create-side.ts (polygon sides). The public
    `./names` module is unchanged.

## Consequences

- Figures built by mouse read like olympiad text: `l_C = perp(C, s_AB)`, `t_P = …`, `c_ABC`.
- Names are longer; the 12-character limit bounds them.
- Every UI state stays expressible in the text: the names are ordinary grammatical names,
  printed and parsed like any other (tested: print → parse → print is the identity and the
  names survive, and a property test over generated point names).
- Frozen tests that asserted the generic names of objects these tools build change (below).

## Alternatives considered

- **`l_{AC}` (a brace subscript, as the label grammar reads it)**: not grammatical for
  non-point names; changing the name grammar for this would change the language (lexer,
  printer, P1–P3, every name check) for a GUI convenience. Rejected.
- **Writing a typeset label (`label="l_{AC}"`) when the user shows a line's label**: would read
  better on the canvas, but it is a label-text decision of the style card (ADR-0029), outside
  this item; left for a later request.
- **`AC`, `ABC`** (as Geomdraw named): not usable, see Context.
- **Primes as the collision suffix (`l_P'`)**: as ambiguous as `_2` (H' is a point name) and
  limited to a few; `_k` was the maintainer's suggestion and is unbounded.
- **A setting to keep the generic names**: would keep the frozen tests unchanged, but by a
  default that is not what the maintainer asked for; rejected as a way around the tests.
- **Leaving tangents from a point and polygon sides generic** (fewer frozen changes): the
  tangent tool would name its tangent at A `t_A` and its tangents from P `l_1`, and a side
  segment(A, B) would be `l` while the Segment tool names the same object `s_AB`: one object,
  two rules. Rejected for consistency.

## Frozen tests changed under this ADR

Each change replaces a generic name expected for an object these tools build from named points
by its descriptive name; the definitions, values, counts, history entries and orders asserted
are unchanged (where a definition refers to the renamed object, only that reference changes,
`perp(C, l)` → `perp(C, s_AB)`). One commit, citing ADR-0050.

- `packages/editor/test/geomdraw-tools.test.ts`:75, 79, 86 (perp through the new point D:
  `l_1` → `l_D`), 94 (parallel through C: `l_C`), 125 (both tangents from P: `t_P`, `t_P_2`),
  152–153 (tangent at C: `t_C`), 169, 181 (the two tangents after a drag: `t_P`, `t_P_2`).
- `packages/editor/test/machine.test.ts`:228 (tangent at C: `t_C`), 231–234 (both tangents from
  P, the comment and three names: `t_P`, `t_P_2`).
- `packages/editor/test/tangent-coincidence.test.ts`:36, 38, 44, 46 (tangent at Q, at P: `t_Q`,
  `t_P`).
- `packages/editor/test/choice-tangent-other.test.ts`:16 (the tangents are found by the
  initial of their names: `'l'` → `'t'`).
- `packages/editor/test/hidden-side-reuse.test.ts`:18–19 (perp through C: `l_C`).
- `packages/editor/test/polygon-sides.test.ts`:15, 17–18, 27, 32–33, 39, 45–46, 55–57 (the side
  segments `s_AB`, `s_BC`; the perp and parallel through C `l_C`; definitions that refer to
  the side).
- `packages/editor/test/glider-sides.test.ts`:17–19, 28–29 (the side segments `s_AB`, `s_BC`
  and the glider on them).
- `packages/editor/test/same-construction.test.ts`:108–109 (line through X and E: `l_XE`).
- `packages/editor/test/geomdraw-tools-more.test.ts`:135 (circle with a typed radius around B:
  `c_B`).
- `apps/web/e2e/flows-build.spec.ts`:28, 34, 36, 39 (the circle through A, B, C built by mouse
  is `c_ABC`; the command-bar half of the same test types that name so that the two texts are
  still compared for identity).
- `apps/web/e2e/flows-geomdraw.spec.ts`:53 (`s_AB = segment(A, B)`, `l_C = perp(C, s_AB)`).

New tests: `packages/editor/test/descriptive-names.test.ts`.
