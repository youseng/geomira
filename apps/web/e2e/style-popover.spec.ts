import { expect, test, type Page } from '@playwright/test';
import { command, openApp, screenOf, tab } from './helpers';

/**
 * ADR-0029: the style card (Geomdraw's right-click card) replaces the Style tab. It edits a
 * draft the canvas previews (no edit), "Write to script" applies it as one style edit,
 * "Reset" goes back to the default style, closing discards the draft. Desktop and mobile.
 */

async function figure(page: Page): Promise<void> {
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 's = segment(A, B)'])
    await command(page, line);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
}

/** The figure's text, read without touching the page (a click elsewhere closes the card). */
function source(page: Page): Promise<string> {
  return page.getByLabel('Text', { exact: true }).inputValue();
}

/** The canvas's colour (r, g, b) at a page position. */
function pixel(page: Page, at: { x: number; y: number }): Promise<number[]> {
  return page.getByLabel('Geometry canvas').evaluate((c, p) => {
    const canvas = c as HTMLCanvasElement;
    const r = canvas.getBoundingClientRect();
    const k = canvas.width / canvas.clientWidth;
    const ctx = canvas.getContext('2d');
    const d = ctx?.getImageData(
      Math.round((p.x - r.left) * k),
      Math.round((p.y - r.top) * k),
      1,
      1,
    );
    return Array.from(d?.data ?? []).slice(0, 3);
  }, at);
}

const isRed = (c: number[]) => (c[0] ?? 0) > 150 && (c[1] ?? 255) < 90 && (c[2] ?? 255) < 90;
const isBlue = (c: number[]) => (c[2] ?? 0) > 150 && (c[0] ?? 255) < 90;

async function rightClick(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const p = await screenOf(page, x, y);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  return p;
}

