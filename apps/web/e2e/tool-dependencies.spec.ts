/** ADR-0071: visible construction tools retain dependencies and accept supported inputs. */
import { expect, test, type Page } from '@playwright/test';
import { command, dragWorld, openApp, tab, text, tool } from './helpers';

async function pick(page: Page, ...names: string[]) {
  await tab(page, 'Objects');
  for (const name of names)
    await page.getByRole('tabpanel').getByRole('button', { name, exact: true }).click();
}
async function svg(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  const result = await page.getByLabel('Export content').inputValue();
  await page.keyboard.press('Escape');
  return result;
}

test('common tangent tool builds dependent lines despite independent coincident lines', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of [
    'O=(0,0)',
    'B=(3,0)',
    'c=circle(O,2)',
    'd=circle(B,2)',
    'a=line((-2,2),(5,2))',
    'b=line((-2,-2),(5,-2))',
  ])
    await command(page, line);
  await tool(page, 'Tangent');
  await pick(page, 'c', 'd');
  const result = await text(page);
  expect(result.match(/= tangent\(c, d,/gu)).toHaveLength(2);
  await tool(page, 'Move');
  await dragWorld(page, [3, 0], [3, 1]);
  await pick(page, 'B');
  await expect(page.getByRole('tabpanel')).not.toContainText('undefined');
  const after = await text(page);
  expect(after).toContain('B = (3, 1)');
  expect(after.match(/= tangent\(c, d,/gu)).toHaveLength(2);
  expect(await svg(page)).toContain('<svg');
  expect(errors).toEqual([]);
});

test('intersection tool creates moving intersections beside free coincident points', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of [
    'O=(0,0)',
    'A=(-2,0)',
    'B=(2,0)',
    'c=circle(O,1)',
    'l=line(A,B)',
    'P=(-1,0)',
    'Q=(1,0)',
  ])
    await command(page, line);
  await tool(page, 'Intersection');
  await pick(page, 'c', 'l');
  const result = await text(page);
  expect(result.match(/= intersect\(c, l,/gu)).toHaveLength(2);
  await tool(page, 'Move');
  await dragWorld(page, [0, 0], [0, 0.5]);
  await tab(page, 'Objects');
  await expect(page.getByRole('tabpanel')).not.toContainText('undefined');
  const after = await text(page);
  expect(after).toContain('P = (-1, 0)');
  expect(after).toContain('Q = (1, 0)');
  expect(after).toContain('O = (0, 0.5)');
  expect(errors).toEqual([]);
});

test('Apply transformation maps a conic selected in the panel and exports it', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of [
    'k=conic((2,0),(0,1),(-2,0),(0,-1),(6/5,4/5))',
    'l=line((0,0),(1,0))',
    't=reflect(l)',
  ])
    await command(page, line);
  await tool(page, 'Apply transformation');
  await pick(page, 't', 'k');
  expect(await text(page)).toContain('apply(t, k)');
  await tab(page, 'Objects');
  await expect(page.getByRole('tabpanel')).not.toContainText('undefined');
  expect(await svg(page)).toContain('<svg');
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveCount(
    process.env['GEOMIRA_ENGINE_E2E'] === '1' ? 1 : 0,
  );
  expect(errors).toEqual([]);
});
