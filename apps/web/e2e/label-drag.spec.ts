import { expect, test, type Page } from '@playwright/test';
import { command, openApp, screenOf } from './helpers';

/**
 * ADR-0049: a label is dragged on the canvas. A press inside a point's label (not on its dot)
 * drags the label; the release writes ONE edit of label_angle / label_dist (whole degrees and
 * px), undone by one undo; a press on the dot still drags the point; Escape cancels. On touch,
 * a press that moves before the long press is a label drag, a still one opens the style card.
 */

async function figure(page: Page): Promise<void> {
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)']) await command(page, line);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
}

function source(page: Page): Promise<string> {
  return page.getByLabel('Text', { exact: true }).inputValue();
}

/** Inside C's label: it sits 9 px from the dot at 45° (up right), about 9 × 15 px. */
async function onLabel(page: Page): Promise<{ x: number; y: number }> {
  const c = await screenOf(page, 1, 3);
  return { x: c.x + 11, y: c.y - 13 };
}

test('a mouse drag of a label: one edit, the text shows it, one undo', async ({ page }) => {
  const errors = await openApp(page);
  await figure(page);
  const p = await onLabel(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 20, p.y + 10, { steps: 4 });
  await page.mouse.move(p.x + 40, p.y + 30, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(() => source(page))
    .toMatch(/^C = \(1, 3\) \[label_angle=\d+, label_dist=\d+\]$/mu);
  const angle = Number(/label_angle=(\d+)/u.exec(await source(page))?.[1]);
  // Dragged down and right from up-right: the label is now below right of C.
  expect(angle).toBeGreaterThan(270);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => source(page)).toMatch(/^C = \(1, 3\)$/mu);
  expect(errors).toEqual([]);
});

test('a press on the dot drags the point; Escape cancels a label drag', async ({ page }) => {
  await openApp(page);
  await figure(page);
  const c = await screenOf(page, 1, 3);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 30, c.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => source(page)).not.toMatch(/^C = \(1, 3\)$/mu);
  expect(await source(page)).not.toContain('label_angle');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => source(page)).toMatch(/^C = \(1, 3\)$/mu);
  const p = await onLabel(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 40, p.y + 40, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.move(p.x + 60, p.y + 50, { steps: 2 });
  await page.mouse.up();
  await expect.poll(() => source(page)).toMatch(/^C = \(1, 3\)$/mu);
});

test('touch: a moving press drags the label; a still press opens the card', async ({ page }) => {
  await openApp(page);
  await figure(page);
  const p = await onLabel(page);
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    });
  await touch('touchStart', p.x, p.y);
  for (let k = 1; k <= 5; k++) await touch('touchMove', p.x + 8 * k, p.y + 6 * k);
  await touch('touchEnd', 0, 0);
  await expect
    .poll(() => source(page))
    .toMatch(/^C = \(1, 3\) \[label_angle=\d+, label_dist=\d+\]$/mu);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => source(page)).toMatch(/^C = \(1, 3\)$/mu);
  const before = await source(page);
  await touch('touchStart', p.x, p.y);
  await page.waitForTimeout(800);
  await touch('touchEnd', 0, 0);
  await expect(page.getByRole('dialog', { name: 'Style of C' })).toBeVisible();
  expect(await source(page)).toBe(before);
});
