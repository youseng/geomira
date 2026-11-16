import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const engine = process.env['GEOMIRA_ENGINE_E2E'] === '1';
const port = Number(process.env['GEOMIRA_PREVIEW_PORT'] ?? (engine ? 4174 : 4173));
const base = process.env['GEOMIRA_BASE'] ?? '/';
const local = `http://localhost:${String(port)}${base}`;
/** Set after a deploy: the smoke test then runs against the GitHub Pages site (Run 9b). */
const pages = process.env['GEOMIRA_PAGES_URL'];
/** The single-file build's folder as a file:// URL (Run 12: the specs open its index.html). */
const singleFile = pathToFileURL(
  fileURLToPath(new URL(engine ? 'dist-single-claims/' : 'dist-single/', import.meta.url)),
).href;

/** Specs that run only in their own projects below. */
const OWN =
  'long-task|drag-frame|pages-smoke|file-url|fallback-long-task|fallback-discovery|pwa|release-download';
// Legacy feature flows remain exercised by e2e:claims, not against release artifacts.
const INTERNAL =
  'flows-claimtool|flows-geomdraw|flows-claims|flows-review|flows-discovery|flows-design|design-mobile|drawer-notice-mobile';
const internalOnly = engine ? '|public-release' : `|${INTERNAL}`;
const fileSpecs = engine
  ? /file-url\.spec/u
  : /(public-release|persistence|modal-safety|release-download|document-files|randomize-integrity|script-editor)\.spec/u;

export default defineConfig({
  testDir: 'e2e',
  ...(engine ? { testIgnore: /public-release\.spec/u } : {}),
  forbidOnly: true,
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: local,
    trace: 'retain-on-failure',
    // Run 12: the site registers a service worker; only the PWA project lets it, so the other
    // flows run exactly as before (no background caching, no controlled reloads).
    serviceWorkers: 'block',
  },
  projects: (
    [
      // Run 8b: the flows run on the desktop, the touch flows on the phone; Run 7's specs on both.
      {
        name: 'desktop',
        use: { ...devices['Desktop Chrome'] },
        testIgnore: new RegExp(`(mobile|${OWN}${internalOnly})\\.spec`, 'u'),
      },
      {
        name: 'mobile',
        use: {
          ...devices['Desktop Chrome'],
          viewport: { width: 390, height: 664 },
          hasTouch: true,
        },
        testIgnore: new RegExp(`(flows-[a-z]+|${OWN}${internalOnly})\\.spec`, 'u'),
      },
      ...(['firefox', 'webkit'] as const).map((browserName) => ({
        name: `desktop-${browserName}`,
        use: { browserName, viewport: { width: 1280, height: 720 } },
        testMatch:
          /(flows-build|flows-persist|flows-keyboard|public-release|modal-safety|script-editor)\.spec/u,
      })),
      // Run 9b: the static site's smoke test (locally built, or the deployed Pages site).
      {
        name: 'pages',
        use: { ...devices['Desktop Chrome'], baseURL: pages ?? local, serviceWorkers: 'allow' },
        testMatch: /pages-smoke\.spec/u,
      },
      // Run 12: the single-file build opened from file:// in the three engines (Chromium, Firefox,
      // WebKit: Safari's), and the PWA (service worker, offline, version banner) in Chromium.
      {
        name: 'file-chromium',
        use: { ...devices['Desktop Chrome'], baseURL: singleFile },
        testMatch: fileSpecs,
      },
      {
        name: 'file-firefox',
        use: { ...devices['Desktop Firefox'], baseURL: singleFile },
        testMatch: fileSpecs,
      },
      {
        name: 'file-webkit',
        use: { ...devices['Desktop Safari'], baseURL: singleFile },
        testMatch: fileSpecs,
      },
      {
        name: 'pwa',
        use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow' },
        testMatch: /pwa\.spec/u,
      },
      // The main-thread measurements (Run 8b's long tasks, Run 9a's drag frame, Run 12's tests on
      // the page without workers) run after every other test, alone: no other browser or test
      // worker competes for the CPU while they measure.
      {
        name: 'measure',
        use: { ...devices['Desktop Chrome'] },
        testMatch: /[/\\]long-task\.spec/u,
        dependencies: [
          'desktop',
          'mobile',
          'desktop-firefox',
          'desktop-webkit',
          'file-chromium',
          'file-firefox',
          'file-webkit',
        ],
      },
      {
        name: 'measure-drag',
        use: { ...devices['Desktop Chrome'] },
        testMatch: /drag-frame\.spec/u,
        dependencies: engine
          ? ['measure']
          : ['desktop', 'mobile', 'desktop-firefox', 'desktop-webkit'],
      },
      {
        name: 'measure-fallback',
        use: { ...devices['Desktop Chrome'], baseURL: singleFile },
        testMatch: /fallback-long-task\.spec/u,
        dependencies: ['measure-drag'],
      },
      // Run 17 (ADR-0037): find on 150 objects without workers, after the others and alone (in
      // one project with fallback-long-task, the two specs would run in parallel and compete).
      {
        name: 'measure-discovery',
        use: { ...devices['Desktop Chrome'], baseURL: singleFile },
        testMatch: /fallback-discovery\.spec/u,
        dependencies: ['measure-fallback'],
      },
    ] satisfies NonNullable<PlaywrightTestConfig['projects']>
  ).filter((p) =>
    engine
      ? !['pages', 'pwa'].includes(p.name)
      : !['measure', 'measure-fallback', 'measure-discovery'].includes(p.name),
  ),
  // Against the deployed site no local server is needed (deploy.yml's smoke job).
  ...(pages === undefined
    ? {
        webServer: {
          command: `pnpm exec vite preview --outDir ${engine ? 'dist-claims' : 'dist'} --port ${String(port)} --strictPort`,
          url: local,
          reuseExistingServer: false,
        },
      }
    : {}),
});
