/** ADR-0074: the ordinary workspace remains usable across input modes and sizes. */
import { expect, test, type Page } from '@playwright/test';
import { clickWorld, command, openApp, screenOf, tab, text, tool } from './helpers';

async function more(page: Page) {
  const overflow = page.getByRole('button', { name: 'More actions', exact: true });
  if ((await overflow.isVisible()) && (await overflow.getAttribute('aria-expanded')) !== 'true')
    await overflow.click();
}
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
    for (const name of ['File', 'Undo', 'Redo', 'Randomize', 'Export', 'Help'])
      await usable(page, page.getByRole('button', { name, exact: true }));
    await more(page);
    await usable(page, page.getByRole('button', { name: 'Settings', exact: true }));
    await usable(page, page.getByLabel('Triangle type', { exact: true }));
    const canvas = await page.getByLabel('Geometry canvas').boundingBox();
    if (canvas === null) throw new Error('no canvas');
    expect(canvas.width).toBeGreaterThanOrEqual(width <= 760 ? width - 2 : 300);
    expect(canvas.height).toBeGreaterThan(180);
  });
}

test('sidebar collapse, keyboard resize and reload preserve draft, history and mapping', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await command(page, 'A=(0,0)');
  const area = page.getByLabel('Text', { exact: true });
  await area.fill('A=(0,0)\nthis is an invalid draft');
  const before = await area.inputValue();
  await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
  await expect(page.getByRole('tabpanel')).not.toBeVisible();
  await page.getByRole('button', { name: 'Show panels', exact: true }).click();
  await expect(area).toHaveValue(before);
  const separator = page.getByRole('separator', { name: 'Resize panels' });
  await separator.focus();
  const initial = await separator.getAttribute('aria-valuenow');
  await page.keyboard.press('ArrowLeft');
  expect(await separator.getAttribute('aria-valuenow')).not.toBe(initial);
  await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show panels', exact: true })).toBeVisible();
  await tool(page, 'Point');
  const at = await screenOf(page, 2, 1);
  await page.mouse.click(at.x, at.y);
  await page.getByRole('button', { name: 'Show panels', exact: true }).click();
  expect(await text(page)).toContain('(2, 1)');
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
  await page.locator('.recent-tools summary').click();
  await expect(
    page.getByRole('button', { name: 'Recent: Circumcenter', exact: true }),
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
  await page.getByRole('button', { name: 'Pan canvas', exact: true }).click();
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
  await page.getByRole('button', { name: 'Pan canvas', exact: true }).click();
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
  await page.getByRole('button', { name: 'Getting started', exact: true }).click();
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
  await usable(page, page.getByLabel('Text', { exact: true }));
  await usable(page, page.getByRole('button', { name: 'Hide panels', exact: true }));
  const box = await page.getByRole('tabpanel').boundingBox();
  if (box === null) throw new Error('no sheet');
  expect(box.height).toBeLessThan(240);
});
