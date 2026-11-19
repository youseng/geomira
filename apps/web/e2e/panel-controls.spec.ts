/** ADR-0074: panel navigation owns separate native targets and never edits the figure. */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { viewAction, command, openApp } from './helpers';

async function pointerTarget(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  expect(
    await control.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
  ).toBe(true);
}

test('a partially visible native Text focus exposes source and figure without changing the draft', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 420 });
  const errors = await openApp(page, './index.html');
  await command(page, 'A=(0,0)');
  await page.getByRole('tab', { name: 'Text', exact: true }).click();
  const field = page.getByLabel('Text', { exact: true });
  const draft = '@version 1\nA=(0,0)\nM=midpoint(\n# preserve raw source';
  await field.fill(draft);
  // Reproduce WebKit's traced native-focus placement (only62px of source visible).
  // preventScroll injects that browser alignment; this is a real DOM focus, not a
  // synthetic focus/pointer event or a changed viewport/layout assertion.
  await field.evaluate((element: HTMLTextAreaElement) => {
    element.blur();
    // Older browsers have no visualViewport global; the host still uses innerHeight.
    Reflect.deleteProperty(window, 'visualViewport');
    const app = element.closest('.app');
    if (!(app instanceof HTMLElement)) throw new Error('no workspace scroll host');
    app.scrollTop += element.getBoundingClientRect().top - (innerHeight - 62);
    element.focus({ preventScroll: true });
    element.setSelectionRange(17, 17);
  });
  await expect
    .poll(async () => {
      const box = await field.boundingBox();
      return box === null ? 0 : Math.min(420, box.y + box.height) - Math.max(0, box.y);
    })
    .toBeGreaterThanOrEqual(120);
  await expect(field).toHaveValue(draft);
  expect(errors).toEqual([]);
  expect(await field.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(17);
  const figure = await page.getByLabel('Geometry canvas').boundingBox();
  if (figure === null) throw new Error('no figure');
  expect(Math.min(420, figure.y + figure.height) - Math.max(0, figure.y)).toBeGreaterThanOrEqual(
    120,
  );
  expect(
    await page.getByLabel('Geometry canvas').evaluate((element) => {
      const box = element.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === element;
    }),
  ).toBe(true);
});

for (const width of [320, 390]) {
  test(`all panel tabs and native size/close controls remain reachable at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 664 });
    await openApp(page, './index.html');
    await command(page, 'A=(0,0)');
    await command(page, 'B=(4,0)');
    await page.getByRole('tab', { name: 'Text', exact: true }).click();
    const field = page.getByLabel('Text', { exact: true });
    const draft = '@version 1\nA=(9,9)\nM=midpoint(\n# keep this raw draft';
    await field.fill(draft);
    const expand = page.getByRole('button', { name: 'Expand panel', exact: true });
    await pointerTarget(expand);
    await expand.click();
    const compact = page.getByRole('button', { name: 'Compact panel', exact: true });
    await pointerTarget(compact);
    await compact.press('Space');
    await expect(expand).toBeFocused();
    for (const name of ['Text', 'Objects', 'Layers', 'Help', 'Text']) {
      const tab = page.getByRole('tab', { name, exact: true });
      await pointerTarget(tab);
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    }
    await expect(field).toHaveValue(draft);
    await expand.focus();
    await expand.press('Enter');
    await expect(compact).toBeFocused();
    await compact.press('Enter');
    await expect(field).toHaveValue(draft);
    await page.getByRole('tab', { name: 'Objects', exact: true }).click();
    const objects = page.getByRole('tabpanel');
    await expect(objects.getByRole('button', { name: 'A', exact: true })).toBeVisible();
    await expect(objects.getByRole('button', { name: 'B', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(objects.getByRole('button', { name: 'B', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(objects.getByRole('button', { name: 'B', exact: true })).toBeVisible();
    const hide = page.getByRole('button', { name: 'Hide panels', exact: true });
    await pointerTarget(hide);
    await hide.click();
    await viewAction(page, 'Show panels');
    await page.getByRole('tab', { name: 'Text', exact: true }).click();
    await expect(field).toHaveValue(draft);
  });
}

async function validFigureDownload(page: Page) {
  await page.getByRole('button', { name: /^File: /u }).click();
  await page.getByRole('button', { name: 'Save / Download .geo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Save figure', exact: true });
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download current valid figure', exact: true }).click();
  const path = await (await pending).path();
  const source = await readFile(path, 'utf8');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  return source;
}

async function canvasDocumentBounds(page: Page) {
  const board = page.getByLabel('Geometry canvas');
  await board.scrollIntoViewIfNeeded();
  return board.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const app = e.closest('.app');
    if (!(app instanceof HTMLElement)) throw new Error('no workspace');
    return { x: r.x + app.scrollLeft, y: r.y + app.scrollTop, width: r.width, height: r.height };
  });
}

for (const expanded of [false, true]) {
  for (const palette of [false, true]) {
    test(`short invalid Text leaves Command exposed: ${expanded ? 'expanded' : 'compact'}, tools ${palette ? 'shown' : 'hidden'}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 380 });
      const errors = await openApp(page, './index.html');
      for (const line of ['A=(0,0)', 'B=(4,0)']) await command(page, line);
      await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
        'Saved locally',
      );
      if (palette) await viewAction(page, 'Show all tools');
      await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
      const closed = await canvasDocumentBounds(page);
      const board = page.getByLabel('Geometry canvas');
      const camera = await board.evaluate((e) => [
        e.dataset['cx'],
        e.dataset['cy'],
        e.dataset['zoom'],
      ]);
      const input = page.getByLabel('Command', { exact: true });
      await input.fill('C=midpoint(');
      await page.getByRole('tab', { name: 'Text', exact: true }).click();
      const field = page.getByLabel('Text', { exact: true });
      const draft = '@version 1\nA=(9,9)\nM=midpoint(\n# keep this invalid draft';
      await field.fill(draft);
      await field.evaluate((element: HTMLTextAreaElement) => {
        element.setSelectionRange(17, 17);
      });
      if (expanded) {
        const expand = page.getByRole('button', { name: 'Expand panel', exact: true });
        await pointerTarget(expand);
        await expand.click();
      }
      if (expanded && palette) await page.getByText('Editor help', { exact: true }).click();
      await input.focus();
      await pointerTarget(input);
      await expect(input).toBeFocused();
      await expect(input).toHaveValue('C=midpoint(');
      await input.click();
      await input.press('End');
      await input.press('B');
      await expect(input).toHaveValue('C=midpoint(B');
      await expect(field).toHaveValue(draft);
      expect(await field.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(
        17,
      );
      expect(
        await board.evaluate((e) => [e.dataset['cx'], e.dataset['cy'], e.dataset['zoom']]),
      ).toEqual(camera);
      expect((await page.locator('.side.open').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
        280,
      );
      await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
      expect(await canvasDocumentBounds(page)).toEqual(closed);
      await viewAction(page, 'Show panels');
      await expect(field).toHaveValue(draft);
      const ab = '@version 1\nA = (0, 0)\nB = (4, 0)\n';
      expect(await validFigureDownload(page)).toBe(ab);
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      expect(await validFigureDownload(page)).toBe('@version 1\nA = (0, 0)\n');
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      expect(await validFigureDownload(page)).toBe(ab);
      await expect(field).toHaveValue(draft);
      await expect(input).toHaveValue('C=midpoint(B');
      expect(errors).toEqual([]);
    });
  }
}
