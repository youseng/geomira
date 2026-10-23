import { expect, test, type Page } from '@playwright/test';
import { claimItem, command, openApp, tab, text } from './helpers';

/** Bug-fix round (ADR-0028): claims, counterexamples, notices and gestures on the desktop. */

test('Test globally after an edit leaves the local verdict marked as of the earlier figure', async ({
  page,
}) => {
  await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'claim CA = CB'])
    await command(page, line);
  await tab(page, 'Claims');
  await claimItem(page, 'claim').getByRole('button', { name: 'Test', exact: true }).click();
  const local = page.locator('.verdict[data-regime="local"]');
  await expect(local.locator('.verdict-line')).toHaveText(/^False/u, { timeout: 60_000 });
  // Edit the figure: the claim now holds in it, and the local verdict is of the earlier one.
  const area = page.getByLabel('Text', { exact: true });
  await tab(page, 'Text');
  await area.fill((await area.inputValue()).replace('C = (1, 3)', 'C = (2, 3)'));
  await page.getByRole('button', { name: 'Apply text' }).click();
  await tab(page, 'Claims');
  await expect(page.locator('.stale-note')).toBeVisible();
  await claimItem(page, 'claim')
    .getByRole('button', { name: 'Test globally', exact: true })
    .click();
  await expect(page.locator('.verdict[data-regime="global"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.stale-note')).toContainText(
    'The local test result is for an earlier version of the figure.',
  );
  await expect(page.locator('.run-box.stale .verdict[data-regime="local"]')).toHaveCount(1);
  await expect(page.locator('.run-box.stale .verdict[data-regime="global"]')).toHaveCount(0);
  expect(await text(page)).toContain('C = (2, 3)');
});

/** The canvas's view (data attributes). */
async function view(page: Page): Promise<string> {
  return page
    .getByLabel('Geometry canvas')
    .evaluate((c) => ['cx', 'cy', 'zoom'].map((k) => c.getAttribute(`data-${k}`)).join(' '));
}

test('Open counterexample fits the view to the sample figure', async ({ page }) => {
  await openApp(page);
  for (const line of ['A = (1, 3)', 'B = (0, 0)', 'C = (4, 0)', 'H = orthocenter(A, B, C)'])
    await command(page, line);
  await command(page, 'claim ∠BHC + ∠BAC = 180');
  await tab(page, 'Claims');
  await claimItem(page, 'claim')
    .getByRole('button', { name: 'Test globally', exact: true })
    .click();
  const global = page.locator('.verdict[data-regime="global"]');
  await expect(global).toBeVisible({ timeout: 60_000 });
  await global.getByRole('button', { name: 'Open counterexample' }).click();
  await expect(claimItem(page, 'claim').locator('.badge')).toHaveText('false in this figure');
  const opened = await view(page);
  // Fit changes nothing: the view was fitted when the sample opened.
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  expect(await view(page)).toBe(opened);
});

test('the wheel on the canvas zooms the figure, never the page (pinch is ctrl+wheel)', async ({
  page,
}) => {
  await openApp(page);
  await page.evaluate(() => {
    // Each wheel event that reaches the window: whether the page's own zoom was prevented.
    window.addEventListener('wheel', (e) => {
      document.body.dataset['wheel'] =
        `${document.body.dataset['wheel'] ?? ''}${String(e.defaultPrevented)};`;
    });
  });
  const canvas = page.getByLabel('Geometry canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no canvas box');
  const zoom = () => canvas.getAttribute('data-zoom');
  const before = await zoom();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect.poll(zoom).not.toBe(before);
  expect(await page.locator('body').getAttribute('data-wheel')).toBe('true;');
});

test('the canvas takes the new pixel ratio when it changes (another screen, a zoom)', async ({
  page,
}) => {
  await openApp(page);
  const canvas = page.getByLabel('Geometry canvas');
  const ratio = () =>
    canvas.evaluate((c) => (c instanceof HTMLCanvasElement ? c.width / c.clientWidth : 0));
  const width = await canvas.evaluate((c) => c.clientWidth);
  expect(await ratio()).toBeCloseTo(1, 2);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('no viewport');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    ...viewport,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(2);
  expect(await canvas.evaluate((c) => c.clientWidth)).toBe(width);
  await expect.poll(ratio).toBeCloseTo(2, 2);
});

test('a label typed in the Style panel is one edit, applied on Enter or when leaving', async ({
  page,
}) => {
  await openApp(page);
  await command(page, 'A = (0, 0)');
  await command(page, 'B = (4, 0)');
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await tab(page, 'Style');
  const label = page.getByLabel('Label text');
  await label.pressSequentially('xyz');
  await label.press('Enter');
  expect(await text(page)).toContain('A = (0, 0) [label="xyz"]');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await text(page)).toMatch(/^A = \(0, 0\)$/mu);
  // Leaving the field applies it too.
  await tab(page, 'Style');
  await page.getByLabel('Label text').pressSequentially('pq');
  await tab(page, 'Text');
  expect(await text(page)).toContain('A = (0, 0) [label="pq"]');
});
