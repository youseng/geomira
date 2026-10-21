/**
 * Helpers of the Run 8b flows: open the page, run command-bar lines, read the text panel,
 * aim at world coordinates on the canvas (the canvas publishes its viewport as data
 * attributes; the mapping is the scene's toScreen), and read the claims panel.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export async function openApp(page: Page, url = './'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await expect(page.getByLabel('Geometry canvas')).toBeVisible();
  return errors;
}

export function commandInput(page: Page): Locator {
  return page.getByLabel('Command', { exact: true });
}

/** Runs one command-bar line and checks it was accepted (the bar empties). */
export async function command(page: Page, line: string): Promise<void> {
  const input = commandInput(page);
  await input.fill(line);
  await input.press('Enter');
  await expect(input).toHaveValue('');
}

export async function tab(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
}

/** The text panel's field (the Text tab opened). */
export async function textArea(page: Page): Promise<Locator> {
  await tab(page, 'Text');
  return page.getByLabel('Text', { exact: true });
}

/** The figure's text as the text panel shows it now. */
export async function text(page: Page): Promise<string> {
  return (await textArea(page)).inputValue();
}

function escaped(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Waits until the text panel shows every one of `lines` (each a whole line). */
export async function expectLines(page: Page, ...lines: string[]): Promise<void> {
  const area = await textArea(page);
  for (const line of lines) await expect(area).toHaveValue(new RegExp(`^${escaped(line)}$`, 'mu'));
}

/** Page coordinates of a world point (the scene's toScreen on the canvas's box). */
export async function screenOf(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const canvas = page.getByLabel('Geometry canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no canvas box');
  // The page maps with the canvas's client size (whole CSS px), from its box's corner.
  const vp = await canvas.evaluate((c) => ({
    cx: Number(c.getAttribute('data-cx')),
    cy: Number(c.getAttribute('data-cy')),
    zoom: Number(c.getAttribute('data-zoom')),
    width: c.clientWidth,
    height: c.clientHeight,
  }));
  return {
    x: box.x + (x - vp.cx) * vp.zoom + vp.width / 2,
    y: box.y + vp.height / 2 - (y - vp.cy) * vp.zoom,
  };
}

export async function clickWorld(page: Page, x: number, y: number): Promise<void> {
  const p = await screenOf(page, x, y);
  await page.mouse.click(p.x, p.y);
}

/** Drags with the mouse from one world point to another, in steps. */
export async function dragWorld(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
): Promise<void> {
  const a = await screenOf(page, from[0], from[1]);
  const b = await screenOf(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

export async function tool(page: Page, label: string): Promise<void> {
  await page
    .getByRole('toolbar', { name: 'Tools' })
    .getByRole('button', { name: label, exact: true })
    .click();
}

/** The claim list item of the claim on the printed line that starts with `prefix`. */
export function claimItem(page: Page, prefix: string): Locator {
  return page
    .getByRole('list', { name: 'Claims' })
    .getByRole('listitem')
    .filter({ hasText: prefix });
}

/** Words the v1 user-facing text never uses (CLAUDE.md), built so this file does not contain them. */
export const RESERVED = new RegExp(['pro' + 'ved', 'pro' + 'of', 'pro' + 'ven'].join('|'), 'iu');
