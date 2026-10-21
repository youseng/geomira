import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const base = process.env['GEOMIRA_BASE'] ?? '/';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}${base}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // Run 8b: the flows run on the desktop, the touch flows on the phone; Run 7's specs on both.
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(mobile|long-task)\.spec/u,
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 664 }, hasTouch: true },
      testIgnore: /(flows-[a-z]+|long-task)\.spec/u,
    },
    // The main-thread measurement runs after every other test, alone: no other browser or test
    // worker competes for the CPU while it measures.
    {
      name: 'measure',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /long-task\.spec/u,
      dependencies: ['desktop', 'mobile'],
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}${base}`,
    reuseExistingServer: false,
  },
});
