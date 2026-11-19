# ADR-0080 Move zoom controls into the workspace header

The three viewport actions were always visible in a 72 px strip above the
drawing. On an idle canvas that strip held only Zoom in, Zoom out and Fit.
Place the same buttons in the workspace header next to View on desktop and
beside the document controls on phones.

Tool options and selection actions use the existing status strip below the
canvas. Its height stays fixed as tools and selections change. The canvas
starts at the top of the stage and a selection box uses the same origin as
the pointer. This amends the reserved-strip placement in ADR-0074 and
preserves its requirement for unobstructed native input.

The workspace and interaction-layout browser checks cover direct access to
the three header buttons, canvas alignment and the exposed Properties action.
The larger drawable area changes fitted scenes, exports and workspace images.
