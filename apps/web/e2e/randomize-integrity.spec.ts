import { expect, test } from '@playwright/test';
import { command, openApp, text } from './helpers';

test('Randomize refuses invalid bounds without losing the figure; valid sampling is undoable', async ({
  page,
}) => {
  const errors = await openApp(page, './index.html');
  for (const line of ['A=(0,0)', 'B=(1,0)', 'C=(0,1)', 'M=midpoint(A,B)', 'p=param(2,1,1)'])
    await command(page, line);
  const before = await text(page);
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'p: param' })).toContainText('min < max');
  expect(await text(page)).toBe(before);
  await expect(page.getByText('Internal error', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const valid = await text(page);
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  await expect(page.getByLabel('Text', { exact: true })).not.toHaveValue(valid);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await text(page)).toBe(valid);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('Text', { exact: true })).not.toHaveValue(valid);
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveCount(
    process.env['GEOMIRA_ENGINE_E2E'] === '1' ? 1 : 0,
  );
  expect(errors).toEqual([]);
});
