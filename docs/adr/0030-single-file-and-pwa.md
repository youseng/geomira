# ADR-0030: The single-file build, tests without workers, and the PWA (Run 12)

Status: accepted (Run 12). Builds SPEC §1 v1.1 ("single-file offline build, PWA") and the
v1.1 part of SPEC §16 ("without workers, the page runs them in ≤ 16 ms slices (tested in v1.1
from file://)"). Extends ADR-0013 (decision 7: the test worker) and ADR-0012 (decision 17: share
links). Adds one development dependency (decision 2). No package under `packages/` changes.

## Context

Run 12's brief: (1) a vite-plugin-singlefile build with the worker inlined that works from
file://; (2) a time-sliced fallback (≤ 16 ms slices) when workers are unavailable, tested;
(3) Playwright from file:// in Chromium, Firefox and WebKit: open, draw, local and global test,
export, share link; (4) a PWA: manifest, service worker, offline after the first visit, a version
banner. The maintainer authorised vite-plugin-singlefile as a development dependency and noted
that `new Worker(new URL('./test-worker.ts', import.meta.url))` is a second file the single file
cannot carry, that the worker's 12 ms slice loop should be reused, and that CI installed only
Chromium. SPEC leaves open: what "workers unavailable" means, how the slices are kept under
16 ms, the service worker's caching and update rules, and what the version banner says.

## Decision

### Two builds (apps/web/vite.config.ts, apps/web/build/)

1. `pnpm build` makes both: the **site** (`vite build` → `dist/`, deployed to Pages, with the
   service worker) and the **single file** (`vite build --mode singlefile` →
   `dist-single/index.html`, uploaded by CI as the artifact `geomira-single-file`).
2. **vite-plugin-singlefile 2.3.3** (devDependency of apps/web, exact version; released
   2026-04-17; 2.3.4 of 2026-10-17 is younger than two weeks) inlines scripts and styles. It is
   a build tool and ships nothing at runtime; CLAUDE.md's runtime list is unchanged.
3. **The worker in the single file**: the host creates its worker through `worker/spawn.ts`
   (the site's separate module file, cached like the page's scripts). The single-file mode
   aliases that module to `worker/spawn-inline.ts`, which imports the worker with Vite's
   `?worker&inline`: its bundle is embedded and started from a blob: URL (Vite falls back to a
   data: URL). The site keeps a separate file, so its main script does not carry the worker's
   code a second time.
4. The single file has no public folder (`publicDir: false`); its favicon is a data: URL and it
   has no manifest link (`build/singlefile.ts`); the Help menu's "About Geomira" links to the
   site's landing page instead of the missing `about.html`. Two build-time constants
   (`build-info.ts`): `BUILD`, the build id (env `GEOMIRA_BUILD`, else the 8-character commit),
   and `SINGLE_FILE`.

### Tests without workers (apps/web/src/worker/)

5. **One slice loop** (`slicer.ts`) runs a job's generator for the worker and for the page. A
   slice runs steps until the next one would end past the budget, predicted by the longest of the
   last 16 steps (the first step, which also prepares the job, is not used: one slow setup must
   not shrink every later slice); it always runs at least one step, then yields through the
   caller's scheduler. So a slice exceeds its budget only by a step longer than the recent ones.
   The worker keeps its budget SLICE_MS = 12 and setTimeout; its slices now stop before a
   predicted overrun instead of after it.
6. **The page's runner** (`inline-runner.ts`): budget MAIN_SLICE_MS = 8 ms (SPEC's 16 ms, with
   room for task overhead, a garbage collection or a step longer than predicted), every slice and
   every progress report and result in its own task (so the Claims panel's re-render never
   lengthens a slice), tasks queued through a MessageChannel (no 4 ms timer clamp). Same
   generator, same seed, same verdict as the worker.
