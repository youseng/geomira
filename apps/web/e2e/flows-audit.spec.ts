import { expect, test } from '@playwright/test';
import { command, dragWorld, expectLines, openApp, tab, textArea, tool } from './helpers';

/**
 * Run 10 audit flows (desktop project).
 * A press on the canvas used to start its drag BEFORE the text field lost focus: the text
 * panel's apply-on-blur was then refused ("a drag is in progress"), the refusal vanished with
 * the next drag move, and the edit typed in the text was left as a stale draft (pressing Apply
 * later would have put the dragged point back). The field now loses focus first.
 */
test('an edit typed in the text panel is applied when a drag starts on the canvas', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)']) await command(page, line);
  await tool(page, 'Move');
  const area = await textArea(page);
  const typed = (await area.inputValue()).replace('C = (1, 3)', 'C = (2, 3)');
  await area.fill(typed);
  await expect(area).toBeFocused();
  await dragWorld(page, [4, 0], [5, 1]);
  await expectLines(page, 'C = (2, 3)', 'B = (5, 1)');
  // Both are in the document: one undo takes back the drag only.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectLines(page, 'C = (2, 3)', 'B = (4, 0)');
  expect(errors).toEqual([]);
});

/**
 * Run 10 audit (W4): a text with errors is not applied when the field loses focus, and it used
 * to vanish when another tab was opened (the panel unmounted with its draft). The draft and its
 * diagnostics now stay until applied or reverted, whichever tab was opened meanwhile.
 */
test('a text with errors survives a visit to another tab', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)']) await command(page, line);
  const area = await textArea(page);
  const typed = `${await area.inputValue()}\nC = (1, `;
  await area.fill(typed);
  await expect(page.getByRole('button', { name: 'Apply text' })).toBeDisabled();
  await tab(page, 'Objects');
  const again = await textArea(page);
  await expect(again).toHaveValue(typed);
  await expect(page.getByRole('button', { name: 'Revert text' })).toBeEnabled();
  expect(errors).toEqual([]);
});

/**
 * ADR-0020 (audit proposal P3): a layer locked in the Layers panel keeps its objects from
 * being deleted through the GUI (the refusal is shown); the text still edits them.
 */
test('a locked layer refuses Delete on its objects; the text still edits them', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)']) await command(page, line);
  await tab(page, 'Layers');
  await page.getByRole('checkbox', { name: 'Lock layer 1' }).check();
  await expectLines(page, '@layer main [locked]');
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.notice')).toContainText(
    'A is in the locked layer main: unlock the layer to remove it',
  );
  await expectLines(page, 'A = (0, 0)');
  const area = await textArea(page);
  await area.fill((await area.inputValue()).replace('A = (0, 0)', 'A = (1, 1)'));
  await page.getByRole('button', { name: 'Apply text' }).click();
  await expectLines(page, 'A = (1, 1)');
  expect(errors).toEqual([]);
});
