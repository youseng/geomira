# ADR-0007: Transformations and derived layers (Run 4)

Status: accepted (Run 4). Extends ADR-0003 (items 6 and 7: managed names, edits on derived
layers) and ADR-0006 (items 3 and 14: signatures and static kinds); clarifies SPEC §8.2 (which
objects are imaged, decision 9); supersedes nothing.

## Context

Run 4 builds SPEC §8: similarity transformations, derived layers, views and drag-through,
with law L13 ("§8 laws; sync under any edit sequence, including redefine T and move T").
SPEC fixes the maps, the laws, the rule { transform, source, suffix, exclude }, the reserved
names and the drag-through rule, but leaves open: where sync is checked (frozen tests of Run 2
require `assertInvariants` to accept a hand-built rule document without every image), how
the kernel knows an object's kind before evaluating it, which kinds have images (note A of
the run: SPEC §8.2 says "every object X", SPEC §11.2 lets `*` follow point names only), where
images are placed, what an edit of a rule does to existing images, and how Phase 2 inversion
plugs in.

## Decision

### Maps (packages/kernel/src/similarity.ts, tools/transforms.ts)

1. **One field-generic core.** A Similarity is z ↦ a·z + b or a·z̄ + b (`anti`). `mapPoint`,
   `mapDirection`, `composeSimilarities` (s ∘ t, t first), `inverseSimilarity` and
   `applySimilarity` are polynomials in the coordinates (the inverse divides once by |a|²),
   so every map and image is exact over Q and mod p; only `rotate` by an angle off the
   multiples of 90° is Inexact over Q (cos and sin both rational only there).