7. **When workers are unavailable** (`host.ts`): the platform has no `Worker`; creating one
   throws; or the worker fails, or stays silent for READY_MS = 5 s, before it posts the new
   `ready` message (protocol.ts). Then the host runs every job on the page from now on, and the
   jobs already sent move there (same callbacks). A worker that fails after `ready` is a failure
   of its jobs, reported as before (ADR-0013 decision 11), and the next job starts a new worker.
   The Help panel says where tests run and why ("run on this page in short slices, since workers
   are unavailable (…)").

### The PWA (apps/web/src/sw/, src/pwa.ts, build/pwa.ts)

8. **Manifest** `manifest.webmanifest` (name, standalone display, relative start URL and scope
   so it works under `/geomira/`, an SVG icon and 192/512 px PNGs rendered once from it).
9. **The service worker** is `src/sw/service-worker.ts`, one self-contained module (typed by
   small local interfaces, without the WebWorker lib, which conflicts with the DOM lib in one
   program). After the site build, `build/pwa.ts` lists every file of `dist/` except source maps
   and itself, versions the build by a SHA-256 of their paths and bytes (12 hex digits), and
   writes `sw.js` with that list, the cache name `geomira-<version>` and the build id. Rules:
   install caches every file (bypassing the HTTP cache); a GET for a file of the build is
   answered from the cache (query ignored), a navigation anywhere in scope gets the app's
   `index.html`, everything else goes to the network; an evicted entry falls back to the
   network; activation deletes `geomira-*` caches of other versions and claims the pages.
10. **Updates wait for the user** (the version banner). A new version installs beside the
    running one and waits; the page asks it for its build and shows "A new version of Geomira is
    available (build X; this page runs build Y). Reloading keeps your figure." with **Reload to
    update** (flush the autosave, `skip-waiting`, reload on `controllerchange`) and **Later**.
    The page registers after its `load` event, looks for an update when it becomes visible
    again, and registers nothing in the single file, from file://, on the development server, or
    where the browser has no service worker; the Help panel's "About this copy" says which
    (build, offline status, test runner). The debug report's app version names the build.

### Share links from a file

11. **Bug fix**: the share link was `location.origin + location.pathname + #s=…`. For a page
    opened from a file Firefox's `location.origin` is the string `"null"`, which gave
    `null/home/…/index.html#s=…`. The link is now the page's URL without its query and hash, then
    the fragment (`share-url.ts`); on http(s) pages the result is the same as before.

### Tests and CI

12. Playwright projects: `file-chromium`, `file-firefox`, `file-webkit` (Desktop Chrome, Firefox,
    Safari devices) open `dist-single/index.html` from file:// (`e2e/file-url.spec.ts`: one file
    and no other request; drawing with the polygon tool; the local test and the global test the
    assume line starts; the same without `Worker`, on the page; SVG shown and downloaded, TikZ;
    a share link opened in a new page). `pwa` (`e2e/pwa.spec.ts`, Chromium) serves a copy of
    `dist/` under the deploy's base path from a server the test stops: offline after the first
    visit (server gone and the browser offline: reload, figure, local test in the cached worker,
    export, an unvisited address), the banner with the new build and Reload into it, Later.
    `measure-fallback` (`e2e/fallback-long-task.spec.ts`) traces the main thread of the single
    file without workers over a local and a global test: every task ≤ 16 ms, no long task; it
    runs after the other measurements, and `measure` now waits for every project.
13. The existing projects run with `serviceWorkers: 'block'`, so their flows are exactly as
    before (no background caching, no controlled reloads); `pages` and `pwa` allow them. `measure`
    matches `long-task.spec` only at the start of a file name (the old pattern also matched the
    new spec).
14. ci.yml and deploy.yml install Chromium, Firefox and WebKit; deploy.yml also checks the
    manifest link and `sw.js` in the Pages build. `tsconfig.tests.json` covers `apps/web/build`;
    ESLint, Prettier and git ignore `dist-single/`.

### Revision (maintainer request, same run)

15. **A committed copy.** The maintainer asked for the single file in the repository:
    `releases/geomira.html` is the single-file build of commit 5f0ce3be, committed by hand, with
    `releases/README.md`. It is a snapshot: it embeds its build id, so it can never equal the
    build of the commit that contains it, and no check compares it with the code; it is updated
    by hand when the maintainer asks. SPEC §2's directory list gains `releases/` for it. Prettier
    skips it (minified output); it is within the 400-line limit (182 lines) and has none of the
    reserved words, so `pnpm rules` checks it as any file.

## Consequences

- The site works offline after one visit and updates only when the user reloads into a new
  version; the single file works from disk in the three engines, with tests in an inlined worker
  where the browser allows it and on the page in short slices otherwise.
- A deployment always changes `sw.js` when any file changes (the version is a content hash), so
  browsers see the update.
- Frozen tests: none changed (the worker protocol gains a message; `JobCallbacks` is re-exported
  from `host.ts` under its old name).

## Alternatives considered

- **Always inlining the worker** (one code path for both builds): the site's main script would
  carry the worker's code a second time, base64-encoded, on every first load.
- **vite-plugin-pwa / Workbox**: not authorised; a precache list and four event handlers are
  small enough to own and test.
- **Activating new versions at once (`skipWaiting` on install)**: a page would run old scripts
  against a new cache, or reload under the user's hands; waiting with a banner is the safe order.
- **Network-first navigations**: a slow network would delay every start; the precached shell
  opens at once and the update check runs in the background.
- **A fixed number of samples per slice on the page**: slices would depend on the figure's size;
  the time-based loop with a prediction keeps them under the budget for any figure whose single
  step fits it.
