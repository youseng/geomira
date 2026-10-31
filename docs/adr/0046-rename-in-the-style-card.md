# ADR-0046: Rename in the style card

Status: accepted (maintainer request "usability", item 2, 2026-10-30). Extends ADR-0029 (the
style card: draft, "Write to script" as one edit) with a Name field; uses the kernel's rename
(`renameObject` through `applyDocEdit`, SPEC §5 invariant I1, ADR-0007 managed images) and the
editor's batch edit (ADR-0012 decisions 2–3). SPEC is unchanged: the rename edit and batches
are SPEC §12 edits already.

## Context

Renaming an object was possible only in the text (or the command bar). The maintainer asked for
a "Name" field at the top of the style card: "Write to script" applies the name and the style
as ONE edit (kernel rename + style; one history entry; the text shows it; images follow as
today: A* becomes P* when A becomes P); invalid or taken names give an inline message and
disable Write; managed images cannot be renamed, and the card says why.

What the kernel's rename already does (checked, `packages/kernel/src/edit.ts` renameObject and
doc-edit.ts): it refuses a name that is not grammatical (`nameProblem`: empty, keyword, a
trailing `*`, `Ma` with "did you mean M_a?"), a name used by another object or a claim, and any
rename of a managed image; it renames the managed images of the object and of its images
(A* → P*, A** → P**, Run 4's rename-chain test). Claims, assumptions, layer exclusions, rule
transforms and comment anchors refer to objects by id, so the printed text shows the new name
everywhere with nothing else to update. The language accepts every name the kernel accepts
(checked: names equal to tool or function names such as `line`, `sqrt`, `pi` parse and print
back), so L5 holds for every rename the field can write.

## Decision

1. **The field.** The card's first row is "Name": a text field holding the object's name. Its
   text is part of the card's draft (`OpenCard.name`, absent while untouched, so the field
   follows the object's current name, for example after an undo). Blanks around the typed name
   are not part of it. Enter in the field does what "Write to script" does.
2. **One edit** (`@geomira/editor/style-card`, `cardEdit`): a changed name and a changed style
   are a `batch` of the kernel's `rename` and the `style` edit (rename first; one history entry,
   one undo restores both, the batch applies whole or not at all, ADR-0012 decision 2). A name
   alone is a `rename` edit; a style alone is exactly the `style` edit the card wrote before
   (so ADR-0029's behaviour and tests are unchanged); nothing changed is no edit (Write
   disabled). After a successful write the field is untouched again.
3. **Validation by the write itself** (`cardNameProblem`): the typed name is checked by applying
   the kernel's rename edit to the document (`applyDocEdit`, no state change), so the field
   refuses exactly what the write would refuse, with the kernel's own words ("the name B is
   already used", "\"Ma\" is not a valid name: did you mean M_a?", "a name cannot be empty",
   "\"claim\" is a keyword", "\"P*\": names ending in * are reserved for images"). The message
   is shown under the field (`role="status"`, the field `aria-invalid` and described by it),
   and Write is disabled while there is one, whatever the style draft holds: the write is one
   edit, so a style draft is not written with the name silently dropped. The object's own name
   is never a problem. A locked layer (ADR-0020) is refused at the write, with the notice every
   refused card write shows, as for a style today.
4. **Managed images** (`fixedName`): the field is read-only and says why, with what to rename
   instead: "A* is the image of A in layer inv: rename A" (the kernel's `reservedName` sentence;
   for an image of an image, "A** is the image of A* in layer twice: rename A", the user object
   at the root of the chain). Their style stays editable as before (ADR-0029 decision 7).
5. **Preview.** The canvas previews a writable typed name with the style draft (the kernel's
   rename on the preview document, so images' labels follow), as ADR-0029 previews the style;
   a name with a problem is not previewed. The preview is no edit.
6. **Where the logic lives.** The decisions are in packages/editor (`style-card.ts`: pure,
   tested at editor level); apps/web's `style-name.ts` (pure, DOM-free) combines them with the
   style draft (`cardWrite`, `previewDocument`); StyleCard.tsx only shows the results.

## Consequences

- An object is renamed where it is styled; the text and every reference follow, in one undo.
- The card is one row taller (and one line more while a message shows). No screenshot baseline
  shows the card (checked: the baselines under apps/web/e2e/*-snapshots are figures, the main
  screens and the claims panel), so none changes.
- `@geomira/editor` gains the subpath `./style-card` (its export-surface test gains lines only).

## Alternatives considered

- **Two edits (rename, then style)**: two undo steps for one button; the request says one edit.
- **Validating the name with a copy of the kernel's rules in the card**: two rule sets that
  could disagree; the trial edit is exact by construction and costs one rename and one derived
  layer sync per keystroke.
- **Writing the style and skipping an invalid name**: a write that silently drops part of what
  the user typed; refused instead (Write disabled, the reason shown).
- **Renaming an image by renaming its source from the image's card**: surprising (the user would
  rename another object from this card); the field says which object to rename instead.
- **Accepting `\omega` in the field as the text does**: the field takes the name as stored (ω);
  the language's escapes are a text-panel convenience. Left for a later request.

## Frozen tests changed

None. Added lines only: `packages/editor/test/exports.test.ts` (the `./style-card` subpath).
New tests: `packages/editor/test/style-card-rename.test.ts`, `apps/web/test/style-card-name.test.tsx`,
`apps/web/e2e/style-card-rename.spec.ts`.
