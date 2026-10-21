import { expect, test } from '@playwright/test';
import { clickWorld, command, dragWorld, expectLines, openApp, tab, text, tool } from './helpers';

/** Run 8b flows (SPEC §15): building, dragging, undo/redo, derived layers. Desktop project. */

const TRIANGLE = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'];

test('triangle and circumcircle by mouse and by command bar give the identical text', async ({
  page,
  browser,
}) => {
  const errors = await openApp(page);
  await tool(page, 'Polygon');
  for (const [x, y] of [
    [0, 0],
    [4, 0],
    [1, 3],
    [0, 0],
  ] as const)
    await clickWorld(page, x, y);
  await tool(page, 'Circle (3 points)');
  for (const [x, y] of [
    [0, 0],
    [4, 0],
    [1, 3],
  ] as const)
    await clickWorld(page, x, y);
  await expectLines(page, 'c = circle(A, B, C)');
  const byMouse = await text(page);

  // A separate browser context: its own storage, so it does not open page 1's autosave.
  const other = await (await browser.newContext()).newPage();
  await openApp(other);
  for (const line of [...TRIANGLE, 'poly = polygon(A, B, C)', 'c = circle(A, B, C)'])
    await command(other, line);
  await expectLines(other, 'c = circle(A, B, C)');
  const byCommand = await text(other);
  expect(byMouse).toBe(byCommand);
  for (const line of [...TRIANGLE, 'poly = polygon(A, B, C)', 'c = circle(A, B, C)'])
    expect(byMouse.split('\n')).toContain(line);
  expect(errors).toEqual([]);
});

test('dragging a free point moves it, rounds it at the end, and undo returns', async ({ page }) => {
  await openApp(page);
  for (const line of [...TRIANGLE, 'M = midpoint(B, C)']) await command(page, line);
  await tool(page, 'Move');
  await dragWorld(page, [4, 0], [5, 1]);
  await expectLines(page, 'B = (5, 1)', 'M = midpoint(B, C)');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectLines(page, 'B = (4, 0)');
  // A point that is not free is not dragged: the press pans the view instead.
  const canvas = page.getByLabel('Geometry canvas');
  const before = await canvas.getAttribute('data-cx');
  await dragWorld(page, [2.5, 1.5], [3.5, 1.5]);
  await expect(canvas).not.toHaveAttribute('data-cx', before ?? '');
  await expectLines(page, 'B = (4, 0)');
});

/** A tiny seeded generator, so the random walk is the same in every run. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

test('50 random undo/redo steps: every step shows its text; redoing all returns the original', async ({
  page,
}) => {
  await openApp(page);
  await tab(page, 'Text');
  const area = page.getByLabel('Text', { exact: true });
  const lines = [
    ...TRIANGLE,
    'M = midpoint(B, C)',
    'l = line(A, M)',
    'c = circle(A, B, C)',
    'O = center(c)',
    'style O [color=red]',
    'claim on(O, line(O, M))',
    'H = orthocenter(A, B, C)',
  ];
  const texts = [await area.inputValue()];
  for (const line of lines) {
    const before = texts[texts.length - 1] ?? '';
    await command(page, line);
    // Every line changes the text: wait for the panel to show it before recording it.
    await expect(area).not.toHaveValue(before);
    texts.push(await area.inputValue());
  }
  const original = texts[texts.length - 1];
  const random = lcg(20261021);
  let at = texts.length - 1;
  for (let step = 0; step < 50; step++) {
    const undo = random() < 0.5;
    const name = undo ? 'Undo' : 'Redo';
    const button = page.getByRole('button', { name, exact: true });
    if (undo ? at === 0 : at === texts.length - 1) {
      await expect(button).toBeDisabled();
      continue;
    }
    await button.click();
    at += undo ? -1 : 1;
    await expect(area).toHaveValue(texts[at] ?? '');
  }
  while (at < texts.length - 1) {
    await page.keyboard.press('Control+Shift+Z');
    at++;
    await expect(area).toHaveValue(texts[at] ?? '');
  }
  expect(await area.inputValue()).toBe(original);
});

test('a derived layer from a transform, its images, and dragging an image moves its source', async ({
  page,
}) => {
  await openApp(page);
  for (const line of [...TRIANGLE, 'l = line(A, B)', 't = reflect(l)']) await command(page, line);
  await tool(page, 'Layer from transform');
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 't', exact: true }).click();
  await expectLines(page, '@layer image = image(t, main)');
  await tab(page, 'Layers');
  await expect(page.getByLabel('image', { exact: true })).toBeChecked();
  // C* = (1, -3), the mirror image of C in AB; dragging it moves C (drag-through, SPEC §8.4).
  await tool(page, 'Move');
  await dragWorld(page, [1, -3], [2, -2]);
  await expectLines(page, 'C = (2, 2)');
  await tab(page, 'Objects');
  await expect(page.getByText('reflect(l)')).toBeVisible();
});

test('command bar: completions from the registry; shortcuts and help from the keymap', async ({
  page,
}) => {
  await openApp(page);
  const input = page.getByLabel('Command', { exact: true });
  await input.fill('O = circumc');
  const list = page.getByRole('listbox', { name: 'Completions' });
  await expect(list).toContainText('circumcenter');
  await expect(list).toContainText('circumcircle');
  await input.press('Tab');
  await expect(input).toHaveValue(/^O = circum(center|circle)\($/u);
  await input.fill('');
  await page.getByLabel('Geometry canvas').click();
  await page.keyboard.press('c');
  const tools = page.getByRole('toolbar', { name: 'Tools' });
  await expect(tools.getByRole('button', { name: 'Circle (centre, point)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await tab(page, 'Help');
  await expect(page.getByRole('tabpanel')).toContainText('Circle (centre, point)');
  await expect(page.getByRole('tabpanel')).toContainText('Ctrl+Shift+Z');
});
