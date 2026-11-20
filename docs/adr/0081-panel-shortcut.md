# ADR-0081 Direct access to figure panels

Opening the last-used figure panel from the desktop header required opening View first. Put a sidebar icon beside the view controls and expose the active panel body as its disclosure target. Drive its expanded state from the existing desktop collapse preference or phone sheet state. The original View action, panel tabs and close button continue to use those same controls. The layer-visibility test reads the complementary landmark named Figure, which distinguishes the sidebar from the disclosure button. A new independent open flag would let the icon drift out of sync with them.

Keep the existing desktop and phone header heights. On a phone the document controls share the first row with Zoom, and the panel shortcut sits before View in the second row. Update the full-workspace image fixtures to show the direct control. The Write-up editor is a separate proposal in [the design notes](../design/write-up-editor.md).
