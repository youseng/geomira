import { expect, test } from '@playwright/test';
import { command, expectLines, openApp, tab, text, textArea } from './helpers';

/** Run 8b flows (SPEC §12, §15): text panel, objects, style, share links, autosave, debug report. */

const CURRENT = 'geomira.autosave.current';

test('text panel: two-way, with per-line diagnostics', async ({ page }) => {
  await openApp(page);
  await command(page, 'A = (0, 0)');
  await tab(page, 'Text');
  const area = page.getByLabel('Text', { exact: true });
  const t = await area.inputValue();
  await area.fill(`${t}B = (2, 0)\nM = midpoint(A, Q)\n`);
  const diags = page.getByRole('list', { name: 'Diagnostics' });
  await expect(diags).toContainText(/Line 4, column \d+: .*Q/u);
  await expect(page.getByRole('button', { name: 'Apply text' })).toBeDisabled();
  await area.fill(`${t}B = (2, 0)\nM = midpoint(A, B)\n`);
  await expect(diags).toHaveCount(0);
  await page.getByRole('button', { name: 'Apply text' }).click();
  await tab(page, 'Objects');
  await expect(page.getByRole('button', { name: 'M', exact: true })).toBeVisible();
  // The GUI changes the text: a command adds its line.
  await command(page, 'N = midpoint(A, M)');
  await expectLines(page, 'N = midpoint(A, M)');
});

test('objects panel lists Undefined reasons; style panel edits the text', async ({ page }) => {
  await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (2, 0)', 'X = intersect(line(A, B), line(A, B))'])
    await command(page, line);
  await tab(page, 'Objects');
  await expect(page.locator('.object-row').filter({ hasText: 'intersect' })).toContainText(
    'undefined: ',
  );
  await page.getByRole('button', { name: 'B', exact: true }).click();
  await tab(page, 'Style');
  await page.getByLabel('Colour').selectOption('red');
  await page.getByLabel('No image in derived layers (noimage)').check();
  await expectLines(page, 'B = (2, 0) [color=red, noimage]');
});

test('opening a share link keeps the autosave; Restore previous figure brings it back', async ({
  page,
  context,
}) => {
  await openApp(page);
  for (const line of ['P = (1, 1)', 'Q = (3, 2)', 's = segment(P, Q)']) await command(page, line);
  await expectLines(page, 's = segment(P, Q)');
  const linked = await text(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page
    .getByRole('dialog', { name: 'Share link' })
    .getByRole('textbox')
    .inputValue();
  expect(link).toMatch(/#s=[A-Za-z0-9+\-$]+$/u);
  await page.getByRole('button', { name: 'Close' }).click();
  // The user's own figure, autosaved.
  await command(page, 'R = midpoint(P, Q)');
  await expectLines(page, 'R = midpoint(P, Q)');
  const own = await text(page);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), CURRENT)).toBe(own);

  const other = await context.newPage();
  await openApp(other, link);
  await expect(await textArea(other)).toHaveValue(linked);
  // Opening the link did not overwrite the autosave.
  await other.waitForTimeout(500);
  expect(await other.evaluate((k) => localStorage.getItem(k), CURRENT)).toBe(own);
  await other.getByRole('button', { name: 'Export', exact: true }).click();
  await other.getByRole('button', { name: 'Restore previous figure' }).click();
  await expect(await textArea(other)).toHaveValue(own);
  // And back: the link's figure is now the previous one.
  await other.getByRole('button', { name: 'Export', exact: true }).click();
  await other.getByRole('button', { name: 'Restore previous figure' }).click();
  await expect(await textArea(other)).toHaveValue(linked);
});

test('a damaged share link is refused with its reason; the autosave opens instead', async ({
  page,
  context,
}) => {
  await openApp(page);
  await command(page, 'P = (1, 1)');
  await expectLines(page, 'P = (1, 1)');
  const own = await text(page);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), CURRENT)).toBe(own);
  const other = await context.newPage();
  await openApp(other, './#s=not*a*link');
  await expect(
    other.getByRole('status').filter({ hasText: 'The link could not be opened' }),
  ).toContainText('the link cannot be read');
  await expect(await textArea(other)).toHaveValue(own);
});

test('the debug report is reachable from the page and from an internal error', async ({ page }) => {
  await openApp(page);
  await command(page, 'A = (0, 0)');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('button', { name: 'Debug report' }).click();
  const report = page.getByRole('dialog', { name: 'Debug report' }).getByRole('textbox');
  await expect(report).toHaveValue(/^# GEOMIRA debug report\n/u);
  await expect(report).toHaveValue(/A = \(0, 0\)/u);
  await page.getByRole('button', { name: 'Close' }).click();
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('a test of the error path');
    });
  });
  const banner = page.getByRole('alert').filter({ hasText: 'Internal error' });
  await expect(banner).toContainText('a test of the error path');
  await expect(banner.getByRole('button', { name: 'Copy debug report' })).toBeVisible();
});
