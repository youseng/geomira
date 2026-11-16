import { expect, test, type Page } from '@playwright/test';
import { command, openApp, screenOf, text } from './helpers';
async function outsideFit(page: Page) {
  // The floating card may cover the canvas Fit control on narrow screens.
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: /^Fit the figure/u }).click();
}
async function setup(page: Page) {
  await openApp(page);
  for (const line of ['A=(0,0)', 'B=(4,0)', 'C=(1,3)']) await command(page, line);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
}
async function card(page: Page, x = 1, y = 3) {
  const hide = page.getByRole('button', { name: 'Hide panels', exact: true });
  if ((page.viewportSize()?.width ?? 1280) <= 760 && (await hide.isVisible())) await hide.click();
  const point = await screenOf(page, x, y);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  return page.getByRole('dialog', { name: /^Style of/u });
}
for (const close of ['canvas', 'Fit', 'close', 'Rename', 'Tab', 'Enter']) {
  test(`a valid rename commits once on ${close} dismissal`, async ({ page }) => {
    await setup(page);
    const c = await card(page);
    await c.getByLabel('Name', { exact: true }).fill('P');
    if (close === 'canvas') {
      const p = await page.getByLabel('Geometry canvas').evaluate((canvas) => {
        const r = canvas.getBoundingClientRect();
        for (const x of [r.left + 4, r.right - 4])
          for (const y of [r.bottom - 8, r.top + r.height / 2, r.top + 8])
            if (document.elementFromPoint(x, y) === canvas) return { x, y };
        throw new Error('No exposed canvas point outside the card');
      });
      await page.mouse.click(p.x, p.y);
    } else if (close === 'Rename')
      await c.getByRole('button', { name: 'Rename', exact: true }).click();
    else if (close === 'Tab' || close === 'Enter')
      await c.getByLabel('Name', { exact: true }).press(close);
    else if (close === 'Fit') await outsideFit(page);
    else await c.getByRole('button', { name: 'Close the style card' }).click();
    await expect.poll(() => text(page)).toContain('P = (1, 3)');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => text(page)).toContain('C = (1, 3)');
  });
}
test('undo replaces label/numeric/digits fields without resurrecting undone labels', async ({
  page,
}) => {
  await setup(page);
  const c = await card(page);
  const label = c.getByLabel('Label text', { exact: true });
  await label.fill('foo');
  await c.focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(label).toHaveValue('');
  await c.getByLabel('Show the label', { exact: true }).uncheck();
  await c.getByLabel('Show the label', { exact: true }).check();
  await expect(label).toHaveValue('');
  await c.locator('summary').click();
  const z = c.getByLabel('Drawing order z', { exact: true });
  await z.fill('3');
  await c.focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(z).toHaveValue('');
});

test('invalid outside-close gives a persistent reason; Escape commits a valid name', async ({
  page,
}) => {
  await setup(page);
  let c = await card(page);
  await c.getByLabel('Name', { exact: true }).fill('A');
  await outsideFit(page);
  await expect(page.locator('.notice').filter({ hasText: 'was not applied' })).toBeVisible();
  await expect.poll(() => text(page)).toContain('C = (1, 3)');
  const hide = page.getByRole('button', { name: 'Hide panels', exact: true });
  if ((page.viewportSize()?.width ?? 1280) <= 760 && (await hide.isVisible())) await hide.click();
  await page.getByRole('button', { name: 'Properties', exact: true }).click();
  c = page.getByRole('dialog', { name: /^Style of/u });
  await c.getByLabel('Name', { exact: true }).fill('P');
  await page.keyboard.press('Escape');
  await expect.poll(() => text(page)).toContain('P = (1, 3)');
});

test('opening another card commits the previous object, and numeric partial input stays local', async ({
  page,
}) => {
  await setup(page);
  let c = await card(page);
  await c.getByLabel('Name', { exact: true }).fill('P');
  c = await card(page, 0, 0);
  await expect(c).toHaveAccessibleName('Style of A');
  await c.locator('summary').click();
  const z = c.getByLabel('Drawing order z', { exact: true });
  await z.fill('-');
  await expect(z).toHaveValue('-');
  await z.fill('1.');
  await expect(z).toHaveValue('1.');
  await c.focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(z).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect.poll(() => text(page)).toContain('P = (1, 3)');
});

test('an inherited-hidden image eye and properties agree with undo and source preservation', async ({
  page,
}) => {
  await setup(page);
  await command(page, 'style C [hidden]');
  await command(page, 't=reflect(line(A,B))');
  await command(page, '@layer inv=image(t,main)');
  await page.getByRole('tab', { name: 'Objects', exact: true }).click();
  const eye = page.getByRole('button', { name: 'Show C*', exact: true });
  await expect(eye).toBeVisible();
  await eye.click();
  await expect(page.getByRole('button', { name: 'Hide C*', exact: true })).toBeVisible();
  const row = page
    .locator('.object-row')
    .filter({ has: page.getByRole('button', { name: 'C*', exact: true }) });
  await row.click({ button: 'right' });
  const c = page.getByRole('dialog', { name: 'Style of C*', exact: true });
  await expect(c.getByRole('checkbox', { name: 'Shown', exact: true })).toBeChecked();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show C*', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show C', exact: true })).toBeVisible();
});

test('measurement decimals follow undo, redo and reset without remounting the card', async ({
  page,
}, testInfo) => {
  await setup(page);
  await command(page, 'd=dist(A,B) [show]');
  await page.getByRole('tab', { name: 'Objects', exact: true }).click();
  await page.getByRole('button', { name: 'Measurement d', exact: true }).click({ button: 'right' });
  const c = page.getByRole('dialog', { name: 'Style of d', exact: true });
  await c.locator('summary').click();
  const digits = c.getByLabel('Decimals (0–10, empty = 2)', { exact: true });
  await digits.fill('5');
  await c.focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(digits).toHaveValue('');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(digits).toHaveValue('5');
  await c.screenshot({ path: testInfo.outputPath('properties-after-undo.png') });
  await c.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(digits).toHaveValue('');
});
