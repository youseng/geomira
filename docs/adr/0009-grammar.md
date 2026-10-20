# ADR-0009: The language: grammar, names with `*`, printing, parseInto, migrations (Run 6)

Status: accepted (Run 6). Extends SPEC §11 (statements, names, laws, versioning), ADR-0003
(items 2 and 5: literals and claims as data), ADR-0004 (item 9: `on(obj)`), ADR-0006 (item 14:
parse-level selector checks), ADR-0007 (items 9 and 10: managed names, placement of images) and
ADR-0008 (decision 2 and its consequences: the notation of the claim kinds, `assumptionProblem`).
Adds two optional fields to the kernel's data model (decisions 12 and 13) and one module to
packages/claims (decision 16). Numbered 0009 because 0004–0008 were taken (note E of the run).

## Context

Run 6 builds packages/lang (SPEC §11): lexer, recursive-descent parser with per-line recovery,
printer, `parseInto`, migrations, the laws P1–P3, and the generated language reference. SPEC
§11 lists the statements and the name grammar, but leaves open: the exact grammar of every
statement, attribute and selector; how `*` after lowercase names lexes (ADR-0007 made `l*`, `ω*`
managed names, SPEC §11.2 allowed `*` only after point names); the claim and assumption notation
of SPEC §10–§11 against ADR-0008's kinds; where comments and "numbers as written" live in a
document whose text is not stored; what P1's "up to ids" covers; what parseInto keeps; and how
`on(obj)` and `triangle` expand. Notes A–C of the run fix the `*` rule, require the kernel's and
the claims package's own diagnostics (never re-implemented), and require totality.

## Decision

### Grammar (EBNF; `packages/lang/src/grammar.ts` is the source, docs/language.md shows it)

