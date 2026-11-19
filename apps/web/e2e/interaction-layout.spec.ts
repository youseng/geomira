/** ADR-0074: controls never intercept the next geometry interaction. */
import { expect, test, type Page } from '@playwright/test';
import { clickWorld, command, openApp, screenOf, text, tool } from './helpers';
import { expectHeaderClear, fitAfterPageScroll } from './layout-visibility';
import { nativeWorldPoint, pointText } from './native-pointer';

for (const route of ['palette', 'search', 'shortcut', 'command', 'command polygon then point']) {
  test(`choosing Point by ${route} clears the guide before a center canvas click`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await openApp(page, './index.html');
    await expect(page.getByRole('region', { name: 'Getting started' })).toBeVisible();
    if (route.startsWith('command')) {
      if (route === 'command polygon then point') {
        await command(page, 'tool polygon');
        await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);
      }
      await command(page, 'tool point');
    } else if (route === 'palette') await tool(page, 'Point');
    else if (route === 'search') {
      await page.getByRole('combobox', { name: 'Find a tool' }).fill('Point');
      await page
        .getByRole('option')
        .filter({ has: page.getByText('Point', { exact: true }) })
        .click();
    } else {
      await page.getByLabel('Geometry canvas').focus();
      await page.keyboard.press('p');
    }
    await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);
    const canvas = page.getByLabel('Geometry canvas');
    await canvas.scrollIntoViewIfNeeded();
    const before = await canvas.boundingBox();
    if (before === null) throw new Error('missing canvas');
    const actual = await nativeWorldPoint(page, () => clickWorld(page, 0, 0));
    expect(await canvas.boundingBox()).toEqual(before);
    await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);
    const source = await text(page);
    expect(source).toBe(`@version 1\nA = ${pointText(actual)}\n`);
    expect(
      source.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('@')),
    ).toEqual([`A = ${pointText(actual)}`]);
  });
}

async function figure(page: Page) {
  await page.setViewportSize({ width: 390, height: 664 });
  await openApp(page, './index.html');
  for (const line of ['A=(0,0)', 'B=(4,0)', 'C=(1,3)']) await command(page, line);
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
}

test('rename save status cannot move View between pointer down and click', async ({ page }) => {
  await figure(page);
  const point = await screenOf(page, 1, 3);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await page
    .getByRole('dialog', { name: 'Style of C', exact: true })
    .getByLabel('Name', { exact: true })
    .fill('P');
  const view = page.getByRole('button', { name: 'View', exact: true });
  const before = await view.boundingBox();
  if (before === null) throw new Error('no View control');
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText('Saving');
  expect(await view.boundingBox()).toEqual(before);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: /^Fit the figure/u })).toBeVisible();
  await page.getByRole('button', { name: /^Fit the figure/u }).click();
  expect(await text(page)).toContain('P = (1, 3)');
});

