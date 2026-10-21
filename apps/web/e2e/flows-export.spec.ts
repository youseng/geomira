import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { command, openApp, RESERVED } from './helpers';

/**
 * Run 9a, note E: the Export dialog, one flow per format (SPEC §14): the text shown, copy, and
 * download; the PNG's size and its figure text; the warning for a character TeX cannot write.
 */

async function openEuler(page: Page): Promise<void> {
  await openApp(page);
  await page.getByLabel('Example').selectOption('euler-line');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Export' })).toBeVisible();
}

async function format(page: Page, label: string): Promise<void> {
  await page.getByRole('radiogroup', { name: 'Format' }).getByLabel(label, { exact: true }).check();
}

function content(page: Page) {
  return page.getByRole('dialog', { name: 'Export' }).getByLabel('Export content');
}

/** Clicks the dialog's download button and returns the file's name and bytes. */
async function download(page: Page, name: string): Promise<{ name: string; bytes: Buffer }> {
  const wait = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download ${name}` }).click();
  const d = await wait;
  const path = await d.path();
  return { name: d.suggestedFilename(), bytes: readFileSync(path) };
}

test('SVG: the canvas picture as SVG, shown and downloaded', async ({ page }) => {
  await openEuler(page);
  const svg = await content(page).inputValue();
  expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /u);
  for (const name of ['A', 'B', 'C', 'O', 'G', 'H', 'e', 'abc'])
    expect(svg).toContain(`data-name="${name}"`);
  const file = await download(page, 'euler-line.svg');
  expect(file.name).toBe('euler-line.svg');
  expect(file.bytes.toString('utf8')).toBe(svg);
});

test('PNG: the canvas size times the pixel ratio, with the figure text inside', async ({
  page,
}) => {
  await openEuler(page);
  const size = await page
    .getByLabel('Geometry canvas')
    .evaluate((c) => ({ w: c.clientWidth, h: c.clientHeight }));
  await format(page, 'PNG');
  await page.getByRole('radiogroup', { name: 'Pixel ratio' }).getByLabel('2×').check();
  await expect(content(page)).toContainText(`${String(size.w * 2)} × ${String(size.h * 2)} pixels`);
  const file = await download(page, 'euler-line.png');
  const b = file.bytes;
  expect([...b.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(b.subarray(12, 16).toString('latin1')).toBe('IHDR');
  expect(b.readUInt32BE(16)).toBe(size.w * 2);
  expect(b.readUInt32BE(20)).toBe(size.h * 2);
  const text = b.toString('utf8');
  expect(text).toContain('GEOMIRA');
  expect(text).toContain('O = circumcenter(A, B, C)');
  expect(text).toContain('pHYs');
});

test('PNG at 1×: pixel for pixel the canvas on the screen', async ({ page }) => {
  await openEuler(page);
  await format(page, 'PNG');
  await page.getByRole('radiogroup', { name: 'Pixel ratio' }).getByLabel('1×').check();
  const file = await download(page, 'euler-line.png');
  const base64 = file.bytes.toString('base64');
  const diff = await page.evaluate(async (data) => {
    const board = document.querySelector('canvas.board');
    if (!(board instanceof HTMLCanvasElement)) throw new Error('no board');
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    const bctx = board.getContext('2d');
    if (ctx === null || bctx === null) throw new Error('no context');
    ctx.drawImage(img, 0, 0);
    const a = ctx.getImageData(0, 0, c.width, c.height).data;
    const b = bctx.getImageData(0, 0, board.width, board.height).data;
    let n = 0;
    for (let i = 0; i < a.length; i++) if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > 2) n++;
    return {
      n,
      size: [c.width, c.height, board.width, board.height],
      dark: a.filter((x, i) => i % 4 === 0 && x < 100).length,
    };
  }, base64);
  expect(diff.size[0]).toBe(diff.size[2]);
  expect(diff.size[1]).toBe(diff.size[3]);
  expect(diff.dark).toBeGreaterThan(100);
  expect(diff.n).toBe(0);
});

test('TikZ: snippet and standalone document, copy and download', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openEuler(page);
  await format(page, 'TikZ');
  const snippet = await content(page).inputValue();
  expect(snippet).toContain('\\begin{tikzpicture}');
  expect(snippet).toMatch(/\\definecolor\{gmc\d+\}\{HTML\}\{FF0000\}/u);
  expect(snippet).not.toContain('\\documentclass');
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(snippet);
  expect((await download(page, 'euler-line.tikz.tex')).bytes.toString('utf8')).toBe(snippet);
  await page
    .getByRole('radiogroup', { name: 'TikZ form' })
    .getByLabel('Standalone document')
    .check();
  const doc = await content(page).inputValue();
  expect(doc.startsWith('\\documentclass[11pt]{standalone}')).toBe(true);
  expect((await download(page, 'euler-line.tex')).name).toBe('euler-line.tex');
});

test('Asymptote: standalone with helpers, and the AoPS form with olympiad.asy', async ({
  page,
}) => {
  await openEuler(page);
  await format(page, 'Asymptote');
  const asy = await content(page).inputValue();
  expect(asy).toContain('pair O = gm_circumcenter(A, B, C);');
  expect(asy).toContain('pair H = gm_orthocenter(A, B, C);');
  expect(asy).not.toContain('import olympiad;');
  expect((await download(page, 'euler-line.asy')).bytes.toString('utf8')).toBe(asy);
  await page
    .getByRole('radiogroup', { name: 'Asymptote dialect' })
    .getByLabel('AoPS (olympiad.asy)')
    .check();
  await expect(page.getByText('checked by hand, not compiled automatically')).toBeVisible();
  const aops = await content(page).inputValue();
  expect(aops).toContain('import olympiad;');
  expect(aops).toContain('pair O = circumcenter(A, B, C);');
  expect((await download(page, 'euler-line.aops.asy')).name).toBe('euler-line.aops.asy');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Export' })).toHaveCount(0);
});

test('a character TeX cannot write is reported in the TeX formats, not in SVG', async ({
  page,
}) => {
  await openApp(page);
  await command(page, 'P = (0, 0)');
  await command(page, 't = text((1, 1), "café")');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const warnings = page.getByRole('list', { name: 'Export warnings' });
  await expect(warnings).toHaveCount(0);
  await expect(content(page)).toHaveValue(/café/u);
  await format(page, 'TikZ');
  await expect(warnings).toContainText(
    'the label of t has a character TeX cannot write ("é", U+00E9): written as ?',
  );
  await expect(content(page)).toHaveValue(
    /% Warning: the label of t has a character TeX cannot write/u,
  );
  await expect(content(page)).toHaveValue(/\{caf\?\}/u);
  await format(page, 'Asymptote');
  await expect(warnings).toHaveCount(1);
  await expect(content(page)).toHaveValue(/\/\/ Warning: the label of t/u);
  expect(await page.getByRole('dialog', { name: 'Export' }).innerText()).not.toMatch(RESERVED);
});

/**
 * Golden PNG per example (Run 9a, item 3): the 1× PNG export of every example, compared as an
 * image with a committed baseline (the text formats' goldens are in packages/export). The same
 * small tolerance as Run 7's canvas baselines, for the anti-aliasing of text across font
 * rasterisers; geometry must match.
 */
const PNG_GOLDEN = [
  'euler-line',
  'feuerbach',
  'incenter-excenter',
  'miquel',
  'nine-point-circle',
  'radical-axes',
  'reflection-layer',
  'simson',
];

for (const id of PNG_GOLDEN)
  test(`PNG golden: ${id}`, async ({ page }) => {
    const errors = await openApp(page);
    await page.getByLabel('Example').selectOption(id);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await format(page, 'PNG');
    await page.getByRole('radiogroup', { name: 'Pixel ratio' }).getByLabel('1×').check();
    // The file is named after the figure's title, e.g. "incenter-excenter-lemma.png".
    const wait = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Download [a-z0-9-]+\.png$/u }).click();
    const bytes = readFileSync(await (await wait).path());
    expect(bytes.toString('utf8')).toContain('GEOMIRA');
    expect(bytes).toMatchSnapshot(`${id}.png`, { maxDiffPixelRatio: 0.002 });
    expect(errors).toEqual([]);
  });
