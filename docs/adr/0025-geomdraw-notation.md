# ADR-0025: Geomdraw's notation in the text language

Status: accepted (maintainer request of 2026-10-22, with ADR-0024). Extends ADR-0009 (the
grammar) with forms that are READ but never printed: the parser turns each into the canonical
statements of ADR-0009, so the printed text, the document and the language laws P1–P3 are
those of ADR-0009 unchanged.

## Context

The maintainer found the text language rigid next to their earlier Geomdraw: a point needed
coordinates (`A = (1, 2)`; Geomdraw had `points A B C` and `A = point()`), `AB` could not
stand for the line AB in a call (`foot(C, AB)` was an error with a hint to write
`line(A, B)`), and Geomdraw's `X, Y = intersect(a, b)`, `t1, t2 = tangents(P, w)`,
`@red @dashed`, capitalised names and claim forms such as `AB ⟂ CD` or `ABCD cyclic` were
errors. Geomdraw's script was its source of truth and its index-based branches were one of its
bugs; Geomira's document is the source of truth and its text is printed from it. The request:
Geomdraw's convenience, Geomira's engine.

## Decision

1. **Read, never printed.** Every form below is turned into canonical statements when the text
   is parsed (applied from the Text panel, the command bar, a file or a link). The document
   holds no trace of how it was written; the Text panel shows the canonical text after Apply.
   So P1 (parse∘print = id), P2 (print∘parse idempotent) and P3 (parseInto keeps ids and
   styles) hold as before: the printer never writes these forms, and each test of this ADR
   also checks that the printed result parses back to the same document.
2. **Free points without coordinates**: `point A`, `points A B C` (names glued or apart, with
   attributes) and `A = point()` are free points at exact places on the 0.1 grid of
   [−5, 5]², drawn by num's seeded generator from a hash of the statement (as the `triangle`
   sugar, ADR-0009 decision 11) until every two are at least 2 apart. Deterministic: the same
   text gives the same figure.