test('a point: colour, size and opacity previewed, written as one edit, reset', async ({
  page,
}) => {
  const errors = await openApp(page);
  await figure(page);
  const at = await rightClick(page, 1, 3);
  const card = page.getByRole('dialog', { name: 'Style of C' });
  await expect(card).toBeVisible();
  await expect(card.locator('header')).toContainText('point');
  const reset = card.getByRole('button', { name: 'Reset', exact: true });
  const write = card.getByRole('button', { name: 'Write to script', exact: true });
  await expect(reset).toBeDisabled();
  await expect(write).toBeDisabled();
  // Sliders show the effective value: the scene's default radius, opacity 1.
  await expect(card.getByRole('slider', { name: 'Point size' })).toHaveValue('3.5');
  await expect(card.getByRole('slider', { name: 'Opacity' })).toHaveValue('1');
  expect(isRed(await pixel(page, at))).toBe(false);

  await card.getByRole('button', { name: 'red', exact: true }).click();
  await expect(card.getByRole('button', { name: 'red', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // The preview: the canvas draws the draft; the text does not change.
  await expect.poll(async () => isRed(await pixel(page, at))).toBe(true);
  expect(await source(page)).toMatch(/^C = \(1, 3\)$/mu);
  await card.getByRole('slider', { name: 'Point size' }).fill('5');
  await card.getByRole('slider', { name: 'Opacity' }).fill('0.5');
  await expect(card).toContainText('5');
  await expect(card).toContainText('0.5');
  await expect(write).toBeEnabled();
  const past = await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled();

  await write.click();
  await expect
    .poll(() => source(page))
    .toMatch(/^C = \(1, 3\) \[color=red, width=5, opacity=0\.5\]$/mu);
  await expect(write).toBeDisabled();
  await expect(reset).toBeEnabled();
  expect(past).toBe(true);

  // Reset: the draft goes back to the default style; writing it removes the attributes.
  await reset.click();
  await expect(reset).toBeDisabled();
  await expect(card.getByRole('slider', { name: 'Point size' })).toHaveValue('3.5');
  await expect.poll(async () => isRed(await pixel(page, at))).toBe(false);
  await write.click();
  await expect.poll(() => source(page)).toMatch(/^C = \(1, 3\)$/mu);
  // Undo takes back the last write only: one style edit each.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(() => source(page))
    .toMatch(/^C = \(1, 3\) \[color=red, width=5, opacity=0\.5\]$/mu);
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Escape and a click elsewhere discard the draft; the preview goes', async ({ page }) => {
  await openApp(page);
  await figure(page);
  const at = await rightClick(page, 1, 3);
  const card = page.getByRole('dialog', { name: 'Style of C' });
  await card.getByRole('button', { name: 'blue', exact: true }).click();
  await expect.poll(async () => isBlue(await pixel(page, at))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect.poll(async () => isBlue(await pixel(page, at))).toBe(false);
  expect(await source(page)).toMatch(/^C = \(1, 3\)$/mu);
  // A click elsewhere on the page closes it too, with its draft.
  await rightClick(page, 1, 3);
  await card.getByRole('button', { name: 'blue', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(card).toHaveCount(0);
  expect(await source(page)).toMatch(/^C = \(1, 3\)$/mu);
});

test('a segment: line width, dash under More, label shown, visible; one style line', async ({
  page,
}) => {
  await openApp(page);
  await figure(page);
  await rightClick(page, 2.5, 0);
  const card = page.getByRole('dialog', { name: 'Style of s' });
  await expect(card.locator('header')).toContainText('segment');
  await expect(card.getByRole('slider', { name: 'Line width' })).toHaveValue('1.5');
  await card.getByRole('slider', { name: 'Line width' }).fill('3');
  await card.getByText('More', { exact: true }).click();
  await card.getByLabel('Dash').selectOption('dashed');
  await expect(card.getByLabel('Label text')).toBeDisabled();
  await card.getByLabel('Show the label').check();
  await expect(card.getByLabel('Label text')).toHaveAttribute('placeholder', 's');
  await card.getByRole('button', { name: 'Write to script', exact: true }).click();
  await expect
    .poll(() => source(page))
    .toMatch(/^s = segment\(A, B\) \[width=3, dash=dashed, label="s"\]$/mu);
  await card.getByLabel('Shown').uncheck();
  await card.getByRole('button', { name: 'Write to script', exact: true }).click();
  await expect
    .poll(() => source(page))
    .toMatch(/^s = segment\(A, B\) \[width=3, dash=dashed, hidden, label="s"\]$/mu);
});

test('a point label: "show" off is label="", a text replaces the name', async ({ page }) => {
  await openApp(page);
  await figure(page);
  await rightClick(page, 1, 3);
  const card = page.getByRole('dialog', { name: 'Style of C' });
  await expect(card.getByLabel('Show the label')).toBeChecked();
  await expect(card.getByLabel('Label text')).toHaveAttribute('placeholder', 'C');
  await card.getByLabel('Label text').fill('C_1');
  await card.getByRole('button', { name: 'Write to script', exact: true }).click();
  await expect.poll(() => source(page)).toMatch(/^C = \(1, 3\) \[label="C_1"\]$/mu);
  await card.getByLabel('Show the label').uncheck();
  await card.getByRole('button', { name: 'Write to script', exact: true }).click();
  await expect.poll(() => source(page)).toMatch(/^C = \(1, 3\) \[label=""\]$/mu);
});

test('empty canvas: no card and no browser menu; the Objects panel opens cards too', async ({
  page,
}) => {
  await openApp(page);
  await figure(page);
  await page.evaluate(() => {
    addEventListener('contextmenu', (e) => {
      document.body.dataset['menu'] = e.defaultPrevented ? 'prevented' : 'browser';
    });
  });
  const box = await page.getByLabel('Geometry canvas').boundingBox();
  if (box === null) throw new Error('no canvas');
  await page.mouse.click(box.x + 15, box.y + box.height - 15, { button: 'right' });
  await expect(page.locator('body')).toHaveAttribute('data-menu', 'prevented');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // A row of the Objects panel; another object's card replaces it (A's row is above B's, so
  // the card of B, below B's row on a phone, leaves it uncovered).
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 'B', exact: true }).click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'Style of B' })).toBeVisible();
  await page.getByRole('button', { name: 'A', exact: true }).click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'Style of A' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  // The Style tab is gone.
  await expect(page.getByRole('tab', { name: 'Style', exact: true })).toHaveCount(0);
});

test('a long press (touch) opens the card; the point does not move', async ({ page }) => {
  await openApp(page);
  await figure(page);
  const before = await source(page);
  const p = await screenOf(page, 1, 3);
  const cdp = await page.context().newCDPSession(page);
  const point = { x: p.x, y: p.y, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('dialog', { name: 'Style of C' })).toBeVisible();
  expect(await source(page)).toBe(before);
});
