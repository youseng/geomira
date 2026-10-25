import { expect, test, type Page } from '@playwright/test';
import { command, openApp, tab, textArea } from './helpers';

/**
 * The views UI (SPEC §8.3, §15; v1.1, Run 13): save, show, cycle with ] and [, rename and
 * delete views in the Layers tab. Each is one document edit: it shows in the text and one
 * undo takes it back.
 */

async function canvasZoom(page: Page): Promise<number> {
  return Number(await page.getByLabel('Geometry canvas').getAttribute('data-zoom'));
}

async function saveView(page: Page, name: string): Promise<void> {
  await tab(page, 'Layers');
  await page.getByLabel('New view name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
}

async function auxVisible(page: Page): Promise<boolean> {
  await tab(page, 'Layers');
  return page.getByLabel('aux', { exact: true }).isChecked();
}

test('views: save, show, cycle, rename, delete, undo; each in the text', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of ['@layer aux', 'A = (0, 0)', 'B = (4, 0)', 'M = midpoint(A, B) [layers=aux]'])
    await command(page, line);

  // Save the whole figure at the current zoom.
  const wide = await canvasZoom(page);
  await saveView(page, 'whole');
  await expect(await textArea(page)).toHaveValue(
    new RegExp(
      `^@view whole \\[layers=main,aux\\] \\[viewport=[-0-9.e]+,[-0-9.e]+,${String(wide)}\\]$`,
      'mu',
    ),
  );

  // Hide the aux layer, zoom in, save a second view with Enter in the name field.
  await tab(page, 'Layers');
  await page.getByLabel('aux', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const close = await canvasZoom(page);
  expect(close).not.toBe(wide);
  await page.getByLabel('New view name', { exact: true }).fill('close');
  await page.getByLabel('New view name', { exact: true }).press('Enter');
  await expect(await textArea(page)).toHaveValue(/^@view close \[layers=main,-aux\] /mu);

  // Showing a view sets the layers, writes @viewport and moves the canvas.
  await tab(page, 'Layers');
  await page.getByRole('button', { name: 'Show view whole', exact: true }).click();
  expect(await auxVisible(page)).toBe(true);
  await expect.poll(() => canvasZoom(page)).toBe(wide);
  await expect(await textArea(page)).toHaveValue(/^@viewport /mu);

  // ] switches to the next view, [ back.
  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press(']');
  expect(await auxVisible(page)).toBe(false);
  await expect.poll(() => canvasZoom(page)).toBe(close);
  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press('[');
  expect(await auxVisible(page)).toBe(true);

  // Rename in place.
  await tab(page, 'Layers');
  await page.getByRole('button', { name: 'Rename view close', exact: true }).click();
  const field = page.getByLabel('New name of view close', { exact: true });
  await field.fill('detail');
  await field.press('Enter');
  await expect(await textArea(page)).toHaveValue(/^@view detail \[layers=main,-aux\] /mu);

  // Delete, then one undo brings the view back.
  await tab(page, 'Layers');
  await page.getByRole('button', { name: 'Delete view whole', exact: true }).click();
  await expect(await textArea(page)).not.toHaveValue(/^@view whole /mu);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(await textArea(page)).toHaveValue(/^@view whole /mu);

  // A used name is refused with the reason; nothing changes.
  await saveView(page, 'detail');
  await expect(page.getByText('the view name detail is already used')).toBeVisible();
  expect(errors).toEqual([]);
});