3. **`triangle ABC`**: the names may be glued; Geomdraw's bare types `acute`, `scalene`,
   `obtuse` (at the first vertex) and `obtuse_at_B` are the attributes of those names; `right`
   is refused ("a right angle is constructed, never assumed", SPEC §6.2). Names already defined
   on an earlier line are used as they are (the statement then draws their triangle and adds
   the type's `assume` lines); the others are made as before.
4. **Glued point names in expressions** (ADR-0009 made them an error outside claims): a run of
   2 names is line(A, B), of 3 circle(A, B, C), of 4 or more polygon(…). As an argument of a
   call, the runs are SPREAD into their points when no signature of the tool takes the lines,
   circles or polygons there but one takes the points (other arguments count as any kind):
   `midpoint(BC)`, `circumcenter(ABC)`, `ratio(AB, AC)`, `polygon(ABC)`, `dist(AB)`, while
   `foot(C, AB)`, `dist(C, AB)`, `reflect(AB)` and `on(ABC)` keep the line or the circle.
   Claims and assumptions follow their kind's parameters the same way (`collinear(ABC)`,
   `acute(ABC)`), and `P inside ABC` reads the run as a polygon. The relations keep their
   meaning: `AB = CD` is still a length claim and `AB < AC` a comparison of lengths. When a name
   of a run is unknown, the hint says what the run means ("AB is line(A, B); the length AB is
   dist(A, B)").
5. **Both branches: `X, Y = call(…)`** for a call whose overloads, for every static kind of its
   arguments, have two candidates and one low-level selector: X gets `along(+)` or `orient(+)`,
   Y `along(-)` or `orient(-)` (SPEC §7: branches by the line's direction or by orientation,
   never by an index). Refused, with the reason: one candidate (two lines), not two names,
   selectors written (the branches are chosen for you), kinds whose candidates need different
   low-level selectors (a cline). The text cannot evaluate the figure, so it cannot write the
   semantic selector the GUI writes (ADR-0024); when a claim depends on the choice, the claims
   tester says so (ORIENTATION-DEPENDENT, SPEC §10.5) and names the line, where a semantic
   selector is the fix.
6. **Other names for tools** (Geomdraw's): `tangents` = tangent_from, `tangent_points` =
   tangent_point, `second_intersection` = other, `length` and `distance` = dist, `slider` =
   param, `perpendicular` = perp. The table is language data (`TOOL_ALIASES`); a test checks
   that every value is a registry tool and no key is one, so the registry stays the only
   enumeration of tools. The document stores the registry name.
7. **Capitals**: a capitalised word followed by `(` is a call name (`Midpoint(A, B)`), and a
   capitalised statement keyword at the start of a line is that keyword (`Triangle ABC`). Both
   were invalid point names before.
8. **Style words**: `@dashed @dotted @solid @thick @thin @hidden @nolabel @noimage` and the
   palette's colour names (`@red`, …, ADR-0016 decision 20) after a definition or in a `style`
   statement are the attributes `dash=…`, `width=2.5` / `width=1`, `hidden`, `label=""`,
   `noimage`, `color=…`. An unknown word is an error listing the words.
9. **Claim forms**: `A, B, C collinear`, `ABCD cyclic` (or `concyclic`), `AP, BQ, CR
concurrent`, `AB ⟂ CD` (or `⊥`, `perp`, `perpendicular`, `\perp`), `AB ∥ CD` (or
   `parallel`, `\parallel`), `P on ω`, `ω tangent γ`: the claim kinds of those names. They
   are tried after the kind calls and before the relations, and only when the whole form is
   matched, so every claim of ADR-0009 reads as before.
10. **Documentation**: docs/language.md gains a generated section whose "read as" column is
    produced by parsing each example, so it cannot drift from the parser. The canonical grammar
    (ADR-0009, carried verbatim and checked by a test) is unchanged; the additions are this
    block, which this ADR carries verbatim (also checked by a test):

```ebnf
(* ---- Geomdraw's notation: read, never printed (ADR-0025) ---- *)
statement    += pointsStmt | branchesStmt ;
pointsStmt    = ( "point" | "points" ) , pointName , { pointName } , { attr } ;
                                    (* free points at places drawn from the names *)
branchesStmt  = name , "," , name , "=" , call , { attr } ;
                                    (* a two-candidate call without selectors: the first name
                                       takes along(+) or orient(+), the second along(-) or orient(-) *)
definition   += name , "=" , "point" , "(" , ")" , { attr } ;           (* a free point *)
triangleStmt += "triangle" , pointName , pointName , pointName ,
                { "acute" | "scalene" | "obtuse" | "obtuse_at_" , pointName } , { attr } ;
                                    (* names that exist are used; "obtuse": at the first vertex *)
primary      += run ;
run           = pointName , pointName , { pointName } ;    (* glued: AB is line(A, B), ABC is
                                       circle(A, B, C), ABCD… polygon(A, B, C, D, …); as an argument
                                       a run is spread into its points where the call or the claim
                                       takes the points and not the line, circle or polygon *)
call         += Capitalised , "(" , [ args ] , ")" ;    (* Midpoint(…) is midpoint(…) *)
tool         += alias ;                                     (* see "Other names" *)
attr         += "@" , styleWord ;                           (* @red is [color=red] *)
claim        += expr , { "," , expr } , ( "collinear" | "concyclic" | "cyclic" | "concurrent" )
              | expr , ( "⟂" | "⊥" | "perp" | "perpendicular" | "∥" | "parallel"
                       | "on" | "tangent" ) , expr ;
symbol escapes += "\perp" = "⟂", "\parallel" = "∥".
keywords: Triangle, Point, Points, Claim, Assume, Style, Label start a line as in lowercase.
```

## Consequences

- One frozen line changes (commit citing this ADR): `apps/web/e2e/flows-design.spec.ts`
  typed Geomdraw's `O, G, H collinear` into the claim box to show that a text the language
  does not read is refused with the parser's reason. Decision 9 makes that text a claim, so
  the line types `O, G, H are collinear` instead, which is still refused with the parser's
  reason; the test's other lines, and what it checks, are unchanged. Every other form here
  was an error before, so no other valid text changes meaning, and the frozen assertion about
  `x = AB` (its hint names `dist(A, B)`) holds.
- A text written with these forms is rewritten in canonical form on Apply (as the `triangle`
  sugar already was); the figure is the same.

## Alternatives considered

- **Printing the short forms** (`foot(C, AB)`): changes the canonical text that frozen tests,
  the export goldens and saved files pin, for no change in the document.
- **Index-based `X, Y = intersect(a, b)`** (Geomdraw's): forbidden by SPEC §7; indices flip.
- **Evaluating while parsing to write semantic selectors for `X, Y = …`**: the parser would
  depend on the figure's values; the GUI (ADR-0024) does that, and the tester reports the rest.
- **Aliases in the kernel's ToolSpec**: the kernel's registry would carry another program's
  names; they are a language matter.
