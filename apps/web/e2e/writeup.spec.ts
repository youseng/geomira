import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { command, openApp, selectExample, tab } from './helpers';
import { holdConnections } from './recovery-helpers';

async function writer(page: Page) {
  await tab(page, 'Write-up');
  return page.getByRole('textbox', { name: 'Write-up source' });
}

test('write-up typesets during input and retains malformed source across tabs, download and reload', async ({
  page,
}) => {
  const errors = await openApp(page, './index.html');
  await selectExample(page, 'nine-point-circle');
  const area = await writer(page);
  await area.fill('Angle $\\angle ABC');
  await area.press('End');
  await area.pressSequentially('$');
  const preview = page.getByRole('region', { name: 'Live preview' });
  await expect(preview.locator('math')).toHaveCount(1);
  await expect(area).toBeFocused();
  const raw = '# Step\n\n$\\frac{1}{2}$\n\n$\\badcommand$\n\nUnfinished $\\frac{\n';
  await area.fill(raw);
  await expect(preview.locator('mfrac')).toHaveCount(1);
  await expect(preview.locator('.writeup-error')).toContainText('badcommand');
  await preview.locator('.writeup-error button').click();
  await expect(area).toBeFocused();
  expect(
    await area.evaluate((el) =>
      el instanceof HTMLTextAreaElement ? el.value.slice(el.selectionStart, el.selectionEnd) : '',
    ),
  ).toBe('$\\badcommand$');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  await tab(page, 'Layers');
  await expect(await writer(page)).toHaveValue(raw);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md', exact: true }).click();
  const file = await (await download).path();
  if (!file) throw new Error('Missing Markdown download');
  expect(await readFile(file, 'utf8')).toBe(raw);
  await page.reload();
  await expect(await writer(page)).toHaveValue(raw);
  await expect(preview.locator('math')).toHaveCount(1);
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
  await expect(await writer(page)).toHaveValue(raw);
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
  await expect(await writer(page)).toHaveValue(raw);
  for (const [link, expected] of [
    [privateLink, ''],
    [fullLink, raw],
  ] as const) {
    const recipient = await page.context().newPage();
    const url = new URL(page.url());
    url.hash = new URL(link).hash;
    await recipient.goto(url.href);
    await expect(await writer(recipient)).toHaveValue(expected);
    await recipient.close();
  }
});

test('a preview failure leaves saving, editing and native undo available', async ({ page }) => {
  await openApp(page, './index.html');
  const area = await writer(page);
  const source = 'x'.repeat(80_001);
  await area.fill(source);
  const preview = page.getByRole('region', { name: 'Live preview' });
  await expect(preview).toContainText('preview limit');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  await page.reload();
  await expect(await writer(page)).toHaveValue(source);
  await area.fill('First');
  await area.press('End');
  await area.pressSequentially(' step');
  await tab(page, 'Objects');
  await writer(page);
  await area.focus();
  await area.press('Control+z');
  expect(await area.inputValue()).not.toBe('First step');
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
  await expect(area).toHaveValue(raw);
  await page.evaluate(() => window.dispatchEvent(new Event('release-storage')));
  await expect(status).toContainText('Saved locally');
  expect(await canLeave()).toBe(true);
  await page.reload();
  await expect(await writer(page)).toHaveValue(raw);
});
