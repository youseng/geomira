import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { command, openApp, selectExample, tab } from './helpers';
import { holdConnections } from './recovery-helpers';

async function writer(page: Page) {
  await tab(page, 'Write-up');
  await expect(page.locator('.writeup-surface .cm-content')).toBeVisible();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  return page.getByRole('textbox', { name: 'Write-up source' });
}

async function expectSource(page: Page, expected: string) {
  await writer(page);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md', exact: true }).click();
  const path = await (await downloading).path();
  if (!path) throw new Error('Missing write-up source download');
  expect(await readFile(path, 'utf8')).toBe(expected);
}

test('write-up typesets during input and retains malformed source across tabs, download and reload', async ({
  page,
}) => {
  const errors = await openApp(page, './index.html');
  await selectExample(page, 'nine-point-circle');
  await tab(page, 'Write-up');
  const live = page.getByRole('textbox', { name: 'Write-up editor', exact: true });
  await live.fill('Angle $\\angle ABC');
  await live.press('End');
  await live.pressSequentially('$');
  await expect(live.locator('math')).toHaveCount(1);
  await expect(live).toBeFocused();
  const raw = '# Step\n\n$\\frac{1}{2}$\n\n$\\badcommand$\n\nUnfinished $\\frac{\n';
  await live.fill(raw);
  await expect(live.locator('mfrac')).toHaveCount(1);
  const error = live.locator('.writeup-error');
  await expect(error).toHaveAttribute('title', /badcommand/u);
  await error.click();
  await expect(live).toBeFocused();
  await expect(live).toContainText('$\\badcommand$');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('$\\badcommand$');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  await tab(page, 'Layers');
  await expectSource(page, raw);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md', exact: true }).click();
  const file = await (await download).path();
  if (!file) throw new Error('Missing Markdown download');
  expect(await readFile(file, 'utf8')).toBe(raw);
  await page.reload();
  await expectSource(page, raw);
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(live.locator('math')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('construction editing and sharing preserve write-up privacy and portable file content', async ({
  page,
}) => {
  await openApp(page, './index.html');
  await command(page, 'A=(1,2)');
  const raw = 'Private reasoning $a^2$\n';
  await (await writer(page)).fill(raw);
  await command(page, 'B=(3,4)');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectSource(page, raw);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Share link', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'Share link content' });
  const privateLink = await field.inputValue();
  await page.getByLabel('Include write-up').check();
  const fullLink = await field.inputValue();
  expect(fullLink).not.toBe(privateLink);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /^File: /u }).click();
  const saving = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save / Download .geo', exact: true }).click();
  const path = await (await saving).path();
  if (!path) throw new Error('Missing portable file');
  const text = await readFile(path, 'utf8');
  expect(text).toContain('@writeup ' + JSON.stringify(raw));
  await (await writer(page)).fill('temporary');
  await page.getByLabel('Open .geo file', { exact: true }).setInputFiles({
    name: 'reopen.geo',
    mimeType: 'text/plain',
    buffer: Buffer.from(text),
  });
  await page
    .getByRole('dialog', { name: 'Document files' })
    .getByRole('button', { name: 'Continue', exact: true })
    .click();
  await expectSource(page, raw);
  for (const [link, expected] of [
    [privateLink, ''],
    [fullLink, raw],
  ] as const) {
    const recipient = await page.context().newPage();
    const url = new URL(page.url());
    url.hash = new URL(link).hash;
    await recipient.goto(url.href);
    await expectSource(recipient, expected);
    await recipient.close();
  }
});

test('a formatting failure leaves saving, editing and undo available', async ({ page }) => {
  await openApp(page, './index.html');
  const area = await writer(page);
  const source = 'x'.repeat(80_001);
  await area.fill(source);
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(page.locator('.writeup-message')).toContainText('formatting limit');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  await page.reload();
  await expectSource(page, source);
  await area.fill('First');
  await area.press('End');
  await area.pressSequentially(' step');
  await tab(page, 'Objects');
  await writer(page);
  await area.focus();
  await area.press('Control+z');
  await expect(area).not.toHaveText('First step');
  await area.press('Control+Shift+z');
  await expect(area).toHaveText('First step');
});

test('denied browser storage leaves malformed Markdown downloadable', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('Denied by the test', 'SecurityError');
      },
    }),
  );
  const errors = await openApp(page, './index.html');
  const source = 'Draft $\\frac{\n';
  await (await writer(page)).fill(source);
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText('Not saved');
  expect(
    await page.evaluate(() =>
      window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    ),
  ).toBe(false);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md', exact: true }).click();
  const path = await (await downloading).path();
  if (!path) throw new Error('Missing backup');
  expect(await readFile(path, 'utf8')).toBe(source);
  expect(errors).toEqual([]);
});

