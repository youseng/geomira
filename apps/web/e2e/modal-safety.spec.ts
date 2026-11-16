import { expect, test, type Page } from '@playwright/test';
import { clickWorld, command, openApp, tool } from './helpers';

async function openModal(page: Page, name: string) {
  await page
    .getByRole('button', { name: name === 'Debug report' ? 'Help' : 'Export', exact: true })
    .click();
  await page.getByRole('button', { name: name === 'Export' ? 'SVG' : name, exact: true }).click();
  return page.getByRole('dialog', { name, exact: true });
}

async function canonical(page: Page) {
  const report = await openModal(page, 'Debug report');
  const content = await report.getByRole('textbox').inputValue();
  await page.keyboard.press('Escape');
  const result = content.split('\ntext:\n')[1];
  if (result === undefined) throw new Error('debug report has no canonical document');
  return result;
}

// Deliberately leave both undo and redo populated. Compare the canonical document, then
// traverse the complete history: a leaked edit may leave the same text but destroy redo.
async function fixture(page: Page) {
  await openApp(page, './index.html');
  for (const line of ['A = (0, 0)', 'B = (4, 0)', 'C = (0, 3)']) await command(page, line);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const before = await canonical(page);
  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press('ControlOrMeta+a');
  return before;
}

async function unchangedHistory(page: Page, before: string) {
  expect(await canonical(page)).toBe(before);
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await undo.click();
  expect(await canonical(page)).toBe('@version 1\nA = (0, 0)\n');
  await undo.click();
  expect(await canonical(page)).toBe('@version 1\n');
  await expect(undo).toBeDisabled();
  await redo.click();
  await redo.click();
  expect(await canonical(page)).toBe(before);
  await redo.click();
  expect(await canonical(page)).toBe('@version 1\nA = (0, 0)\nB = (4, 0)\nC = (0, 3)\n');
  await expect(redo).toBeDisabled();
}

for (const name of ['Export', 'Share link', 'Debug report']) {
  test(`${name}: Delete behind the modal preserves the canonical figure and history`, async ({
    page,
  }) => {
    const before = await fixture(page);
    const dialog = await openModal(page, name);
    await dialog.focus();
    await page.keyboard.press('Delete');
    await page.keyboard.press('Escape');
    await unchangedHistory(page, before);
  });

  test(`${name}: container and button isolate every editor shortcut`, async ({ page }) => {
    const before = await fixture(page);
    const dialog = await openModal(page, name);
    const canvas = page.locator('canvas.board');
    const viewport = await canvas.evaluate((c) => [c.dataset.cx, c.dataset.cy, c.dataset.zoom]);
    for (const target of [dialog, dialog.getByRole('button', { name: 'Close', exact: true })]) {
      await target.focus();
      for (const key of [
        'Delete',
        'Backspace',
        'ControlOrMeta+z',
        'ControlOrMeta+Shift+z',
        'Control+y',
        'ControlOrMeta+a',
        'p',
        'l',
        '/',
        '?',
        '0',
        '[',
        ']',
      ])
        await page.keyboard.press(key);
      await expect(target).toBeFocused();
    }
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.selbar-what')).toHaveText('A, B');
    expect(await canvas.evaluate((c) => [c.dataset.cx, c.dataset.cy, c.dataset.zoom])).toEqual(
      viewport,
    );
    await unchangedHistory(page, before);
  });
}

test('Tab stays inside visible enabled controls; backdrop and assistive navigation are isolated', async ({
  page,
  browserName,
}, testInfo) => {
  const before = await fixture(page);
  const dialog = await openModal(page, 'Share link');
  await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await dialog.evaluate((d) => {
    const disabled = document.createElement('button');
    disabled.disabled = true;
    disabled.textContent = 'Disabled fixture';
    const hidden = document.createElement('button');
    hidden.hidden = true;
    hidden.textContent = 'Hidden fixture';
    d.append(disabled, hidden);
  });
  const field = dialog.getByRole('textbox');
  const copy = dialog.getByRole('button', { name: 'Copy link', exact: true });
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await field.focus();
  for (const target of [copy, close, field]) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
  }
  for (const target of [close, copy, field]) {
    await page.keyboard.press('Shift+Tab');
    await expect(target).toBeFocused();
  }
  // DOM role locators do not model showModal's implicit inertness. Inspect the browser's
  // accessibility tree itself rather than treating DOM presence as exposure.
  await expect(dialog).toHaveJSProperty('open', true);
  expect(await dialog.evaluate((d) => d.matches(':modal'))).toBe(true);
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const tree = await cdp.send('Accessibility.getFullAXTree');
    expect(tree.nodes.filter((n) => !n.ignored && n.name?.value === 'Randomize')).toEqual([]);
    expect(tree.nodes.filter((n) => !n.ignored && n.role?.value === 'dialog')).toHaveLength(1);
    await cdp.detach();
  }
  const background = page.locator('.topbar button').first();
  const box = await background.boundingBox();
  if (box === null) throw new Error('no background button');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const canvas = page.locator('canvas.board');
  const viewport = await canvas.evaluate((c) => [c.dataset.cx, c.dataset.cy, c.dataset.zoom]);
  const area = await canvas.boundingBox();
  if (area === null) throw new Error('no canvas');
  const corner = { x: area.x + 15, y: area.y + area.height - 15 };
  await page.mouse.click(corner.x, corner.y);
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.wheel(0, 100);
  if (testInfo.project.use.hasTouch === true) await page.touchscreen.tap(corner.x, corner.y);
  await page.locator('canvas.board').focus();
  await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.selbar-what')).toHaveText('A, B');
  expect(await canvas.evaluate((c) => [c.dataset.cx, c.dataset.cy, c.dataset.zoom])).toEqual(
    viewport,
  );
  await unchangedHistory(page, before);
});

