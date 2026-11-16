# ADR-0071: Reuse construction dependencies and consume actual GUI inputs

Status: authorized by release prompt 06; integration verification remains required.
Extends ADR-0024, ADR-0029, ADR-0042, ADR-0045, ADR-0051 and ADR-0064.

## Context

Base `f95e0056c9e2cb73d23c6dac900acaf9e7f1a06a` includes public claims retirement,
transactional recovery and shared modal safety. Positional filtering in the common-tangent
and multi-intersection tools treats independent coincident objects as reusable constructions.
Those objects do not follow the picked parents when moved. Selection preflight counts raw
objects, although a semantic line input can consume two points. Apply transformation uses
image-sugar metadata, excluding conics accepted by `apply(T, X)`. Automatic polygon finish
discards a refusal, leaving unexplained pending picks.

## Decision

- Reuse a geometric candidate only when both its current position/carrier matches and its
  incidence or tangency with both picked curves follows from construction dependencies.
  Expose the existing pure registry-guarantee closure through the narrow
  `@geomira/discovery/construction` facade. This synchronous tool-action helper does not
  execute discovery, evaluate saved claims, accept assumptions as facts, warm workers or
  dispatch jobs. Unknown facts conservatively permit a distinct dependent construction.
  Named defining points (a circle and a line through C), and existing dependent intersections
  or tangents, still reuse their identities. An independent coincident free point or line
  remains independent. Existing expression-based `sameConstruction` reuse remains in place.
- Feed preselected identities through the same object-input machine as sequential picking.
  Detect completion from the actual machine state rather than comparing selection size
  with semantic step count. Refuse extra picks atomically, preserve partial pairs, and
  finish repeated inputs only when enough semantic slots are complete. A failed automatic
  finish reports its reason immediately and retains the picks so the action can be retried.
- Give Apply transformation its own `mapped_figure` pick kind, matching `apply`'s ordinary
  shapes, conics and annotations. Ideal points are accepted from the Objects panel, where
  their identity exists; they have no canvas shape. Other transformation sugar retains its
  narrower `figure` metadata and does not start accepting unsupported conic overloads.
- Retain existing branch selectors, batching, undo/redo and document invariants. These
  changes never expose the retired public claim interface; variable-width claim picking
  is covered only through retained internal editor APIs.

## Validation and frozen tests

`packages/editor/test/tool-dependencies.test.ts` adds failures for the audited reproductions,
parent movement and identity preservation, complete/partial line pairs, repeated claim
steps, atomic excessive selection refusal, locked finish feedback and mapped kinds.
`apps/web/e2e/tool-dependencies.spec.ts` covers visible tangent/intersection/conic workflows
and SVG export. Existing reuse and selector tests remain unchanged.
`packages/discovery/test/exports.test.ts` only adds the new subpath import and surface entry;
no frozen assertion is weakened. No numerical tolerances, count/coverage floors or tests
are removed. Exact commands/results belong to the task result and integrated STATUS.

## Consequences

Tool-action reuse depends on proven construction metadata instead of accidental coordinates.
The closure is created lazily for a matching candidate, never cached globally or run on each drag. Complex
relationships absent from its conservative fact set may produce an additional dependent
object; that is preferable to losing a dependency. The scene still does not draw ideal
points; supported panel picking is explicit. No runtime dependency is added.

## Alternatives

Removing all reuse duplicates repeated constructions and drops named defining-point behavior.
Retaining positional equality loses dependencies. Sampling a few perturbations is not a
construction-identity argument. Expanding the shared image-sugar picker exposes unsupported
kernel overloads. A second selection-only slot machine would drift from sequential picking.
