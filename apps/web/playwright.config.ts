import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const base = process.env['GEOMIRA_BASE'] ?? '/';
const local = `http://localhost:${String(port)}${base}`;
/** Set after a deploy: the smoke test then runs against the GitHub Pages site (Run 9b). */
const pages = process.env['GEOMIRA_PAGES_URL'];

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: local,
    trace: 'retain-on-failure',
  },
  projects: [
    // Run 8b: the flows run on the desktop, the touch flows on the phone; Run 7's specs on both.
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(mobile|long-task|drag-frame|pages-smoke)\.spec/u,
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 664 }, hasTouch: true },
      testIgnore: /(flows-[a-z]+|long-task|drag-frame|pages-smoke)\.spec/u,
    },
    // Run 9b: the static site's smoke test (locally built, or the deployed Pages site).
    {
      name: 'pages',
      use: { ...devices['Desktop Chrome'], baseURL: pages ?? local },
      testMatch: /pages-smoke\.spec/u,
    },
    // The main-thread measurements (Run 8b's long tasks, Run 9a's drag frame) run after every
    // other test, alone: no other browser or test worker competes for the CPU while they measure.
    {
      name: 'measure',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /long-task\.spec/u,
      dependencies: ['desktop', 'mobile'],
    },
    {
      name: 'measure-drag',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /drag-frame\.spec/u,
      dependencies: ['measure'],
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
