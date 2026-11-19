import { nativeWorldPoint, pointText } from './native-pointer';
/** ADR-0074: the ordinary workspace remains usable across input modes and sizes. */
import { expect, test, type Page } from '@playwright/test';
import { viewAction, clickWorld, command, openApp, screenOf, tab, text, tool } from './helpers';

async function usable(page: Page, locator: ReturnType<Page['getByRole']>) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const size = page.viewportSize();
  if (box === null || size === null) throw new Error('missing bounds');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
}

for (const width of [320, 390, 760, 768, 820, 1024, 1440]) {
  test(`workspace reaches every header action at ${String(width)} pixels`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await openApp(page);
    await command(page, 'A=(0,0)');
    for (const name of [/^File: /u, 'Undo', 'Redo', 'View', 'Export', 'More actions'])
      await usable(page, page.getByRole('button', { name, exact: true }));
    const header = page.getByRole('banner');
    for (const name of ['Zoom in', 'Zoom out', 'Fit']) {
      const control = header.getByRole('button', { name, exact: true });
      await usable(page, control);
      await control.click({ trial: true });
    }
    const search = page.getByRole('combobox', { name: 'Find a tool' });
    await search.click({ trial: true });
    expect((await search.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('button', { name: 'Randomize', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Triangle type', { exact: true })).toHaveCount(0);
    if (width >= 768) {
      const positions = await page.getByRole('banner').evaluate((header) =>
        [
          ...header.querySelectorAll(
            '.document-trigger,.history-group button,.tool-search input,.zoomctl button,.header-actions > .menu-wrap > button',
          ),
        ].map((control) => {
          const box = control.getBoundingClientRect();
          return box.y + box.height / 2;
        }),
      );
      expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
    }
    const canvas = await page.getByLabel('Geometry canvas').boundingBox();
    if (canvas === null) throw new Error('no canvas');
    expect(canvas.y).toBe((await page.getByRole('main').boundingBox())?.y);
    expect(canvas.width).toBeGreaterThanOrEqual(width <= 760 ? width - 2 : 300);
    expect(canvas.height).toBeGreaterThan(180);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
    if (width <= 760)
      for (const name of [/^File: /u, 'Undo', 'Redo', 'View', 'Export', 'More actions']) {
        const button = await page.getByRole('button', { name, exact: true }).boundingBox();
        expect(button?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(button?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
  });
}

test('sidebar collapse and resize preserve drafts; reload restores layout and mapping', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await command(page, 'A=(0,0)');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  const area = page.getByLabel('Text', { exact: true });
  await area.fill('A=(0,0)\nthis is an invalid draft');
  const before = await area.inputValue();
  await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
  await expect(page.getByRole('tabpanel')).not.toBeVisible();
  await viewAction(page, 'Show panels');
  await expect(area).toHaveValue(before);
  const separator = page.getByRole('separator', { name: 'Resize panels' });
  await separator.focus();
  const initial = await separator.getAttribute('aria-valuenow');
  await page.keyboard.press('ArrowLeft');
  expect(await separator.getAttribute('aria-valuenow')).not.toBe(initial);
  await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'View', exact: true })).toBeVisible();
  await tool(page, 'Point');
  const at = await screenOf(page, 2, 1);
  const actual = await nativeWorldPoint(page, () => page.mouse.click(at.x, at.y));
  await viewAction(page, 'Show panels');
  expect(await text(page)).toContain(`B = ${pointText(actual)}`);
});

test('search and recent tools use selection inputs; hidden tools never appear', async ({
  page,
}) => {
  await openApp(page);
  for (const line of ['A=(0,0)', 'B=(4,0)', 'C=(0,3)']) await command(page, line);
  await tool(page, 'Move');
  await tab(page, 'Objects');
  for (const [i, name] of ['A', 'B', 'C'].entries())
    await page
      .getByRole('tabpanel')
      .getByRole('button', { name, exact: true })
      .click(i === 0 ? {} : { modifiers: ['Shift'] });
  const search = page.getByRole('combobox', { name: 'Find a tool' });
  await search.fill('circumcentre');
  await search.press('ArrowDown');
  await search.press('Enter');
  expect(await text(page)).toContain('circumcenter(ABC)');
  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
  await expect(
    page
      .getByRole('listbox', { name: 'Recent tools' })
      .getByRole('option')
      .filter({ hasText: 'Circumcenter' }),
  ).toBeVisible();
  await search.fill('claim');
  if (process.env['GEOMIRA_ENGINE_E2E'] !== '1')
    await expect(page.getByRole('listbox', { name: 'Matching tools' })).not.toContainText('Claim');
  await search.fill('no-such-geometry-tool');
  await expect(page.getByRole('status', { name: 'Tool search results' })).toContainText('No tools');
  await search.press('Escape');
  await expect(page.getByRole('listbox', { name: 'Matching tools' })).toHaveCount(0);
});

test('palette has one tab stop, arrow navigation, and named picked inputs', async ({ page }) => {
  await openApp(page);
  await command(page, 'A=(0,0)');
  const toolbar = page.getByRole('toolbar', { name: 'Tools', exact: true });
  await expect(toolbar.locator('button[tabindex="0"]')).toHaveCount(1);
  await toolbar.locator('button[tabindex="0"]').focus();
  await page.keyboard.press('End');
  await expect(toolbar.getByRole('button').last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(toolbar.getByRole('button').first()).toBeFocused();
  await page.keyboard.press(
    (await toolbar.getAttribute('aria-orientation')) === 'horizontal' ? 'ArrowRight' : 'ArrowDown',
  );
  await expect(toolbar.getByRole('button').nth(1)).toBeFocused();
  await tool(page, 'Line');
  await tab(page, 'Objects');
  await page.getByRole('tabpanel').getByRole('button', { name: 'A', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Current tool' })).toContainText('A');
  await expect(page.getByRole('status', { name: 'Current tool' })).toContainText(/second|next/iu);
});

test('explicit Pan and visible Properties preserve figure text', async ({ page }) => {
  await openApp(page);
  await command(page, 'A=(0,0)');
  const before = await text(page);
  if ((page.viewportSize()?.width ?? 1280) <= 760)
    await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
  await viewAction(page, 'Pan canvas');
  const canvas = page.getByLabel('Geometry canvas');
  const a = await screenOf(page, 0, 0);
  const cx = await canvas.getAttribute('data-cx');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 50, a.y + 20, { steps: 5 });
  await page.mouse.up();
  expect(await canvas.getAttribute('data-cx')).not.toBe(cx);
  expect(await text(page)).toBe(before);
  if ((page.viewportSize()?.width ?? 1280) <= 760)
    await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
  await viewAction(page, 'Pan canvas');
  await clickWorld(page, 0, 0);
  await page.getByRole('button', { name: 'Properties', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Style/iu })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await text(page)).toBe(before);
});

test('first-use guide offers safe actions and workspace storage failures do not break controls', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem.bind(localStorage);
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('geomira.workspace')) throw new DOMException('blocked', 'SecurityError');
      set(key, value);
    };
  });
  await openApp(page);
  await expect(page.getByRole('region', { name: 'Getting started' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss getting started', exact: true }).click();
  await command(page, 'A=(0,0)');
  const before = await text(page);
  await viewAction(page, 'Getting started');
  await expect(page.getByRole('button', { name: 'Create a triangle', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Choose a tool', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Find a tool' })).toBeFocused();
  expect(await text(page)).toBe(before);
});

test('short phone sheet exposes the canvas and active field with a small viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 380 });
  await openApp(page);
  await command(page, 'A=(0,0)');
  await tab(page, 'Text');
  await page.getByRole('button', { name: 'Expand panel', exact: true }).click();
  await page.getByRole('button', { name: 'Compact panel', exact: true }).click();
  await page.getByLabel('Text', { exact: true }).scrollIntoViewIfNeeded();
  await usable(page, page.getByLabel('Text', { exact: true }));
  await page.getByRole('button', { name: 'Hide panels', exact: true }).scrollIntoViewIfNeeded();
  await usable(page, page.getByRole('button', { name: 'Hide panels', exact: true }));
  const box = await page.getByRole('tabpanel').boundingBox();
  if (box === null) throw new Error('no sheet');
  expect(box.height).toBeGreaterThanOrEqual(220);
  const canvas = await page.getByLabel('Geometry canvas').boundingBox();
  expect(canvas?.height ?? 0).toBeGreaterThanOrEqual(60);
});
