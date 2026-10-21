import { expect, test } from '@playwright/test';
import { clickWorld, command, expectLines, openApp, text, tool } from './helpers';

/**
 * ADR-0016 decision 21: the Centers group and the triangle circles, built by clicks: the
 * circumcentre from an empty canvas (the clicks create A, B, C), then the incircle on the
 * same three points. The text is the one the command bar writes. Desktop project.
 */

const CLICKS = [
  [0, 0],
  [4, 0],
  [1, 3],
] as const;

test('the circumcentre and the incircle by clicks; the same text as by command', async ({
  page,
  browser,
}) => {
  const errors = await openApp(page);
  const centers = page.getByRole('group', { name: 'Centers', exact: true });
  for (const name of [
    'Centroid',
    'Circumcentre',
    'Incentre',
    'Orthocentre',
    'Nine-point centre',
    'Excentre',
  ])
    await expect(centers.getByRole('button', { name, exact: true })).toBeVisible();
  const circles = page.getByRole('group', { name: 'Circles', exact: true });
  for (const name of ['Circumcircle', 'Incircle', 'Excircle', 'Nine-point circle'])
    await expect(circles.getByRole('button', { name, exact: true })).toBeVisible();

  await tool(page, 'Circumcentre');
  for (const [x, y] of CLICKS) await clickWorld(page, x, y);
  await expectLines(page, 'A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'D = circumcenter(A, B, C)');
  await tool(page, 'Incircle');
  for (const [x, y] of CLICKS) await clickWorld(page, x, y);
  await expectLines(page, 'c = incircle(A, B, C)');
  const byMouse = await text(page);

  const other = await (await browser.newContext()).newPage();
  await openApp(other);
  for (const line of [
    'A = (0, 0)',
    'B = (4, 0)',
    'C = (1, 3)',
    'D = circumcenter(A, B, C)',
    'c = incircle(A, B, C)',
  ])
    await command(other, line);
  await expectLines(other, 'c = incircle(A, B, C)');
  expect(byMouse).toBe(await text(other));
  expect(errors).toEqual([]);
});

test('the centre tools have their keys: 2 is the circumcentre, Shift+N the nine-point circle', async ({
  page,
}) => {
  await openApp(page);
  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Circumcentre', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Shift+N');
  await expect(
    page.getByRole('button', { name: 'Nine-point circle', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('n');
  await expect(page.getByRole('button', { name: 'Angle bisector', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
