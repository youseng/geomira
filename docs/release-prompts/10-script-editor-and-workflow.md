# Prompt 10 — Improve the existing script editor and command workflow

Implement this task in Geomira after the public claim-testing removal.
Keep the current geometry language and canonical document model.
The user requested a better scripting experience, not a new general-purpose language.

Audit baseline: `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`.

## Read first and coordinate

- Read this directory's `README.md` common execution contract.
- Follow `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the ADR-reading protocol.
- Read ADR-0009, ADR-0025, ADR-0047 and ADR-0061 before changing editing semantics.
- Integrate after 01, with 09's panel layout and 03's file actions.
- Keep legacy claim/assumption text parseable and serializable as required by 01.
- Do not expose claim execution through completion, buttons, keyboard shortcuts or hover UI.
- Source files and tests may have moved since the audit; verify your starting revision.
- Use the existing registry and parser for signatures, diagnostics and names.

## Confirmed command defect

Start with `@title "old"`.
Running `@title "new"` alone replaces the title successfully.
Running the following command fails with a duplicate-title diagnostic:

```text
@title "new"; D=(5,5)
```

`runCommand` performs singleton replacement only when there is one statement.
A valid batch should have the same document effect as applying its statements in order,
while remaining one atomic edit and one undo.
Handle `@title`, `@author` and `@viewport` consistently.
Repeated singleton directives within a command batch should follow that sequential rule.
A later invalid statement must roll the whole batch back, including directive changes.
Diagnostics must still point to the right span of the original command text.

## Existing friction to address

The Text panel is a plain textarea.
Errors supply line/column numbers that users must locate manually.
Command completion exists, but the larger Text editor lacks equivalent assistance.
Implicit normalization can replace readable source with generated text on leaving the field.
A command bar accepts top-level semicolons, while a file/Text line does not.

The semicolon difference is intentional in ADR-0061, not a newly discovered parser defect.
Keep one-statement-per-line files for this task.
Offer a visible, explicit conversion of pasted command-style statements into separate lines.
Do not silently change the grammar or split semicolons inside strings, comments,
attributes or constructs such as `harmonic(A,B;C,D)`.

## Source starting points

- `apps/web/src/panels/TextPanel.tsx`: text field, diagnostics and apply/revert actions.
- `apps/web/src/text-apply.ts`: draft following, debounce and stale-draft handling.
- `apps/web/src/caret.ts`: line/column and caret offsets.
- `apps/web/src/CommandBar.tsx`: completion UI and keyboard behavior.
- `packages/editor/src/command.ts`: `runCommand`, singleton replacement and completion.
- `packages/editor/src/text-draft.ts`: edit/stale/draft invariants.
- `packages/lang/src/statements.ts`: existing safe top-level statement splitting.
- `packages/lang/src/diagnostic.ts`, `parse-text.ts`, `print-short.ts`.
- Existing language round-trip, command, text-typing, caret and browser editor tests.

## Required release scope

1. Fix atomic multi-statement directive replacement and its diagnostic mapping.
2. Add visible line numbers that stay aligned while editing and scrolling.
3. Make each diagnostic actionable: click/keyboard activation focuses and selects its source span.
   Display errors beside the relevant source or in an accessible linked list.
4. Add lightweight syntax highlighting without changing the stored source or token semantics.
5. Add context-sensitive object/tool completion in the Text panel and signature help.
   Derive it from existing registries; do not maintain another tool-name list.
6. Support keyboard and pointer completion, clear no-match behavior and predictable dismissal.
   Completion acceptance must be one ordinary text edit and must preserve caret/selection.
7. Add the explicit semicolon-to-lines conversion described above, with a preview or clear action.
8. Preserve a user's unchanged draft, comments and formatting during normal text interaction
   wherever the existing document representation supports them.
9. Make generated/normalized source changes deliberate and understandable.
   Do not introduce two conflicting authoritative definitions of a figure.
10. Preserve stale-draft protection: a GUI edit made meanwhile cannot be silently overwritten.
11. Preserve the 500 ms valid-text apply behavior and coalesced history unless a justified
    ADR explicitly replaces that interaction; invalid drafts must never erase the last valid figure.

Source preservation needs careful scope.
Do not claim arbitrary exact-format round trips if the parser/document does not retain them.
Retain comments already represented by the language and uncommitted draft text.
If a GUI edit requires regenerated text, preserve pending edits and show why it changed.
For broader source-span tracking, document the design and test semantic round trips first.
Do not change canonical export/share/save output merely to make the editor look shorter.

## Dependency and accessibility constraints

Use existing dependencies and framework facilities where practical.
The repository allowlist does not currently include an external code-editor runtime.
Do not install one first and ask afterward.
If a new runtime dependency is essential, prepare a concrete justified request under
the repository policy and complete independent work while that decision is pending.

Keep the editable surface accessible to screen readers and native text selection.
If highlighting uses an overlay, it must not intercept clicks or duplicate announced text.
IME composition, Unicode/Greek names, primes, pasted multiline text and mobile selection
must work without premature parsing/completion commits.
Respect modal shortcut isolation from task 04.
Do not steal arrow, Home/End, Tab or Escape behavior when completion is not active.

## Tests to write before the fix

- Existing title plus title-and-object command succeeds; one undo restores both.
- Repeated singleton directives behave like sequential commands, atomically.
- A later syntax/name error rolls back the complete batch.
- Diagnostic offsets remain correct after replaced directives and multiple statements.
- Semicolon conversion preserves strings, escaped quotes, comments and nested constructs.
- A diagnostic on a scrolled line focuses the right UTF-16 source span.
- Completion in a middle line, after a Greek name and inside nested calls keeps the caret.
- Invalid drafts, undo/redo, blur, apply, revert and GUI edits preserve existing safety rules.
- Syntax highlighting and line numbers do not alter parsed document identity.
- IME composition and phone keyboard edits do not lose characters.
- Legacy claim text survives load/edit/save while public execution stays inaccessible.
- New/Open/Save from task 03 does not bypass stale-draft or dirty-work handling.

Run focused parser/editor tests and actual browser typing flows.
Use semantic assertions rather than snapshots alone.
Keep existing language laws, exact numbers, selectors and ID preservation intact.
For necessary frozen-test changes, record the ADR and retain the same or stronger guarantees.

## Acceptance and handoff

A user can locate an error, navigate to it, repair it with completion and continue drawing.
The title batch reproduction is fixed without changing file grammar.
Source, canvas and undo history agree after every tested edit path.
Report exact revision, changed semantics, tests and supported input methods.
Run common repository checks and update relevant docs.
Do not deploy or publish.

## Non-goals

Do not add a new language, unrestricted code evaluation, macros, animation or loci.
Do not rewrite the parser or make claims executable in the public build.
Do not let editor polish delay or replace the release-critical data-safety fixes.
