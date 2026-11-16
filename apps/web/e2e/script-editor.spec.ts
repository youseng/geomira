import { expect, test, type Locator, type Page } from '@playwright/test';
import { command, openApp, textArea, tab } from './helpers';

async function source(page: Page, value: string) {
  const field = await textArea(page);
  await field.fill(value);
  return field;
}
async function caret(field: Locator, at: number) {
  await field.evaluate((e: HTMLTextAreaElement, cursor: number) => {
    e.focus();
    e.setSelectionRange(cursor, cursor);
  }, at);
}

test('source assistance highlights and numbers exact text; blur preserves source until explicit formatting', async ({
  page,
}, testInfo) => {
  await openApp(page, './index.html');
  const value = '# geometry 🟢\nA=(0,0)\nB=(4,0)\nω=circle(A,2)\n';
  const field = await source(page, value);
  await expect(page.locator('.script-gutter')).toHaveText('1\n2\n3\n4\n5');
  await expect(page.locator('.script-highlight')).toContainText('# geometry 🟢');
  await expect(field).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.script-overlay')).toHaveCSS('pointer-events', 'none');
  await page.screenshot({ path: testInfo.outputPath('script-editor.png') });
  await page.waitForTimeout(650);
  await tab(page, 'Objects');
  await tab(page, 'Text');
  await expect(field).toHaveValue(value);
  await field.press('Control+Enter');
  await expect(field).toHaveValue(/A = \(0, 0\)/u);
  await expect(field).toHaveValue(/# geometry 🟢/u);
});

test('diagnostic activation scrolls to and selects the exact Unicode source span', async ({
  page,
}) => {
  await openApp(page, './index.html');
  const value = `A=(0,0)\n${Array.from({ length: 45 }, (_, i) => `# line ${String(i)} 🟢`).join('\n')}\nω=midpoint(A,Missing)\n`;
  const field = await source(page, value);
  const diagnostic = page
    .getByRole('list', { name: 'Diagnostics' })
    .getByRole('button')
    .filter({ hasText: 'Missing' });
  await diagnostic.click();
  await expect(field).toBeFocused();
  expect(
    await field.evaluate((e: HTMLTextAreaElement) =>
      e.value.slice(e.selectionStart, e.selectionEnd),
    ),
  ).toBe('Missing');
  expect(await field.evaluate((e: HTMLTextAreaElement) => e.scrollTop)).toBeGreaterThan(0);
  const top = await field.evaluate((e: HTMLTextAreaElement) => e.scrollTop);
  await expect(page.locator('.script-gutter pre')).toHaveCSS(
    'transform',
    `matrix(1, 0, 0, 1, 0, ${String(-top)})`,
  );
});

test('registry completion works in a middle line and after Greek names without changing surrounding source', async ({
  page,
}) => {
  await openApp(page, './index.html');
  const value = 'A=(0,0)\nω=circle(A,2)\nM = midp\n# keep suffix\n';
  const field = await source(page, value);
  await caret(field, value.indexOf('midp') + 4);
  await field.press('Control+Space');
  const list = page.getByRole('listbox', { name: 'Text completions' });
  await expect(list).toContainText('midpoint');
  await field.press('Tab');
  await expect(field).toHaveValue('A=(0,0)\nω=circle(A,2)\nM = midpoint(\n# keep suffix\n');
  await expect(page.locator('#script-signature')).toContainText('midpoint(');
  const after = await field.inputValue();
  await field.press('Control+Space');
  await field.press('Escape');
  await field.press('End');
  await field.press('Home');
  expect(await field.inputValue()).toBe(after);
  await field.fill('A=(0,0)\nω_1=circle(A,2)\nM = center(ω');
  await field.press('Control+Space');
  await expect(list).toContainText('ω_1');
  await field.press('Tab');
  await expect(field).toHaveValue(/center\(ω_1$/u);
  await field.fill('not_a_tool_xyz');
  await field.press('Control+Space');
  await expect(page.getByText('No matching completions.', { exact: true })).toBeVisible();
});

test('explicit command conversion preserves strings and nested separators, and completion supports pointer choice', async ({
  page,
}) => {
  await openApp(page, './index.html');
  const value = '@title "a;b"; A=(0,0); B=(4,0) # comment; keep';
  const field = await source(page, value);
  await page.getByRole('button', { name: 'Convert command separators to lines' }).click();
  await expect(field).toHaveValue('@title "a;b"\nA=(0,0)\nB=(4,0) # comment; keep');
  await field.fill('A=(0,0)\nB=(4,0)\nM=midp');
  await field.press('Control+Space');
  await page.getByRole('option').filter({ hasText: 'midpoint' }).click();
  await expect(field).toHaveValue('A=(0,0)\nB=(4,0)\nM=midpoint(');
  await expect(field).toBeFocused();
});

test('IME composition cannot apply partial text or accept a completion until composition ends', async ({
  page,
}) => {
  await openApp(page, './index.html?dev=1');
  await command(page, 'A=(0,0)');
  const field = await textArea(page);
  const before = await field.inputValue();
  await field.dispatchEvent('compositionstart');
  await field.fill(`${before}ω=(2,3)\n`);
  await field.dispatchEvent('compositionupdate', { data: 'ω' });
  await field.press('Control+Enter');
  await page.waitForTimeout(650);
  await expect(page.getByRole('listbox', { name: 'Text completions' })).toHaveCount(0);
  await expect(page.getByTestId('object-counts')).toContainText('1');
  await field.dispatchEvent('compositionend', { data: 'ω' });
  await page.waitForTimeout(650);
  await expect(field).toHaveValue(/ω=\(2,3\)/u);
  await tab(page, 'Objects');
  await expect(page.getByRole('button', { name: 'ω', exact: true })).toBeVisible();
});

test('completion is one normal source edit with one undo; construction regeneration is explained', async ({
  page,
}) => {
  await openApp(page, './index.html');
  await command(page, 'A=(0,0)');
  await command(page, 'B=(4,0)');
  const field = await textArea(page);
  const before = await field.inputValue();
  await caret(field, before.length);
  await page.keyboard.type('M=midp');
  await field.press('Control+Space');
  await field.press('Tab');
  await page.keyboard.type('A,B)');
  await page.waitForTimeout(650);
  await expect(field).toHaveValue(/M=midpoint\(A,B\)/u);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(field).toHaveValue(before);
  await expect(page.locator('.source-regeneration')).toContainText('source was regenerated');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(field).toHaveValue(/midpoint\(A, B\)/u);
});

test('native undo and redo preserve the exact source around completions in both entry fields', async ({
  page,
}) => {
  await openApp(page, './index.html');
  const area = await source(page, 'A=(0,0)\nB=(4,0)\nM=midp');
  await area.press('Control+Space');
  await area.press('Tab');
  await expect(area).toHaveValue('A=(0,0)\nB=(4,0)\nM=midpoint(');
  await area.press('Control+z');
  await expect(area).toHaveValue('A=(0,0)\nB=(4,0)\nM=midp');
  await area.press('Control+Shift+z');
  await expect(area).toHaveValue('A=(0,0)\nB=(4,0)\nM=midpoint(');
  const input = page.getByLabel('Command', { exact: true });
  await input.fill('M=midp');
  await input.press('Tab');
  await expect(input).toHaveValue('M=midpoint(');
  await input.press('Control+z');
  await expect(input).toHaveValue('M=midp');
  await input.press('Control+Shift+z');
  await expect(input).toHaveValue('M=midpoint(');
});

// Delay frames, not typing: an old RAF selection reset must not run after the first new key.
async function delayCompletionFrames(page: Page) {
  await page.evaluate(() => {
    const callbacks: FrameRequestCallback[] = [];
    const original = window.requestAnimationFrame.bind(window);
    Object.defineProperty(window, '__flushCompletionFrames', {
      configurable: true,
      value: () => {
        window.requestAnimationFrame = original;
        for (const callback of callbacks) callback(performance.now());
      },
    });
    window.requestAnimationFrame = (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    };
  });
}
async function flushCompletionFrames(page: Page) {
  await page.evaluate(() => {
    const flush = Reflect.get(window, '__flushCompletionFrames') as (() => void) | undefined;
    if (typeof flush !== 'function') throw new Error('Missing frame fixture');
    flush();
  });
}

test('immediate typing after keyboard or pointer completion never receives an old caret reset', async ({
  page,
}) => {
  await openApp(page, './index.html');
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const pointer of [false, true]) {
      const prefix = 'ω_1=(0,0)\nB=(4,0)\nM=midp\n# suffix 🟢';
      const field = await source(page, prefix);
      await caret(field, prefix.indexOf('midp') + 4);
      await field.press('Control+Space');
      await delayCompletionFrames(page);
      if (pointer)
        await page
          .getByRole('option')
          .filter({ hasText: 'midpoint' })
          .dispatchEvent('pointerdown', { button: 0 });
      else await field.press('Tab');
      await page.keyboard.type('ω_1');
      await flushCompletionFrames(page);
      await page.keyboard.type(',B)');
      await expect(field).toHaveValue('ω_1=(0,0)\nB=(4,0)\nM=midpoint(ω_1,B)\n# suffix 🟢');

      const input = page.getByLabel('Command', { exact: true });
      await input.fill('M=midp # suffix');
      await caret(input, 6);
      await input.press('ArrowLeft');
      await input.press('ArrowRight');
      await expect(page.getByRole('listbox', { name: 'Completions', exact: true })).toContainText(
        'midpoint',
      );
      await delayCompletionFrames(page);
      if (pointer)
        await page
          .getByRole('listbox', { name: 'Completions', exact: true })
          .getByRole('option')
          .filter({ hasText: 'midpoint' })
          .dispatchEvent('mousedown', { button: 0 });
      else await input.press('Tab');
      await page.keyboard.type('ω_1');
      await flushCompletionFrames(page);
      await page.keyboard.type(',B)');
      await expect(input).toHaveValue('M=midpoint(ω_1,B) # suffix');
    }
  }
});
