import { expect, test } from '@playwright/test';
import { clickWorld, command, commandInput, expectLines, openApp, tab, tool } from './helpers';

/**
 * Run 13 (ADR-0031): a map tool builds the transformation itself with "Transformation only"
 * (the maintainer's note: Reflect, Rotate, Homothety, Translate and Spiral only built one
 * object's image), "Apply transformation" maps objects with it, and the GUI tools over the v1.1
 * kernel tools build what the language writes. Desktop project.
 */

test('Reflect with "Transformation only" builds f = reflect(l); Apply transformation maps C with it', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'l = line(A, B)'])
    await command(page, line);
  await tool(page, 'Reflect');
  await page.getByLabel('Transformation only').check();
  await clickWorld(page, 2, 0);
  await expectLines(page, 'f = reflect(l)');
  await tool(page, 'Apply transformation');
  // The switch belongs to the map tools only.
  await expect(page.getByLabel('Transformation only')).toHaveCount(0);
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 'f', exact: true }).click();
  await clickWorld(page, 1, 3);
  await expectLines(page, 'D = apply(f, C)');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () =>
      (await page.getByLabel('Text', { exact: true }).inputValue()).includes('apply(f, C)'),
    )
    .toBe(false);
  expect(errors).toEqual([]);
});

test('the arc tool builds arc(A, B, C); Shift+Y chooses the symmedian', async ({ page }) => {
  await openApp(page);
  for (const line of ['A = (4, 0)', 'B = (0, 4)', 'C = (-4, 0)']) await command(page, line);
  await tool(page, 'Arc (3 points)');
  await clickWorld(page, 4, 0);
  await clickWorld(page, 0, 4);
  await clickWorld(page, -4, 0);
  await expectLines(page, 'c = arc(A, B, C)');
  await commandInput(page).blur();
  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press('Shift+Y');
  await expect(page.locator('.statusbar')).toContainText('Symmedian');
});
