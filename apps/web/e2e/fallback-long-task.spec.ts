import { expect, test } from '@playwright/test';
import { claimItem, command, openApp, tab } from './helpers';

/**
 * Run 12, SPEC §16: "without workers, the page runs them in ≤ 16 ms slices (tested in v1.1 from
 * file://)". The single file, opened from file:// with Web Workers removed, runs a local test
 * and the global test that follows it on its own main thread. A Chromium trace records the
 * wall-clock duration of every task of the page's main thread over both tests; the longest
 * must be ≤ 16 ms, and the Long Tasks API (≥ 50 ms) must report none. No Playwright action runs
 * inside the measured window. Runs in its own project after every other (playwright.config.ts).
 */

declare global {
  interface Window {
    __measureFallback?: () => Promise<{ longTasks: number[] }>;
  }
}

interface TraceEvent {
  readonly name: string;
  readonly ph: string;
  readonly pid: number;
  readonly tid: number;
  readonly dur?: number;
  readonly args?: { readonly name?: string };
}

const TASKS = ['ThreadControllerImpl::RunTask', 'RunTask'];

function mainThreadTasks(trace: Buffer): number[] {
  const events = (JSON.parse(trace.toString('utf8')) as { traceEvents: TraceEvent[] }).traceEvents;
  const mains = new Set(
    events
      .filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
      .map((e) => `${String(e.pid)}:${String(e.tid)}`),
  );
  return events
    .filter(
      (e) =>
        TASKS.includes(e.name) && e.ph === 'X' && mains.has(`${String(e.pid)}:${String(e.tid)}`),
    )
    .map((e) => (e.dur ?? 0) / 1000);
}

test('without workers, the page never blocks for more than 16 ms during a local and a global test', async ({
  page,
  browser,
}, info) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'Worker');
  });
  await openApp(page, 'index.html');
  for (const line of [
    'A = (1, 3)',
    'B = (0, 0)',
    'C = (4, 0)',
    'H = orthocenter(A, B, C)',
    'O = circumcenter(A, B, C)',
    'N = ninepoint_center(A, B, C)',
    'ν = ninepoint_circle(A, B, C)',
    'assume acute(A, B, C)',
    'claim collinear(O, N, H)',
  ])
    await command(page, line);
  await tab(page, 'Claims');
  await expect(claimItem(page, 'claim')).toBeVisible();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__measureFallback = async () => {
      const longTasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      observer.observe({ type: 'longtask', buffered: false });
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Test');
      button?.click();
      await new Promise<void>((resolve) => {
        const poll = setInterval(() => {
          if (document.querySelector('.verdict[data-regime="global"]') === null) return;
          clearInterval(poll);
          resolve();
        }, 100);
      });
      observer.disconnect();
      return { longTasks };
    };
  });
  await browser.startTracing(page, { categories: ['toplevel', 'devtools.timeline'] });
  const m = await page.evaluate(() => window.__measureFallback?.());
  const trace = await browser.stopTracing();
  if (m === undefined) throw new Error('no measurement');
  const tasks = mainThreadTasks(trace);
  const sorted = [...tasks].sort((a, b) => b - a);
  const r = (x: number) => Math.round(x * 10) / 10;
  const json = JSON.stringify({
    tasks: tasks.length,
    longest: sorted.slice(0, 5).map(r),
    longTasks: m.longTasks,
  });
  info.annotations.push({ type: 'fallback-long-task', description: json });
  console.warn(`main thread during a test without workers: ${json}`);
  await expect(page.locator('.verdict[data-regime="local"] .verdict-line')).toHaveText(
    /^Holds in this configuration/u,
  );
  await expect(page.locator('.verdict[data-regime="global"] .verdict-line')).toHaveText(
    /^Holds across the declared configuration/u,
  );
  await tab(page, 'Help');
  await expect(page.getByTestId('runner')).toHaveAttribute('data-runner', 'page');
  // The tests ran on this thread: many slices of several ms each, none longer than 16 ms.
  expect(tasks.filter((t) => t >= 5).length).toBeGreaterThan(5);
  expect(sorted[0] ?? 0).toBeLessThanOrEqual(16);
  expect(m.longTasks).toEqual([]);
});
