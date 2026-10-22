# ADR-0026: Undefined objects in exports are listed, never placed

Status: accepted (maintainer's review of PR #16, 2026-10-22). Extends ADR-0014 (exports) and
SPEC §14's warnings.

## Context

The maintainer asked that undefined points work well in exports such as Asymptote, and allowed
assigning coordinates. An undefined object (a second intersection whose known point is not on
both curves, a homothety of ratio 0, the polar of a circle's center, …) has no position: the
canvas does not draw it and the Objects panel lists it with its reason. Every export already
leaves it out (it is not in the display list, and Asymptote's planner declares only drawn
objects, ADR-0014), so no file holds NaN or a wrong point; but the omission was silent.

## Decision

1. **No coordinates are invented** for an undefined object: any number written for it would be a
   point that does not exist in the figure ("Undefined is shown as undefined, never as garbage",
   CLAUDE.md). An object that is defined but that Asymptote cannot construct keeps its computed
   coordinates, as before (`pair D = (1, -3); // numeric`).
2. **Every format lists it.** Each visible undefined object (the scene's `unavailable`) gives an
   export warning `X is undefined in this figure (<reason>): not drawn`: shown by the Export
   dialog for SVG, PNG, TikZ and Asymptote, and written as `% Warning:` / `// Warning:` lines at
   the head of the TikZ and Asymptote files, as character and colour warnings already are. A
   hidden object is not listed (it is not shown on the canvas either).

## Consequences

- `ExportWarning` gains the kind `undefined`; `@geomira/export/paint`'s exported names are
  unchanged (the helper is internal, `undefined-objects.ts`).
- The example goldens do not change: no example has an undefined object.

## Alternatives considered

- **Placing an undefined point at its last defined position, or at the origin**: garbage that
  compiles; a reader of the exported figure could not tell it from a real point.
- **Refusing to export a figure with undefined objects**: the defined part is still worth
  exporting; the warning says what is missing.
