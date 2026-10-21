import { expect, test, type Page } from '@playwright/test';
import { command, expectLines, openApp, screenOf, tab } from './helpers';

/** Run 8b (SPEC §15): a phone, 390×664, by touch: pan, pinch, drag and the panels. Mobile project. */

type Touch = { x: number; y: number; id: number };

/** Touch input through the Chrome DevTools Protocol (Playwright has no multi-touch API). */
async function touches(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Touch[]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id })),
    });
  /** Moves the fingers from `from` to `to` in `steps` steps. */
  const gesture = async (from: Touch[], to: Touch[], steps = 8) => {
    await send('touchStart', from);
    for (let i = 1; i <= steps; i++)
      await send(
        'touchMove',
        from.map((f, k) => {
          const t = to[k] ?? f;
          return {
            id: f.id,
            x: f.x + ((t.x - f.x) * i) / steps,
            y: f.y + ((t.y - f.y) * i) / steps,
          };
        }),
      );
    await send('touchEnd', []);
  };
  return { gesture };
}

async function viewport(page: Page) {
  return page.getByLabel('Geometry canvas').evaluate((c) => ({
    cx: Number(c.getAttribute('data-cx')),
    cy: Number(c.getAttribute('data-cy')),
    zoom: Number(c.getAttribute('data-zoom')),
  }));
}

async function figure(page: Page) {
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'poly = polygon(A, B, C)'])
    await command(page, line);
  await page.getByRole('button', { name: 'Fit' }).click();
}

test('pan with one finger, pinch with two', async ({ page }) => {
  await openApp(page);
  await figure(page);
  const t = await touches(page);
  const box = await page.getByLabel('Geometry canvas').boundingBox();
  if (box === null) throw new Error('no canvas');
  // An empty corner of the canvas: one finger pans.
  const v0 = await viewport(page);
  const p = { x: box.x + 20, y: box.y + box.height - 20, id: 1 };
  await t.gesture([p], [{ ...p, x: p.x + 60, y: p.y - 30 }]);
  const v1 = await viewport(page);
  expect(v1.zoom).toBe(v0.zoom);
  expect(v1.cx).toBeCloseTo(v0.cx - 60 / v0.zoom, 6);
  expect(v1.cy).toBeCloseTo(v0.cy - 30 / v0.zoom, 6);
  // Two fingers spreading to twice their distance zoom in by 2.
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const a = { x: mid.x - 40, y: mid.y, id: 1 };
  const b = { x: mid.x + 40, y: mid.y, id: 2 };
  await t.gesture(
    [a, b],
    [
      { ...a, x: mid.x - 80 },
      { ...b, x: mid.x + 80 },
    ],
  );
  const v2 = await viewport(page);
  expect(v2.zoom / v1.zoom).toBeCloseTo(2, 6);
  await expectLines(page, 'B = (4, 0)');
});

test('drag a point with a finger; the text follows', async ({ page }) => {
  await openApp(page);
  await figure(page);
  const t = await touches(page);
  const from = await screenOf(page, 4, 0);
  const to = await screenOf(page, 5, 1);
  await t.gesture([{ ...from, id: 1 }], [{ ...to, id: 1 }]);
  await expectLines(page, 'B = (5, 1)');
});

test('the panels work on a phone: tabs, objects, claims, command bar', async ({ page }) => {
  const errors = await openApp(page);
  await figure(page);
  await command(page, 'claim collinear(A, B, C)');
  await tab(page, 'Objects');
  await expect(page.getByRole('button', { name: 'poly', exact: true })).toBeVisible();
  await tab(page, 'Claims');
  await expect(page.locator('.badge')).toHaveText('false in this figure');
  await tab(page, 'Help');
  await expect(page.getByRole('tabpanel')).toContainText('Undo');
  await tab(page, 'Layers');
  await page.getByLabel('main').uncheck();
  await expect(page.getByLabel('main')).not.toBeChecked();
  const canvas = await page.getByLabel('Geometry canvas').boundingBox();
  expect(canvas?.height ?? 0).toBeGreaterThan(250);
  expect(errors).toEqual([]);
});
