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

3. The slice test (`apps/web/test/host-discovery.test.ts`, "without a worker the page finds the
   Euler line in slices within its budget") still failed about 1 in 30 under CPU load after Run
   16b's fix. Measured in this run (a copy of the test that also records each task's thread CPU
   time, 30 runs under four busy loops on four cores): of 71 tasks over 16 ms by wall time, 69
   used less than 16 ms of CPU on their thread (wall time 2–4 times the CPU time); two were over
   by CPU too. One run had 5 late tasks against its allowance of 5. So the late tasks are the
   machine giving the cores to other processes, which no slicer can prevent, not slices that do
   too much work.

4. ADR-0042 decision 4 decides a conic's type on ac − b² over a² + 2b² + c² with EPS and the band.
   That ratio is an aspect ratio, not a distance: for a hyperbola x²/A² − y²/B² = 1 it is about
   A²/B², whatever the figure. The audit found the thin hyperbola (x − 0.3)²/0.01 −
   (y − 0.2)²/10⁸ = 1 (the image of a small hyperbola under a projective map), centre and both
   branches in the figure, called a parabola: its foci came out at (−1.15·10⁸, 7.7·10⁷), its
   centre as a point at infinity, the scene drew it as one far parabola (centred at the origin:
   "not finite"). A parabola is a conic whose centre is at infinity; ADR-0040 decides "at
   infinity" for the meeting point of two lines at the figure's scale (an angle within EPS: a
   point beyond about scale/EPS).
5. ADR-0042 decision 8 says orient(+) on the tangents from P to a conic is the touch point T with
   cross(mid − P, T − P) > 0, so that a conic that is a circle has the circle tools' labels. The
   code read the side from the sign of Q(P), and every label was the opposite one (the audit
   compared `tangent_point(P, k, orient(±))` for k a circle given as a conic with the circle
   tool: all six cases differed). The 16b export fixture `tests/fixtures/export/conics.geo`
   uses `tangent_from(P, e, orient(±))` for t_1 and t_2.

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
3. The slice test counts each task as the shorter of its wall time and its thread's CPU time
   (`process.threadCpuUsage`, Node ≥ 22.19; CI runs the latest Node 22). Its frozen line
   `this.durations.push(performance.now() - t0)` changes to push that minimum; the threshold
   (16 ms), the allowance (one in fifty) and every other assertion stay. A slice that does too
   much work is over in both measures and still fails the test; time the machine gave to other
   processes is no longer counted against the slicer.
4. The type (`packages/kernel/src/conic-type.ts`, `parabolaSign`; used by conicType, pole,
   conic_center, foci and the scene's drawing) is the sign of ac − b², with a parabola decided in
   floats at the figure's scale: the scale over the conic's largest real semi-axis (centre to
   vertex; no finite centre: 0) as a dimensionless number, within EPS a parabola, within the
   band ambiguous. Exact fields: the exact sign, as before. SPEC §3.1 changes with this ADR.
   The degenerate fixture NEAR_PAR of `packages/kernel/test/helpers/degenerate-conics.ts`
   (x² + 10⁻⁸·y² − y = 0, "within the band of a parabola") has its centre 5·10⁷ away in a figure
   of size 5.7: 1.1·10⁻⁷ under the new rule, just outside the band (an ellipse, as two lines
   meeting at that distance meet at a finite point). Its ε changes to 10⁻⁹ (centre 5·10⁸ away,
   1.1·10⁻⁸, inside the band), so the two frozen tests on it (pole, conic_center) keep their
   assertions; five frozen lines (the comment and the four points) change.
   `packages/kernel/test/conic-type-scale.test.ts` and `packages/scene/test/conic-type-draw.test.ts`
   failed before the change.
5. The label follows its definition: the sign of cross(mid − P, d) for the candidate mid + k·d
   (`packages/kernel/test/conic-tangent-orient.test.ts`, failing before). A saved file keeps
   its figure only if it swaps its signs, so the fixture's two lines swap orient(+) and
   orient(−) (frozen lines; the figure, its export tests and tex.yml's points are unchanged).

## Consequences

- Sixteen frozen lines in nine files change, each listed in STATUS (Changed frozen tests), in
  commits citing ADR-0044.
- The slice test needs Node ≥ 22.19 (`process.threadCpuUsage`); the repository's engines field
  says ≥ 22.12, so on 22.12–22.18 this test throws. CI and the dev container run later versions.
- The next tool with selectors changes the hint line again; that is its run's ADR.
- A document written with Run 16b that labels the tangents from a point to a conic by orient(±)
  now picks the other tangent. Conics were merged in Run 16b and no example or library entry
  uses these labels; the one fixture is migrated.
- The scene's `shapeOf` takes the document's tolerance context (optional, scale 1 by default for
  callers without one, as before for every value but a conic near a parabola).
- A conic with a real semi-axis beyond scale/EPS (an ellipse 10⁹ figure sizes long) is a
  parabola in floats: at that scale its visible part cannot be told from one, as two lines at an
  angle within EPS are parallel. Exact fields still give its exact type.

## Alternatives

- Keep the old words: rejected, they are wrong (Context 1).
- Make the selector hint not list the tools ("only tools with candidates choose among them"):
  rejected; it changes the frozen line all the same and tells the user less.
- Raise the slice test's threshold or allowance: rejected, it would also let through slices that
  really do too much work.
- Measure CPU time only: rejected; wall time is the page's real budget, and the minimum never
  exceeds it, so a task is late only when both measures say so.
- Keep the aspect ratio and add a scale test only for hyperbolas: rejected; the ratio has no
  length in it, so no threshold on it can say whether a centre is in the figure.
- Leave the two conic examples out of `intersect`: rejected; the exact other(P, Q, R) example is
  the documented evidence that the fourth point is exact over Q (ADR-0043 acceptance).
