import { expect, test, type Page } from '@playwright/test';
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

/** The canvas's view (data attributes). */
async function view(page: Page): Promise<string> {
  return page
    .getByLabel('Geometry canvas')
    .evaluate((c) => ['cx', 'cy', 'zoom'].map((k) => c.getAttribute(`data-${k}`)).join(' '));
}

test('Open counterexample fits the view to the sample figure', async ({ page }) => {
  await openApp(page);
  for (const line of ['A = (1, 3)', 'B = (0, 0)', 'C = (4, 0)', 'H = orthocenter(A, B, C)'])
    await command(page, line);
  await command(page, 'claim ∠BHC + ∠BAC = 180');
  await tab(page, 'Claims');
  await claimItem(page, 'claim')
    .getByRole('button', { name: 'Test globally', exact: true })
    .click();
  const global = page.locator('.verdict[data-regime="global"]');
  await expect(global).toBeVisible({ timeout: 60_000 });
  await global.getByRole('button', { name: 'Open counterexample' }).click();
  await expect(claimItem(page, 'claim').locator('.badge')).toHaveText('false in this figure');
  const opened = await view(page);
  // Fit changes nothing: the view was fitted when the sample opened.
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  expect(await view(page)).toBe(opened);
});