test('native dialog text editing, selection, copying and undo keep their defaults', async ({
  page,
}) => {
  const before = await fixture(page);
  const dialog = await openModal(page, 'Share link');
  const field = dialog.getByRole('textbox');
  const original = await field.inputValue();
  await field.focus();
  await page.keyboard.press('ControlOrMeta+a');
  expect(
    await field.evaluate((e: HTMLInputElement) =>
      e.value.slice(e.selectionStart ?? 0, e.selectionEnd ?? 0),
    ),
  ).toBe(original);
  await page.keyboard.press('Delete');
  await expect(field).toHaveValue(original); // The product's share field remains read-only.
  // Exercise the same boundary with a future editable field, without adding a product UI.
  await dialog.evaluate((d) => {
    const edit = document.createElement('textarea');
    edit.setAttribute('aria-label', 'Editable fixture');
    d.append(edit);
    document.addEventListener(
      'copy',
      (e) => {
        queueMicrotask(() => {
          edit.dataset.copyPrevented = String(e.defaultPrevented);
        });
      },
      { once: true },
    );
  });
  const edit = dialog.getByLabel('Editable fixture');
  await edit.focus();
  await page.keyboard.type('alpha beta');
  await page.keyboard.press('Backspace');
  await expect(edit).toHaveValue('alpha bet');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+c');
  await expect(edit).toHaveAttribute('data-copy-prevented', 'false');
  await page.keyboard.press('Delete');
  await expect(edit).toHaveValue('');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(edit).toHaveValue('alpha bet');
  // Browser/system combinations are left alone by the application boundary.
  expect(
    await edit.evaluate((e) =>
      e.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true }),
      ),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await unchangedHistory(page, before);
});

test('Escape and close restore the menu invoker; repeated opening and a removed invoker stay usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === 'keydown') listeners.add(listener);
      add(type, listener, options);
    };
    window.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) {
      if (type === 'keydown') listeners.delete(listener);
      remove(type, listener, options);
    };
    Object.defineProperty(window, '__modalKeyListeners', { get: () => listeners.size });
  });
  await fixture(page);
  const listeners = await page.evaluate(() => Reflect.get(window, '__modalKeyListeners') as number);
  for (const name of ['Export', 'Share link', 'Debug report', 'Export']) {
    const trigger = page.getByRole('button', {
      name: name === 'Debug report' ? 'Help' : 'Export',
      exact: true,
    });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const item = page.getByRole('button', { name: name === 'Export' ? 'SVG' : name, exact: true });
    await item.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => Reflect.get(window, '__modalKeyListeners') as number)).toBe(
      listeners,
    );
  }
  const dialog = await openModal(page, 'Export');
  await page
    .locator('.menu-wrap')
    .filter({ has: page.locator('button[title="Export, share, restore"]') })
    .evaluate((e) => {
      e.remove();
    });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByLabel('Geometry canvas')).toBeFocused();
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: 'Point', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('canvas Delete and Backspace resume after closing a modal', async ({ page }) => {
  const before = await fixture(page);
  await openModal(page, 'Export');
  await page.keyboard.press('Escape');
  for (const key of ['Delete', 'Backspace']) {
    await page.getByLabel('Geometry canvas').focus();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press(key);
    expect(await canonical(page)).toBe('@version 1\n');
    await page.getByLabel('Geometry canvas').focus();
    await page.keyboard.press('ControlOrMeta+z');
    expect(await canonical(page)).toBe(before);
  }
});

test('a modal with no focusable children holds focus and Escape still dismisses it', async ({
  page,
}) => {
  await fixture(page);
  const dialog = await openModal(page, 'Export');
  await dialog.evaluate((d) => {
    for (const e of d.querySelectorAll('input, textarea, button')) e.setAttribute('disabled', '');
  });
  await dialog.focus();
  for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
    await page.keyboard.press(key);
    await expect(dialog).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeFocused();
});

test('Escape closes one modal without cancelling a pending two-pick construction', async ({
  page,
}, testInfo) => {
  await openApp(page, './index.html');
  await command(page, 'A = (0, 0)');
  await command(page, 'B = (4, 0)');
  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press('0');
  await tool(page, 'Line');
  await clickWorld(page, 0, 0);
  const hint = await page.locator('.tool-hint').innerText();
  const dialog = await openModal(page, 'Export');
  await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('p');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tool-hint')).toHaveText(hint);
  await expect(page.getByRole('button', { name: 'Line', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await clickWorld(page, 4, 0);
  expect(await canonical(page)).toContain('= line(A, B)');
  const reopened = await openModal(page, 'Export');
  await reopened.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await page.screenshot({ path: testInfo.outputPath('keyboard-export.png') });
  await page.keyboard.press('Escape');
  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press('ControlOrMeta+z');
  expect(await canonical(page)).not.toContain('= line(A, B)');
});
