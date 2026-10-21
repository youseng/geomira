import { expect, test, type Page } from '@playwright/test';
import { openApp, tab } from './helpers';

/**
 * Run 9b (ADR-0016 decision 18): the phone layout at 390 × 664: icon-only top bar, the tab
 * row, the tool strip with its group labels, the command line, panels as a drawer, nothing
 * clipped. Mobile project.
 */

async function nine(page: Page): Promise<void> {
  await page.getByLabel('Example').selectOption('nine-point-circle');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/** Every box lies inside the viewport (nothing clipped off the screen). */
async function inside(page: Page, selector: string): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  const height = page.viewportSize()?.height ?? 0;
  for (const el of await page.locator(selector).filter({ visible: true }).all()) {
    const b = await el.boundingBox();
    if (b === null) throw new Error(`${selector} has no box`);
    expect(b.x, selector).toBeGreaterThanOrEqual(0);
    expect(b.y, selector).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, selector).toBeLessThanOrEqual(width + 0.5);
    expect(b.y + b.height, selector).toBeLessThanOrEqual(height + 0.5);
  }
}

test('screenshot baseline: the phone layout', async ({ page }) => {
  const errors = await openApp(page);
  await nine(page);
  await expect(page).toHaveScreenshot('main-phone.png', { maxDiffPixelRatio: 0.01 });
  expect(errors).toEqual([]);
});

test('nothing is clipped: top bar, tabs, tool strip, command line, drawer', async ({ page }) => {
  await openApp(page);
  await nine(page);
  await inside(page, '.topbar > *');
  await inside(page, '[role="tab"]');
  await inside(page, '.cmdbar');
  await inside(page, '.zoomctl button');
  // The tool strip scrolls sideways; its group labels are there, written vertically.
  const strip = page.locator('.palette');
  await inside(page, '.palette');
  expect(await strip.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  await expect(page.getByRole('group', { name: 'Points' })).toBeVisible();
  const last = page.getByRole('button', { name: 'Claim', exact: true });
  await last.scrollIntoViewIfNeeded();
  await inside(page, '.palette [role="toolbar"] [aria-label="Measure / Claim"] .tool');
  // A tab opens its panel over the canvas, which keeps its size; Hide panels closes it.
  const canvas = await page.getByLabel('Geometry canvas').boundingBox();
  await tab(page, 'Objects');
  await expect(page.getByRole('tabpanel')).toBeVisible();
  await inside(page, '.side.open');
  expect(await page.getByLabel('Geometry canvas').boundingBox()).toEqual(canvas);
  await page.getByRole('button', { name: 'Hide panels' }).click();
  await expect(page.getByRole('tabpanel')).toBeHidden();
  // Labels hidden on the phone keep their names.
  for (const name of ['Undo', 'Redo', 'Randomize', 'View', 'Export', 'Settings', 'Help'])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
});

test('Randomize and the menus work on a phone', async ({ page }) => {
  await openApp(page);
  await nine(page);
  await tab(page, 'Text');
  const area = page.getByLabel('Text', { exact: true });
  const before = await area.inputValue();
  await page.getByRole('button', { name: 'Hide panels' }).click();
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  await tab(page, 'Text');
  await expect(area).not.toHaveValue(before);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await inside(page, '.menu');
  await expect(page.getByRole('button', { name: 'Share link' })).toBeVisible();
});
