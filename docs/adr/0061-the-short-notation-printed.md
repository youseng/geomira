# ADR-0061: The short notation, printed

Status: accepted (maintainer request "GUI and script", second milestone, 2026-11-10: "now do the
script language simplification"; target feel `ABC triangle; O = circumcenter(ABC); w =
incircle(ABC); D = foot(A, BC); P, Q = tangents(X, w)`). Amends ADR-0025 decision 1 ("The Text
panel shows the canonical text after Apply") and ADR-0013 decision 4 (the command bar takes one
line). ADR-0009's canonical text, laws P1–P3, `@version` and every saved file are unchanged.
SPEC §11.1, §11.3, §12 and §15 are updated in this commit.

## Context

Measured before any change (main = 8bb6915, `pnpm verify` green):

- The language already READ the short forms (ADR-0025): `foot(A, BC)`, `circumcenter(ABC)`,
  `P, Q = tangents(X, w)` all parsed. But the text panel then replaced what was typed with the
  canonical text: `D = foot(A, line(B, C))`, and two lines `P = tangent_from(X, w, orient(+))`,
  `Q = tangent_from(X, w, orient(-))`. A user who writes short is shown long, and everything
  the GUI builds appears long. That rewriting, not the reader, is what made the script feel
  verbose.
- The maintainer's example, pasted as written, failed at two places: `ABC triangle` ("expected
  a statement") and the `;` ("unexpected ";"" with the hint "attributes go in brackets").
- British spellings (`circumcentre`, `incentre`) were errors with a suggestion.
- The diagnostics were otherwise already specific (the token, a hint, did-you-mean for tools
  and names); they are kept.

A rebuild of the parser was considered and rejected (Alternatives): the reader was not the
problem.

## Decision

1. **Two notations of one document.** `print(doc)` (canonical) is unchanged and is what files,
   share links, autosaves, exports, the PNG text chunk and every golden hold. `printShort(doc,
registry)` (`@geomira/lang/print-short`) is the SHORT notation: the same layout, with the
   three rules below. Both read back to the same document.
2. **What is written short** (only where the reader gives back exactly the same definition;
   the printer asks the reader's own functions, `runReading`, `conditionReading`, `branchLow`):
   - (a) an argument `line(A, B)` or `circle(A, B, C)` of point names is the run `AB` / `ABC`,
     where the call (or the claim kind) takes a line or a circle there: `foot(A, BC)`,
     `intersect(ω, AB, …)` without selectors, `claim perpendicular(AB, CD)`;
   - (b) a call of exactly three point names is `tool(ABC)`: `circumcenter(ABC)`,
     `circle(ABC)`, `angle(ABC)`, `polygon(ABC)`; not when the tool has image forms
     (`Signature.imageOf`: `translate(X, A, B)` is not a triangle);
   - (c) two ADJACENT objects that are the two branches of one call, `along(+)` then `along(-)`
     or `orient(+)` then `orient(-)`, with the same attributes and no comment on the second,
     are ONE statement `X, Y = call(…)`; `tangent_from` and `tangent_point` are written
     `tangents` and `tangent_points` there (ADR-0025's aliases).
     Names must glue back into the same names (checked with the lexer: `A_1B'M_a`, `A*B*`).
     Everything else is the canonical text.
3. **What is NOT written short, on purpose.** Two point names are not glued (`midpoint(B, C)`,
   `line(A, B)`, `circle(O, A)`): `circle(OA)` would read as something else, and a rule that
   depends on the tool is a list of tools outside the registry. A call with selectors keeps its
   arguments as calls. Four or more names are not glued (`ratio(ABCD)` is worse than what it
   replaces).
4. **Laws** (tested on generated documents and on every example and export fixture). S1:
   wherever parse(print(doc)) has no diagnostics (P1's domain), parse(printShort(doc)) has none
   and is the same document. S2: printShort∘parse is idempotent on that text. S3: the short text
   is never longer.
5. **The text panel shows the short notation** (apps/web `text-apply.ts`). So a text typed
   short is still that text after it is applied, and what the GUI builds appears short. The
   Claims panel's line numbers are the short text's (`statementLines(doc, registry)`), since
   two branches may share a line; a claim row's own text is unchanged.
6. **Reading, three additions.**
   - `ABC triangle …` is `triangle ABC …` (three glued point names, then the word).
   - A tool name with `centre` for `center` is the tool (`circumcentre`, `incentre`,
     `orthocentre`, `ninepoint_centre`, `centre`), when the registry has the American name.
   - A `;` in a file line is still an error (one statement per line: comments, diagnostics and
     the panels count lines), but its hint now says so and where `;` works.
7. **The command bar takes several statements separated by `;`** (`splitStatements`,
   `@geomira/lang/statements`: outside parentheses, brackets, strings and comments, so
   `harmonic(A, B; C, D)` keeps its own). They are appended one line each and applied as ONE
   `replaceText` edit (one history entry, all or nothing); a diagnostic is reported on line 1
   at its statement's columns in the command.
8. **Multiple results are never one silently.** Unchanged and restated: a call with two
   candidates and one name is an error that says so (ADR-0006); `X, Y = …` names both.

## Consequences

- Frozen e2e tests that read the text panel changed their expected lines to the short forms
  (listed in STATUS, "Changed frozen tests"); no assertion was removed or loosened.
- `packages/lang/src/print.ts` keeps exporting only `print` (the frozen surface test); the
  layout moved to `print-document.ts` unchanged, with a notation parameter.
- ADR-0025's grammar block gained the two reading additions (it is checked verbatim against
  `GEOMDRAW_GRAMMAR`); `docs/language.md` is regenerated.
- A file saved from the app is still canonical (long). Whether saved files should be short too
  is a maintainer decision (STATUS, Requests): the reader takes both, older builds of the app
  read both since ADR-0025, but the export goldens and the PNG text chunk pin the canonical text.

## Alternatives

- **A new language and parser from scratch.** Rejected: the existing reader already accepts the
  target forms, its diagnostics are specific, and 386 language tests pin its behaviour. A new
  grammar would have had to re-earn all of that and still needed a migration for old files.
- **Changing `print` itself.** Rejected for now: it rewrites every golden, the export fixtures
  and the baselines for no gain in the panel, and makes old and new files differ.
- **Keeping the typed text verbatim.** Rejected: the GUI also edits the document, so the panel
  must be able to print any document; a text that is sometimes the user's and sometimes printed
  is two formats in one field.
- **`;` in files.** Rejected: one statement per line is what lets a diagnostic, a comment and
  a panel row name a line.
- **Indices for branches (`intersect(a, b, 1)`).** Still forbidden (SPEC §7): the pair statement
  names both branches by a structural selector that does not jump while dragging.