```ebnf
(* ---- lexical ---- *)
file          = { line , newline } , [ line ] ;
line          = { space } , [ statement ] , { space } , [ comment ] ;
comment       = "#" , { any character } ;                  (* kept: it belongs to the next statement *)
space         = " " | tab ;                                 (* a trailing CR is dropped *)

pointName     = upper , [ digit , { digit }
                        | "_" , ( digit , { digit } | letter | "{" , alnum , { alnum } , "}" ) ] ,
                { "'" } , { "*" } ;                         (* glued stars always belong to it *)
otherName     = ( lower | greek ) , { letter | digit | "_" | greek } , { "'" } , [ stars ] ;
stars         = "*" , { "*" } ;     (* part of otherName iff the next character is NOT a letter,
                                       digit, "_", "(" or "\"; a starred name followed by
                                       whitespace and an operand is an error *)
greek         = "α" … "ω" | "Α" … "Ω" | "\" , greekWord ;  (* \alpha … \omega, \Gamma … \Omega *)
name          = pointName | otherName ;
number        = digit , { digit } , [ "." , digit , { digit } | "/" , digit , { digit } ] , [ "°" ] ;
                                    (* exact; glued; a leading "-" glued to it makes it negative *)
float         = [ "-" ] , digit , { digit } , [ "." , digit , { digit } ] ,
                [ ( "e" | "E" ) , [ "+" | "-" ] , digit , { digit } ] ;   (* attributes, @viewport *)
string        = '"' , { character | "\\" , ( '"' | "\\" | "n" | "t" | "r" | "u{" , hex , "}" ) } , '"' ;
symbol escapes: "\angle" = "∠", "\measuredangle" = "∡", "\cdot" = "·", "\neq" = "\ne" = "≠";
                "−" = "-", "⋅" = "·", "!=" = "≠", "<=" = "≤", ">=" = "≥".

(* ---- statements: one per line ---- *)
statement     = definition | claimStmt | assumeStmt | triangleStmt | styleStmt | labelStmt
              | directive ;
definition    = name , "=" , expr , { attrGroup } ;        (* keys: style keys, layers *)
claimStmt     = "claim" , claim , { attrGroup } ;           (* key: name *)
assumeStmt    = "assume" , condition ;
triangleStmt  = "triangle" , pointName , pointName , pointName , { attrGroup } ;
                                    (* keys: acute, scalene, obtuse_at_<vertex> *)
styleStmt     = "style" , name , { attrGroup } ;           (* style keys; images too: style A* … *)
labelStmt     = "label" , name , string ;
directive     = "@version" , digit , { digit }
              | "@title" , string | "@author" , string
              | "@layer" , name , [ "=" , "image" , "(" , name , "," , name , ")" ] , { attr }
                                    (* keys: main, visible, locked, opacity, order;
                                       derived: suffix, exclude *)
              | "@view" , name , { attr }                   (* keys: layers, viewport *)
              | "@viewport" , float , float , float ;       (* centre x, centre y, zoom *)

(* ---- attributes ---- *)
attr          = attrGroup | attrItem ;                      (* bare items in directives only *)
attrGroup     = "[" , [ attrItem , { "," , attrItem } ] , "]" ;
attrItem      = key , [ "=" , value , { "," , value } ] ;   (* a list (exclude, layers, viewport)
                                                               takes the rest of its group *)
value         = float | number | name | "-" , name | string | stars ;
style keys    : color=word|string, width=float, dash=solid|dashed|dotted, hidden[=true|false],
                noimage[=true|false], label=string.

(* ---- expressions ---- *)
expr          = product , { ( "+" | "-" ) , product } ;
product       = unary , { ( "*" | "·" | "/" ) , unary } ;
unary         = "-" , number                                (* glued: a negative literal *)
              | "-" , unary | primary ;
primary       = number | name | call | "(" , expr , ")" | "(" , expr , "," , expr , ")" ;
                                                            (* (x, y) is point(x, y) *)
call          = tool , "(" , [ args ] , ")" ;               (* tool: a registry name *)
args          = arg , { "," , arg } , { "," , selector } | selector , { "," , selector } ;
arg           = expr ;                                      (* on(obj) gets an explicit parameter *)
selector      = ( "same_side" | "opposite_side" ) , "(" , expr , "," , expr , ")"
              | "on_arc" , "(" , expr , "," , expr , "," , [ "not" ] , expr , ")"
              | "between" , "(" , expr , "," , expr , ")"
              | ( "inside" | "outside" ) , "(" , expr , ")"
              | ( "other" | "near" | "far_from" ) , "(" , expr , ")"     (* other(P): one argument *)
              | ( "along" | "orient" ) , "(" , ( "+" | "-" ) , ")" ;

(* ---- claims (kinds of ADR-0008) ---- *)
claim         = kind , "(" , expr , { "," , expr } , ")"    (* every kind by name *)
              | segment , "=" , [ number , ( "·" | "*" ) ] , segment          (* length *)
              | segment , "/" , segment , "=" , segment , "/" , segment      (* ratio *)
              | segment , "/" , segment , "=" , number                       (* ratio_value *)
              | [ number , [ "·" | "*" ] ] , dangle , "=" , dangle           (* dangle *)
              | "∡" , "(" , expr , "," , expr , ")" , "=" , number           (* dangle_lines *)
              | angle , "=" , angle                                          (* angle_eq *)
              | angle , ( "+" | "-" ) , angle , "=" , number                 (* angle_sum, angle_diff *)
              | expr , "=" , expr ;                                          (* equal *)
segment       = pointName , pointName                       (* glued: AB *)
              | "dist" , "(" , expr , "," , expr , ")" ;
angle         = "∠" , pointName , pointName , pointName     (* glued: ∠ABC, the angle at B *)
              | "∠" , "(" , expr , "," , expr , "," , expr , ")"
              | "angle" , "(" , expr , "," , expr , "," , expr , ")" ;
dangle        = "∡" , pointName , pointName , pointName
              | "∡" , "(" , expr , "," , expr , "," , expr , ")" ;

(* ---- assumptions (open conditions) ---- *)
condition     = kind , "(" , expr , { "," , expr } , ")"
              | measure , ( "<" | ">" | "≠" ) , measure
              | expr , "inside" , expr
              | expr , { "," , expr } , "in" , "order" , "on" , expr ;
measure       = segment | angle | number | expr ;
```

### Names and the `*` rule (extends SPEC §11.2; note A)

1. A POINT name is an uppercase Latin letter, then digits or `_` + (digits | one letter |
   `{alnum+}`), then primes, then any glued run of `*`, which is ALWAYS part of the name
   (points are never multiplied, so `A*B*` is A*, B*; `∡A*BC` is A*, B, C).
