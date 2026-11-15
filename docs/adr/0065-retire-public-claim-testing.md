# ADR-0065: Retire public claim testing; retain documents and the internal engine

Status: accepted scope decision from the maintainer's release prompt 01 (2026-11-16).
Implementation acceptance remains pending the checks and review recorded in STATUS.
Supersedes the public-interface requirements of ADR-0013, ADR-0016, ADR-0030,
ADR-0035, ADR-0036 and ADR-0051; their internal engine semantics remain documented.

## Context

The authorized baseline is 95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128 (PR #36).
The fresh checkout's main branch was exactly that commit; no later changes were overwritten.
Its latest STATUS entry still says NOT ACCEPTED, but PR #36 is merged and the present prompt
explicitly includes it as the review baseline. This work does not retroactively mark it accepted.
During the session PR #37 merged as a761f67, adding the shared release contract and prompts.
That documentation-only update was fetched and fast-forwarded into this worktree before
completion; all thirteen new files are preserved. The shared contract explicitly authorizes
retaining internal tests separately and requires local delivery without a push. No source
code changed between the review baseline and this updated base.

The maintainer's reproduction is a false current-figure statement which sampled tests report
as 200 true / 0 false because fixed radius ratios change:

```text
O=(0,0)
F=(1000,0)
c=circle(O,0.01)
d=circle(O,0.02)
A=on(c,0)
B=on(d,0)
claim length(O,A,O,B,1)
```

The sampler repair belongs to a separate task. Hiding this interface is containment, not a
mathematical correction; retained tests do not establish that this bug has been fixed.

## Decision

1. One compile-time capability, `CLAIM_TESTING` in apps/web/src/features.ts, defaults false.
   Vite enables it only in the explicit `claim-engine` and `claim-engine-singlefile` modes.
   Their output directories are distinct from release directories. Normal `production` and
   `singlefile` builds ignore URL parameters, settings, environment feature preferences and
   document contents. No user-facing switch enables it.
2. Remove the header claim box, Claim palette button/key/help, Claims tab, live chips,
   local/global tests, automatic global follow-up, finder, hunting, branch-fix actions and
   result previews from the public app. Guard run orchestration and the worker host itself;
   warming and discovery subscriptions also stop. Neutral feedback answers explicit retired
   command/tool requests. Ordinary `claim ...` commands remain document edits.
3. Retain packages/claims and packages/discovery, their meaningful tests and registry data.
   Dependency tracing: lang validates statement kinds through claims; editor Randomize uses
   claims/randomize, which uses the sampler and hypotheses; construction selection also
   uses sampling helpers. Removing these dependencies would break ordinary geometry.
4. Preserve the language, document model, metadata, canonical and short printers, autosave,
   share codec, exports, undo and rename. The PWA update protocol and exported file metadata
   are unchanged. The advertised releases/geomira.html snapshot is not regenerated here;
   the release-artifact task owns it. No publication, merge or deployment is authorized here.
5. Public copy describes construction, exploration, measurements and export. Remove the old
   screenshot from public copy because it advertises the retired interface. Keep language
   syntax documentation for old documents, with a neutral availability note. Generated
   in-app help derives from the same filtered tool catalog as the palette.
6. Retain internal tests in explicit engine configurations; add public-default assertions
   against both fresh release artifacts. No disabled tests or lower count/coverage floors.
   Frozen UI assertions which required the retired public interface are replaced with
   absence and document-preservation assertions as listed in STATUS. Commits modifying
   those files cite ADR-0065 as required by the add-only guard.

## Consequences

Saved documents remain usable and editable. Randomize still uses its shared sampler and
assumptions; this ADR makes no claim about repairing its numeric behavior. Dormant engine
modules remain directly callable by internal package tests, but public application paths do
not dispatch their jobs or render their verdicts. A separately built internal artifact must
never be used as a release artifact. CI checks both modes; remote CI acceptance requires a
later authorized push, since this task is kept local.

## Alternatives

CSS hiding leaves jobs and keyboard paths active. A URL flag or persisted preference creates
a public escape hatch. Deleting claims or their packages breaks saved documents and Randomize.
Repairing the sampler in this change would exceed the requested scope. None was selected.
