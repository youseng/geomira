import { expect, test } from '@playwright/test';
import { clickWorld, command, expectLines, openApp, screenOf, tab, text } from './helpers';

/**
 * ADR-0060: several objects at once, and layers from the panel. Shift+click and Ctrl+click
 * build a selection on the canvas; the selection bar hides it, takes its labels off and moves
 * it to a layer, each as one undo; the Layers panel makes a layer and renames it; an object
 * row's eye shows a hidden object again; Ctrl+A selects what is drawn and Delete removes it.
 */
const FIGURE = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'ω = circle(A, B, C)'];

async function extendClick(page: import('@playwright/test').Page, x: number, y: number) {
  const p = await screenOf(page, x, y);
  await page.keyboard.down('Shift');
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up('Shift');
}

test('Shift+click selects several objects; the bar hides them in one undo', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of FIGURE) await command(page, line);
  const bar = page.getByRole('toolbar', { name: 'Selection' });
  await expect(bar).toHaveCount(0);
  await clickWorld(page, 0, 0);
  await extendClick(page, 4, 0);
  await expect(bar).toContainText('A, B');
  await bar.getByRole('button', { name: 'Hide', exact: true }).click();
  await expectLines(page, 'A = (0, 0) [hidden]', 'B = (4, 0) [hidden]');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectLines(page, 'A = (0, 0)', 'B = (4, 0)');
  expect(errors).toEqual([]);
});

test('a new layer from the panel: made active, renamed, and the selection moved to it', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of FIGURE) await command(page, line);
  await tab(page, 'Layers');
  await page.getByRole('button', { name: 'New layer', exact: true }).click();
  await expectLines(page, '@layer layer1');
  await tab(page, 'Layers');
  await expect(page.getByLabel('Build new objects in layer 2')).toBeChecked();
  const name = page.getByLabel('Name of layer 2', { exact: true });
  await name.fill('aux');
  await name.press('Enter');
  await expectLines(page, '@layer aux');
  // A name the language does not take is refused in place, with the reason.
  await tab(page, 'Layers');
  await page.getByLabel('New layer name', { exact: true }).fill('aux');
  await expect(page.getByRole('alert')).toContainText('the layer name aux is already used');
  await expect(page.getByRole('button', { name: 'New layer', exact: true })).toBeDisabled();
  await page.getByLabel('New layer name', { exact: true }).fill('');

  await page.getByLabel('Build new objects in layer 1').check();
  await clickWorld(page, 0, 0);
  await extendClick(page, 1, 3);
  await page.getByRole('button', { name: 'Move the selection to layer 2', exact: true }).click();
  await expectLines(page, 'A = (0, 0) [layers=aux]', 'C = (1, 3) [layers=aux]', 'B = (4, 0)');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectLines(page, 'A = (0, 0)', 'C = (1, 3)');
  expect(errors).toEqual([]);
});

test('the eye of an object row; Ctrl+A and Delete', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of FIGURE) await command(page, line);
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 'Hide ω', exact: true }).click();
  await expectLines(page, 'ω = circle(ABC) [hidden]');
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 'Show ω', exact: true }).click();
  await expectLines(page, 'ω = circle(ABC)');

  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press('Control+a');
  await expect(page.getByRole('toolbar', { name: 'Selection' })).toContainText('4 objects');
  await page.keyboard.press('Delete');
  expect((await text(page)).trim()).toBe('@version 1');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectLines(page, 'A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'ω = circle(ABC)');
  expect(errors).toEqual([]);
});
