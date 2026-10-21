# ADR-0012: Editor core (Run 8a, steps 1–5)

Status: accepted (Run 8a). Makes SPEC §12 precise where it leaves choices open, and
records how the editor keeps SPEC §7's GUI selector choice, law L5 ("every UI state is
expressible in the text format") and law L6 (undo/redo restore exactly). Builds on ADR-0006
(candidates and selectors), ADR-0007 (dragThrough, image order), ADR-0009 decision 22
(parseInto) and ADR-0011 (display values).

## Context

SPEC §12 lists the editor state, the edit kinds, drag coalescing, the drag-end rounding
rule, "GUI tools are data; one state machine runs them", the §7 GUI selector choice, the
autosave policy, share links and the debug report. It does not say how a GUI choice stays
right when the figure moves, what rounding does for images and gliders, what happens when
an edit would produce a document the text cannot express, or where the viewport and the
active layer live. Run 8a's brief adds: applyEdit never throws (refusal with a reason, state
unchanged); L5 compares up to ids and image-run order with lang's `sameUpToIds`; L6 restores
EXACTLY; the intersection tool never writes a bare index or an orientation-dependent
selector when a semantic one decides (L16), and the selector it writes must pick the
clicked point in 200 perturbed copies (local regime).

## Decision

### State and edits

