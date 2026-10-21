import { expect, test } from '@playwright/test';
import { openApp, screenOf } from './helpers';

/**
 * Run 9a, note F (SPEC §17: drag frame ≤ 8 ms at 300 objects): a FULL UI drag frame — the
 * pointer event, the editor's applyEdit (dragMove, incremental evaluation), the scene, the
 * layout, React's render and the canvas drawing calls, plus the browser's style, layout and
 * paint of that frame — measured with a Chromium trace. The real mouse presses on the first
 * free point of the 300-object figure (so the editor's drag starts as for a user); then the page
 * itself dispatches one pointermove per animation frame, marking each with performance.mark,
 * with no Playwright action inside the measured window. A frame's cost is the summed wall
 * clock of the page's main-thread tasks from its mark to the next one, WARMUP frames first.
 *
 * Headless Chromium here has no GPU, so the canvas is rasterised in software ON THE MAIN THREAD
 * (CanvasResourceProviderSharedImage::ProduceCanvasResource); with a GPU, as in a desktop
 * browser, that raster runs in the GPU process. The frame is therefore reported as `app` (all
 * main-thread work except that raster), `raster` and `total`; the budget is asserted on `app`
 * (ADR-0014 decision 19, a reading recorded under "Uncertain" in STATUS).
 */

declare global {
  interface Window {
    __drag?: (x: number, y: number, frames: number) => Promise<void>;
  }
}

interface TraceEvent {
  readonly name: string;
  readonly ph: string;
  readonly pid: number;
  readonly tid: number;
  readonly ts: number;
  readonly dur?: number;
  readonly args?: { readonly name?: string };
}

const FRAMES = 120;
const WARMUP = 20;
const TASKS = ['ThreadControllerImpl::RunTask', 'RunTask'];

const RASTER = 'CanvasResourceProviderSharedImage::ProduceCanvasResource';

interface FrameCost {
  readonly total: number;
  readonly raster: number;
}

/** The main-thread work (ms) between consecutive `gm-frame` marks of a trace. */
function frameCosts(trace: Buffer): FrameCost[] {
  const events = (JSON.parse(trace.toString('utf8')) as { traceEvents: TraceEvent[] }).traceEvents;
  const mains = new Set(
    events
      .filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
      .map((e) => `${String(e.pid)}:${String(e.tid)}`),
  );
  const onMain = (e: TraceEvent) => e.ph === 'X' && mains.has(`${String(e.pid)}:${String(e.tid)}`);
  const marks = events
    .filter((e) => e.name.startsWith('gm-frame-') && (e.ph === 'R' || e.ph === 'I' || e.ph === 'n'))
    .map((e) => e.ts)
    .sort((a, b) => a - b);
  const costs = marks.slice(0, -1).map(() => ({ total: 0, raster: 0 }));
  /** The frame of an event: the last mark before it ends (a frame's own task contains its mark). */
  const frameOf = (e: TraceEvent) => {
    const end = e.ts + (e.dur ?? 0);
    let i = -1;
    while (i + 1 < marks.length && (marks[i + 1] ?? Infinity) <= end) i++;
    return i >= 0 && i < costs.length ? costs[i] : undefined;
  };
  for (const e of events) {
    if (!onMain(e)) continue;
    const c = frameOf(e);
    if (c === undefined) continue;
    if (TASKS.includes(e.name)) c.total += (e.dur ?? 0) / 1000;
    else if (e.name === RASTER) c.raster += (e.dur ?? 0) / 1000;
  }
  return costs;
}

function stats(xs: readonly number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
  const r = (x: number) => Math.round(x * 100) / 100;
  return { frames: s.length, median: r(at(0.5)), p95: r(at(0.95)), max: r(s[s.length - 1] ?? 0) };
}

test('a full UI drag frame at 300 objects (SPEC §17: ≤ 8 ms)', async ({ page, browser }, info) => {
  await openApp(page);
  await page.getByLabel('Example').selectOption('stress-300');
  await page.waitForTimeout(500);
  const p = await screenOf(page, -4.5, -2.5);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.evaluate(() => {
    window.__drag = async (x0, y0, frames) => {
      const canvas = document.querySelector('canvas.board');
      if (canvas === null) throw new Error('no canvas');
      for (let i = 0; i < frames; i++) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            performance.mark(`gm-frame-${String(i)}`);
            const a = (2 * Math.PI * i) / 60;
            const init = {
              bubbles: true,
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true,
              buttons: 1,
            };
            canvas.dispatchEvent(
              new PointerEvent('pointermove', {
                ...init,
                clientX: x0 + 30 + 20 * Math.cos(a),
                clientY: y0 + 20 * Math.sin(a),
              }),
            );
            resolve();
          });
        });
      }
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));
      performance.mark(`gm-frame-${String(frames)}`);
    };
  });
  await browser.startTracing(page, {
    categories: ['toplevel', 'devtools.timeline', 'blink.user_timing', 'blink', 'cc'],
  });
  await page.evaluate(([x, y, n]) => window.__drag?.(x, y, n), [
    p.x,
    p.y,
    FRAMES + WARMUP,
  ] as const);
  const trace = await browser.stopTracing();
  await page.mouse.up();
  const costs = frameCosts(trace).slice(WARMUP);
  const app = stats(costs.map((c) => c.total - c.raster));
  const json = JSON.stringify({
    objects: 300,
    app,
    raster: stats(costs.map((c) => c.raster)),
    total: stats(costs.map((c) => c.total)),
  });
  info.annotations.push({ type: 'drag-frame', description: json });
  console.warn(`full UI drag frame (${info.project.name}): ${json}`);
  expect(app.frames).toBe(FRAMES);
  // The drag moved the point (one history entry at the end).
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  expect(app.median).toBeLessThanOrEqual(8);
});
