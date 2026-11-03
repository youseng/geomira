import { expect, test, type Page } from '@playwright/test';
import { command, openApp, screenOf } from './helpers';

/**
 * ADR-0046: the style card's Name field. Write to script applies the name and the style as
 * one edit (one undo restores both); the image follows (C* becomes P*); a taken or invalid
 * name shows the reason under the field and disables Write; a managed image's name is fixed.
 */

async function figure(page: Page): Promise<void> {
  for (const line of [
    'A = (0, 0)',
    'B = (4, 0)',
    'C = (1, 3)',
    'T = reflect(line(B, (4, 1)))',
    '@layer inv = image(T, main)',
  ])
    await command(page, line);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
}

function source(page: Page): Promise<string> {
  return page.getByLabel('Text', { exact: true }).inputValue();
}

async function rightClick(page: Page, x: number, y: number): Promise<void> {
  const p = await screenOf(page, x, y);
  await page.mouse.click(p.x, p.y, { button: 'right' });
}

test('a new name and a colour: one write, the image follows, one undo restores both', async ({
  page,
}) => {
  const errors = await openApp(page);
  await figure(page);
  await rightClick(page, 1, 3);
  const card = page.getByRole('dialog', { name: 'Style of C' });
  const name = card.getByRole('textbox', { name: 'Name', exact: true });
  const write = card.getByRole('button', { name: 'Write to script', exact: true });
  await expect(name).toHaveValue('C');
  await expect(write).toBeDisabled();
  await name.fill('P');
  await card.getByRole('button', { name: 'red', exact: true }).click();
  await expect(write).toBeEnabled();
  // A draft: the text has not changed.
  expect(await source(page)).toMatch(/^C = \(1, 3\)$/mu);
  await write.click();
  await expect.poll(() => source(page)).toMatch(/^P = \(1, 3\) \[color=red\]$/mu);
  await expect(page.getByRole('dialog', { name: 'Style of P' })).toBeVisible();
  // The image is P* now: its card says so.
  await page.keyboard.press('Escape');
  await rightClick(page, 7, 3);
  const image = page.getByRole('dialog', { name: 'Style of P*' });
  await expect(image).toBeVisible();
  await page.keyboard.press('Escape');
  // One undo takes back the name and the colour together.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => source(page)).toMatch(/^C = \(1, 3\)$/mu);
  expect(await source(page)).not.toContain('P');
  expect(errors).toEqual([]);
});

test('a taken or invalid name: the reason under the field, Write disabled; Enter writes', async ({
  page,
}) => {
  await openApp(page);
  await figure(page);
  await rightClick(page, 1, 3);
  const card = page.getByRole('dialog', { name: 'Style of C' });
  const name = card.getByRole('textbox', { name: 'Name', exact: true });
  const write = card.getByRole('button', { name: 'Write to script', exact: true });
  await card.getByRole('button', { name: 'blue', exact: true }).click();
  await expect(write).toBeEnabled();
  await name.fill('A');
  await expect(card.getByText('the name A is already used')).toBeVisible();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(write).toBeDisabled();
  await name.fill('Ma');
  await expect(card.getByText('"Ma" is not a valid name: did you mean M_a?')).toBeVisible();
  await expect(write).toBeDisabled();
  await name.fill('M_a');
  await expect(card.locator('.sc-problem')).toHaveCount(0);
  await expect(write).toBeEnabled();
  await name.press('Enter');
  await expect.poll(() => source(page)).toMatch(/^M_a = \(1, 3\) \[color=blue\]$/mu);
});

test("a managed image's name is fixed, with the reason", async ({ page }) => {
  await openApp(page);
  await figure(page);
  await rightClick(page, 7, 3);
  const card = page.getByRole('dialog', { name: 'Style of C*' });
  const name = card.getByRole('textbox', { name: 'Name', exact: true });
  await expect(name).toHaveValue('C*');
  await expect(name).toHaveAttribute('readonly', '');
  await expect(card.getByText('C* is the image of C in layer inv: rename C')).toBeVisible();
});
