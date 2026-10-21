import { expect, test } from '@playwright/test';
import { command, openApp, tab } from './helpers';

/**
 * Run 8b, SPEC §16: tests run in a Web Worker, so the main thread never blocks for more than
 * 16 ms during a test. Measured over a local test and the global test that follows it (the
 * figure has an assume line), with no Playwright action inside the measured window (its
 * locator polling runs on the page's main thread too):
 *   - a Chromium trace (Playwright's browser.startTracing): the wall-clock duration of EVERY task of the
 *     page's main thread (ThreadControllerImpl::RunTask) — the blocking itself;
 *   - the Long Tasks API (tasks ≥ 50 ms by the browser's definition): none;
 *   - a MessageChannel ping loop: the longest gap between two of its tasks (reported; it
 *     also counts the OS descheduling the main thread, which is not the page's work).
 * The spec runs in its own Playwright project after all the others (playwright.config.ts), so
 * no other browser competes for the CPU.
 */

declare global {
  interface Window {
    __measure?: () => Promise<{ maxGap: number; gaps: number; longTasks: number[] }>;
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

/** A main-thread task's trace event, by Chromium version and category (toplevel). */
const TASKS = ['ThreadControllerImpl::RunTask', 'RunTask'];

/** The durations (wall-clock ms) of the tasks of every renderer main thread in a trace. */
function mainThreadTasks(trace: Buffer): number[] {
  const parsed = JSON.parse(trace.toString('utf8')) as { traceEvents: TraceEvent[] };
  const events = parsed.traceEvents;
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

test('the main thread never blocks for more than 16 ms during a local and a global test', async ({
  page,
  browser,
}, info) => {
  await openApp(page);
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
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__measure = async () => {
      const longTasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      observer.observe({ type: 'longtask', buffered: false });
      const channel = new MessageChannel();
      let [last, maxGap, gaps, running] = [performance.now(), 0, 0, true];
      channel.port1.onmessage = () => {
        const now = performance.now();
        [maxGap, gaps, last] = [Math.max(maxGap, now - last), gaps + 1, now];
        if (running) channel.port2.postMessage(0);
      };
      channel.port2.postMessage(0);
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Test');
      button?.click();
      await new Promise<void>((resolve) => {
        const poll = setInterval(() => {
          if (document.querySelector('.verdict[data-regime="global"]') === null) return;
          clearInterval(poll);
          resolve();
        }, 100);
      });
      running = false;
      observer.disconnect();
      return { maxGap, gaps, longTasks };
    };
  });
  await browser.startTracing(page, { categories: ['toplevel', 'devtools.timeline'] });
  const m = await page.evaluate(() => window.__measure?.());
  const trace = await browser.stopTracing();
  if (m === undefined) throw new Error('no measurement');
  const tasks = mainThreadTasks(trace);
  const maxTask = Math.max(...tasks);
  const r = (x: number) => Math.round(x * 10) / 10;
  const json = JSON.stringify({
    tasks: tasks.length,
    maxTask: r(maxTask),
    longTasks: m.longTasks,
    pingGaps: m.gaps,
    maxPingGap: r(m.maxGap),
  });
  info.annotations.push({ type: 'long-task', description: json });
  console.warn(`main thread during a test (${info.project.name}): ${json}`);
  await expect(page.locator('.verdict[data-regime="local"] .verdict-line')).toHaveText(
    /^Holds in this configuration/u,
  );
  expect(tasks.length).toBeGreaterThan(100);
  expect(m.longTasks).toEqual([]);
  expect(maxTask).toBeLessThanOrEqual(16);
});
