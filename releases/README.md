# Downloadable Geomira

[Download the public offline HTML](https://youseng.github.io/geomira/geomira.html).
For this GitHub link, use your browser’s **Save link as** action, or open the
[about page](https://youseng.github.io/geomira/about.html) and choose **Download offline copy**
for a normal browser download. Open the saved file directly in Chromium, Firefox or Safari. It needs no account,
network or server after download. Browser file-origin storage policies still apply;
keep portable `.geo` backups of important work. The initial download and its provenance
manifest use the network; the PWA does not precache these files or substitute its app shell
when their URLs are opened. Once saved, the standalone HTML works without the network.

The download is copied byte for byte from the public single-file build tested by the
website's validation run. The same immutable Pages artifact contains the hosted app,
`geomira.html` and [release.json](https://youseng.github.io/geomira/release.json). The manifest
records the full source SHA, Actions run/attempt, deployment base, public build mode and
SHA-256 of every delivered file. Help → About this copy shows that full build SHA.

The old hand-maintained `releases/geomira.html` snapshot has been removed: it could lag
behind the website and still exposed retired claim testing. Do not distribute a file from
an old Git commit as the current release. The public URL changes only with an authorized,
validated deployment; a branch's preview artifact is not a published release.

For an unpublished candidate under the Pages base, use pinned pnpm and
`GEOMIRA_BASE=/geomira/ pnpm build`, then verify it with:

```sh
pnpm exec tsx scripts/release-candidate.ts check apps/web/dist apps/web/dist-single/index.html "$(git rev-parse HEAD)" local 1 /geomira/
```

This creates `apps/web/dist/geomira.html` and `release.json`; it does not publish anything.
The deployment graph runs the full verification, public/internal browser tests and export
compilation for the same source, checks the manifest after download, and uploads exactly
those tested bytes. Missing, failed, cancelled or unfinished prerequisite jobs cannot
produce the Pages artifact or enter deployment. Nightly mutation campaigns retain their
separate main/scheduled policy; they are not silently substituted for release checks.

## Public screenshot maintenance

`apps/web/public/screenshots/main-desktop.png` is a shipped public image. The current
web manifest has no `screenshots` field; this file is not an active install-dialog preview.
Keep it consistent with the reviewed public interface when that interface changes. After
reviewing the native desktop GUI reference under the current release ADR, copy its exact
bytes, retaining the 1280×720 dimensions and existing public path:

```sh
cp apps/web/e2e/public-layout.spec.ts-snapshots/public-workspace-desktop-linux.png apps/web/public/screenshots/main-desktop.png
```

Review the source image and record its source/run/hash provenance. Do not substitute an
internal-engine screenshot with retired claim controls. The next ordinary candidate build
includes the copied file in its checksum manifest and required validation; copying it alone
does not publish a release.
