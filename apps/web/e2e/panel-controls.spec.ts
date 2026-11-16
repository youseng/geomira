/** ADR-0074: panel navigation owns separate native targets and never edits the figure. */
import { expect, test, type Locator } from '@playwright/test';
import { command, openApp } from './helpers';

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
    await page.getByRole('button', { name: 'Show panels', exact: true }).click();
    await page.getByRole('tab', { name: 'Text', exact: true }).click();
    await expect(field).toHaveValue(draft);
  });
}
