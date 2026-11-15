# Prompt 03: add native document files and reliable sharing

Implement this task in Geomira. The maintainer has authorized fixing the release review's
file/sharing weaknesses and adding an ordinary local document workflow. Deliver a reviewable
patch, regression tests and documentation; do not publish, merge or deploy as part of this task.

Read `docs/release-prompts/README.md`, `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the
required ADRs. Follow the shared execution contract. Review baseline:
`95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`. Inspect current code and the persistence contract
from prompt 02 rather than assuming the old two-slot storage still exists. Integrate
prompt 04's modal safety before implementing file-replacement dialogs.

## Outcome

Users can create, name, open, save and duplicate a portable `.geo` document, understand which
revision is saved locally or exported, and recover before replacing a figure. Share never
offers a link that the app will reject under its own format limits. A share link made from
the offline HTML points to the hosted application rather than to the sender's local path.

Keep all of this local and static-site compatible: no accounts, server storage or automatic
uploads. Reuse the existing versioned language as the canonical file format.

## Failures to reproduce

**Oversized share:** the encoder accepts documents the decoder refuses. Generate 500 valid
circles using this JavaScript fixture generator, then paste the generated text into Geomira:

```js
Array.from(
  { length: 500 },
  (_, i) =>
    `w_${i} = circle((${Math.sin(i) * 4}, ${Math.cos(i) * 4}), ${1 + Math.sin(i * 2) ** 2})`,
).join('\n');
```

At baseline the canonical text has about 38,400 characters and its fragment about 21,201.
Share offers it normally, but opening it is refused by the decoder's 20,000-character payload
limit. The fixture is test-data generation; do not put platform math/randomness in pure code.

**Offline sharing:** `shareUrl('file:///home/u/geomira/index.html', '#s=AbC')` returns that
same local pathname with the fragment. Existing tests only open another tab on the same
machine. A recipient generally has no application at the sender's exact local path.

**Missing document workflow:** the existing Export menu offers image/TeX output, not an
ordinary New/Open/Save `.geo` workflow. Users must rely on autosave or copy source manually.

## Implementation requirements

1. Add understandable New, Open, Save/Download and Save As actions, with the current document
   name visible. Preserve document identity/revision semantics from prompt 02. Save As or
   Duplicate must not silently make two different figures overwrite the same recovery entry.
2. Use canonical versioned text for `.geo`; preserve geometry, styles, layers, viewport,
   document metadata, claims and assumptions. Claim data remains inert after prompt 01.
   Do not invent a second serialization format or drop data not currently shown in the UI.
3. Provide a portable file-input/download baseline. A browser file-handle API may enhance it
   where supported but must not be required, including in the single-file build. Label a
   downloaded copy honestly; the ordinary download API cannot confirm a filesystem write.
4. Before New/Open replaces work, preserve it in recovery and make pending/unapplied text
   explicit. If a draft contains parse errors, do not quietly export an older figure while
   implying the visible draft was saved. Offer a clearly labelled draft-text backup or a
   path to resolve/discard the draft. Cancel must leave the entire session unchanged.
   If recovery storage has failed, require a backup path or an explicit in-app discard choice
   before replacement; a failed save must not make the replacement appear safe.
5. Validate a chosen file before replacing the current document. Read/permission failures,
   malformed text, unsupported future versions and unreasonable sizes produce actionable
   feedback; no partial import, loss of the open figure or accidental empty replacement.
   Use the existing migrations and diagnostics where applicable.
6. Consolidate share limits in a checked encoder/result API. Validate canonical-text size
   and encoded-payload size consistently with the decoder before displaying Copy link.
   Retain checksum, decompression limits, damaged-link handling and old-link compatibility.
7. When a document is too large to share, explain the limitation and offer Download `.geo`.
   Do not increase/remove decoder limits merely to make the reproduction pass. Ensure the
   fallback contains the complete intended document and has a descriptive safe filename.
8. For a supported hosted HTTP(S) app, preserve its configured deployment base. For a
   `file:` origin, generate the public HTTPS app URL with the encoded fragment, using the
   configured canonical site URL rather than leaking the local pathname. Explain that the
   recipient opens the hosted app. An optional local bookmark must be distinctly named.
9. Sharing and downloading must not send document text to a service. Keep data in the URL
   fragment for hosted share links. Do not use a URL-shortening service or introduce uploads.
10. Integrate the persistence failure's backup action with this same serializer/download
    path. Keep Saved locally, exported/downloaded revision, unsaved changes and conflict
    states distinct; a clipboard copy is not evidence of durable saving.

## Starting points

- `packages/editor/src/share.ts`: `encodeShare`, `decodeShare`, payload/text limits.
- `packages/editor/src/lz-bounded.ts` and share round-trip/limit tests.
- `apps/web/src/share-url.ts`, `build-info.ts` (`SITE_URL`), `page.ts` sharing actions.
- `apps/web/src/Header.tsx`, `ExportDialog.tsx`, `Dialogs.tsx` and `hooks.ts`.
- `apps/web/src/store.ts`, `persist.ts`, text-draft/application paths and prompt 02's APIs.
- `packages/lang` parse/print/version migration; `packages/export` filename/metadata helpers.
- `apps/web/test/share-url.test.ts`, E2E persistence/share/file-mode flows.
- ADR-0018, ADR-0028, ADR-0030 and the new decisions produced by prompts 01 and 02.

## Acceptance tests

- Create a named figure, save/download it, close it, reopen the file and compare the complete
  document structurally, allowing only documented ID normalization. Include derived layers,
  styles, views, claims, assumptions and Unicode names/labels.
- Save As/Duplicate yields separate recoverable documents. Cancel a picker or replacement
  prompt: no document, history, dirty flag, text draft or recovery entry is lost or changed.
- Attempt to open malformed, truncated, future-version and oversized files; the existing
  figure remains intact. Test file read failures and a supported older-version file.
- Saving with a valid pending text edit captures that edit. Saving with an invalid/stale
  draft clearly distinguishes the visible draft from the last valid figure and preserves it.
- With storage blocked/full, a visible backup action still produces a usable `.geo` file.
- The 500-circle fixture receives an honest too-large message and working file fallback.
  Add boundary cases around both decoder limits, including text that compresses extremely
  well. Every link the UI offers successfully decodes to the complete intended document.
- Existing valid and legacy share links still open; checksums, malformed percent escapes,
  damaged data and bounded decompression remain covered.
- Simulate different sender/recipient local paths: an offline-generated public link uses
  HTTPS and contains no local directory. Open it against the hosted app and compare geometry.
- Verify hosted base paths, query/hash removal, clipboard refusal and the canonical origin.
  Do not make correct offline sharing depend on an existing service worker cache.
- Exercise keyboard and touch access, browser download fallback and both build modes. The
  dialog/input-isolation prompt owns the shared modal fix; integrate it before final E2E.

## Scope and completion

Depend on prompt 02's persistence/dirty/recovery model; coordinate shared Header/page/hooks
changes with prompt 01. Do not independently rewrite storage or reintroduce the claim UI.
PNG metadata reimport is optional future work, not a prerequisite for this task. Do not add
cloud hosting, synchronization, broad editor redesign or new construction tools.

Document the file workflow, size limits, privacy behavior and offline share behavior. If the
old specification or frozen tests prescribe local-file share URLs, change that behavior via
an ADR and the frozen-test exception process, preserving meaningful replacement assertions.
Keep the test-count floor. Run required checks and actual save/open/share browser flows.

In the handoff state the document lifecycle, treatment of unapplied drafts, file API fallback,
checked-sharing contract, tested browsers, changed ADR/tests and exact verification results.
