import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  claimItem,
  clickWorld,
  command,
  expectLines,
  openApp,
  tab,
  text,
  textArea,
  tool,
} from './helpers';

/**
 * Run 12 (SPEC §1 v1.1, §16): the single-file build opened from file://, in Chromium, Firefox and
 * WebKit (projects file-chromium, file-firefox, file-webkit). One HTML file and nothing else:
 * open, draw with the mouse, the local test and the global test that follows it, export, and a
 * share link that opens the same figure. Without Web Workers the page runs the tests itself in
 * short slices, and the verdicts are the same.
 */

const PAGE = 'index.html';
const CLAIM = 'claim ∠BHC + ∠BAC = 180';

/** Opens the single file and records every request the page makes. */
async function openSingle(page: Page): Promise<{ errors: string[]; requests: string[] }> {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const errors = await openApp(page, PAGE);
  return { errors, requests };
}

/** Draws the triangle A(0, 0), B(4, 0), C(1, 3) with the polygon tool. */
async function drawTriangle(page: Page): Promise<void> {
  await tool(page, 'Polygon');
  for (const [x, y] of [
    [0, 0],
    [4, 0],
    [1, 3],
    [0, 0],
  ] as const)
    await clickWorld(page, x, y);
  await expectLines(page, 'A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)');
}

/** Runs the local test of the claim; the assume line makes the global test follow. */
async function testBoth(page: Page): Promise<void> {
  for (const line of ['H = orthocenter(A, B, C)', 'assume acute(A, B, C)', CLAIM])
    await command(page, line);
  await tab(page, 'Claims');
  await claimItem(page, 'claim').getByRole('button', { name: 'Test', exact: true }).click();
  const local = page.locator('.verdict[data-regime="local"] .verdict-line');
  await expect(local).toHaveText(
    'Holds in this configuration (local test, n = 200, exact over Q)',
    {
      timeout: 90_000,
    },
  );
  const global = page.locator('.verdict[data-regime="global"] .verdict-line');
  await expect(global).toHaveText(
    /^Holds across the declared configuration \(global test, n = 200/u,
    {
      timeout: 90_000,
    },
  );
}

/** Where the tests ran, as the Help panel says. */
async function runner(page: Page): Promise<string | null> {
  await tab(page, 'Help');
  const line = page.getByTestId('runner');
  await expect(line).toBeVisible();
  return line.getAttribute('data-runner');
}

test('one file and nothing else: open, draw, local and global test', async ({ page }, info) => {
  const { errors, requests } = await openSingle(page);
  await drawTriangle(page);
  await testBoth(page);
  const ran = await runner(page);
  expect(['worker', 'page']).toContain(ran);
  info.annotations.push({ type: 'runner', description: `${info.project.name}: ${String(ran)}` });
  console.warn(`tests ran in: ${String(ran)} (${info.project.name})`);
  await expect(page.getByTestId('offline')).toContainText('single-file copy');
  // Nothing but the file itself (and data:/blob: URLs it makes) was requested.
  const self = page.url().split('#')[0] ?? '';
  expect(requests.filter((u) => u.split('#')[0] !== self && !/^(data|blob):/u.test(u))).toEqual([]);
  expect(errors).toEqual([]);
});

test('without Web Workers the page runs the tests itself, with the same verdicts', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'Worker');
  });
  const { errors } = await openSingle(page);
  expect(await page.evaluate(() => typeof Worker)).toBe('undefined');
  await drawTriangle(page);
  await testBoth(page);
  expect(await runner(page)).toBe('page');
  await expect(page.getByTestId('runner')).toContainText('this browser has no Web Workers');
  expect(errors).toEqual([]);
});

