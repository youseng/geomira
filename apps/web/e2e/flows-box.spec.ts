import { expect, test, type Page } from '@playwright/test';
import { command, expectLines, openApp, screenOf } from './helpers';

/**
 * ADR-0062: with the mouse, a drag on empty canvas in the Move tool draws a selection box
 * (the objects wholly inside are selected; the bar acts on them), and the right button pans;
 * a right click still opens the style card.
 */
const FIGURE = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'l = line(A, B)'];

async function drag(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
  button: 'left' | 'right' = 'left',
): Promise<void> {
  const a = await screenOf(page, from[0], from[1]);
  const b = await screenOf(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button });
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up({ button });
}

const viewOf = (page: Page) =>
  page
    .getByLabel('Geometry canvas')
    .evaluate((c) => [c.getAttribute('data-cx'), c.getAttribute('data-cy')].join(','));

test('a drag on empty canvas selects what is inside the box; the view does not move', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of FIGURE) await command(page, line);
  const before = await viewOf(page);
  const a = await screenOf(page, -1, 4);
  const b = await screenOf(page, 2, -1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await expect(page.locator('.selbox')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.selbox')).toHaveCount(0);
  const bar = page.getByRole('toolbar', { name: 'Selection' });
  await expect(bar).toContainText('A, C');
  expect(await viewOf(page)).toBe(before);
  await bar.getByRole('button', { name: 'Hide', exact: true }).click();
  await expectLines(page, 'A = (0, 0) [hidden]', 'C = (1, 3) [hidden]', 'B = (4, 0)');
  expect(errors).toEqual([]);
});

test('the right button pans; a right click on an object opens its style card', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of FIGURE) await command(page, line);
  const before = await viewOf(page);
  await drag(page, [2, 2], [3, 1], 'right');
  await expect.poll(() => viewOf(page)).not.toBe(before);
  await expect(page.getByRole('toolbar', { name: 'Selection' })).toHaveCount(0);
  await expect(page.locator('.style-card')).toHaveCount(0);
  const c = await screenOf(page, 1, 3);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await expect(page.getByRole('dialog').or(page.locator('.style-card')).first()).toBeVisible();
  expect(errors).toEqual([]);
});
