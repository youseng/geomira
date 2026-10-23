import { expect, test } from '@playwright/test';
import { command, openApp } from './helpers';

/** Bug-fix round (ADR-0028): keyboard and focus on the desktop. */

test('Enter works on a focused button and tab (the shortcut does not take it)', async ({
  page,
}) => {
  await openApp(page);
  const exportButton = page.getByRole('button', { name: 'Export', exact: true });
  await exportButton.focus();
  await page.keyboard.press('Enter');
  await expect(exportButton).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  const claims = page.getByRole('tab', { name: 'Claims', exact: true });
  await claims.focus();
  await page.keyboard.press('Enter');
  await expect(claims).toHaveAttribute('aria-selected', 'true');
  await command(page, 'A = (0, 0)');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await undo.focus();
  await page.keyboard.press('Enter');
  await expect(undo).toBeDisabled();
});

test('after choosing an example the canvas has the focus: a letter is no other example', async ({
  page,
}) => {
  await openApp(page);
  const examples = page.getByLabel('Example', { exact: true });
  await examples.selectOption('euler-line');
  await expect(page.getByLabel('Geometry canvas')).toBeFocused();
  const text = page.getByLabel('Text', { exact: true });
  await expect(text).toHaveValue(/^@title "Euler line"$/mu);
  // With the focus left on the list, "r" opened radical-axes (type-ahead).
  await page.keyboard.press('r');
  await page.keyboard.press('m');
  await expect(text).toHaveValue(/^@title "Euler line"$/mu);
  // A letter or an arrow on the focused, closed list does not open an example either.
  await examples.focus();
  await page.keyboard.press('m');
  await page.keyboard.press('ArrowDown');
  await expect(text).toHaveValue(/^@title "Euler line"$/mu);
});
