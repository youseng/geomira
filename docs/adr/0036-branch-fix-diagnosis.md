# ADR-0036: Branch-fix diagnosis for MIXED and ORIENTATION-DEPENDENT claims (Run 17)

Status: accepted (Run 17). Moves "branch-fix diagnosis" out of SPEC §1's Phase 2 list (SPEC §1
and §16 are updated in the same commit as ADR-0035). Builds on SPEC §7 (selectors), ADR-0006
(candidates and BranchShape), ADR-0012 decisions 12–14 (the GUI choice and its tiers) and
ADR-0008 decision 15 (the flip test). Lives in packages/discovery (ADR-0035 decision 1).

## Context

A claim whose local verdict is MIXED, or whose global verdict is ORIENTATION-DEPENDENT, often
fails because a branchable call (an intersection of curves, a tangent from a point) picks a
candidate the statement did not mean, or picks it with an orientation-dependent selector. The
brief: list EVERY selector assignment that makes the claim hold, with a visible cap when 2^k is
too large, ordered by (1) keeps all currently drawn points, (2) moves one point, later steps
first; each with "what moves" text and a preview through the draft-scene mechanism (ADR-0024,
ADR-0029), not a document edit; applying one is ONE edit; reflection-equivariant selectors
(law L16) preferred when writing them, as the GUI choice does.

## Decision

1. **Sites** are the calls of the claim's closure (claims' `prepare`: the objects the claim
   depends on, nested calls included) whose overload has two candidates (BranchShape
   `candidates: 2`) and whose call has two candidates in the current figure (the tool's own
   `candidates`, FloatField). A site's CURRENT choice is the candidate its value equals (the
   kernel's point coincidence); a site that is undefined now has no current choice. k sites give
   2^k assignments (each site: its current candidate or the other).
2. **Enumeration order** (also the order shown): by the number of flipped sites, 0 first; among
   one flip, later sites first (construction order, the call's position in the object list);
   among more flips, the later flipped sites first (lexicographic from the end). At most
   MAX_ASSIGNMENTS = 64 are built and tested; beyond that the result says "checked 64 of 1,024
   assignments: cap". The 0-flip assignment keeps every candidate and only rewrites the
   selectors, which is exactly what an ORIENTATION-DEPENDENT verdict asks for.
3. **Writing an assignment**: sites in construction order; each is re-evaluated in the document
   built so far (an earlier flip can move a later site's candidates); its target is the
   candidate nearest the site's current value (kept) or the other one (flipped), and its
   selectors are written by the GUI choice of packages/editor (`chooseSelectors`: other(P),
   same_side / opposite_side / on_arc with construction points, robust under the local noise;
   along / orient only when none decides; near last), which the host passes to the job as
   `env.choose` (discovery cannot import the editor: SPEC §2). A site whose arguments are not
   objects, or when no chooser is given, gets the low-level selector that the kernel's compute
   confirms (along(±) or orient(±)). Every written selector is verified by the kernel: the call
   with it must give the target. The chooser sees the document up to the site's object only (a
   selector may name earlier objects alone, invariant I2; the first version offered the object
   itself and wrote `same_side(X, ab)` in X's own definition). A site that keeps its candidate
   keeps its selectors when they are firm: filters, other(P) and low-level selectors that do not
   depend on the orientation; near / far_from and orientation-dependent ones are rewritten.
   The chooser's selectors are verified like the low-level ones. A written definition must not
   be the same construction as another object (the editor refuses such an edit; found on CI,
   where the GUI choice wrote X = intersect(l, k, along(+)), R's own definition): the options
   are tried in order (the GUI choice's, then every confirmed low-level selector) and the first
   that repeats nothing is written; failing that, a site's own orientation-dependent selectors
   are kept when they still pick the candidate (a ranker, near / far_from, never: it is what made
   the claim MIXED); failing that, the repeating option is written and the fix reports it
   (decision 7).
4. **Testing**: each assignment's document is tested with the regime of the verdict it fixes
   (MIXED: local; ORIENTATION-DEPENDENT: global, so the global sampler's mirroring decides), n
   and seed from the job. Listed iff it HOLDS (local: HOLDS IN THIS CONFIGURATION; global: HOLDS
   ACROSS THE DECLARED CONFIGURATION). An assignment that rewrites nothing (its selectors equal
   the document's) is the failing document itself and is not listed.
5. **What moves**: the user objects whose float value differs (beyond the band) between the
   current figure and the assignment's ("Y and K move"), or "nothing moves; only the selectors
   change" for a 0-flip assignment; plus each rewritten definition. The UI previews the
   assignment's document as a draft scene (never a document edit) and applies it as ONE batch
   of `redefine` edits (packages/editor `applyBranchFix`: one history entry, one undo, shown in
   the text).
6. **Job** `branchFix` (`@geomira/discovery/job`): the same protocol as ADR-0035 decision 15
   (progress per sample, cancel, the result carries the seed and the cap).
7. **Repeats**: a fix whose definition would be the same construction as another object is
   listed (it makes the claim hold) with "X would be the same construction as R: use R instead
   of X", and is not applied (its Apply is disabled). It is the honest answer for circle ∩ circle
   or line ∩ circle sites whose only selectors are the other point's definition.

## Consequences

- L16 is kept: a fix written from the GUI choice never introduces an orientation-dependent
  selector where a reflection-equivariant one decides; the tests check that a fix of an
  ORIENTATION-DEPENDENT claim built with `orient(+)` writes `same_side` / `opposite_side` when
  the construction offers a point and a line.
- A claim with no branchable call in its closure gets "no branch choice in this claim's
  construction", not an empty list.

## Alternatives considered

- **Flipping selectors textually** (orient(+) → orient(−)): changes branches only by
  orientation and writes exactly the selectors the verdict warns about.
- **Moving the GUI choice into discovery**: two copies of SPEC §7's tiers; injecting the
  editor's function keeps one.
- **Testing every assignment in both regimes**: twice the work for a verdict that names its
  regime.
