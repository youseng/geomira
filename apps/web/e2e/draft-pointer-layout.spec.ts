/** Applying source on pointer-down must preserve the physical input target. ADR-0074. */
import { expect, test } from '@playwright/test';
import { command, dragWorld, openApp, screenOf, text, textArea, tool } from './helpers';
import { nativeWorldPoint, pointText } from './native-pointer';

test('a draft applied by native canvas input preserves its canvas bounds and drag history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openApp(page, './index.html');
  for (const line of ['A=(0,0)', 'B=(4,0)', 'C=(1,3)']) await command(page, line);
  await tool(page, 'Move');
  const area = await textArea(page);
  await area.fill((await area.inputValue()).replace('C = (1, 3)', 'C = (2, 3)'));
  await expect(page.getByRole('status').filter({ hasText: 'Unapplied text draft' })).toBeVisible();
  const canvas = page.getByLabel('Geometry canvas');
  await canvas.scrollIntoViewIfNeeded();
  const before = await canvas.boundingBox();
  if (before === null) throw new Error('missing canvas');
  const actual = await nativeWorldPoint(page, () => dragWorld(page, [4, 0], [5, 1]));
  expect(await canvas.boundingBox()).toEqual(before);
  await expect(page.getByRole('status').filter({ hasText: 'Unapplied text draft' })).toHaveCount(0);
  const dragged = `@version 1\nA = (0, 0)\nB = ${pointText(actual)}\nC = (2, 3)\n`;
  expect(await text(page)).toBe(dragged);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await text(page)).toBe('@version 1\nA = (0, 0)\nB = (4, 0)\nC = (2, 3)\n');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await text(page)).toBe(dragged);
});

for (const width of [320, 390, 768, 1280]) {
  test(`draft status preserves header and input layout at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await openApp(page, './index.html');
    for (const line of ['A=(0,0)', 'B=(4,0)', 'C=(1,3)']) await command(page, line);
    await tool(page, 'Move');
    const area = await textArea(page);
    await area.fill((await area.inputValue()).replace('C = (1, 3)', 'C = (2, 3)'));
    const status = page.getByRole('status').filter({ hasText: 'Unapplied text draft' });
    await expect(status).toBeVisible();
    const header = page.locator('.topbar');
    const canvas = page.getByLabel('Geometry canvas');
    await canvas.scrollIntoViewIfNeeded();
    const before = { header: await header.boundingBox(), canvas: await canvas.boundingBox() };
    await canvas.click({ position: { x: 12, y: 12 } });
    expect({ header: await header.boundingBox(), canvas: await canvas.boundingBox() }).toEqual(
      before,
    );
    await expect(status).toHaveCount(0);
    expect(await text(page)).toBe('@version 1\nA = (0, 0)\nB = (4, 0)\nC = (2, 3)\n');
  });
}

const LONG_TITLE = 'This is a deliberately long document title used to exercise stable identity';

for (const transition of ['title', 'download feedback']) {
  test(`${transition} applied on native pointer-down preserves the input layout and history`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await openApp(page, './index.html');
    await command(page, 'A=(0,3)');
    await tool(page, 'Move');
    if (transition === 'download feedback') {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'File', exact: true }).click();
      await page.getByRole('button', { name: 'Save / Download .geo', exact: true }).click();
      await download;
    }
    const title = transition === 'title' ? `@title "${LONG_TITLE}"\n` : '';
    const extra = transition === 'download feedback' ? 'B = (4, 0)\n' : '';
    const applied = `@version 1\n${title}A = (0, 3)\n${extra}`;
    await (await textArea(page)).fill(applied);
    const canvas = page.getByLabel('Geometry canvas');
    await canvas.scrollIntoViewIfNeeded();
    const header = page.locator('.topbar');
    const before = { header: await header.boundingBox(), canvas: await canvas.boundingBox() };
    await canvas.evaluate((c) => {
      c.addEventListener(
        'pointerdown',
        () => {
          c.setAttribute(
            'data-draft-at-press',
            document.querySelector('.document-draft')?.getAttribute('data-active') ?? 'missing',
          );
        },
        { capture: true, once: true },
      );
    });
    const actual = await nativeWorldPoint(page, async () => {
      const from = await screenOf(page, 0, 3);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 25, from.y + 15, { steps: 4 });
      await page.mouse.up();
    });
    await expect(canvas).toHaveAttribute('data-draft-at-press', 'true');
    expect({ header: await header.boundingBox(), canvas: await canvas.boundingBox() }).toEqual(
      before,
    );
    const dragged = `@version 1\n${title}A = ${pointText(actual)}\n${extra}`;
    expect(await text(page)).toBe(dragged);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await text(page)).toBe(applied);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect(await text(page)).toBe(dragged);
  });
}
