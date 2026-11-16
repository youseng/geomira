import { expect, test } from '@playwright/test';
import { openApp, tool, text } from './helpers';

async function fractionalPointer(page: import('@playwright/test').Page) {
  const errors = await openApp(page, './index.html');
  await tool(page, 'Point');
  const canvas = page.getByLabel('Geometry canvas');
  await canvas.evaluate((c) => {
    c.style.width = 'calc(100% - 0.35px)';
    c.style.height = 'calc(100% - 22.35px)';
  });
  await page.waitForTimeout(100);
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('missing canvas');
  const metrics = await canvas.evaluate((c) => ({
    width: c.clientWidth,
    height: c.clientHeight,
    cx: Number(c.dataset.cx),
    cy: Number(c.dataset.cy),
    zoom: Number(c.dataset.zoom),
  }));
  await canvas.evaluate((c) => {
    c.addEventListener('pointerup', (event) => {
      const e = event as PointerEvent;
      c.setAttribute('data-delivered-x', String(e.clientX));
      c.setAttribute('data-delivered-y', String(e.clientY));
    });
  });
  // Integer physical coordinates work in every driver; the canvas origin/extent may be fractional.
  await page.mouse.click(Math.floor(box.x + box.width / 2), Math.floor(box.y + box.height / 2));
  const delivered = await canvas.evaluate((c) => ({
    x: Number(c.getAttribute('data-delivered-x')),
    y: Number(c.getAttribute('data-delivered-y')),
  }));
  const round = (v: number) => String(Math.round(v * 10000) / 10000);
  const x =
    metrics.cx +
    (((delivered.x - box.x) / box.width) * metrics.width - metrics.width / 2) / metrics.zoom;
  const y =
    metrics.cy -
    (((delivered.y - box.y) / box.height) * metrics.height - metrics.height / 2) / metrics.zoom;
  expect(await text(page)).toContain(`A = (${round(x)}, ${round(y)})`);
  expect(errors).toEqual([]);
}

test('fractional canvas CSS bounds map delivered native input to the drawn logical view', async ({
  page,
}) => {
  await fractionalPointer(page);
});
test.describe('fractional DPR raster', () => {
  test.use({ deviceScaleFactor: 1.25 });
  test('uses the same native pointer projection after backing-store rounding', async ({ page }) => {
    await fractionalPointer(page);
  });
});
