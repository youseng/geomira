/** Applying source on pointer-down must preserve the physical input target. ADR-0074. */
import { expect, test } from '@playwright/test';
import { command, dragWorld, openApp, text, textArea, tool } from './helpers';
import { nativeWorldPoint, pointText } from './native-pointer';

test('a draft applied by native canvas input preserves its canvas bounds and drag history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openApp(page, './index.html');
  for (const line of ['A=(0,0)', 'B=(4,0)', 'C=(1,3)']) await command(page, line);
  await tool(page, 'Move');
  const area = await textArea(page);
  await area.fill((await area.inputValue()).replace('C = (1, 3)', 'C = (2, 3)'));
  await expect(page.getByRole('status').filter({ hasText: 'Unapplied text draft' })).toBeVisible();
  const canvas = page.getByLabel('Geometry canvas');
  await canvas.scrollIntoViewIfNeeded();
  const before = await canvas.boundingBox();
  if (before === null) throw new Error('missing canvas');
  const actual = await nativeWorldPoint(page, () => dragWorld(page, [4, 0], [5, 1]));
  expect(await canvas.boundingBox()).toEqual(before);
  await expect(page.getByRole('status').filter({ hasText: 'Unapplied text draft' })).toHaveCount(0);
  const dragged = `@version 1\nA = (0, 0)\nB = ${pointText(actual)}\nC = (2, 3)\n`;
  expect(await text(page)).toBe(dragged);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await text(page)).toBe('@version 1\nA = (0, 0)\nB = (4, 0)\nC = (2, 3)\n');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await text(page)).toBe(dragged);
});

for (const width of [320, 390, 768, 1280]) {
  test(`draft status preserves header and input layout at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await openApp(page, './index.html');
    for (const line of ['A=(0,0)', 'B=(4,0)', 'C=(1,3)']) await command(page, line);
    await tool(page, 'Move');
    const area = await textArea(page);
    await area.fill((await area.inputValue()).replace('C = (1, 3)', 'C = (2, 3)'));
    const status = page.getByRole('status').filter({ hasText: 'Unapplied text draft' });
    await expect(status).toBeVisible();
    const header = page.locator('.topbar');
    const canvas = page.getByLabel('Geometry canvas');
    await canvas.scrollIntoViewIfNeeded();
    const before = { header: await header.boundingBox(), canvas: await canvas.boundingBox() };
    await canvas.click({ position: { x: 12, y: 12 } });
    expect({ header: await header.boundingBox(), canvas: await canvas.boundingBox() }).toEqual(
      before,
    );
    await expect(status).toHaveCount(0);
    expect(await text(page)).toBe('@version 1\nA = (0, 0)\nB = (4, 0)\nC = (2, 3)\n');
  });
}
