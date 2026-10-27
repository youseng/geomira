import { expect, test, type Page } from '@playwright/test';
import { claimItem, command, openApp, RESERVED, tab, text, textArea } from './helpers';

/**
 * Run 17 flows (ADR-0035, ADR-0036), desktop: "What is special?" reports the Euler line with
 * its tag and rungs, hides construction facts (counted), and "Add as claim" is one undoable
 * edit shown in the text; "Special positions" views a position as a draft (the text never
 * changes) and opens one as a new figure; a MIXED claim's branch fix previews as a draft and
 * applies as one edit that one undo takes back.
 */

const TRIANGLE = [
  'A = (1, 5)',
  'B = (-3, 0)',
  'C = (4, 1)',
  'O = circumcenter(A, B, C)',
  'H = orthocenter(A, B, C)',
  'G = centroid(A, B, C)',
];

/** find and hunt run for tens of seconds in the browser: beyond the default test timeout. */
const SLOW = 240_000;

async function undo(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
}

test('What is special? finds the Euler line; Add as claim is one undoable edit', async ({
  page,
}) => {
  test.setTimeout(SLOW);
  const errors = await openApp(page);
  for (const line of TRIANGLE) await command(page, line);
  await tab(page, 'Claims');
  await page.getByRole('button', { name: 'What is special?' }).click();
  const facts = page.getByRole('list', { name: 'Facts' });
  await expect(facts).toBeVisible({ timeout: 120_000 });
  const euler = facts.locator('.fact').filter({ hasText: 'Euler line' }).first();
  await expect(euler).toBeVisible();
  await expect(euler.locator('.verdict-line')).toHaveText(
    /^holds in this configuration \(exact over Q, \d+\/\d+\)$/u,
  );
  await expect(page.locator('.construction-facts summary')).toHaveText(
    /^\d[\d,]* construction facts hidden$/u,
  );
  expect(await page.locator('.discovery').innerText()).not.toMatch(RESERVED);
  const before = await text(page);
  await tab(page, 'Claims');
  await euler.hover();
  await euler.getByRole('button', { name: 'Add as claim' }).click();
  await expect(euler.getByRole('button', { name: 'Added' })).toBeDisabled();
  await expect(await textArea(page)).not.toHaveValue(before);
  const added = await text(page);
  await tab(page, 'Claims');
  const claimLines = added.split('\n').filter((l) => l.startsWith('claim '));
  expect(claimLines).toHaveLength(1);
  expect(claimLines[0]).toMatch(/^claim collinear\([OHG], [OHG], [OHG]\)$/u);
  await undo(page);
  await tab(page, 'Text');
  await expect(await textArea(page)).toHaveValue(before);
  expect(errors).toEqual([]);
});

test('Special positions: View is a draft, Open as new figure opens it', async ({ page }) => {
  test.setTimeout(SLOW);
  const errors = await openApp(page);
  for (const line of ['A = (1, 5)', 'B = (-3, 0)', 'C = (4, 1)', 'O = circumcenter(A, B, C)'])
    await command(page, line);
  await command(page, 'M = midpoint(B, C)');
  await tab(page, 'Claims');
  await page.getByRole('button', { name: 'Special positions' }).click();
  const positions = page.getByRole('list', { name: 'Positions' });
  await expect(positions).toBeVisible({ timeout: 120_000 });
  const before = await text(page);
  await tab(page, 'Claims');
  const first = positions.locator('.position').first();
  await first.getByRole('button', { name: 'View' }).click();
  await expect(page.locator('.view-banner')).toContainText('special position 1');
  // A draft: the document is unchanged.
  expect(await text(page)).toBe(before);
  await tab(page, 'Claims');
  await page.getByRole('button', { name: 'Close view' }).click();
  await expect(page.locator('.view-banner')).toHaveCount(0);
  await positions
    .locator('.position')
    .first()
    .getByRole('button', { name: 'Open as new figure' })
    .click();
  // The text panel shows the opened figure once it has re-rendered: wait for it, then read it.
  await expect(await textArea(page)).not.toHaveValue(before);
  const opened = await text(page);
  expect(opened).not.toBe(before);
  for (const name of ['O = circumcenter(A, B, C)', 'M = midpoint(B, C)'])
    expect(opened).toContain(name);
  expect(errors).toEqual([]);
});

test('a MIXED claim: branch fixes preview as a draft and apply as one edit', async ({ page }) => {
  test.setTimeout(SLOW);
  const errors = await openApp(page);
  for (const line of [
    'O = (0, 0)',
    'L_1 = (-7, 1/10)',
    'L_2 = (7, 1/10)',
    'P = (1/50, 4)',
    'k = circle(O, 5)',
    'l = line(L_1, L_2)',
    'X = intersect(l, k, near(P))',
    'S = intersect(l, k, along(-))',
    'R = other(l, k, S)',
    'claim X = R',
  ])
    await command(page, line);
  await tab(page, 'Claims');
  const item = claimItem(page, 'claim');
  await item.getByRole('button', { name: 'Test', exact: true }).click();
  await expect(item.locator('.verdict[data-regime="local"] .verdict-line')).toHaveText(/^Mixed/u, {
    timeout: 90_000,
  });
  await item.getByRole('button', { name: 'Find branch fixes' }).click();
  const fixes = item.getByRole('list', { name: 'Branch fixes' });
  await expect(fixes).toBeVisible({ timeout: 120_000 });
  const first = fixes.locator('.branch-fix').first();
  await expect(first.locator('.fix-moves')).toHaveText('nothing moves; only the selectors change');
  const before = await text(page);
  await tab(page, 'Claims');
  await first.getByRole('button', { name: 'Preview' }).click();
  await expect(page.locator('.view-banner')).toContainText('branch fix 1');
  expect(await text(page)).toBe(before);
  await tab(page, 'Claims');
  await claimItem(page, 'claim')
    .getByRole('list', { name: 'Branch fixes' })
    .locator('.branch-fix')
    .first()
    .getByRole('button', { name: 'Apply' })
    .click();
  // The text panel shows the edit once it has re-rendered: wait for it, then read it.
  await expect(await textArea(page)).not.toHaveValue(before);
  const applied = await text(page);
  expect(applied).not.toContain('near(P)');
  await undo(page);
  await expect(await textArea(page)).toHaveValue(before);
  expect(errors).toEqual([]);
});
