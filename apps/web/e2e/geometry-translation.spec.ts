import { expect, test } from '@playwright/test';
import { command, openApp, tab, text } from './helpers';

test('translated unit triangle displays area 0.50', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of [
    'A=(100000000,100000000)',
    'B=(100000001,100000000)',
    'C=(100000000,100000001)',
    's=area(A,B,C) [show]',
  ])
    await command(page, line);
  await tab(page, 'Objects');
  await expect(page.locator('.measurement-row')).toContainText('0.50');
  expect(errors).toEqual([]);
});

test('translated defining point has a drawn tangent and exports the same conic', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of [
    'A=(1000005,1000000)',
    'B=(1000000,1000005)',
    'C=(999995,1000000)',
    'D=(1000000,999995)',
    'E=(1000003,1000004)',
    'k=conic(A,B,C,D,E)',
    't=tangent(A,k)',
  ])
    await command(page, line);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await tab(page, 'Objects');
  const tangent = page
    .locator('.object-row')
    .filter({ has: page.getByRole('button', { name: 't', exact: true }) });
  await expect(tangent).toHaveClass(/status-ok/u);
  await expect(tangent).not.toContainText('not drawable');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  const svg = page
    .getByRole('dialog', { name: 'Export', exact: true })
    .getByLabel('Export content');
  await expect(svg).toHaveValue(/data-name="k"/u);
  await expect(svg).toHaveValue(/data-name="t"/u);
  await page.keyboard.press('Escape');
  const before = await text(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => text(page)).not.toContain('t = tangent');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => text(page)).toBe(before);
  expect(errors).toEqual([]);
});
