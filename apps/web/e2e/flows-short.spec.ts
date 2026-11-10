import { expect, test } from '@playwright/test';
import { command, expectLines, openApp, text, textArea, tool, clickWorld } from './helpers';

/**
 * ADR-0061: the short notation. The command bar takes several statements separated by `;`;
 * the text panel shows what was written, short, and no longer rewrites it into the canonical
 * form; what a tool builds appears short too; a typed short text stays as typed.
 */
const EXAMPLE =
  'ABC triangle; O = circumcenter(ABC); w = incircle(ABC); D = foot(A, BC); X = (6, 3); P, Q = tangents(X, w)';

test('the maintainer’s example in the command bar: one undo, shown short', async ({ page }) => {
  const errors = await openApp(page);
  await command(page, EXAMPLE);
  await expectLines(
    page,
    'tri_ABC = polygon(ABC)',
    'O = circumcenter(ABC)',
    'w = incircle(ABC)',
    'D = foot(A, BC)',
    'P, Q = tangents(X, w)',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await text(page)).trim()).toBe('@version 1');
  expect(errors).toEqual([]);
});

test('a short text typed in the panel stays as typed after it is applied', async ({ page }) => {
  const errors = await openApp(page);
  const typed = [
    '@version 1',
    'A = (0, 0)',
    'B = (4, 0)',
    'C = (1, 3)',
    'O = circumcenter(ABC)',
    'D = foot(A, BC)',
    '',
  ].join('\n');
  const area = await textArea(page);
  await area.fill(typed);
  await page.getByRole('button', { name: 'Apply text', exact: true }).click();
  await expect(area).toHaveValue(typed);
  // The figure has the objects: the Objects panel lists O with its definition.
  await page.getByRole('tab', { name: 'Objects', exact: true }).click();
  await expect(page.getByText('circumcenter(A, B, C)')).toBeVisible();
  expect(errors).toEqual([]);
});

test('what a tool builds is written short: the foot of A on line BC', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of ['A = (1, 3)', 'B = (0, 0)', 'C = (4, 0)', 'l = line(B, C)'])
    await command(page, line);
  await tool(page, 'Circumcenter');
  await clickWorld(page, 1, 3);
  await clickWorld(page, 0, 0);
  await clickWorld(page, 4, 0);
  await expectLines(page, 'O = circumcenter(ABC)');
  expect(errors).toEqual([]);
});
