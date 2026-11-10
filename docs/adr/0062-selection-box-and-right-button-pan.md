# ADR-0062: The selection box, and panning on the right button

Status: accepted (maintainer's decision of 2026-11-10 on Request 2 of the GUI milestone: "sure,
pan moves to right"). Amends ADR-0013 decision 6 ("Move-tool press on a point drags; other
presses pan") for the MOUSE, and ADR-0029 decision 1 (the right click opens the style card: now
on its release). Extends ADR-0060 (several objects selected). SPEC §12, §13 and §15 are updated
in this commit.

## Context

After ADR-0060 several objects can be selected, but only one click at a time. With the mouse,
any drag that did not start on a draggable point panned the view, so the gesture every drawing
program uses for "these objects" was taken by panning.

## Decision

1. **The left button, Move tool.** A press that starts no drag (not on a free point, glider,
   image or label) and moves past the click slop draws a SELECTION BOX from where it went down
   to the pointer. On release the objects WHOLLY inside the box become the selection; with
   Shift, Ctrl or Cmd they are ADDED to it (an empty box then keeps the selection; without the
   key it clears it). A press on a point still drags the point; a press that does not move is
   still a click. A box is no document edit and no history entry.
2. **Wholly inside** (`@geomira/scene/box`, `inBox`): a window, not a crossing. A point, a text
   and an angle mark by their anchor; a segment, a segment mark and a distance by both ends; a
   polygon by every vertex; a circle and an ellipse by their bounding box. An unbounded line, a
   ray, a hyperbola and a parabola are never wholly inside, so a box never takes them (a click
   does). Reason: a line through the whole canvas would be caught by every box drawn around two
   points. Only drawn objects are in the scene, so hidden ones are not taken. The selection is
   in construction order.
3. **The right button (and the middle one) pans**, in every tool. A right press that does not
   move opens the style card of the object under it, as before, now on its release (so a right
   drag does not open it); the canvas's `contextmenu` event is only kept from the browser's
   menu after a mouse's right press, and still opens the card for a touch's held press.
4. **Other tools and touch are unchanged.** In a construction tool a left drag still pans (a
   press there is a pick; the box belongs to Move). A finger on empty canvas pans, two fingers
   pinch, the wheel zooms.
5. **Where the logic lives.** The gesture is apps/web's (`gestures.ts`: `Press`, `BoxHost`),
   as panning and dragging are; what is inside a box is the scene's (`box.ts`, pure, tested);
   the selection is the editor's `select` UI edit. The box is drawn as an overlay element, not
   on the canvas, so drawing it repaints nothing of the figure.

## Consequences

- One frozen e2e assertion changed (STATUS): a left drag from a point that is not free no
  longer pans; the test now checks that the view stays and that the right button pans.
- Callers of `Gestures.down` that say nothing about the button (`press` absent: touch, and
  every earlier test) behave exactly as before.
- On a trackpad without a right button, panning is two-finger scrolling's job; that is the
  wheel's zoom today. See STATUS, Requests.

## Alternatives

- **Shift+drag for the box, plain drag pans** (additive, no frozen change): offered to the
  maintainer, who chose the box on the plain drag.
- **Crossing selection** (anything the box touches): rejected for the reason in decision 2.
- **Space+drag to pan** as well: not added; every letter key is a tool and the right button is
  enough for a mouse. It can be added without touching this.
