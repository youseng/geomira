# ADR-0064: Select first, then the tool

Status: accepted (maintainer's decision of 2026-11-10 on Request 4a of the GUI milestone:
"acceptable"; "keep the button palette as it is"). Extends ADR-0024 (tools take their picks in
any order where the kinds differ) and ADR-0060 (several objects selected). SPEC §12 is updated
in this commit.

## Context

A tool took its inputs only by clicks made after it was chosen. With several objects selected
(ADR-0060, ADR-0062) the selection could be hidden or styled but not built on. And the two
circle tools (centre and point; three points) could not tell from clicks alone which circle
was meant; the maintainer kept the palette as it is, so the tools stay separate.

## Decision

1. **The selection becomes the tool's picks.** When a tool is chosen (toolbar button or key)
   while objects are selected in the Move tool, they are given to the tool in the order they
   were selected, as picks from the Objects panel are (`chooseTool`,
   `@geomira/editor/selection-tool`). A selection that fills the tool builds at once (one
   edit, one undo) and the tool stays active for the next construction; a smaller one becomes
   its first picks and the tool waits for the rest; a tool with a repeated step (polygon, a
   claim's list) takes any number from its step count on and finishes.
2. **Order-free tools stay order-free**: a point and a circle selected in either order give
   Tangent both tangents (ADR-0024).
3. **Alternatives** (`TOOL_ALTERNATIVES`, data): when the chosen tool cannot take the
   selection at all (a pick refused, or more objects than its steps), a tool that takes it
   EXACTLY builds instead, and the chosen tool is active afterwards. Today: Circle (center,
   point) ↔ Circle (3 points). So three points with either circle tool give the circle through
   them, two points with Circle (center, point) the circle about the first. A selection the
   chosen tool can START with is its own: two points with Circle (3 points) wait for a third.
4. **Only a selection made in the Move tool counts.** A construction tool selects what it
   built; choosing the next tool after it must not take that object as a pick (build O, then
   choose Incircle and click A, B, C).
5. **A selection no tool takes** chooses the tool with no picks, keeps the selection, and says
   why: "the selection (A, B, C) is not Midpoint's input: it takes a different number of
   objects". Nothing is built.

## Consequences

- No frozen test changes: every existing flow chooses its tool with nothing selected, or after
  a construction tool (decision 4).
- The command bar's "tool <name>" line still switches without picks.

## Alternatives

- **One Circle button that decides by the selection**: rejected by the maintainer's "keep the
  palette as it is"; the alternatives table gives the same result from either button.
- **Use the selection whatever tool was active**: rejected; see decision 4.
- **Ignore a selection that does not fit, silently**: rejected; a key that seems to do nothing
  is what the request complained about.
