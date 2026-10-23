import { expect, test } from '@playwright/test';
import { openApp, tab } from './helpers';

/**
 * Bug-fix round (ADR-0028): on the phone layout (390 × 664) a refusal notice was drawn
 * behind the open panel drawer. It now shows above the drawer. Mobile project.
 */

test('a refusal notice is visible above the open drawer', async ({ page }) => {
  await openApp(page);
  await page.getByLabel('Example').selectOption('euler-line');
  await tab(page, 'Claims');
  const box = page.getByLabel('New claim');
  await box.fill('Z, A, B collinear');
  await box.press('Enter');
  const notice = page.locator('.notice');
  await expect(notice).toBeVisible();
  const b = await notice.boundingBox();
  if (b === null) throw new Error('no notice box');
  const top = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('.notice') !== null,
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
  expect(top).toBe(true);
  // The drawer's tab row stays usable: the notice does not cover it.
  await tab(page, 'Text');
  await expect(page.getByRole('tab', { name: 'Text', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice).toHaveCount(0);
});
