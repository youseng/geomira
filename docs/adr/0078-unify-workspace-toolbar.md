# ADR-0078 Unify the workspace toolbar

The maintainer’s design places file identity, local save status, history, tool
search, View and Export in one desktop row. A second full-width search strip
used drawing space and gave secondary actions the same weight as primary ones.

The document title opens the file menu. The local save indicator opens recovery
and retains its live status and conflict handling. Search shows recent tools on
focus and accepts Ctrl+K or Command+K outside modal dialogs. View groups canvas
and panel controls. Examples, help and settings share the overflow menu.
A phone uses two compact rows with touch-sized controls.

The saved document format and viewport coordinate system are independent of the
toolbar. Its smaller height increases the available drawing area, which changes
full-workspace, fitted-canvas and PNG export screenshot fixtures. Browser tests
reach each action through its new visible entry point, and exercise keyboard
search, menu focus, draft stability and recovery.
