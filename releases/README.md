# Releases

`geomira.html` is the single-file build of Geomira (ADR-0030): one HTML file with everything
inlined, the claim tester's worker included. Download it and open it in a browser; it needs no
network and no server (file:// works in Chromium, Firefox and Safari's engine).

It is a snapshot, committed by hand: build `5f0ce3be` (the commit it was built from), made with
`pnpm build` (→ `apps/web/dist-single/index.html`). Help → "About this copy" shows the build it
came from. It does not follow later changes of the code; every CI run also uploads a fresh copy
as the artifact `geomira-single-file`.