test('leaving with an uncommitted write-up is guarded until the transaction completes', async ({
  page,
}) => {
  await openApp(page, './index.html');
  const area = await writer(page);
  const status = page.getByRole('status', { name: 'Local save status' });
  await area.fill('Saved baseline');
  await expect(status).toContainText('Saved locally');
  const canLeave = () =>
    page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })));
  expect(await canLeave()).toBe(true);
  await holdConnections(page);
  await area.fill('');
  expect(await canLeave()).toBe(false);
  const raw = 'Last edit $\\frac{';
  await area.fill(raw);
  expect(await canLeave()).toBe(false);
  await expectSource(page, raw);
  await page.evaluate(() => window.dispatchEvent(new Event('release-storage')));
  await expect(status).toContainText('Saved locally');
  expect(await canLeave()).toBe(true);
  await page.reload();
  await expectSource(page, raw);
});

test('all six headings share the document typeface and descend in size in the writing area', async ({
  page,
}) => {
  await openApp(page, './index.html');
  await tab(page, 'Write-up');
  const live = page.getByRole('textbox', { name: 'Write-up editor', exact: true });
  const text = Array.from(
    { length: 6 },
    (_, i) => '#'.repeat(i + 1) + ' Level ' + String(i + 1),
  ).join('\n');
  await live.fill(text);
  await page.getByRole('button', { name: 'Live', exact: true }).focus();
  const headings = live.getByRole('heading');
  await expect(headings).toHaveCount(6);
  const sizes = await headings.evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return { family: style.fontFamily, color: style.color, size: parseFloat(style.fontSize) };
    }),
  );
  expect(new Set(sizes.map((s) => s.family)).size).toBe(1);
  expect(new Set(sizes.map((s) => s.color)).size).toBe(1);
  expect(sizes.every((s, i) => i === 0 || s.size < (sizes[i - 1]?.size ?? 0))).toBe(true);
  await expect(live.getByRole('heading', { level: 3 })).toHaveText('Level 3');
  await expect(page.getByRole('region', { name: 'Live preview' })).toHaveCount(0);
});

test('math compiles at the caret and can be edited again in place', async ({ page }) => {
  await openApp(page, './index.html');
  await tab(page, 'Write-up');
  const live = page.getByRole('textbox', { name: 'Write-up editor', exact: true });
  await live.click();
  await page.keyboard.insertText('Radius $\\frac{R}{2}');
  await expect(live.locator('math')).toHaveCount(0);
  await page.keyboard.type('$');
  await expect(live.locator('mfrac')).toHaveCount(1);
  await expect(live).toBeFocused();
  await page.keyboard.type(' exactly.');
  await expect(live).toContainText(' exactly.');
  await live.locator('math').click();
  await expect(live.locator('math')).toHaveCount(0);
  await expect(live).toContainText('\\frac{R}{2}');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md', exact: true }).click();
  const path = await (await downloading).path();
  if (!path) throw new Error('Missing write-up download');
  expect(await readFile(path, 'utf8')).toBe('Radius $\\frac{R}{2}$ exactly.');
});

test('pasted rules, code and math keep their Markdown through mode changes and Undo', async ({
  page,
}) => {
  const errors = await openApp(page, './index.html');
  await tab(page, 'Write-up');
  const live = page.getByRole('textbox', { name: 'Write-up editor', exact: true });
  const text =
    '### Radius\n\n- **Half** the length\n\n$$\n\\frac{R}{2}\n$$\n\n`$literal$` <b>plain</b>\n';
  await live.click();
  await live.evaluate((node, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', value);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: clipboardData });
    node.dispatchEvent(event);
  }, text);
  await expect(live.locator('math[display="block"] mfrac')).toHaveCount(1);
  await expect(live.locator('b')).toHaveCount(0);
  await expect(live.locator('.wu-strong')).toHaveText('Half');
  await expectSource(page, text);
  const source = page.getByRole('textbox', { name: 'Write-up source', exact: true });
  await source.focus();
  await source.press('Control+z');
  await expectSource(page, '');
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await live.press('Control+Shift+z');
  await expect(live.locator('mfrac')).toHaveCount(1);
  await expectSource(page, text);
  expect(errors).toEqual([]);
});

test('composition leaves input in place and typesets after commit', async ({
  page,
  browserName,
}) => {
  await openApp(page, './index.html');
  await tab(page, 'Write-up');
  const live = page.getByRole('textbox', { name: 'Write-up editor', exact: true });
  await live.click();
  const data = '角 $x$';
  const ime = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
  if (ime) {
    await ime.send('Input.imeSetComposition', {
      text: data,
      selectionStart: data.length,
      selectionEnd: data.length,
    });
  } else {
    await live.dispatchEvent('compositionstart', { data: '' });
    await live.evaluate(
      (node, text) => node.ownerDocument.execCommand('insertText', false, text),
      data,
    );
  }
  await expect(live).toHaveText(data);
  await expect(live.locator('math')).toHaveCount(0);
  if (ime) await ime.send('Input.insertText', { text: data });
  else await live.dispatchEvent('compositionend', { data });
  await expect(live.locator('math')).toHaveCount(1);
  await expectSource(page, data);
});
