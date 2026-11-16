# CI follow-up: native traversal and retained claim entry

Scope: the c540 cross-engine report's keyboard walkthrough and legacy GUI/file/claim
failures. This record supplements the integrated prompt results; it is not a final CI
acceptance or a publication decision.

## Findings and changes

- Firefox completed the starter triangle and circumcenter. The second search traversal
  exhausted forward Tab at the document's final Hide O control. The fixture now chooses
  native Shift+Tab for earlier DOM targets, keeping its 60-key bound and every focus,
  construction, Properties and export assertion. No application focus correction was needed.
- A real retained-engine ClaimBox defect reopened the empty forms popup immediately after
  success, covering Text navigation. Success and Escape now dismiss suggestions; subsequent
  input/focus reopens them. Escape retains exact input and owns its dismissal key. The
  public claim interface remains excluded. Exact Claim-tool status expectations include the
  intentionally visible picked names.
- Shared document-file tests now assert exactly zero Claims tabs for the public artifact and
  exactly one only for explicit internal builds. Offline share tests assert canonical HTTPS
  SITE_URL and compare the entire recipient canonical document, including an added claim.
- Phone fixtures now exercise ADR-0074 page flow through native scrolling, at least 120
  actually exposed drawable pixels, native empty-canvas input, exact camera/source retention
  and restoration of the complete pre-open closed-sheet bounds. Floating-card interactions
  target exposed View/row controls and retain color commit, replacement and Undo assertions.
  Settings is reached through its visible More actions disclosure.

No snapshot reference, numerical tolerance, timeout or test-count floor changed. ADR-0074
and ADR-0069 identify the frozen fixture migrations. The fractional native-pointer fixtures,
measurement coincidence and optional header draft-badge reflow were diagnosed separately
and handed to agent 07; Expand-panel/focus CSS and visual references remain other owners'
work. No changes to those source areas are included here.

## Evidence

All local browser commands used Chromium and one worker, preview port 4192, with the pinned
pnpm and shared browser cache. Counts below overlap; they are not a distinct-test total.

- New ClaimBox regression failed before the fix: forms count 1 instead of 0 after success
  (`/tmp/geomira-08-claim-before.log`).
- Internal build succeeded. Six focused claim-tool/box, claim-chip and Geomdraw flows passed
  in 18.0s (`/tmp/geomira-08-claim-after.log`).
- Internal design-mobile and native file-share roundtrip passed in 10.1s, including the
  added claim (`/tmp/geomira-08-migration-final2.log`). The strengthened complete restored
  bounds checks passed both phone flows in 7.7s (`/tmp/geomira-08-bounds-final.log`).
- Internal named-duplicate cases passed on desktop and phone in a mixed five-case run;
  that command failed its initial design fixture, later corrected and rerun as above
  (`/tmp/geomira-08-fixtures-final.log`).
- The initial migration drafts incorrectly assumed an unmounted Text input could be read,
  then assumed the retained badges left the canvas center exposed. The final fixtures use
  visible Text navigation and the measured exposed right-hand drawing stripe instead.
- Public hosted/single-file build succeeded (`/tmp/geomira-08-public-final-build.log`).
- Application and test TypeScript compilation and changed-file ESLint passed
  (`/tmp/geomira-08-static.log`, `/tmp/geomira-08-fixtures-static.log`).

Eleven final default-build focused browser checks passed in 30.4s: named duplicate,
keyboard construction/Properties/export, card commit/replacement and phone panels across
Chromium desktop, phone and file projects (`/tmp/geomira-08-public-final.log`).
Local Firefox/WebKit execution is unavailable in this environment; full cross-engine CI
and the final integrated verification remain required. Physical-device and real screen-reader
checks were not performed. Nothing was pushed, merged, deployed or published by this agent.
