# ADR-0013: The web app: panels, command bar, canvas tools, test worker (Run 8b)

Status: accepted (Run 8b). Builds the UI of SPEC §15 and the worker host of SPEC §16 over
packages/editor (ADR-0012), packages/scene (ADR-0010) and packages/claims (ADR-0008). Records
the readings of the run's brief, one deviation from its note A (decision 9), and the logic the
run added to the packages so that apps/web holds none. Numbered 0013 (note F of the run).

## Context

Run 8b's brief: React panels (Text two-way with per-line diagnostics; Objects by layer with
Undefined and Inexact reasons; Layers; Claims with live three-valued badges, a local verdict
line, a global verdict line when requested or when `assume` lines exist, "open
counterexample"; Style incl. noimage), a command bar with autocomplete, shortcuts and help
generated from data; a worker host for runJob (progress, cancel) with the main thread never
blocked for more than 16 ms during a test; verdict wording exactly as SPEC §10.5 ("Holds in
this configuration (local test, n = 200, exact over Q)"), global findings never red, never the
words reserved for the Phase 2 prover; Playwright flows. Notes: A (the UI is a thin layer: no
geometry, selector, verdict or autosave logic in apps/web; the worker parses nothing; the main
thread supplies cryptographic entropy), B (a current figure that violates an `assume` line is
said plainly at that line), C (label collisions), D (the debug report from the UI and from
every internal-error message). SPEC and the brief leave open: the exact wording around the
verdict name, how a command-bar line becomes an edit, when the text panel applies, how
gestures map to edits, how the worker is driven and measured, and what "Restore previous
figure" offers while a share link is open.

## Decision

### Logic in the packages, the UI a thin layer (note A)

1. apps/web keeps ONE EditorState in an external store (`store.ts`, useSyncExternalStore)
   changed only through packages/editor's `applyEdit`, `toolInput` and `runCommand`; viewport,
   hover, selection, tool and active layer are the editor's UI edits. Everything the panels
   decide comes from the packages, each with its own tests:
   - claims `./verdict-line` (decision 2) and `./figure-hypotheses` (decision 3);
   - editor `./command` (decision 4), `./keymap` (shortcuts and help as data, one entry per
     tool of the tool table plus editing and view commands), `./panels` (objects by layer with
     the values' reasons; claim rows with evalClaim badges; assume rows; the printed line of
     each claim and assumption) and `./restore` (decision 8);
   - scene `./label-box` (decision 10).
     Their export-surface tests gain lines only.

### Verdict lines (SPEC §10.5)

2. **Wording.** `verdictLine(verdict)` gives the line the app shows: the verdict's name in
   sentence case, then in parentheses the regime, n and the rungs used ("Holds in this
   configuration (local test, n = 200, exact over Q)", "exact over Q 150, numeric 50" when
   mixed), then only the notes that add something: fewer valid figures than tested ("150 of 200
   figures valid"), "true in the current figure only", the counts of a MIXED verdict, samples
   rejected by hypotheses and mirrored figures (global), a shortfall against the hypotheses
   ("only m of N figures satisfied the hypotheses") and "hard to satisfy". The seed, the tally
   and the most frequent reasons of invalid figures form a `detail` line under it (SPEC: every
   result carries its seed). `tone`: a LOCAL verdict is holds / false / mixed / inconclusive;
   every GLOBAL verdict is `info` (blue), never the colour of a failure. packages/claims'
   `Verdict.text` (upper-case names, Run 5) is unchanged: its tests and the job protocol use it.

### Hypotheses in the current figure (note B)

3. `hypothesesInFigure(doc, registry)` decides each `assume` line on the CURRENT figure with
   the tester's own `checkAssumption` (probes, float values, the band) and, when it does not
   hold, says why with the deciding measure: "This figure is not acute: ∠B ≈ 104°" (the largest
   angle), "… not scalene: AB ≈ CA ≈ 3.61" (the closest sides), "… does not satisfy AB > BC:
   AB ≈ 3, BC ≈ 4.12", "… does not have P inside t", "… is at the edge of acute(A, B, C): ∠B ≈ 90°"
   (inside the band), "… does not satisfy …: X is undefined (reason)", and an assumption the
   claims package refuses is `invalid` with its reason. The Claims panel shows the sentence at
   the assumption's printed line; the tests still run, and their verdict lines then leave out
   the generic "hard to satisfy" (`figureExplains`), never the counts.

### Command bar and text panel

4. A command-bar line that is not a GUI tool's id or label is the document's printed text with
   the line appended, applied as ONE `replaceText` edit: the same parser as the text panel,
   ids kept (parseInto), one history entry; its diagnostics are shifted to line 1 (the
   command's own line). A line that changes nothing is refused as such. Completions of the word
   before the cursor: registry tools (with their signatures: nothing outside the registry
   enumerates tools), object names, statement keywords, claim and assumption kinds after
   `claim` / `assume`, and the GUI tools at the start of a line.
5. The text panel shows `print(doc)`. Typing shows every line's diagnostics at once; the text is
   applied (one `replaceText`) on Apply, Ctrl+Enter or leaving the field, and only when it has
   no errors (the figure stays as it was otherwise, ADR-0012 decision 3). A change of the figure
   from elsewhere replaces an unedited text and leaves an edited one alone, with a note.

### Canvas

6. Gestures (`gestures.ts`): in the Move tool a press on a drawn point starts the editor's drag
   (dragStart → dragMove… → dragEnd, one history entry, drag-through for images); a press that
   the editor refuses to drag (a point that is not free), or on anything else, pans; a press
   that moves less than 4 px is a click, given to the active tool with the scene's hit test at
   the cursor and its world position; two pointers pinch (zoom about their midpoint, pan with
   it); the wheel zooms about the cursor. A newly opened document is fitted once the canvas has
   a size (its `@viewport` when it has one); later edits keep the view. The canvas publishes its
   viewport as data attributes so the end-to-end tests aim at world coordinates.

### Tests in a worker (SPEC §16)

7. One module Web Worker runs packages/claims' `runJob` on the parsed Document the page sends
   (the worker parses nothing): it advances the generator for at most 12 ms, then yields to
   its own event loop (a `cancel` is read between two samples), and posts progress at most
   every 100 ms. The worker is started 300 ms after the page loads, so the first Test does not
   pay for creating it. A local test of n = 200 is followed by a global one when the document
   has `assume` lines; the global test can also be asked for. Every run uses a fresh seed from
   `crypto.getRandomValues` and remembers the document it tested: after an edit its verdict is
   marked "for an earlier version of the figure", never shown as the current one's. Progress
   goes through a separate store (`test-runs.ts`) that re-renders the Claims panel only, and
   the side panel is CSS-contained, so a progress update lays out the panel alone.
8. **Autosave and restore** (`restore.ts`, completing ADR-0012 decision 16): at startup a valid
   share link opens (origin `link`, not saved before its first edit), else the autosave, else a
   new figure. While a link is open and unsaved, the user's own figure is still the `current`
   slot, so "Restore previous figure" offers THAT (the link's text becomes `previous`); otherwise
   it swaps `previous` and `current`. After a restore the session counts as saved. The page
   saves 200 ms after the last change, and removes a link's hash from the address after the
   link's first edit (a reload then opens the autosave, which holds the edit).

### Deviation from note A: where the entropy is drawn

9. Note A says the MAIN THREAD supplies the cryptographic entropy of the mod-p rung
   (crypto.getRandomValues through num's cryptoSource). A function cannot be posted to a
   worker, and a pool of random words sent with each job would need a size bound on what the
   rung consumes (it draws per free input and retries by rejection) and a refusal when it runs
   out. The worker therefore builds `cryptoSource((b) => crypto.getRandomValues(b))` itself:
   the same Web Crypto of the same browser, supplied by the host code of apps/web, never by a
   pure package. packages/claims is unchanged (`env.entropy`). Recorded under "Uncertain" in
   STATUS for the maintainer.

### Labels (note C)

10. `placeLabels` places labels with a fixed direction first (explicit `label_angle`, and every
    label that is not a point's) and never moves them; then automatic point labels in draw
    order: the best direction for the curves through the point (Run 7's rule) unless its box
    overlaps a label placed before it, then the next directions in rank order that keep at least
    MIN_CLEAR_DEG = 20° from those curves, else the best direction after all. Boxes are
    ESTIMATED from the text (`label-box.ts`: 0.62 em per character at the renderer's 15 px,
    sub- and superscripts at 0.7, overlap within 1 px), since the scene does not know the
    renderer's font metrics. Deterministic.

### Internal errors, measurement, layout

11. The debug report (editor's `debugReport`: text, version, last 50 edits, user agent) opens
    from the header, and every internal-error message offers "Copy debug report": exceptions
    thrown inside an edit (the store catches them), render errors (an error boundary around the
    panels), uncaught errors and rejections of the page, and worker failures.
12. **The 16 ms measurement** (e2e `long-task.spec.ts`): Playwright records a Chromium trace
    over a local test and the global test that follows it, and the longest task of the page's
    main thread (`ThreadControllerImpl::RunTask`, wall clock) must be ≤ 16 ms; the Long Tasks
    API (≥ 50 ms) must report none; a MessageChannel ping loop's longest gap is reported. No
    Playwright action runs inside the measured window (locator polling runs on the page's main
    thread). The spec runs in its own Playwright project after all the others, so no other
    browser competes for the CPU (an earlier run beside another browser measured 20 ms once).
13. Accessible names avoid the substrings that Run 7's frozen end-to-end tests look up with
    substring matching (`getByLabel('main')`, `getByLabel('Figure')`, `getByLabel('Example')`,
    the Fit and Zoom buttons): the side panel is the region labelled "Figure", each layer's
    visibility box is labelled by the layer's name, other controls avoid those words. The
    Run 7 screenshot baselines were regenerated for the new layout (the canvas is smaller).

## Consequences

- apps/web holds no geometry, selector, verdict or autosave decision; replacing React would
  touch only apps/web.
- The verdict line of the UI and `Verdict.text` of packages/claims are two renderings of one
  verdict; a new verdict kind needs both (the exhaustive switches fail to compile otherwise).
- The views UI (v1.1) and the no-worker fallback in 16 ms slices (v1.1, tested from file://)
  are not built here.

## Alternatives considered

- Verdict wording in apps/web: verdict logic in the UI, against note A.
- Changing `Verdict.text` to the sentence-case line: modifies Run 5's frozen tests and the
  texts the job protocol returns.
- Applying the text panel on every keystroke: a history entry per character, and the
  canonical printing would rewrite the line being typed.
- A command bar with its own statement parser: two grammars that could disagree.
- Measuring blocking with the Long Tasks API alone: its threshold is 50 ms, not 16; with a
  ping loop alone: it counts the OS descheduling the main thread and Playwright's own polling.
- An entropy pool sent with the job (note A literally): needs a bound on the rung's
  consumption and a failure mode when it runs out.
