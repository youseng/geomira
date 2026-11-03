import { expect, test } from '@playwright/test';
import {
  claimItem,
  clickWorld,
  command,
  commandInput,
  expectLines,
  openApp,
  tab,
  text,
  tool,
} from './helpers';

/**
 * ADR-0024 and ADR-0025 (the maintainer's request after Geomdraw): order-free picks, both
 * tangents, polygon sides as lines, typed numbers, and Geomdraw's script and claim forms, by
 * mouse and keyboard in the real page. Desktop project.
 */

const FIGURE = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'triangle ABC', 'ω = circumcircle(ABC)'];

test('the tangent tool from an outside point builds both tangents, circle clicked first', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of [...FIGURE, 'P = (6, 3)']) await command(page, line);
  await tool(page, 'Tangent');
  await expect(page.locator('.statusbar')).toHaveText('Tangent: point and circle, in either order');
  // ω has center (2, 1) and radius √5: its top is (2, 1 + √5).
  await clickWorld(page, 2, 1 + Math.sqrt(5));
  await clickWorld(page, 6, 3);
  const lines = (await text(page)).split('\n').filter((l) => l.includes('tangent_from(P, ω, '));
  expect(lines).toHaveLength(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await text(page)).includes('tangent_from'), { timeout: 5000 })
    .toBe(false);
  expect(errors).toEqual([]);
});

test('a perpendicular from a vertex to a side: the side clicked first, then the vertex', async ({
  page,
}) => {
  await openApp(page);
  for (const line of FIGURE) await command(page, line);
  await commandInput(page).blur();
  await page.keyboard.press('j');
  await expect(page.locator('.statusbar')).toHaveText(
    'Perpendicular: point and line, in either order',
  );
  await clickWorld(page, 2, 0);
  await clickWorld(page, 1, 3);
  await expectLines(page, 's_AB = segment(A, B)', 'l_C = perp(C, s_AB)');
});

test('rotate takes the angle typed in its field', async ({ page }) => {
  await openApp(page);
  for (const line of FIGURE) await command(page, line);
  await commandInput(page).blur();
  await page.keyboard.press('r');
  await page.getByLabel('Angle (degrees)').fill('90');
  await clickWorld(page, 1, 3);
  await clickWorld(page, 0, 0);
  await expectLines(page, 'D = rotate(C, A, 90)');
});

test("Geomdraw's script and claim forms are read and written canonically", async ({ page }) => {
  await openApp(page);
  for (const line of ['points P Q R', 'M = midpoint(QR)', 'X, Y = intersect(PQR, QR)'])
    await command(page, line);
  await expectLines(page, 'M = midpoint(Q, R)');
  const t = await text(page);
  expect(t).toMatch(/^P = \(-?\d+(\.\d)?, -?\d+(\.\d)?\)$/mu);
  expect(t).toMatch(/^X = intersect\(circle\(P, Q, R\), line\(Q, R\), along\(\+\)\)$/mu);
  await page.getByLabel('Claim to test').fill('P, Q, R collinear');
  await page.getByLabel('Claim to test').press('Enter');
  await expect(claimItem(page, 'collinear(P, Q, R)').locator('.badge')).toHaveText(/^false/u);
  await tab(page, 'Text');
  await expectLines(page, 'claim collinear(P, Q, R)');
});
