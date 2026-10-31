import { expect, test, type Locator, type Page } from '@playwright/test';
import { command, dragWorld, expectLines, openApp, tab, textArea, tool } from './helpers';

/**
 * ADR-0047: the text applies as you type (desktop project). After a pause a text without errors
 * is applied, the field keeps the text as typed with its caret, a typing session is one undo,
 * and a document change while a pause is pending wins (the audits' hunt item "text debounce
 * racing a drag").
 */

const counts = (page: Page) => page.getByTestId('object-counts');

/** Puts the caret of the field right after `after` (its first occurrence). */
async function caretAfter(area: Locator, after: string): Promise<number> {
  return area.evaluate((t: HTMLTextAreaElement, s: string) => {
    const at = t.value.indexOf(s) + s.length;
    t.focus();
    t.setSelectionRange(at, at);
    return at;
  }, after);
}

const caret = (area: Locator) => area.evaluate((t: HTMLTextAreaElement) => t.selectionStart);

test('typing applies after a pause; the caret stays; one undo takes back the typing session', async ({
  page,
}) => {
  const errors = await openApp(page, './?dev=1');
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)']) await command(page, line);
  const area = await textArea(page);
  const before = await area.inputValue();
  const at = await caretAfter(area, 'C = (1, 3)');
  const drawn = await counts(page).innerText();
  await page.keyboard.type('\nD = (2,2)', { delay: 20 });
  // Applied without leaving the field: the canvas draws D.
  await expect(counts(page)).not.toHaveText(drawn);
  await expect(area).toBeFocused();
  // The field keeps the text as typed (not rewritten to the printed 'D = (2, 2)'), caret too.
  await expect(area).toHaveValue(/^D = \(2,2\)$/mu);
  expect(await caret(area)).toBe(at + '\nD = (2,2)'.length);
  const one = await counts(page).innerText();
  await page.keyboard.type('\nE = (3,3)', { delay: 20 });
  await expect(counts(page)).not.toHaveText(one);
  expect(await caret(area)).toBe(at + '\nD = (2,2)\nE = (3,3)'.length);
  // Leaving the field shows the printed figure; one undo returns to the text before typing.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(area).toHaveValue(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expectLines(page, 'D = (2, 2)', 'E = (3, 3)');
  expect(errors).toEqual([]);
});

test('a text with errors is not applied; its diagnostics stay; Ctrl+Enter keeps the caret', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)']) await command(page, line);
  const area = await textArea(page);
  const at = await caretAfter(area, 'B = (4, 0)');
  await page.keyboard.type('\nM = midpoint(A, Q)', { delay: 20 });
  await page.waitForTimeout(1500);
  const diags = page.getByRole('list', { name: 'Diagnostics' });
  await expect(diags).toContainText(/Line \d+, column \d+: .*Q/u);
  await expect(page.getByRole('button', { name: 'Apply text' })).toBeDisabled();
  // Fixed: applied after the pause; Ctrl+Enter then prints the figure, the caret stays.
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('B)', { delay: 20 });
  await expect(diags).toHaveCount(0);
  // Typed without the printed space: the field keeps 'midpoint(A,B)' until Ctrl+Enter.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('End');
  await expect(area).toHaveValue(/^M = midpoint\(A,B\)$/mu);
  expect(await caret(area)).toBe(at + '\nM = midpoint(A,B)'.length);
  await page.keyboard.press('Control+Enter');
  // (Not through the Text tab: clicking it would leave the field.)
  await expect(area).toHaveValue(/^M = midpoint\(A, B\)$/mu);
  // The caret stays at the end of its line, now one character longer.
  expect(await caret(area)).toBe(at + '\nM = midpoint(A, B)'.length);
  await expect(area).toBeFocused();
  expect(errors).toEqual([]);
});

test('a drag while a pause is pending wins: the text never comes back over the dragged figure', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)']) await command(page, line);
  await tool(page, 'Move');
  const area = await textArea(page);
  await area.fill((await area.inputValue()).replace('C = (1, 3)', 'C = (2, 3)'));
  // The press leaves the field first (Run 10 audit, W3): the typed edit is in the figure
  // before the drag starts, and the pause pending at that moment never applies afterwards.
  await dragWorld(page, [4, 0], [5, 1]);
  await expectLines(page, 'C = (2, 3)', 'B = (5, 1)');
  await page.waitForTimeout(1500);
  await expectLines(page, 'C = (2, 3)', 'B = (5, 1)');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectLines(page, 'C = (2, 3)', 'B = (4, 0)');
  expect(errors).toEqual([]);
});

test('a link opened while a pause is pending wins: the typed text is kept, not applied', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)']) await command(page, line);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page
    .getByRole('dialog', { name: 'Share link' })
    .getByRole('textbox')
    .inputValue();
  await page.getByRole('button', { name: 'Close' }).click();
  await command(page, 'C = (1, 3)');
  const area = await textArea(page);
  const typed = (await area.inputValue()).replace('A = (0, 0)', 'A = (0, 1)');
  await area.fill(typed);
  // The link opens (hashchange) while the field keeps the focus and the pause is pending.
  await page.evaluate((h) => {
    location.hash = h;
  }, new URL(link).hash);
  await expect(page.getByText('The figure changed meanwhile')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(area).toHaveValue(typed);
  // Leaving the field does not apply it either: the figure is the link's (no C).
  await tab(page, 'Objects');
  await expect(page.getByRole('button', { name: 'B', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C', exact: true })).toHaveCount(0);
  await tab(page, 'Text');
  await page.getByRole('button', { name: 'Revert text' }).click();
  await expectLines(page, 'A = (0, 0)');
  await expect(page.getByText('The figure changed meanwhile')).toHaveCount(0);
  expect(errors).toEqual([]);
});
