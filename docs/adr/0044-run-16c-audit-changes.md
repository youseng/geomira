# ADR-0044: Run 16c audit: refusal words that name the conic, and frozen tests a new tool touches

Status: accepted (Run 16c, scoped audit of Run 16; docs/audit/2026-10-29.md). Changes no rule
of SPEC; it records why frozen test lines change in this run, as CLAUDE.md requires.

## Context

1. Run 16b's STATUS (Known bugs) lists: "the refusal 'pick a line or circle' also accepts a
   conic". The audit found the same mismatch in four places, each pinned by a frozen test:
   - the editor's curve pick (`PICK_WORDS.curve`): "first curve: pick a line or circle" while
     the pick takes a conic (ADR-0042) — `packages/editor/test/new-tools-review.test.ts:41`;
   - the glider tool on empty space: "click a line or a circle" while a conic under the click
     is taken — `packages/editor/test/machine.test.ts:66`;
   - `on(…)` without a parameter on a point: "on(…) takes a line or a circle" while a conic
     with a known point is taken — `packages/lang/test/errors.test.ts:71`;
   - `gliderPoint` / `dragParameter` on a value of the wrong kind: "a glider needs a line or a
     circle, not point" while all three entry points take a conic —
     `packages/kernel/test/glider.test.ts:260, 263`.

   A refusal that leaves out an accepted kind tells the user the conic is not allowed: a
   message that is silently wrong.

2. Run 16c adds `foci(k)` with selectors (ADR-0043 decision 16). Two frozen tests list what the
   registry holds in a line that cannot grow by insertion:
   - the hint of a selector on a tool that takes none lists the tools that choose among
     candidates: "only intersect, tangent_point, tangent_from choose among candidates" —
     `packages/kernel/test/selector-check.test.ts:162`; with foci the generated list gains it;
   - the exactness table counts `intersect`'s examples: `exactExamples: 4, examples: 5` —
     `scripts/exactness/table.test.ts:49, 50`; ADR-0043 adds two examples (conic ∩ conic with
     other(P, Q, R), exact over Q; ellipse ∩ circle with near(P), Inexact), so 5 of 7.

   Lists that grow by an inserted line (`registry.test.ts`, `conic-dispatch.test.ts`,
   `guarantees-hold.test.ts`) need no ADR: their changes are additions.

## Decision

1. The words name every kind the pick takes: "line, circle or conic" (editor pick), "click a
   line, a circle or a conic" (glider tool), "on(…) takes a line, a circle or a conic" (lang),
   "a glider needs a line, a circle or a conic, not …" (kernel). The frozen lines above change
   to the new words and nothing else; new tests (`packages/editor/test/curve-words.test.ts`,
   `packages/lang/test/on-words.test.ts`, `packages/kernel/test/glider-words.test.ts`) pin the
   words AND that a conic is taken where the words say so. They failed before the change.
2. The selector hint and the exactness counts change to what the registry now holds ("only
   intersect, tangent_point, tangent_from, foci choose among candidates"; 5 exact examples of
   7). The assertions keep their strength: an exact string and exact counts.

## Consequences

- Six frozen lines in five files change, each listed in STATUS (Changed frozen tests), in
  commits citing ADR-0044.
- The next tool with selectors changes the hint line again; that is its run's ADR.

## Alternatives

- Keep the old words: rejected, they are wrong (Context 1).
- Make the selector hint not list the tools ("only tools with candidates choose among them"):
  rejected; it changes the frozen line all the same and tells the user less.
- Leave the two conic examples out of `intersect`: rejected; the exact other(P, Q, R) example is
  the documented evidence that the fourth point is exact over Q (ADR-0043 acceptance).
