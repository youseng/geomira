# ADR-0077 Remove the figure randomizer

## Context

The maintainer requested removing the Randomize action, its triangle-type selector
and its implementation. ADR-0016 introduced this action to redraw the free inputs
of an existing construction. The triangle command creates geometry independently.

## Decision

Remove the controls from all header sizes, the editor batch-edit adapter, and
the whole-figure generator and its package exports. Settings was the only other
item in the compact overflow menu and now opens directly. Existing drawings
already store the resulting coordinates. They require no migration.

## Consequences

Retire the tests specific to the removed generator. Exercise undo, redo and
claim-bearing document round trips with a midpoint edit. Check for the absence
of the retired controls across the workspace width matrix. The internal claim
engine continues to exercise its local and global samplers, including validation
of fixed radii, parameter bounds and homogeneous glider inputs.

## Alternatives considered

Moving Randomize into a menu would retain the feature and both package entry
points. The maintainer requested removing all three.
