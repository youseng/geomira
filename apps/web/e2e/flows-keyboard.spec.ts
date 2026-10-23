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
