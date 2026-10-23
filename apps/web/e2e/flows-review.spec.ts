import { expect, test } from '@playwright/test';
import { claimItem, command, openApp, tab, text } from './helpers';

/** Bug-fix round (ADR-0028): claims, counterexamples, notices and gestures on the desktop. */

test('Test globally after an edit leaves the local verdict marked as of the earlier figure', async ({
  page,
}) => {
  await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'claim CA = CB'])
    await command(page, line);
  await tab(page, 'Claims');
  await claimItem(page, 'claim').getByRole('button', { name: 'Test', exact: true }).click();
  const local = page.locator('.verdict[data-regime="local"]');
  await expect(local.locator('.verdict-line')).toHaveText(/^False/u, { timeout: 60_000 });
  // Edit the figure: the claim now holds in it, and the local verdict is of the earlier one.
  const area = page.getByLabel('Text', { exact: true });
  await tab(page, 'Text');
  await area.fill((await area.inputValue()).replace('C = (1, 3)', 'C = (2, 3)'));
  await page.getByRole('button', { name: 'Apply text' }).click();
  await tab(page, 'Claims');
  await expect(page.locator('.stale-note')).toBeVisible();
  await claimItem(page, 'claim')
    .getByRole('button', { name: 'Test globally', exact: true })
    .click();
  await expect(page.locator('.verdict[data-regime="global"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.stale-note')).toContainText(
    'The local test result is for an earlier version of the figure.',
  );
  await expect(page.locator('.run-box.stale .verdict[data-regime="local"]')).toHaveCount(1);
  await expect(page.locator('.run-box.stale .verdict[data-regime="global"]')).toHaveCount(0);
  expect(await text(page)).toContain('C = (2, 3)');
});
