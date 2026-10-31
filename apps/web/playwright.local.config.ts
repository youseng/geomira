import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const port = 4391;
const base = process.env['GEOMIRA_BASE'] ?? '/';
const local = `http://localhost:${String(port)}${base}`;
/** Set after a deploy: the smoke test then runs against the GitHub Pages site (Run 9b). */
const pages = process.env['GEOMIRA_PAGES_URL'];
/** The single-file build's folder as a file:// URL (Run 12: the specs open its index.html). */
const singleFile = pathToFileURL(fileURLToPath(new URL('dist-single/', import.meta.url))).href;

/** Specs that run only in their own projects below. */
const OWN = 'long-task|drag-frame|pages-smoke|file-url|fallback-long-task|fallback-discovery|pwa';

export default defineConfig({
  testDir: 'e2e',
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
  projects: [
    // Run 8b: the flows run on the desktop, the touch flows on the phone; Run 7's specs on both.
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: '/opt/pw-browsers/chromium' } },
      testIgnore: new RegExp(`(mobile|${OWN})\\.spec`, 'u'),
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: '/opt/pw-browsers/chromium' }, viewport: { width: 390, height: 664 }, hasTouch: true },
      testIgnore: new RegExp(`(flows-[a-z]+|${OWN})\\.spec`, 'u'),
    },
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
      testMatch: /file-url\.spec/u,
    },
    {
      name: 'file-firefox',
      use: { ...devices['Desktop Firefox'], baseURL: singleFile },
      testMatch: /file-url\.spec/u,
    },
    {
      name: 'file-webkit',
      use: { ...devices['Desktop Safari'], baseURL: singleFile },
      testMatch: /file-url\.spec/u,
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
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: '/opt/pw-browsers/chromium' } },
      testMatch: /[/\\]long-task\.spec/u,
      dependencies: ['desktop', 'mobile', 'file-chromium', 'file-firefox', 'file-webkit', 'pwa'],
    },
    {
      name: 'measure-drag',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: '/opt/pw-browsers/chromium' } },
      testMatch: /drag-frame\.spec/u,
      dependencies: ['measure'],
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
  ],
  // Against the deployed site no local server is needed (deploy.yml's smoke job).
  ...(pages === undefined
    ? {
        webServer: {
          command: `pnpm exec vite preview --port ${String(port)} --strictPort`,
          url: local,
          reuseExistingServer: false,
        },
      }
    : {}),
});