1. **State** = SPEC §12's `{ doc, values, selection, hover, tool, toolState, history,
viewport }` plus `activeLayer` (where new objects are built), `drag` (the gesture in
   progress) and `log` (the last LOG_LENGTH = 50 edits, for the debug report). Plain
   immutable data; the registry is a parameter (`EditorEnv`), never a singleton.
2. **applyEdit is total.** Every refusal returns the INPUT state object itself with a
   reason (and diagnostics for a text); nothing half-applies. A batch applies all its edits
   or none (the first refusal is the batch's).
3. **Document edits are one history entry each**: the kernel's DocEdits (through
   `applyDocEdit`, so invariants I1–I8 and derived-layer sync hold, L7, L13), claims and
   assumptions (packages/claims' `claimProblem` / `assumptionProblem`, the language's own
   messages), `replaceText` (lang's `parseInto`, ids kept), the document's `@viewport`
   (`docViewport`) and batches. A text with errors is refused whole (applying only the
   lines that parsed would silently drop the others); a text that gives the same document
   (stable print) is no change.
4. **The view is outside history**: `viewport`, `select`, `hover`, `activeLayer` and `tool`
   are UI edits; they refer only to what exists (unknown ids and layers are refused). The
   document's own `@viewport` is a document edit (it is part of the text).
5. **Values** are recomputed after every document change with `evaluateFrom` on the
   objects whose definition OR NAME changed (an Undefined reason names the objects it is
   about: "l is undefined"), which equals a full evaluation (L2; checked after every fuzz
   step).

### The text format holds every state (L5)

6. **What the language refuses, the editor refuses**, with the owners' checks: a call no
   overload takes (the registry's rejection), an unknown tool, the kernel's selector checks
   (bare index, missing or misapplied selectors), a string anywhere but as a whole call
   argument, style values outside the attribute ranges, and a REDEFINITION after which
   something built from the object, or a claim or assumption on it, would be such a call (a
   redefinition can change an object's kind).
7. **Text order.** The text does not record where an image sits: parsing places each image
   right after the later of its source and its map (ADR-0007 decision 10). A `move` or a
   reordering redefinition can put a user object between those places. Every committed
   document is therefore normalised (order.ts): user objects keep their order and each
   image moves to right after the later of its source and its map. Images only move
   earlier, so I2 and every value are unchanged.

### History (L6)

8. Entries hold the documents before and after one action, so undo and redo restore
   documents by identity. A new action clears redo. At most HISTORY_LIMIT = 500 entries.
9. **Drag protocol**: `dragStart(id)` → `dragMove(to)`… → `dragEnd` | `dragCancel`. The
   first move records the gesture's entry, later moves amend its `after` (coalescing),
   `dragEnd` rounds inside the same entry, `dragCancel` restores the document from before the
   gesture and drops the entry. Out-of-order drag edits, and document edits, undo and redo
   while a drag is in progress, are refused.

### Drag and rounding

10. Draggable: free points (literal coordinates), gliders (the kernel's `dragParameter`),
    images through `dragThrough` (not when a map of the chain depends on the source), and a
    text through its anchor (a draggable point reference or a literal point).
11. **Rounding** (SPEC §12): grid g = the finer of 10^(⌊log10 scale⌋ − 4) and the largest
    power of ten with g·zoom ≤ 0.1, decided exactly on rationals. For an image, the zoom is
    multiplied by the chain's scale factor |a| when it exceeds 1, so the image (not only its
    source) moves by at most 0.1 px. Glider parameters are rounded on power-of-ten grids
    chosen so the glider's point moves by at most g/2 (a line parameter t moves the point
    |Δt|·|d|, an angle in degrees r·|Δθ|·π/180, a stereographic ratio — written (1 : w) or
    (w : 1) with |w| ≤ 1 — at most 2r·|Δw|).
    The rounded definition is KEPT only when both the dragged object and the rewritten one
    move by at most ROUNDING_PX = 0.1 on screen (checked by evaluation); otherwise the exact
    drag values stay. New points from clicks are rounded the same way.

### GUI selector choice (SPEC §7)

12. Tiers, the first that singles out the clicked candidate: (1) `other(P)` for an existing
    point at the other candidate; (2) `same_side` / `opposite_side` with a point and a line
    of the construction, and `on_arc(B, C, [not] A)` with points of the construction on the
    intersected circle; (3) `along(±)` / `orient(±)`; (4) `near(P)` for a named point incident
    with the clicked candidate. Every choice is verified by the tool's own compute.
13. **Robustness of tier 2.** SPEC says "within a kind, the largest decision margin". A raw
    margin in length units does not say whether the selector survives the figure moving, so
    the margin is measured in standard deviations of its deciding distances under the claim
    tester's LOCAL noise (each free input moved by LOCAL_SIGMA · scale, one at a time,
    first-order response). A tier-2 option decides only with a margin ≥ ROBUST_SIGMAS = 5;
    otherwise the choice falls to tier 3, which follows the candidate continuously up to a
    tangency (where the point is Undefined, L11). Rationale: a selector that the local noise
    can flip would make the figure jump, the failure the brief's 200-copy test detects.
14. **The 200-copy test** judges a written selector on each perturbed copy by continuity:
    both candidates are tracked from the original figure to the copy (velocity-predicted
    steps, bisection near meets), and the selector must give the tracked continuation of the
    clicked candidate; copies where the candidates meet or cross on the way (a genuine
    degeneracy) are counted apart, never as passes.

### Tools, persistence

15. Tools are data (tools.ts): picks, rest picks ended by `finish`, and what they build.
    A point pick on no point creates one (free, glider, or intersection with item 12) as
    its own edit. Names come from names.ts (A…Z, A_1…; l, c, poly, … with subscripts).
16. **Autosave policy** (pure): slots `current` and `previous`; a document opened from a
    link is not saved until its first edit; the first save of a session moves `current` to
    `previous` (unless equal); restore swaps the slots.
17. **Share links**: `#s=` + lz-string(print(doc)). Decoding is total and VERIFIED: the
    decoded text must re-encode to the payload, so a cut link that still decodes is refused
    ("the link is damaged") instead of opening another figure; a text with errors is
    refused with its diagnostics. lz-string (1.5.0) is an allowed runtime dependency.
18. **Debug report**: the text, app version, last 50 edits as JSON (bigints as decimal
    strings) and user agent; pure, the app passes version and agent.

## Consequences

- The editor can never hold a document that does not come back from its own text (L5 is
  checked after every step of the model-based fuzz, 500 runs per CI and 20,000 nightly).
- Tier 3 is used more often than a raw-margin reading of SPEC §7 would use it: whenever no
  construction point decides by 5 local deviations.
- Moves that put a user object inside an image run are silently normalised (the order is
  not observable in the text anyway); the objects panel shows the normalised order.

## Alternatives considered

- Refusing `move` into an image run instead of normalising: rejected, the GUI would refuse
  harmless reorders whose only effect is invisible.
- A raw distance margin for tier 2 (SPEC's literal wording): rejected, fragile selectors
  were written in the 200-copy test.
- Re-evaluating the whole document after every edit: correct but costs the drag budget;
  incremental evaluation with renamed objects included is equal (checked).
- Storing the viewport in history: rejected (SPEC §12: viewport outside history).
