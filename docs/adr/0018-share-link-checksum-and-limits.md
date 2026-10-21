# ADR-0018: Share links carry a checksum; link and nesting limits (Run 10, bug fixes)

Status: accepted (Run 10, audit). Extends ADR-0012 decision 17 (share links: decoding is total
and verified), SPEC §11.3 ("parse is total") and SPEC §9 ("evaluate is total"); adds the kernel
subpath `./limits`. Old links keep opening.

## Context

The Run 10 audit found four ways a share link (`#s=` + lz-string of the printed text) broke
"nothing silently wrong":

1. **Throws.** The language parsed by recursive descent and converted syntax trees recursively,
   so an expression nested a few thousand levels deep (3000 nested parentheses, a sum of 3000
   terms, `sqrt(` 1500 deep) overflowed the call stack: `parse`, the editor's `replaceText`
   and `decodeShare` threw "Maximum call stack size exceeded". A link of 435 characters made the
   page's startup throw. `evaluate` and the kernel's `addObject` overflowed the same way on
   definitions built in code (2000 and 100,000 levels).
2. **Freezes.** The selector checks formatted the text of every nested call eagerly and the
   language checks each call site, which made a line nested 400 deep take 5.9 s (cubic). And
   nothing bounded a link's size: lz-string's output grows with the square of its input, and
   the verifying re-compression is super-linear, so a link of 4,314 characters (3,000,000
   characters of text) froze startup for 6 s and one of 15,523 characters for 145 s.
3. **Another figure.** The verification (the decoded text must re-encode to the payload) only
   catches cut links: 110 of the 2,000-odd one-character changes of a small link decoded to
   another valid figure (a moved point, a renamed one) and opened it.

## Decision

1. **Nesting limit** `MAX_EXPR_DEPTH = 100` (kernel `limits.ts`, exported as
   `@geomira/kernel/limits` with `exprDepth`, which is computed without recursion). The
   language refuses a deeper expression with a diagnostic at its line ("the expression is
   nested more than 100 levels deep", hint: write intermediate objects): the parser counts its
   own nesting (parentheses, calls, negations) and stops at the limit; `convert` measures a
   long operator chain (as deep as it is long) before converting it. The kernel refuses such a
   definition in `addObject` / `redefineObject`, and `evaluate` gives Undefined ("k is nested
   more than 100 levels deep") for one in a document built by hand, before any recursive walk
   (figureDiameter's walk is iterative too). Real figures nest a few levels; 100 is far above.
2. **The selector checks format a call's text only when they report a diagnostic** (same
   messages), which makes the language's checks quadratic instead of cubic in the depth.
3. **Size limits**: a payload longer than 20,000 characters is refused before decompressing
   (a figure of 500 objects, SPEC §17's budget, needs about 6,000); a text longer than 100,000
   characters is refused before it is re-compressed or parsed.
4. **Checksum**: a new link is `#s=` + four characters of lz-string's URL alphabet (24 bits of
   FNV-1a of the text) + the payload. The checksum comes FIRST, so cutting characters off the
   end never leaves a valid shorter link (Run 8a's frozen test cuts every length), and it uses
   the payload's alphabet, so links keep matching `#s=[A-Za-z0-9+\-$]+` (Run 8b's frozen e2e
   test). A link whose checksum does not match is read as a link without one: re-encoding must
   give the payload back, as before. Links written before this ADR therefore still open; a
   changed character of a new link is refused ("the link is damaged") unless it happens to
   produce a matching 24-bit checksum.

## Consequences

- Tests: `packages/lang/test/nesting.test.ts`, `packages/kernel/test/nesting.test.ts`,
  `packages/editor/test/share-hardening.test.ts` (each failed before).
- A text with an expression nested more than 100 levels, which no earlier version could save
  from the GUI, is refused by the language; it would have overflowed beyond about 1300 levels.
- Links are four characters longer.

## Alternatives considered

- **An iterative parser and evaluator**: removes the overflow but not the cost of absurd
  depths, and every other recursive walk (printing, the scene, claims) would need the same.
- **A bounded lz-string decoder of our own**: a second implementation of the format; the size
  limits bound the library's work instead.
- **A checksum at the end, or a separator character**: a cut at the separator would leave a
  valid old-style link of a different length (frozen test), and a separator outside the
  alphabet breaks the frozen e2e pattern.
- **Refusing links without a checksum**: breaks every link already shared.
