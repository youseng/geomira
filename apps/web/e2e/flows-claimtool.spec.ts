import { expect, test } from '@playwright/test';
import { claimItem, clickWorld, command, expectLines, openApp, tab, tool } from './helpers';

/**
 * ADR-0051 (maintainer request, item 7): claims from the GUI. The cevians AP, BQ, CR of a
 * triangle, not drawn, claimed concurrent with the Claim tool by picking their points; a kind
 * with a number from the tool's field; the claim box's forms, completions and what it could not
 * read. Desktop.
 */

const FIGURE = [
  'A = (0, 3)',
  'B = (-3, -1)',
  'C = (3, -1)',
  'P = midpoint(B, C)',
  'Q = midpoint(C, A)',
  'R = midpoint(A, B)',
];

const AT: Readonly<Record<string, readonly [number, number]>> = {
  A: [0, 3],
  B: [-3, -1],
  C: [3, -1],
  P: [0, -1],
  Q: [1.5, 1],
  R: [-1.5, 1],
};

async function pick(page: import('@playwright/test').Page, ...names: string[]): Promise<void> {
  for (const n of names) {
    const [x, y] = AT[n] ?? [0, 0];
    await clickWorld(page, x, y);
  }
}

test('the Claim tool: concurrent cevians by their points, then Finish', async ({ page }) => {
  await openApp(page);
  for (const line of FIGURE) await command(page, line);
  await tool(page, 'Claim');
  await page.getByLabel('Claim kind').selectOption('concurrent');
  const status = page.locator('.statusbar [role="status"]');
  await expect(status).toHaveText('Claim: concurrent: line (or two points)');
  await pick(page, 'A');
  await expect(status).toHaveText('Claim: concurrent: the second point of the line');
  await pick(page, 'P', 'B', 'Q', 'C', 'R');
  await expect(status).toHaveText('Claim: concurrent: line (or two points), or Finish');
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await tab(page, 'Claims');
  const item = claimItem(page, 'concurrent');
  await expect(item.locator('.badge')).toHaveText('true in this figure');
  await tab(page, 'Text');
  await expectLines(page, 'claim concurrent(line(A, P), line(B, Q), line(C, R))');
});

test('the Claim tool: a kind with a number takes it from the field', async ({ page }) => {
  await openApp(page);
  for (const line of FIGURE) await command(page, line);
  await tool(page, 'Claim');
  await page.getByLabel('Claim kind').selectOption('length');
  const field = page.getByLabel('k in AB = k·CD');
  await expect(field).toHaveValue('1');
  await field.fill('2');
  await pick(page, 'B', 'C', 'Q', 'R');
  await tab(page, 'Text');
  await expectLines(page, 'claim BC = 2·QR');
  await tab(page, 'Claims');
  await expect(claimItem(page, 'BC').locator('.badge')).toHaveText('true in this figure');
});

test('the claim box: its forms, completions, and what it could not read', async ({ page }) => {
  await openApp(page);
  for (const line of FIGURE) await command(page, line);
  const box = page.getByLabel('Claim to test');
  await box.focus();
  const forms = page.getByRole('listbox', { name: 'Forms it reads' });
  await expect(
    forms.getByRole('option').filter({ hasText: 'AP, BQ, CR concurrent' }),
  ).toBeVisible();
  await box.fill('AP, BQ, CR are concurrent');
  await box.press('Enter');
  const alert = page.locator('.claim-feedback');
  await expect(alert).toContainText('could not read "are"');
  await expect(alert).toContainText('AP, BQ, CR concurrent');
  await box.fill('AP, BQ, CR conc');
  const suggestions = page.getByRole('listbox', { name: 'Suggestions' });
  await expect(suggestions.getByRole('option').first()).toContainText('concyclic');
  await suggestions.getByRole('option').filter({ hasText: 'concurrent' }).click();
  await expect(box).toHaveValue('AP, BQ, CR concurrent ');
  await box.press('Enter');
  await expect(box).toHaveValue('');
  await expect(claimItem(page, 'concurrent').locator('.badge')).toHaveText('true in this figure');
});