2. Any other name starts with a lowercase Latin or a Greek letter (or a `\alpha`-style escape),
   continues with letters, digits, `_` and Greek letters, then primes. A glued run of `*` after
   it is part of the name iff the next character is NOT a letter, digit, `_`, `(` or `\`: `l*`,
   `w*,` and `w*)` are names; `a*b`, `k*2`, `r*(1+r)` and `w*\alpha` are products. A starred
   name followed by whitespace and an operand (`a* b`, `a* (b)`) is an error with the hint
   "write a * … for multiplication". `k*-2` is therefore the name `k*` minus 2; the printer
   writes every binary operator with spaces (`k * -2`), so printed text never meets the rule's
   edge. A property test (laws/stars.test.ts) prints documents mixing lowercase numbers,
   lowercase curves and their images `l*`, `w*` with random arithmetic, and checks that they
   parse back to the same trees.
3. Glued point names are juxtaposition: `AB` is a segment and `ABC` an angle in claims and
   assumptions only; in a definition `AB` is an error ("write line(A, B), segment(A, B) or
   dist(A, B)"). `Ma` (a point letter glued to lowercase letters) is "did you mean M_a?";
   `Mab` and `M_ab` give `M_{ab}`.

### Numbers

4. Exact literals are `2`, `0.1`, `2/3` (a fraction is digits/digits glued: `1 / 2` is a
   division), optionally negative when the `-` is glued in operand position (`-3/4`, `x - -1`;
   `- 3` is neg(3)), optionally with `°` (decoration: angles are degrees everywhere). Exponents
   are refused in exact literals ("write 0.001"). Attribute values and `@viewport` are doubles:
   any finite double, `-0` included, printed by its shortest round-trip text (`2.5e21`).

### Statements, attributes, layers

5. One statement per line (the grammar). Attributes are bracket groups; a list-valued key
   (exclude, layers, viewport) takes the rest of its group; directives also accept bare
   `key=value` items (`@view v layers=a,-b`, SPEC's spelling). Booleans: `key` is true,
   `key=true|false` explicit; the printer writes `hidden=false` when a style says so (absent and
   false are different Style values). Colours are words or quoted strings; labels quoted.
6. `@layer` lines may stand anywhere: every layer is created first, in text order (the main
   layer always first; `@layer base [main]` names it); a derived layer's rule becomes active when
   its transformation is defined, and its exclusions are resolved as the excluded objects appear.
   A layer's `order` is printed only when it differs from "highest so far + 1" (the kernel's
   default). A derived layer whose rule cannot be made stays a plain layer, with the error at its
   line.
7. Styles from `style X` / `label X` lines are collected first and applied when X is created
   (a `[noimage]` is thus known before X's images would be made); images are styled the same
   way (`style A* [hidden]`). The printer writes styles inline on definitions, and an image only
   as a `style X*` line, where it sits in construction order, when it has a style or a comment.

### Expressions and selectors

8. `-` binds tighter than `*`, `·`, `/`, which bind tighter than `+`, `-`; all left-associative.
   `(x, y)` is point(x, y). Operators are the registry's `add`, `sub`, `mul`, `div`, `neg`; the
   printer uses infix with the fewest parentheses that give back the same tree (a right operand
   of equal precedence keeps its parentheses: `a - (b - c)`, `a + (b + c)`), and `-(2)` for the
   negation of a literal.
9. Selectors are the trailing arguments of a call (`selectors come after the arguments`).
   `other(P)` with one argument is the ranker, `other(a, b, P)` the tool. `on_arc(B, C, not A)`;
   `along(+)`, `orient(-)`.
10. **`on(obj)` without a parameter** (ADR-0004 item 9) is desugared while parsing, from the value
    of obj in the figure built so far (FloatField): a line → `on(obj, 1/3)`; a circle with a known
    point → `on(obj, 2, 1)` (the anchor turned by the 3-4-5 rotation, exact); a circle without one
    (`circle(O, r)`) → `on(obj, 90)` (exact when r is). Undefined or not a curve → error ("write
    the parameter"). The document always stores the explicit parameter (SPEC §5).
11. **`triangle A B C [type]`** → three free points, `tri_ABC = polygon(A, B, C)` (the first
    unused name `tri_…`, `_2`, …) and the type's assumptions: `acute` → acute(A, B, C), `scalene`
    → scalene(A, B, C), `obtuse_at_V` → ∠ at V > 90. The points come from num's seeded generator
    whose seed is FNV-1a of the statement's names and sorted types, on a 0.1 grid in [−5, 5]²,
    redrawn until the triangle has the type with a margin (every angle ≥ 15°; acute ≤ 80°; obtuse
    100°–150°; scalene sides 10% apart; sides ≥ 2). Right angles stay constructed (no `right`
    type). The printer writes the expansion (P2 holds; `triangle` is input sugar).

### Data model additions (kernel; SPEC §5 deviations, recorded here)

12. **`LitExpr.text?`**: the literal as written when it differs from the canonical form
    (`0.1`, `2/4`, `60°`, `007`). `lit(value, text?)` drops a text equal to formatRational(value).
    Presentation only: `exprEquals` and evaluation read `value`. The printer uses the text when
    it reads back as exactly the value, else the canonical form. ("exact numbers as written")
13. **`Meta.comments?`**: comments are part of the document (SPEC §5: the document is the entire
    state), each `{ anchor, lines, inline? }` anchored to an object, claim, assumption, layer,
    view, the header, title, author, viewport, or the end. A comment line belongs to the next
    statement with a place in the document; a same-line comment is its inline comment; comments
    of `style X` / `label X` lines go to X; comments before lines that are not applied move on to
    the next anchored statement (or the end). The kernel never reads them; a comment whose anchor
    is gone (its object was deleted) is printed at the end. Blank lines are not kept.

### Parsing, diagnostics, recovery

14. Parsing is total (fuzzed: laws/fuzz.test.ts). Each line is lexed and parsed alone; a line
    with an error is not applied (statement-level: a definition with a bad attribute is dropped
    whole), its name is remembered so later uses say "X is not defined: its line n has an error".
    Every diagnostic has a line, a 1-based column range (UTF-16 units) and a non-empty hint. A
    missing `@version` is a warning (read as current). Claims and assumptions are built after
    every object, so they may name objects defined later.
15. Semantic checks are the owners' (note B): names (kernel `nameProblem`, "did you mean M_a?"),
    reserved managed names (kernel `reservedName`: "A* is the image of A in layer inv"), object
    creation (kernel `addObject`), rules (kernel `ruleProblem`, `syncDerived`), the selector checks
    (kernel `callDiagnostics`, each reported at its own call: a call's own diagnostics are the
    first entries of `callDiagnostics(call)` minus those of its nested calls), argument kinds no
    overload takes (the registry's `rejection` message, only after the selector checks pass, so a
    bare index keeps its selector hint), claims (`claimProblem`, decision 16) and assumptions
    (`assumptionProblem`). The language adds only what is syntactic: forward references, unknown
    names and tools ("did you mean …?" by edit distance, for names of three or more characters),
    attribute keys and values, and directive checks.
16. **packages/claims gains `./check`** (`claimProblem`, `argProblem`): the static claim check
    that `prepare` already ran (moved out of prepare.ts, unchanged), exported so the language
    reports the same message as the tester.

### Claim and assumption notation (ADR-0008 kinds)

17. Every kind parses by name (`length(A, B, C, D, 2)`). Notation: `AB = CD` and `AB = k·CD`
    (length; k = 1 is written by omission), `AB/CD = EF/GH` (ratio), `AB/CD = k` (ratio_value),
    `n∡ABC = ∡DEF` (dangle, n = 1 by omission), `∡(l, m) = θ` (dangle_lines), `∠ABC = ∠DEF`
    (angle_eq), `∠ABC ± ∠DEF = θ` (angle_sum, angle_diff), `P = Q` (equal). Segments are `AB` or
    `dist(X, Y)`; angles `∠ABC`, `∠(X, Y, Z)` or `angle(X, Y, Z)`; directed angles `∡ABC` or
    `∡(X, Y, Z)`. collinear, concyclic, concurrent, parallel, perpendicular, on, tangent are
    written as calls (SPEC's own spelling). SPEC's example "∠A + ∠B = 90°" (a vertex letter
    alone) is an error with a hint: a lone vertex does not name an angle in a figure with more
    than one triangle.
18. Assumptions: kind calls (`acute(A, B, C)`, …), comparisons `x < y`, `x > y`, `x ≠ y` (`!=`) of
    measures (`AB`, `∠ABC`, `angle(…)`, `dist(…)`, numbers) → less / greater / not_equal,
    `P inside poly`, `A, B, C in order on l`. `=` → "equality assumptions are not allowed:
    construct it instead"; `≤`, `≥` → "hypotheses are open conditions".
19. The printer chooses the notation when the arguments fit (point names for juxtaposition,
    literals for parameters) and falls back to `∠(…)`, `dist(…)` or the kind call otherwise. A
    test parses an example of every kind and prints it back (notation.test.ts).

### Laws and their domain

20. **P1**: for a document that satisfies I1–I8, whose derived layers are in sync, whose
    definitions, claims and assumptions pass the checks of decision 15, and whose comments are
    anchored to existing things without line breaks, parse(print(doc)) has no diagnostic and
    equals doc **up to ids** (canonicalDocument: objects, layers, claims and assumptions
    renumbered in order; nextId recomputed; comments sorted) **and up to the order of images
    inside a run of consecutive images**. The text does not record where an image sits among
    other images: parse places it right after the later of its source and its transformation
    (ADR-0007 decision 10), and edits can leave it earlier in that run (a second rule on the same
    transformation; an object moved into a source layer later). canonicalDocument orders each run
    by the chain of sources back to a user object, then by layer. The figure is the same: the
    order inside a run changes no value. Objects moved by `move` / `redefine` edits away from
    their canonical place also come back canonical (equal figure, different order): outside P1.
21. **P2**: print∘parse is idempotent on ANY text (tested on printed, mutated and garbage text).
22. **P3**: `parseInto(old, text)` keeps the id of every object whose name persists (user object
    for user object, image for image), of layers by name, named claims by name, unnamed claims
    and assumptions when an identical one persists; new things get ids above old.nextId (never
    reused). An object whose style the text does not state at all (no attribute, no `style` or
    `label` line) keeps its old style, except an old `[noimage]` that would change the derived
    layers. Tested: parseInto(doc, print(doc)) = doc with ids and nextId (images in canonical run
    order); random edits keep persisting ids and give valid, synced documents; a text with every
    style removed keeps every style.

### Versions (SPEC §11.4)

23. `@version N` is printed always. Old files are migrated text to text before parsing, one
    version at a time, by `{ from, to, describe, migrate }` data; the framework rewrites the
    `@version` line after each step. Version 1 is the first, so the chain is empty; the fixture
    test (test/fixtures/migration) defines a fictional version 0 and checks the old file loads
    as the same document as its version-1 form. A newer file or a missing step is an error at
    the `@version` line (the rest is still read).

### Docs

24. `pnpm docs:lang` writes docs/language.md: grammar, statements, attributes, selectors, claim
    and assumption notation, versions, and every registry tool with its signatures, its kernel
    exactness verdict and the reason of each example that is Inexact over RationalField (both
    observed by running the examples). A test fails when the file is stale; it is in
    .prettierignore like docs/tools.md.

## Consequences

- The editor run gets a two-way text panel: `parse` for diagnostics, `parseInto` to keep ids and
  GUI styles, `print` for the canonical text; comments and literal spellings survive GUI edits.
- Kernel edits that rebuild objects keep `LitExpr.text` (they copy expressions); a deleted
  object's comment moves to the end of the printed text.
- A new tool needs nothing in the language (names come from the registry); a new claim or
  assumption kind needs a notation entry (notation.test.ts fails otherwise); a new selector kind
  needs a SYNTAX entry (the compiler fails otherwise).
- A future version adds a migration to MIGRATIONS; the chain test checks it is contiguous.

## Alternatives considered

- Comments and literal spellings outside the document (a side table in the editor): GUI edits
  would lose them, and SPEC §5 makes the document the entire state.
- Comments as fields of objects, claims, layers and views: several kernel helpers rebuild these
  records field by field (rules, views) and would drop them silently.
- Lines for every image (`A*` alone) so P1 holds without the run order: clutter in every file
  for a difference that changes no value.
- Changing the kernel's placement of images to be history-free: ADR-0007's placement is frozen
  behaviour with tests; the order inside a run has no meaning.
- Partial application of a statement with an error (e.g. a definition without its bad
  attribute): silently different from what was written.
- A stricter "two rules with the same source and suffix" check in the language: the kernel
  refuses only rules whose names actually collide; the language reports exactly that.
- Single-letter "did you mean" suggestions: every one-letter name is one edit from every other.
