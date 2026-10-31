import { expect, test, type Page } from '@playwright/test';
import { clickWorld, command, dragWorld, openApp, screenOf, tab, text, tool } from './helpers';

/**
 * ADR-0048: measurements are visible. The Distance tool makes a shown measurement (the text
 * says [show]) listed under Measurements with its value; the value follows a drag of a point
 * live; its label is dragged like any label (one edit of label_angle / label_dist); a click on
 * it selects it; its style card hides it (show removed: not drawn, still listed). Desktop.
 */

/** The figure's text (the Text tab opened). */
function source(page: Page): Promise<string> {
  return text(page);
}

/** The Measurements list's rows (the Objects tab opened). */
async function measurement(page: Page) {
  await tab(page, 'Objects');
  return page.locator('.measurement-row');
}

/** Inside the value label of dist(A, B) on y = 0: 6 px above the middle, about 15 px high. */
async function onValue(page: Page, midX: number): Promise<{ x: number; y: number }> {
  const m = await screenOf(page, midX, 0);
  return { x: m.x, y: m.y - 12 };
}

test('create → visible → live drag → drag the label → hide', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)']) await command(page, line);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await tool(page, 'Distance');
  await clickWorld(page, 0, 0);
  await clickWorld(page, 4, 0);
  await expect.poll(() => source(page)).toMatch(/^d = dist\(A, B\) \[show\]$/mu);
  await expect(await measurement(page)).toHaveCount(1);
  await expect(await measurement(page)).toContainText('dist(A, B)');
  await expect(await measurement(page)).toContainText('4.00 · shown');

  // Dragging B: the figure's value label follows every frame (the scene); the list, like every
  // panel, shows the settled state and has the new value at the drop (note F of Run 9a).
  await tool(page, 'Move');
  const a = await screenOf(page, 4, 0);
  const b = await screenOf(page, 6, 0);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, a.y, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => source(page)).toMatch(/^B = \(6, 0\)$/mu);
  await expect(await measurement(page)).toContainText('6.00 · shown');

  // A click on the value selects the measurement.
  const v = await onValue(page, 3);
  await page.mouse.click(v.x, v.y);
  await tab(page, 'Objects');
  await expect(page.getByRole('button', { name: 'Measurement d' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Drag the value label down: one edit of its offset.
  await page.mouse.move(v.x, v.y);
  await page.mouse.down();
  await page.mouse.move(v.x, v.y + 20, { steps: 4 });
  await page.mouse.move(v.x, v.y + 40, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(() => source(page))
    .toMatch(/^d = dist\(A, B\) \[label_angle=\d+, label_dist=\d+, show\]$/mu);
  const angle = Number(/label_angle=(\d+)/u.exec(await source(page))?.[1]);
  expect(angle).toBeGreaterThan(180);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => source(page)).toMatch(/^d = dist\(A, B\) \[show\]$/mu);

  // Hide it from its style card: show removed, still listed with its value.
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 'Measurement d' }).click({ button: 'right' });
  const card = page.getByRole('dialog', { name: 'Style of d' });
  await card.getByLabel('Shown').uncheck();
  await expect(card).toContainText('Not drawn: tick "shown" to draw its value.');
  await card.getByRole('button', { name: 'Write to script' }).click();
  await expect.poll(() => source(page)).toMatch(/^d = dist\(A, B\)$/mu);
  await expect(await measurement(page)).toContainText('6.00');
  await expect(await measurement(page)).not.toContainText('shown');
  expect(errors).toEqual([]);
});

test('an angle measurement: its arc and value; Undefined is listed with its reason', async ({
  page,
}) => {
  const errors = await openApp(page);
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (0, 3)']) await command(page, line);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await tool(page, 'Angle');
  await clickWorld(page, 4, 0);
  await clickWorld(page, 0, 0);
  await clickWorld(page, 0, 3);
  await expect.poll(() => source(page)).toMatch(/^\S+ = angle\(B, A, C\) \[show\]$/mu);
  await expect(await measurement(page)).toContainText('90.00° · shown');
  // Moving C onto A makes the angle Undefined: listed with its reason, not drawn.
  await tool(page, 'Move');
  await dragWorld(page, [0, 3], [0, 0]);
  await expect(await measurement(page)).toContainText('undefined: ');
  expect(errors).toEqual([]);
});