2. **Every Transform value is invertible**: its scale factor a is not zero as a
   dimensionless quantity (both components within EPS → Undefined "the map collapses the
   plane (scale factor 0)"). Every tool checks its transform arguments the same way, so a
   hand-built degenerate map is refused, never divided by. Mod p (p ≡ 3 mod 4), a ≠ 0 implies
   |a|² ≠ 0. homothety with k = 0 (within EPS) → Undefined("homothety: the ratio k is 0");
   spiral needs A ≠ B and C ≠ D; reflect needs a line with a direction (a degenerate line
   is already Undefined); compose of two valid maps can still collapse in floats (scale
   factors 10⁻⁵ and 10⁻⁵): Undefined there, defined over Q.
3. **apply on every kind**: points; lines, segments and rays keep their parameter range
   (s(p + t·d) = s(p) + t·a·d̂) and their chirality flag (SPEC §4); circles map centre, r²
   (times |a|²), anchor (so gliders on image circles stay exact) and arc (an anti map
   reverses it: the image of the counter-clockwise arc P → Q is the arc Q' → P'); polygons
   keep their vertex order. Numbers and transforms have no image (decision 9); Undefined and
   Inexact pass through (SPEC §6.3).
4. **Image sugar is the same tool**: `reflect(X, l)`, `rotate(X, O, θ)`, … are overloads of
   reflect, rotate, … with X first, told apart by arity (X is a point, curve or polygon). The
   new optional **`Signature.output`** gives an overload's result kinds (`reflect(l)` →
   transform, `reflect(X, l)` → X's kinds), so static kinds stay precise. Exporters stay
   `numeric` (ADR-0003 item 11).
5. **Chirality and selectors under maps** (ADR-0006, note C of the run): an image is
   apply(T, value); selectors are never re-evaluated in the image. Rebuilt from the images
   of its defining points, a construction keeps its along(±) choice under direct maps, and
   under anti maps keeps it on achiral lines and swaps it on chiral ones; orient(±) swaps
   under anti maps; other(P) never swaps. Tested on four maps (two anti).

### Derived layers (derived.ts, derived-edit.ts, doc-edit.ts)

6. **Sync is a separate, registry-aware check (L13), not part of I4.** I4 stays as Run 2
   built it (each managed object matches its rule and sits after its source and transform);
   `syncProblems(doc, registry)` lists every missing, stale, misnamed or misdefined image,
   and `syncDerived(doc, registry)` repairs them: stale images go with their dependents
   (reported in `removed`), names and definitions are repaired in construction order (so an
   image of an image follows its source's new name), and missing images are created. Run 2's
   frozen tests build rule documents by hand without every image and assert I1–I8 on them;
   I4 cannot require completeness without changing them.
7. **Edits keep sync**: `applyDocEdit(doc, registry, edit)` applies one `DocEdit` (add,
   remove, rename, redefine, style, setLayers, move, layer edits, addDerivedLayer,
   updateRule, removeRule, views) through the immutable helpers and then `syncDerived`; on a
   valid synced document every successful edit gives a valid synced one (fuzzed, decision
   15). The Run 2 helpers stay low-level (no registry) and are what applyDocEdit calls; the
   editor's applyEdit (a later run) adds history and selection on top.
8. **Static kinds decide imaging.** `objectKinds(doc, registry)` gives each object the kinds
   its definition can have: a literal is a number, a reference has its object's kinds, a
   call the union of `output` (or the tool's outputKinds) over the overloads its arguments'
   kinds can match. An unknown tool, or arguments no overload takes, gives "unknown". So
   imaging never depends on evaluation, and a document's set of managed objects is a
   function of the document alone.
9. **Which objects are imaged (clarification of SPEC §8.2).** A rule images every object X
   of its source layer that is not excluded, not styled [noimage], and whose kinds include a
   geometric kind (point, line, circle, polygon) or are unknown. Numbers, measures and
   transforms are NOT imaged: apply(T, number) has no geometric meaning, and users measure
   inside the image layer directly. This does not change the image of any point, so the rule
   "the transform's own defining points are imaged" still holds (under spiral(A, B, C, D) the
   images of A, B, C, D exist). Images may be Undefined (an Undefined source, an Undefined
   map). Managed names are `<source name><suffix>` for every imaged kind (A*, l*, ω*, A**);
   all are reserved: a user object or rename to such a name is refused with "C* is the image
   of C in layer ref" (other names ending in `*` keep Run 2's "reserved for images"). The
   lexing of lowercase managed names (l*) is the language run's.
10. **Placement (I4)**: a missing image is inserted right after the later of its source and
    its transform (after images created before it in the same edit), so adding an object to
    the source appends its image, and a map defined after its sources is followed by their
    images. Redefining or moving T re-validates by the stable topological order (images move
    after T); a map built from its own images is a cycle and is refused.
11. **Rule edits**: `addDerivedLayer` (default suffix `*`), `updateRule` (a new transform
    redefines every image in place, keeping ids and whatever was built from them; a new
    source, suffix or exclusion list removes, adds or renames images, chains included) and
    `removeRule` (SPEC: deleting the rule deletes its managed objects, with dependents; the
    layer stays as a plain layer with the user objects built in it; `removeLayer` deletes the
    layer too). A rule needs an existing transform object whose kinds include a
    transformation, an existing source layer other than itself, a suffix of one or more `*`
    and existing excluded objects; a chain of rules leading back to the layer is a cycle and
    is refused. Two rules that would give one name (same source, same suffix) are refused
    ("the image name A* of A in layer two is already used"). A rule's transformation cannot
    be redefined as something that is not one.
12. **Managed objects follow their rule only**: they cannot be removed, renamed, redefined,
    moved or put in other layers through applyDocEdit (the message suggests excluding the
    source or styling it [noimage]); they can be styled, and building in a derived layer
    means adding ordinary objects to it. Run 2's `renameObject` now renames images of images
    too (a bug found here: X** kept its old name; rename-chain.test.ts).

### Views (views.ts)

13. View = { name, layerVisibility, viewport? }: `addView` (a grammatical, unused name;
    existing layers; a finite viewport with zoom > 0), `applyView` (the listed layers take
    the view's visibility, the others keep theirs; the viewport becomes the view's when it
    has one; idempotent), `removeView`. Removing a layer drops it from every view (Run 2).

### Drag-through (drag.ts)

14. `dragThrough(doc, managedId, cursor, values)` → `{ kind: 'edit', edit }` (a redefine of
    the free input) or `{ kind: 'not-draggable', reason }`. A chain X** → X* → X inverts each
    map in turn (float values). A free point gets T⁻¹(cursor) as exact decimals of the doubles
    (the editor rounds at drag end, SPEC §12); a glider gets the parameter of the nearest
    point of its object (glider.ts `dragParameter`). Not draggable: a map of the chain that
    depends on X (SPEC §8.4's stated rule), an Undefined map, a source that is neither a free
    point nor a glider, a glider whose object is Undefined or whose circle has the cursor at
    its centre.

### Testing

15. L13: the similarity laws on random maps and values of every kind in all three fields;
    incidence preservation on registry-fuzzed documents (exact over Q and mod p, both
    directions, and in floats), arcs; kernel-level model-based fuzzing with fast-check's
    `fc.commands` (every DocEdit above plus drags; after each command L1 in three fields, L7,
    L13 sync and, over Q, every image equal to apply(T, X) of the current values): 500 runs in
    CI with a fixed seed, 20,000 with `NIGHTLY=1` (the nightly test job). L1 for degenerate
    maps and derived layers in three fields; L3 with argument plans for the maps.
    **fast-check 4.10.2 is a dev-only dependency** (tests only; it uses its own seeded
    generator, given a fixed seed), added for the run's explicit `fc.commands` requirement.

### Phase 2: inversion (documented only; no v1 code refers to it)

16. **How inversion plugs in.** `Transform.t` becomes a union { similarity | mobius }; the
    compiler then points at every place that switches on it (similarity.ts and the tools,
    each ending in assertNever). A Möbius map (z ↦ (az + b)/(cz + d), or of z̄) is applied
    per kind by its own core: points (the centre's image is Undefined with its reason, which
    the derived layer keeps as an Undefined image: SPEC §8.2 "images may be Undefined"),
    lines and circles through the cline rule (a line or circle through the centre maps to a
    line, others to circles), the anchor mapped as for similarities (exact gliders), arcs
    reversed when the map is anti. Nothing in derived layers, sync, placement, reserved names
    or drag-through depends on the map being a similarity: the rule stores a reference to a
    transform object, `exprKinds` reads overload outputs, and drag-through inverts the map
    and refuses when the map depends on the source (the inversion centre or circle defined
    from X: SPEC §8.4 "inversion inherits this unchanged").
17. **The range `outside` flag it will need** (SPEC §18 E5; decided by ADR in Run 14).
    Inversion maps a segment not through the centre to an ARC of the image circle, and a
    segment through the centre to the two rays outside the image of its ends, i.e. the
    complement of a bounded parameter interval. The Line value has one interval [lo, hi];
    the complement needs a flag (`outside: true` meaning t ∉ (lo, hi)) that every range test
    (intersect, other, gliders, selectors) must then honour. v1 adds nothing: similarities
    map [lo, hi] to [lo, hi] (decision 3), and the exhaustive switches over Value kinds
    and Transform types are the guard (E3, E5).

## Consequences

- The editor run builds applyEdit on applyDocEdit (history, coalesced drags, selection) and
  uses dragThrough for images; the scene run hides images that coincide with their visible
  sources (SPEC §13; the Run 4 scenario names them: A*, B*, l*).
- The language run lexes lowercase managed names (l*, ω*), reports `reservedName` messages
  as diagnostics, and prints `@layer ref = image(t, main) [suffix=…] [exclude=…]`.
- Tools added later may declare `Signature.output` when an overload's result is narrower
  than the tool's; without it a call is assumed to have any of the tool's outputKinds.
- The claims run can rely on images being plain objects (apply(T, X)) for closures.

## Alternatives considered

- Completeness inside I4: changes Run 2's frozen tests (a hand-built chained rule without
  images must pass assertInvariants) and makes assertInvariants depend on the registry.
- Imaging numbers (apply(T, k) = k): a measure is not a figure; its "image" would duplicate
  the number under a starred name and break measures that depend on the image layer's own
  objects (dist(A*, B*) is the measure the user wants there).
- Kinds from a float evaluation: imaging would depend on numerics (an Undefined value has no
  kind), and a document's managed objects would change when a figure degenerates.
- Images appended at the end of the document: a map defined after its sources would need
  its images after it anyway (I4), and images far from their sources make files harder to
  read; "right after the later of source and map" gives both.
- Removing images directly (and re-adding them on the next sync): a deletion that silently
  comes back; exclusion and [noimage] say what the user means.
- A hand-written command generator instead of fast-check: fc.commands gives shrinking of
  failing command sequences to minimal ones, which the run asked for by name.
