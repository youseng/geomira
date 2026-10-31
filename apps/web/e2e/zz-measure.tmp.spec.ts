import { expect, test } from '@playwright/test';
import { stressText } from '../src/stress';
import { openApp, textArea } from './helpers';

test('measure typing on the 150-object figure', async ({ page }) => {
  test.setTimeout(120_000);
  await openApp(page, './?dev=1');
  const area = await textArea(page);
  await area.fill(stressText(150));
  await area.press('Control+Enter');
  await expect(area).toHaveValue(/^l\d+ = line/mu);
  await page.evaluate(() => {
    const w = window as unknown as { __ev: unknown[]; __lt: unknown[] };
    w.__ev = [];
    w.__lt = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as PerformanceEventTiming[])
        w.__ev.push({ name: e.name, dur: e.duration, proc: e.processingEnd - e.processingStart });
    }).observe({ type: 'event', durationThreshold: 16, buffered: false } as PerformanceObserverInit);
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__lt.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: 'longtask', buffered: false });
  });
  const at = await area.evaluate((t: HTMLTextAreaElement) => {
    const i = t.value.indexOf('P1 = (-4.5, -2.5)') + 'P1 = (-4.5, -2.5)'.length;
    t.focus();
    t.setSelectionRange(i, i);
    return i;
  });
  expect(at).toBeGreaterThan(20);
  const drawn = await page.getByTestId('object-counts').innerText();
  await page.keyboard.type('\nQ1 = (1,2)', { delay: 60 });
  await page.waitForTimeout(1500);
  await page.keyboard.type('\nQ2 = (2,1)', { delay: 60 });
  await page.waitForTimeout(1500);
  expect(await page.getByTestId('object-counts').innerText()).not.toBe(drawn);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __ev: { name: string; dur: number; proc: number }[]; __lt: unknown[] };
    return { ev: w.__ev, lt: w.__lt };
  });
  console.log(JSON.stringify(r));
});
