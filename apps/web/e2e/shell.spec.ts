import { expect, test } from '@playwright/test';

test('shows the title and an empty canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Geomira' })).toBeVisible();
  const canvas = page.getByLabel('Geometry canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});
