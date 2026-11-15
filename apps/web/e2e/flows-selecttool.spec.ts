import { expect, test, type Page } from '@playwright/test';
import { command, expectLines, openApp, screenOf, tool } from './helpers';

/**
 * ADR-0064: select first, then the tool. Objects selected in the Move tool (Shift+click, a
 * box) become the picks of the tool chosen next: three points and Circumcenter build O at
 * once; three points and Circle (center, point) build the circle through them.
 */
const FIGURE = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'];

async function selectPoints(page: Page, ...pts: (readonly [number, number])[]): Promise<void> {
  await tool(page, 'Move');
  for (const [i, [x, y]] of pts.entries()) {
    const p = await screenOf(page, x, y);
    if (i > 0) await page.keyboard.down('Shift');
    await page.mouse.click(p.x, p.y);
    if (i > 0) await page.keyboard.up('Shift');
  }
}

test('three points selected, then Circumcenter: built at once, one undo', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of FIGURE) await command(page, line);
  await selectPoints(page, [0, 0], [4, 0], [1, 3]);
  await expect(page.getByRole('toolbar', { name: 'Selection' })).toContainText('A, B, C');
  await tool(page, 'Circumcenter');
  await expectLines(page, 'O = circumcenter(ABC)');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Text', { exact: true })).not.toHaveValue(/circumcenter/u);
  expect(errors).toEqual([]);
});

test('three points with Circle (center, point): the circle through them', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of FIGURE) await command(page, line);
  await selectPoints(page, [0, 0], [4, 0], [1, 3]);
  await tool(page, 'Circle (center, point)');
  await expectLines(page, 'c_ABC = circle(ABC)');
  expect(errors).toEqual([]);
});
