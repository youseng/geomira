import { expect, test, type Page } from '@playwright/test';

/** Run 7 (SPEC §13): the canvas renderer on the development page. */

async function open(page: Page, example: string): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.getByLabel('Example').selectOption(example);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  expect(errors).toEqual([]);
}

const SCREENSHOTS = ['euler-line', 'nine-point-circle', 'reflection-layer'];

for (const id of SCREENSHOTS) {
  test(`screenshot baseline: ${id}`, async ({ page }) => {
    await open(page, id);
    // Small tolerance for anti-aliasing of text across font rasterisers; geometry must match.
    await expect(page.getByLabel('Geometry canvas')).toHaveScreenshot(`${id}.png`, {
      maxDiffPixelRatio: 0.002,
    });
  });
}

test('frame time at 300 objects (SPEC §17: drag frame ≤ 8 ms)', async ({ page }, info) => {
  await open(page, 'stress-300');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Measure frame time' }).click();
  const out = page.getByTestId('frame-times');
  await expect(out).toBeVisible();
  const json = (await out.getAttribute('data-json')) ?? '{}';
  const t = JSON.parse(json) as {
    objects: number;
    drag: { frames: number; median: number; p95: number; max: number };
    pan: { frames: number; median: number; p95: number; max: number };
  };
  info.annotations.push({ type: 'frame-time', description: json });
  console.warn(`frame time (${info.project.name}): ${json}`);
  expect(t.objects).toBe(300);
  expect(t.drag.frames).toBe(120);
  expect(t.drag.median).toBeLessThanOrEqual(8);
  expect(t.pan.median).toBeLessThanOrEqual(8);
});

test.describe('HiDPI', () => {
  test.use({ deviceScaleFactor: 2 });

  test('the canvas has devicePixelRatio device pixels per CSS pixel', async ({ page }) => {
    await open(page, 'euler-line');
    const dims = await page.getByLabel('Geometry canvas').evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      return { w: canvas.width, h: canvas.height, cw: canvas.clientWidth, ch: canvas.clientHeight };
    });
    expect(dims.w).toBe(2 * dims.cw);
    expect(dims.h).toBe(2 * dims.ch);
  });
});

test('hiding the source layer draws the coincident images (image only view)', async ({ page }) => {
  await open(page, 'reflection-layer');
  await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  const panel = page.getByLabel('Figure');
  await expect(panel).toContainText('coincident images hidden');
  const before = await panel.textContent();
  expect(before).toMatch(/[1-9]\d* coincident images hidden/);
  await page.getByLabel('main').uncheck();
  await expect(panel).toContainText('0 coincident images hidden');
});

test('pan, zoom and fit change the picture; fit restores it', async ({ page }) => {
  await open(page, 'euler-line');
  const canvas = page.getByLabel('Geometry canvas');
  const fitted = await canvas.screenshot();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect((await canvas.screenshot()).equals(fitted)).toBe(false);
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no canvas box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Fit' }).click();
  await page.mouse.move(0, 0);
  expect((await canvas.screenshot()).equals(fitted)).toBe(true);
});
