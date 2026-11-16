/** ADR-0074: visible workflows composed with files, properties and native source assistance. */
import { expect, test } from '@playwright/test';
import { command, openApp, tab, tool } from './helpers';

test('a newcomer can create, construct, style, save and export through visible controls', async ({
  page,
}) => {
  await openApp(page, './index.html');
  await page.getByRole('button', { name: 'Create a triangle', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);
  const search = page.getByRole('combobox', { name: 'Find a tool' });
  await search.fill('circumcentre');
  await search.press('Enter');
  await tab(page, 'Objects');
  for (const name of ['A', 'B', 'C'])
    await page.getByRole('tabpanel').getByRole('button', { name, exact: true }).click();
  await tool(page, 'Move');
  await page.getByRole('tabpanel').getByRole('button', { name: 'O', exact: true }).click();
  await page.getByRole('button', { name: 'Properties', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'Style of O', exact: true });
  const bounds = await card.boundingBox();
  const view = page.viewportSize();
  if (bounds === null || view === null) throw new Error('no property card');
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(view.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(view.height);
  await card.getByRole('button', { name: 'blue', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: 'Save As / Duplicate', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Document files' });
  await dialog.getByLabel('Document name').fill('My triangle');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('My-triangle.geo');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  await expect(page.getByLabel('Export content')).toHaveValue(/<svg/u);
});

for (const view of [
  { width: 390, height: 380 },
  { width: 760, height: 390 },
]) {
  test(`native source assistance remains reachable in ${String(view.width)}x${String(view.height)}`, async ({
    page,
  }) => {
    await page.setViewportSize(view);
    await openApp(page, './index.html');
    await tab(page, 'Text');
    const field = page.getByLabel('Text', { exact: true });
    await field.fill('A=(0,0)\nB=(4,0)\nM=midp');
    await field.press('Control+Space');
    const option = page.getByRole('option').filter({ hasText: 'midpoint' });
    await option.click();
    await expect(field).toHaveValue(/M=midpoint\($/u);
    await field.fill('A=(0,0)\nM=midpoint(A,Z)');
    const error = page
      .getByRole('list', { name: 'Diagnostics' })
      .getByRole('button')
      .filter({ hasText: 'Z' })
      .first();
    await error.click();
    await expect(field).toBeFocused();
    const span = await field.evaluate((e: HTMLTextAreaElement) =>
      e.value.slice(e.selectionStart, e.selectionEnd),
    );
    expect(span).toBe('Z');
    await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
    await page.getByRole('button', { name: 'Show all tools', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Tools', exact: true })).toBeVisible();
  });
}

test('text enlargement keeps menu controls inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 768 });
  await openApp(page, './index.html');
  await page.addStyleTag({ content: 'body {font-size:20px}' });
  for (const name of ['File', 'Export', 'Help', 'More actions']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    if (box === null) throw new Error('missing control');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(820);
  }
  await page.getByRole('button', { name: 'More actions', exact: true }).click();
  await expect(page.getByLabel('Triangle type')).toBeVisible();
});

test('keyboard navigation alone constructs, inspects and exports a figure', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page, './index.html');
  const reach = async (target: ReturnType<typeof page.getByRole>) => {
    // Native Firefox leaves the document at its final Tab stop; navigate backwards to
    // earlier controls instead of assuming that a forward Tab wraps through browser chrome.
    const backwards = await target.evaluate((e) => {
      const active = document.activeElement;
      return (
        active !== null && !!(active.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING)
      );
    });
    for (let i = 0; i < 60 && !(await target.evaluate((e) => e === document.activeElement)); i++)
      await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    await expect(target).toBeFocused();
  };
  await reach(page.getByRole('button', { name: 'Create a triangle', exact: true }));
  await page.keyboard.press('Enter');
  const search = page.getByRole('combobox', { name: 'Find a tool' });
  await reach(search);
  await page.keyboard.type('circumcenter');
  await page.keyboard.press('Enter');
  await reach(page.getByRole('tab', { name: 'Objects', exact: true }));
  await page.keyboard.press('Enter');
  for (const name of ['A', 'B', 'C']) {
    await reach(page.getByRole('tabpanel').getByRole('button', { name, exact: true }));
    await page.keyboard.press('Enter');
  }
  await reach(search);
  await page.keyboard.type('Move');
  await page.keyboard.press('Enter');
  await reach(page.getByRole('tabpanel').getByRole('button', { name: 'O', exact: true }));
  await page.keyboard.press('Enter');
  await reach(page.getByRole('button', { name: 'Properties', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Style of O', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await reach(page.getByRole('button', { name: 'Export', exact: true }));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Export', exact: true })).toBeVisible();
});

for (const height of [844, 380]) {
  test(`phone source shows several editable lines at height ${String(height)}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height });
    await openApp(page, './index.html');
    await tab(page, 'Text');
    const field = page.getByLabel('Text', { exact: true });
    await field.scrollIntoViewIfNeeded();
    const input = await field.boundingBox();
    const surface = await page.locator('.script-editor').boundingBox();
    if (input === null || surface === null) throw new Error('no source surface');
    expect(input.height).toBeGreaterThanOrEqual(120);
    expect(surface.height).toBeGreaterThanOrEqual(120);
    expect(input.y).toBeGreaterThanOrEqual(0);
    const visibleHeight = Math.min(height, input.y + input.height) - Math.max(0, input.y);
    expect(visibleHeight).toBeGreaterThanOrEqual(120);
    for (const name of ['Apply text', 'Revert text']) {
      const target = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(target?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await field.fill('A=(0,0)\nB=(4,0)\nM=midpoint(A,Z)');
    const diagnostic = page.getByRole('list', { name: 'Diagnostics' }).getByRole('button').first();
    await diagnostic.click();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('A=(0,0)\nB=(4,0)\nM=midpoint(A,Z)');
  });
}

test('an expanded phone panel leaves a refused tool input visibly explained', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, './index.html');
  await page.getByRole('button', { name: 'Create a triangle', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Find a tool' });
  await command(page, 'l=line(A,B)');
  await search.fill('Circumcenter');
  await search.press('Enter');
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 'Expand panel', exact: true }).click();
  await page.getByRole('tabpanel').getByRole('button', { name: 'l', exact: true }).click();
  const notice = page.locator('.notice');
  await expect(notice).toContainText(/point/iu);
  const visible = await notice.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
  expect(visible).toBe(true);
  await expect(page.getByRole('status', { name: 'Current tool' })).toContainText(/first|pick/iu);
});

test('keyboard tool search keeps the active result visible in a long list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await openApp(page, './index.html');
  const field = page.getByRole('combobox', { name: 'Find a tool' });
  await field.fill('circle');
  const options = page.getByRole('listbox', { name: 'Matching tools' }).getByRole('option');
  const count = await options.count();
  expect(count).toBeGreaterThan(5);
  for (let i = 0; i < count; i++) await field.press('ArrowDown');
  const selected = page
    .getByRole('listbox', { name: 'Matching tools' })
    .getByRole('option', { selected: true });
  const label = await selected.locator('strong').innerText();
  const active = await selected.boundingBox();
  const popup = await page.locator('.tool-results').boundingBox();
  if (active === null || popup === null) throw new Error('missing results');
  expect(active.y).toBeGreaterThanOrEqual(popup.y);
  expect(active.y + active.height).toBeLessThanOrEqual(popup.y + popup.height);
  await field.press('Enter');
  await expect(page.getByRole('status', { name: 'Current tool' })).toContainText(label);
});

test('guided triangle creation transfers keyboard focus to tool search', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page, './index.html');
  const create = page.getByRole('button', { name: 'Create a triangle', exact: true });
  await create.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);
  const search = page.getByRole('combobox', { name: 'Find a tool' });
  await expect(search).toBeFocused();
  await page.keyboard.type('circumcenter');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Current tool' })).toContainText('Circumcenter');
});
