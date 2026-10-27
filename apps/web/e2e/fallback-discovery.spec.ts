import { expect, test } from '@playwright/test';
import { command, openApp, tab } from './helpers';

/**
 * Run 17 (ADR-0035 decision 15 as amended by ADR-0037, ADR-0030): "What is special?" on a
 * 150-object figure on the page itself. The single file, opened from file:// with Web Workers
 * removed, runs the find job on its main thread in time slices. A Chromium trace records every
 * main-thread task from the click to the result; the numbers are logged and annotated on every
 * run. ADR-0030's ≤ 16 ms is not met on this figure (ADR-0037: sporadic pauses that look like
 * collector pauses); this is a regression gate: the job completes on the page, no task is longer
 * than MAX_TASK_MS, and fewer than OVER_SHARE of the tasks are longer than 16 ms. No Playwright
 * action runs inside the measured window. Runs alone, after every other project.
 */

/** ADR-0037: the longest main-thread task allowed during find on 150 objects (ms). */
const MAX_TASK_MS = 150;

/** ADR-0037: the share of main-thread tasks allowed to be longer than ADR-0030's 16 ms. */
const OVER_SHARE = 0.01;

declare global {
  interface Window {
    __measureFind?: () => Promise<{ longTasks: number[]; ms: number }>;
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

/**
 * A triangle and 147 more objects: midpoints, feet, lines and circles of earlier points, each
 * construction once (the app refuses a repeated construction).
 */
function figure(): string[] {
  const lines = ['A = (1, 5)', 'B = (-3, 0)', 'C = (4, 1)'];
  const pts = ['A', 'B', 'C'];
  const used = new Set<string>();
  const fresh = (tool: string, ...args: string[]) => {
    const key = `${tool}(${[...args].sort().join(',')})`;
    if (used.has(key)) return false;
    used.add(key);
    return true;
  };
  // A fixed MINSTD sequence picks earlier points (exact in doubles: the same figure every run).
  let x = 12_345;
  const pick = () => {
    x = (x * 48_271) % 2_147_483_647;
    return pts[x % pts.length] ?? 'A';
  };
  for (let i = 0; lines.length < 150 && i < 10_000; i++) {
    const [a, b, c] = [pick(), pick(), pick()];
    if (a === b || b === c || a === c) continue;
    const name = `P_${String(i)}`;
    const k = i % 4;
    if (k === 0 && fresh('midpoint', a, b)) lines.push(`${name} = midpoint(${a}, ${b})`);
    else if (k === 1 && fresh(`foot:${c}`, a, b)) lines.push(`${name} = foot(${c}, ${a}, ${b})`);
    else if (k === 2 && fresh('line', a, c)) lines.push(`l_${String(i)} = line(${a}, ${c})`);
    else if (k === 3 && fresh('circle', a, b, c))
      lines.push(`k_${String(i)} = circle(${a}, ${b}, ${c})`);
    else continue;
    if (k <= 1) pts.push(name);
  }
  return lines;
}

test('without workers, What is special? on 150 objects completes on the page within the gate', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'Worker');
  });
  await openApp(page, 'index.html');
  const lines = figure();
  expect(lines).toHaveLength(150);
  for (const line of lines) await command(page, line);
  await tab(page, 'Claims');
  await expect(page.getByRole('button', { name: 'What is special?' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__measureFind = async () => {
      const longTasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      observer.observe({ type: 'longtask', buffered: false });
      const t0 = performance.now();
      const button = [...document.querySelectorAll('button')].find(
        (b) => b.textContent === 'What is special?',
      );
      button?.click();
      await new Promise<void>((resolve) => {
        const poll = setInterval(() => {
          const done =
            document.querySelector('.fact-list') !== null ||
            document.querySelector('.discovery-find .empty') !== null ||
            document.querySelector('.discovery-find .tone-error') !== null;
          if (!done) return;
          clearInterval(poll);
          resolve();
        }, 100);
      });
      observer.disconnect();
      return { longTasks, ms: performance.now() - t0 };
    };
  });
  await browser.startTracing(page, { categories: ['toplevel', 'devtools.timeline'] });
  const m = await page.evaluate(() => window.__measureFind?.());
  const trace = await browser.stopTracing();
  if (m === undefined) throw new Error('no measurement');
  const tasks = mainThreadTasks(trace);
  const sorted = [...tasks].sort((a, b) => b - a);
  const r = (x: number) => Math.round(x * 10) / 10;
  const json = JSON.stringify({
    objects: 150,
    tasks: tasks.length,
    seconds: r(m.ms / 1000),
    longest: sorted.slice(0, 5).map(r),
    over16: tasks.filter((t) => t > 16).length,
    longTasks: m.longTasks,
  });
  info.annotations.push({ type: 'fallback-discovery', description: json });
  console.warn(`main thread during find on 150 objects without workers: ${json}`);
  await expect(page.locator('.discovery-find .tone-error')).toHaveCount(0);
  await tab(page, 'Help');
  await expect(page.getByTestId('runner')).toHaveAttribute('data-runner', 'page');
  // The job ran on this thread in many slices; no task beyond MAX_TASK_MS, and fewer than
  // OVER_SHARE of them beyond 16 ms (ADR-0037).
  expect(tasks.filter((t) => t >= 5).length).toBeGreaterThan(5);
  expect(sorted[0] ?? 0).toBeLessThanOrEqual(MAX_TASK_MS);
  expect(tasks.filter((t) => t > 16).length).toBeLessThan(OVER_SHARE * tasks.length);
});