test('export from the file: SVG shown and downloaded, TikZ shown', async ({ page }) => {
  const { errors } = await openSingle(page);
  await drawTriangle(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export' });
  const content = dialog.getByLabel('Export content');
  const svg = await content.inputValue();
  expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /u);
  for (const name of ['A', 'B', 'C']) expect(svg).toContain(`data-name="${name}"`);
  const wait = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /^Download .*\.svg$/u }).click();
  const file = await wait;
  expect(readFileSync(await file.path(), 'utf8')).toBe(svg);
  await dialog
    .getByRole('radiogroup', { name: 'Format' })
    .getByLabel('TikZ', { exact: true })
    .check();
  await expect(content).toHaveValue(/\\begin\{tikzpicture\}/u);
  expect(errors).toEqual([]);
});

test('a share link from the file opens the same figure', async ({ page, context }) => {
  await openSingle(page);
  await drawTriangle(page);
  await command(page, 'M = midpoint(A, B)');
  await expectLines(page, 'M = midpoint(A, B)');
  const figure = await text(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page
    .getByRole('dialog', { name: 'Share link' })
    .getByRole('textbox')
    .inputValue();
  const self = page.url().split('#')[0] ?? '';
  expect(self.startsWith('file://')).toBe(true);
  expect(link.startsWith(`${self}#s=`)).toBe(true);
  expect(link).toMatch(/#s=[A-Za-z0-9+\-$]+$/u);
  const other = await context.newPage();
  const errors = await openApp(other, link);
  await expect(await textArea(other)).toHaveValue(figure);
  expect(errors).toEqual([]);
});

test('views from the file: save and switch; the share link and a reload keep them (Run 13)', async ({
  page,
  context,
}) => {
  const { errors } = await openSingle(page);
  for (const line of ['@layer aux', 'A = (0, 0)', 'B = (4, 0)', 'M = midpoint(A, B) [layers=aux]'])
    await command(page, line);
  await tab(page, 'Layers');
  await page.getByLabel('New view name', { exact: true }).fill('whole');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await page.getByLabel('aux', { exact: true }).uncheck();
  await page.getByLabel('New view name', { exact: true }).fill('bare');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await page.getByRole('button', { name: 'Show view whole', exact: true }).click();
  await expect(page.getByLabel('aux', { exact: true })).toBeChecked();
  await expect(await textArea(page)).toHaveValue(/^@view whole \[layers=main,aux\] /mu);
  await expect(await textArea(page)).toHaveValue(/^@view bare \[layers=main,-aux\] /mu);
  const figure = await text(page);
  // A reload of the file opens the autosaved figure with its views (before another page
  // edits, which would save its own figure).
  await page.reload();
  await expect(await textArea(page)).toHaveValue(figure);
  // The share link carries the views.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page
    .getByRole('dialog', { name: 'Share link' })
    .getByRole('textbox')
    .inputValue();
  const other = await context.newPage();
  const otherErrors = await openApp(other, link);
  await expect(await textArea(other)).toHaveValue(figure);
  await tab(other, 'Layers');
  await other.getByRole('button', { name: 'Show view bare', exact: true }).click();
  await expect(other.getByLabel('aux', { exact: true })).not.toBeChecked();
  expect(otherErrors).toEqual([]);
  expect(errors).toEqual([]);
});

test('What is special? from the file: the Euler line, and Add as claim', async ({ page }) => {
  // Run 17 (ADR-0035): the find job runs in the single file's inlined worker, or on the page.
  test.setTimeout(240_000);
  const { errors } = await openSingle(page);
  for (const line of [
    'A = (1, 5)',
    'B = (-3, 0)',
    'C = (4, 1)',
    'O = circumcenter(A, B, C)',
    'H = orthocenter(A, B, C)',
    'G = centroid(A, B, C)',
  ])
    await command(page, line);
  await tab(page, 'Claims');
  await page.getByRole('button', { name: 'What is special?' }).click();
  const euler = page
    .getByRole('list', { name: 'Facts' })
    .locator('.fact')
    .filter({ hasText: 'Euler line' })
    .first();
  await expect(euler).toBeVisible({ timeout: 180_000 });
  await euler.getByRole('button', { name: 'Add as claim' }).click();
  await expect(await textArea(page)).toHaveValue(/^claim collinear\([OHG], [OHG], [OHG]\)$/mu);
  expect(errors).toEqual([]);
});