test('card Escape keeps the same point under the next right-click', async ({ page }) => {
  await figure(page);
  const canvas = page.getByLabel('Geometry canvas');
  const before = await canvas.boundingBox();
  const point = await screenOf(page, 1, 3);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(page.getByRole('dialog', { name: 'Style of C', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await canvas.boundingBox()).toEqual(before);
  expect(
    await canvas.evaluate(
      (element, at) => document.elementFromPoint(at.x, at.y) === element,
      point,
    ),
  ).toBe(true);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(page.getByRole('dialog', { name: 'Style of C', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await text(page)).toContain('C = (1, 3)');
  expect(await text(page)).not.toContain('hidden');
});

for (const viewport of [
  { width: 320, height: 664 },
  { width: 390, height: 664 },
  { width: 760, height: 664 },
  { width: 390, height: 420 },
  { width: 820, height: 390 },
]) {
  test(`Text and actually exposed canvas stay useful at ${String(viewport.width)}x${String(viewport.height)}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openApp(page, './index.html');
    await command(page, 'A=(0,0)');
    await page.getByRole('tab', { name: 'Text', exact: true }).click();
    const field = page.getByLabel('Text', { exact: true });
    await field.focus();
    await expectHeaderClear(page);
    const exposed = await page.getByLabel('Geometry canvas').evaluate((canvas) => {
      const r = canvas.getBoundingClientRect();
      let longest = 0;
      for (const fraction of [0.1, 0.5, 0.9]) {
        let run = 0;
        for (let y = Math.ceil(Math.max(0, r.top)); y < Math.min(innerHeight, r.bottom); y++) {
          run = document.elementFromPoint(r.left + r.width * fraction, y) === canvas ? run + 1 : 0;
          longest = Math.max(longest, run);
        }
      }
      return {
        longest,
        center: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === canvas,
      };
    });
    expect(exposed.longest).toBeGreaterThanOrEqual(120);
    expect(exposed.center).toBe(true);
    const input = await field.boundingBox();
    if (input === null) throw new Error('no source');
    expect(
      Math.min(viewport.height, input.y + input.height) - Math.max(0, input.y),
    ).toBeGreaterThanOrEqual(120);
    await fitAfterPageScroll(page);
    await field.focus();
    await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
    if (viewport.height < 450)
      await page.getByRole('button', { name: 'Show all tools', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Tools', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Command', exact: true }).focus();
    await expect(page.getByRole('textbox', { name: 'Command', exact: true })).toBeFocused();
  });
}

for (const width of [320, 390]) {
  for (const name of ['View', 'Settings']) {
    test(`${name} closes with its own invoker at ${String(width)}px without a hidden action`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 664 });
      await openApp(page, './index.html');
      await command(page, 'A=(0,0)');
      const canvas = page.getByLabel('Geometry canvas');
      const before = await canvas.evaluate((e) =>
        ['data-cx', 'data-cy', 'data-zoom'].map((a) => e.getAttribute(a)),
      );
      const invoker = page.getByRole('button', { name, exact: true });
      await invoker.click();
      await expect(invoker).toHaveAttribute('aria-expanded', 'true');
      expect(
        await invoker.evaluate((button) => {
          const r = button.getBoundingClientRect();
          return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      ).toBe(true);
      await invoker.click();
      await expect(invoker).toHaveAttribute('aria-expanded', 'false');
      expect(
        await canvas.evaluate((e) =>
          ['data-cx', 'data-cy', 'data-zoom'].map((a) => e.getAttribute(a)),
        ),
      ).toEqual(before);
    });
  }
}

test('Zoom controls never cover B and Properties remains visible at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 664 });
  await openApp(page, './index.html');
  for (const line of ['A=(0,0)', 'B=(4,0)', 'C=(1,3)']) await command(page, line);
  await page.getByRole('tab', { name: 'Text', exact: true }).click();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  const canvas = page.getByLabel('Geometry canvas');
  const point = await screenOf(page, 4, 0);
  const zoom = await canvas.getAttribute('data-zoom');
  expect(
    await canvas.evaluate((element, p) => document.elementFromPoint(p.x, p.y) === element, point),
  ).toBe(true);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.selbar-what')).toHaveText('B');
  expect(await canvas.getAttribute('data-zoom')).toBe(zoom);
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no canvas');
  for (const name of ['Zoom in', 'Zoom out', 'Fit', 'Properties']) {
    const control = page.getByRole('button', { name, exact: true });
    const c = await control.boundingBox();
    if (c === null) throw new Error('no control');
    expect(c.y + c.height).toBeLessThanOrEqual(box.y);
    expect(
      await control.evaluate((button) => {
        const r = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
  }
});

test('box selection outline starts at the delivered canvas pointer below the controls strip', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await openApp(page, './index.html');
  await tool(page, 'Move');
  const canvas = page.getByLabel('Geometry canvas');
  await canvas.scrollIntoViewIfNeeded();
  const r = await canvas.boundingBox();
  if (r === null) throw new Error('no canvas');
  const start = { x: Math.ceil(r.x + 12), y: Math.ceil(r.y + 12) };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 50, start.y + 40, { steps: 4 });
  const box = await page.locator('.selbox').boundingBox();
  if (box === null) throw new Error('no box selection outline');
  expect(Math.round(box.x)).toBe(start.x);
  expect(Math.round(box.y)).toBe(start.y);
  expect(Math.round(box.width)).toBe(50);
  expect(Math.round(box.height)).toBe(40);
  await page.mouse.up();
  await expect(page.locator('.selbox')).toHaveCount(0);
});
