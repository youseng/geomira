# Prompt 12 — Independently audit the integrated candidate

Execute a read-only release review of Geomira. Read
`docs/release-prompts/README.md`, the numbered implementation prompts, `CLAUDE.md`,
SPEC, STATUS and relevant ADRs. The maintainer authorized removing the public claim
tester and repairing the reviewed issues. All implementation work should already be
integrated; independently verify the final result instead of trusting prior reports.

Do not fix source code, change tests/baselines, update dependencies, edit user figures,
publish or deploy during this task. Scratch reproduction files and reports outside
the source tree are allowed. This read-only scope takes precedence over an instruction
to repair a failed baseline during implementation. Report a failed check honestly.

## Establish what is being reviewed

1. Record repository, branch, full HEAD SHA and working-tree state. Preserve local work.
   Audit reference `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128` describes the old failures,
   not the expected current candidate. Confirm prompts 01–11 are integrated or list
   any incomplete/explicitly deferred deliverables before reaching a release decision.
2. Identify the exact hosted/PWA candidate and offline download, their source SHA,
   artifact checksum/identity and supported platforms. A locally rebuilt different
   artifact is not equivalent to the one users receive.
3. Use the pinned package manager and supported Node version. Run the current required
   verification commands and capture results rather than quoting STATUS's history.

## Independently retest the contracts

Use each prompt's reproductions and required behavior. For every row in README's
17-finding matrix, record its disposition, a concrete observation/test, and the
revision/artifact exercised. Mark unresolved, environment-blocked and deferred items
separately from passes.

### Public scope and old-file compatibility

- Fresh hosted visit, narrow/mobile layout, installed/offline app, direct file opening,
  examples, restored autosaves and old share links expose no public claim entry,
  verdicts, test/discovery actions or automated job execution. Test ordinary `?dev=1`
  and old navigation entry points; a public URL must not reactivate the engine.
- Retained claim/assumption statements survive editing, renaming, file round trips,
  sharing and supported export metadata. No false result is made to disappear by
  deleting the user's statements. No claim worker is warmed or job dispatched by
  loading such a document. Construction, measurements and Randomize still work.
- The internal engine may remain directly testable; its existence is not a public
  feature. Confirm shared sampler fixes without restoring public verdicts.

### Document safety and sharing

- Repeat the two-tab A+B versus A+C scenario, including overlapping saves and reload.
  Recover both users' edits or surface a clear conflict; no silent last-writer loss.
- Block storage access, exhaust quota and fail writes after an initial successful save.
  The app visibly reports unsaved work and offers a working file/recovery path.
- Exercise New/Open/Save/Save As, cancellation, malformed input and storage migration.
  Invalid/cancelled Open does not replace the current figure. Confirm dirty state is
  tied to actual successful persistence, not merely an attempted write/download.
- Repeat the 500-circle oversized-share case. It produces either a valid round-trip
  link or an actionable refusal/file fallback; the decoder protections remain.
- Offline sharing produces a portable hosted link with the correct deployed base path,
  not the sender's local filename. Opening it preserves inactive claim data.

### Editing, geometry and interaction

- Export/share/open dialogs isolate Delete, Undo and construction shortcuts while
  preserving normal field editing, modal keyboard navigation and focus restoration.
- Rename applies on Enter, blur and outside-close without duplicate undo entries.
  Undo/redo/reset keep all style controls synchronized; hidden derived images can be
  explicitly shown and their eye state matches the effective drawn state.
- Tangent/intersection tools create genuine dependencies even when unrelated objects
  currently coincide. Move parents and verify behavior, not just the initial picture.
- Conic transformations work through the intended GUI and script paths. Selection-first
  input consumption matches sequential picking, including retained line-claim point
  pairs; complete constructions do not swallow locked-layer/refusal messages.
- The translated unit triangle near 100000000 has area 1/2, and the radius-5 conic near
  1000000 permits a tangent at its own defining point. Compare exact and numeric runs
  where applicable; check incidence/continuity and exports without weaker tolerances.
- Reversed parameter bounds produce a clear refusal/undefined result, not an internal
  exception. Randomize preserves fixed-radius ratios and does not repair zero-radius
  degeneracy into a different construction. Inactive testing remains inactive.

### Usability, browser and release checks

- Inspect widths 320, 390, 760, 768, 820, 1024 and 1440, portrait/landscape and browser
  zoom. No clipped required controls, inaccessible dialogs or unusably narrow canvas.
  Test sidebar controls, tool search, keyboard order and touch-sized targets.
- Test touch selection, pan/pinch, long-press properties and text/file workflows with
  the mobile keyboard visible. Use real supported mobile devices when available;
  clearly state emulation-only coverage instead of calling it a device pass.
- Ask whether a newcomer can construct a triangle, find a center, style it, save/reopen
  it and export it using visible guidance. Report concrete friction, not aesthetic scores.
- Test Text-panel diagnostics/completion, valid/invalid drafts, source formatting,
  semicolon batching and singleton directive replacement through both entry points.
- Run supported Chromium/Firefox/WebKit flows, both builds and relevant export
  compilation. Use offline tests that exercise the actual downloadable file.
- Review screenshots rather than automatically accepting them. Verify the deployment
  job cannot publish before required checks for the same source/artifact succeed.
- Run performance checks in isolation. Separate application work from complete browser
  frame/rasterization cost; report measured values and the actual configured limits.

## Required report

Deliver one self-contained report containing:

1. **Go / no-go / conditional decision**, with the specific release blockers first.
2. Full source and artifact identities, versions, clean/dirty state and review scope.
3. A table covering all 17 original findings, plus newly found regressions: status,
   reproduction or check, observed result, source location and severity.
4. Exact command results/counts, browser/OS/device matrix, screenshot review and
   export/performance evidence. Do not equate high coverage with absence of bugs.
5. Remaining limitations and deferred features, including the disabled tester's
   reactivation gates. No claim that every possible defect has been eliminated.
6. Confirmation that this review changed no application code or baselines and did
   not publish anything. Link the report and useful evidence files.

If fixes are needed, hand back narrowly scoped findings. After another agent fixes
them, review the changed paths and affected scenarios on the new candidate; do not
carry forward a release approval from an earlier revision without checking relevance.
