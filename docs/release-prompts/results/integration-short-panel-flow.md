# Short-phone Command exposure correction (A19)

A separate layout defect was found while checking Recovery's focus handoff. It reproduces
without opening Recovery: at 390×380, focus Command after entering invalid Text. Command
retains focus, but Text's diagnostic button covers the input's center. This is a pointer
exposure defect, independent of the Recovery ownership correction.

## Decision and evidence

Only the two short open-panel grid rows and their selector specificity change. Their
minimum is intrinsic `min-content`; the existing side-panel 280px floor stays. `.app`
qualification lets the short rules override the generic compact-panel row. Both palette
states remain explicit. Normal phone/desktop sizing, drawing projection and editor state
are unchanged. ADR-0074 records the correction.

Measured native input-focus/scroll probe, using the built public artifact:

| Metric                                | Before at 390×380      | After at 390×380          |
| ------------------------------------- | ---------------------- | ------------------------- |
| Side panel / allocated grid row       | 280px / 280px          | 388.78125px / 388.78125px |
| Command input y / height              | 344.5px / 28px         | 344.28125px / 28px        |
| Element at the input center           | Text diagnostic button | Command input             |
| Raw source / caret / Command / camera | Original values        | Exactly unchanged         |

At 390×664, the before/after source probe metrics are identical: side/row 280px, input
628.5px/28px, native workspace scroll 131, and an exposed input center. Normal scope does not
match either changed selector. Changing just the side min-height was rejected by the probe:
it grew the side while leaving its grid allocation 280px and its input still covered.

Local artifacts: `/tmp/geomira-a19-before-compact.jpeg`,
`/tmp/geomira-review08-380-source-fixed.png`,
`/tmp/geomira-review08-664-source-fixed.png`, and
`/tmp/geomira-a19-source-fixed.json`. The independent reviewer inspected the source/test
diff, metrics and screenshots and reported no objection before commit.

## Verification

- All four new native regressions failed before the CSS change at the existing pointer
  center assertion. Immutable traces are in `/tmp/geomira-a19-before-results` and the command
  output in `/tmp/geomira-a19-before.log`.
- Public hosted and standalone builds passed before and after the change
  (`/tmp/geomira-a19-before-build.log`, `/tmp/geomira-a19-after-build.log`).
- All seven `panel-controls.spec.ts` cases passed with one Chromium worker in 18.3s
  (`/tmp/geomira-a19-after.log`). This includes the original 420px source/canvas 120px exposure
  and normal 320/390px tab/size/close/history checks. New cases cover compact/expanded,
  palette hidden/shown, extra Editor-help content, actual native Command click/type, exact
  raw Text/caret 17/Command/camera, restored closed canvas bounds and canonical
  A+B → Undo A → Redo A+B downloads.
- Changed-file ESLint, formatting and test TypeScript compilation passed. No existing assertion, numeric tolerance, timeout or screenshot changes.

One initial after-test invocation encountered the temporary probe preview occupying its port;
it ran no tests. The preview was stopped and the ordinary test runner completed successfully.
Full integrated verification and Firefox/WebKit CI remain the parent's responsibility.
Local browser checks used Chromium; no physical device or real screen reader was tested.
Nothing was pushed, merged, deployed or published by this agent.
