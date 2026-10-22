import { expect, test, type Page } from '@playwright/test';
import { claimItem, command, expectLines, openApp, RESERVED, tab, text } from './helpers';

/**
 * Run 9b (ADR-0016): the design pass on the desktop: screenshot baselines of the main screen
 * and the Claims panel, Randomize, the claim box, the live chips, the developer items, names
 * and focus. Desktop project.
 */

async function example(page: Page, id: string): Promise<void> {
  await page.getByLabel('Example').selectOption(id);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/** Text widths differ by a pixel between font rasterisers; the layout must match. */
const PAGE_DIFF = { maxDiffPixelRatio: 0.01 };

test('screenshot baseline: the main screen (nine-point circle)', async ({ page }) => {
  const errors = await openApp(page);
  await example(page, 'nine-point-circle');
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('main-desktop.png', PAGE_DIFF);
  expect(errors).toEqual([]);
});

test('screenshot baseline: the Claims panel after a local test (seed masked)', async ({ page }) => {
  await openApp(page);
  await example(page, 'euler-line');
  await tab(page, 'Claims');
  await claimItem(page, 'collinear').getByRole('button', { name: 'Test', exact: true }).click();
  await expect(page.locator('.verdict[data-regime="local"] .verdict-line')).toHaveText(
    /^Holds in this configuration/u,
    { timeout: 60_000 },
  );
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('claims-desktop.png', {
    ...PAGE_DIFF,
    mask: [page.locator('.verdict-detail')],
  });
  expect(await page.locator('.claims').innerText()).not.toMatch(RESERVED);
});

test('Randomize draws a new figure of each triangle type as one undoable edit', async ({
  page,
}) => {
  await openApp(page);
  for (const line of ['A = (1, 3)', 'B = (0, 0)', 'C = (4, 0)', 'H = orthocenter(A, B, C)'])
    await command(page, line);
  const before = await text(page);
  for (const type of ['acute', 'obtuse', 'right', 'any']) {
    await page.getByLabel('Triangle type').selectOption(type);
    await page.getByRole('button', { name: 'Randomize', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Text', exact: true })).not.toHaveValue(before);
    await expectLines(page, 'H = orthocenter(A, B, C)');
    expect(await text(page)).toMatch(/^B = \(-?\d+(\.\d{1,4})?, -?\d+(\.\d{1,4})?\)$/mu);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Text', exact: true })).toHaveValue(before);
  }
});

test('Randomize says why it cannot draw a typed triangle', async ({ page }) => {
  await openApp(page);
  await command(page, 'A = (0, 0)');
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Randomize' })).toHaveText(
    /Randomize: a acute triangle needs three free points; this figure has 1\./u,
  );
});

test('the claim box adds the claim, opens Claims and tests it; the chip follows', async ({
  page,
}) => {
  await openApp(page);
  await example(page, 'euler-line');
  await page.getByLabel('Claim to test').fill('O, G, H are collinear');
  await page.getByLabel('Claim to test').press('Enter');
  // Not a statement of the language: refused with the parser's reason, nothing added.
  await expect(page.getByRole('status').filter({ hasText: 'Line 1' })).toBeVisible();
  await page.getByLabel('Claim to test').fill('collinear(H, G, O)');
  await page.getByLabel('Claim to test').press('Enter');
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const card = claimItem(page, 'collinear(H, G, O)');
  await expect(card.locator('.badge')).toHaveText('true in this figure');
  await expect(card.locator('.verdict-line')).toHaveText(/^Holds in this configuration/u, {
    timeout: 60_000,
  });
  const chip = page.getByRole('group', { name: 'Live claim badges' }).getByRole('button', {
    name: 'collinear(H, G, O)',
  });
  await expect(chip).toHaveClass(/chip-true/u);
  await tab(page, 'Text');
  await chip.click();
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('developer items: behind Settings, or on from the start with ?dev=1', async ({ page }) => {
  await openApp(page);
  await example(page, 'euler-line');
  await expect(page.getByTestId('object-counts')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Show object counts').check();
  await expect(page.getByTestId('object-counts')).toContainText(/\d+ drawn · 0 undefined/u);
  await openApp(page, './?dev=1');
  await expect(page.getByTestId('object-counts')).toBeVisible();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Debug report' })).toBeVisible();
});

test('icon buttons are named by their old labels; keyboard focus is visible', async ({ page }) => {
  await openApp(page);
  for (const name of ['Undo', 'Redo', 'Randomize', 'View', 'Export', 'Settings', 'Help'])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  for (const name of ['Zoom in', 'Zoom out', 'Fit', 'Move', 'Circle (3 points)', 'Claim'])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await page.getByLabel('Command', { exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    return el === null ? '' : getComputedStyle(el).outlineStyle + getComputedStyle(el).outlineWidth;
  });
  expect(outline).toBe('solid2px');
});

/** The WCAG contrast of each element's text with the first opaque background under it. */
async function contrasts(page: Page, selectors: readonly string[]) {
  return page.evaluate((sels) => {
    const rgb = (c: string): number[] | null => {
      const m = /rgba?\(([^)]+)\)/u.exec(c);
      if (m === null) return null;
      const v = (m[1] ?? '').split(/[ ,/]+/u).map(Number);
      return v.length >= 4 && v[3] === 0 ? null : v.slice(0, 3);
    };
    const lum = (v: number[]) =>
      v
        .map((x) => x / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((s, c, i) => s + c * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
    return sels.map((sel) => {
      const el = document.querySelector(sel);
      if (el === null) return { sel, ratio: 0 };
      const fg = rgb(getComputedStyle(el).color) ?? [0, 0, 0];
      let bg: number[] | null = null;
      for (let e: Element | null = el; e !== null && bg === null; e = e.parentElement)
        bg = rgb(getComputedStyle(e).backgroundColor);
      const [a, b] = [lum(fg), lum(bg ?? [255, 255, 255])];
      return { sel, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  }, selectors);
}

for (const scheme of ['light', 'dark'] as const)
  test(`text meets WCAG AA contrast (${scheme} scheme)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openApp(page);
    await example(page, 'euler-line');
    await tab(page, 'Claims');
    await claimItem(page, 'GH').getByRole('button', { name: 'Test', exact: true }).click();
    await expect(page.locator('.verdict-detail')).toBeVisible({ timeout: 60_000 });
    const found = await contrasts(page, [
      '.brand',
      '.tabs [role="tab"]:not([aria-selected="true"])',
      '.pgroup h4',
      '.tool .k',
      '.badge-true',
      '.verdict-line',
      '.verdict-detail',
      '.line-no',
      '.chip-true',
      '.statusbar span',
      '.cmdbar .pr',
      'h3.sec',
    ]);
    for (const c of found) expect(c.ratio, c.sel).toBeGreaterThanOrEqual(4.5);
  });
