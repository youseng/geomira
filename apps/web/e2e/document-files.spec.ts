import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { command, openApp, textArea } from './helpers';
import { readRecovery, holdConnections } from './recovery-helpers';

async function fileAction(page: Page, action: string) {
  await page.getByRole('button', { name: /^File: /u }).click();
  await page.getByRole('button', { name: action, exact: true }).click();
}
async function upload(page: Page, content: string, name = 'test.geo') {
  await page
    .getByLabel('Open .geo file', { exact: true })
    .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(content) });
}
async function saved(page: Page) {
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
}

test('files: named duplicate downloads canonical data and reopens as an independent document', async ({
  page,
}) => {
  await openApp(page, './index.html');
  for (const line of [
    'A=(0,0)',
    'B=(4,0)',
    'claim equal(A,A)',
    'assume greater(dist(A,B),0)',
    '@author "Author"',
  ])
    await command(page, line);
  await saved(page);
  const old = (await readRecovery(page)).revisions.at(-1)?.documentId;
  await fileAction(page, 'Save As / Duplicate');
  const dialog = page.getByRole('dialog', { name: 'Document files' });
  await dialog.getByLabel('Document name').fill('測試 figure');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('測試-figure.geo');
  const canonical = readFileSync(await file.path(), 'utf8');
  expect(canonical).toContain('@title "測試 figure"');
  expect(canonical).toContain('claim A = A');
  expect(canonical).toContain('@author "Author"');
  await saved(page);
  expect((await readRecovery(page)).revisions.at(-1)?.documentId).not.toBe(old);
  await fileAction(page, 'New document');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(await textArea(page)).not.toHaveValue(/claim/u);
  await upload(page, canonical);
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(await textArea(page)).toHaveValue(/claim A = A/u);
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveCount(
    process.env['GEOMIRA_ENGINE_E2E'] === '1' ? 1 : 0,
  );
});

test('files: cancelling replacement preserves invalid draft, document and undo history', async ({
  page,
}) => {
  await openApp(page, './index.html');
  await command(page, 'A=(1,2)');
  await saved(page);
  const before = await readRecovery(page);
  const draft = await textArea(page);
  await draft.fill('A=(1,2)\nB=(');
  await fileAction(page, 'New document');
  const dialog = page.getByRole('dialog', { name: 'Document files' });
  await expect(dialog).toContainText('draft has errors');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(draft).toHaveValue('A=(1,2)\nB=(');
  expect((await readRecovery(page)).revisions).toEqual(before.revisions);
  await page.getByRole('button', { name: 'Revert text', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(draft).not.toHaveValue(/A =/u);
});

test('files: valid pending text is included in Save, invalid text gets an explicit draft backup', async ({
  page,
}) => {
  await openApp(page, './index.html');
  const area = await textArea(page);
  await area.fill('A=(123,456)');
  const download = page.waitForEvent('download');
  await fileAction(page, 'Save / Download .geo');
  expect(readFileSync(await (await download).path(), 'utf8')).toContain('A = (123, 456)');
  await area.fill('A=(123,456)\nB=(');
  await fileAction(page, 'Save / Download .geo');
  const dialog = page.getByRole('dialog', { name: 'Save figure' });
  await expect(dialog).toContainText('not the current valid figure');
  const raw = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download draft text', exact: true }).click();
  expect(readFileSync(await (await raw).path(), 'utf8')).toBe('A=(123,456)\nB=(');
  await page.keyboard.press('Escape');
  await expect(area).toHaveValue('A=(123,456)\nB=(');
});

for (const bad of ['A=(1,2)\nB=(', '@version 999\nA=(1,2)']) {
  test(`files: rejects invalid file ${bad.slice(0, 12)} before replacement`, async ({ page }) => {
    await openApp(page, './index.html');
    await command(page, 'P=(9,8)');
    await upload(page, bad);
    const dialog = page.getByRole('dialog', { name: 'Document files' });
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(await textArea(page)).toHaveValue(/P = \(9, 8\)/u);
  });
}

test('files: too-large sharing offers complete .geo download rather than a broken link', async ({
  page,
}) => {
  await openApp(page, './index.html');
  const circles = Array.from(
    { length: 500 },
    (_, i) =>
      `w_${String(i)}=circle((${String(Math.sin(i) * 4)},${String(Math.cos(i) * 4)}),${String(1 + Math.sin(i * 2) ** 2)})`,
  ).join('\n');
  const area = await textArea(page);
  await area.fill(circles);
  await area.press('ControlOrMeta+Enter');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Share link', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share link', exact: true });
  await expect(dialog).toContainText('too large');
  await expect(dialog.getByRole('button', { name: 'Copy link', exact: true })).toHaveCount(0);
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download .geo file', exact: true }).click();
  expect(readFileSync(await (await download).path(), 'utf8')).toContain('w_499 = circle(');
});

test('files: replacement modal blocks Delete and Escape preserves pending construction', async ({
  page,
}) => {
  await openApp(page, './index.html');
  await command(page, 'A=(1,2)');
  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press('ControlOrMeta+a');
  await fileAction(page, 'New document');
  const dialog = page.getByRole('dialog', { name: 'Document files' });
  await dialog.focus();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Escape');
  await expect(await textArea(page)).toHaveValue(/A = \(1, 2\)/u);
});

test('files: confirmed Save As locks all controls and Escape until durability completes', async ({
  page,
}) => {
  await openApp(page, './index.html');
  await command(page, 'A=(1,2)');
  await saved(page);
  await holdConnections(page);
  await (await textArea(page)).fill('A=(1,2)\nB=(3,4)');
  await fileAction(page, 'Save As / Duplicate');
  const dialog = page.getByRole('dialog', { name: 'Document files' });
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog).toContainText('Saving before replacement');
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Document name')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('release-storage'));
  });
  const file = await download;
  expect(readFileSync(await file.path(), 'utf8')).toContain('B = (3, 4)');
  await expect(dialog).toHaveCount(0);
});

test('files: delayed file read cannot replace a newer file action', async ({ page }) => {
  await openApp(page, './index.html');
  await command(page, 'A=(1,2)');
  await page.evaluate(() => {
    File.prototype.text = () =>
      new Promise<string>((resolve) => {
        window.addEventListener(
          'release-file',
          () => {
            resolve('B=(3,4)');
          },
          { once: true },
        );
      });
  });
  await upload(page, 'B=(3,4)');
  await fileAction(page, 'New document');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('release-file'));
  });
  const dialog = page.getByRole('dialog', { name: 'Document files' });
  await expect(dialog.getByRole('heading', { name: 'New document', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(await textArea(page)).toHaveValue(/A = \(1, 2\)/u);
});

for (const valid of [true, false]) {
  test(`files: startup draft ${valid ? 'valid' : 'invalid'} survives delayed recovery and saves explicitly`, async ({
    page,
  }) => {
    const original = '@version 1\nP = (9, 8)\n';
    await page.addInitScript((legacy) => {
      localStorage.setItem('geomira.autosave.current', legacy);
    }, original);
    await holdConnections(page, true);
    await openApp(page, './index.html');
    await expect(page.locator('html')).toHaveAttribute('data-held-storage', 'yes');
    const draft = valid ? 'A=(123,456)' : 'A=(123,456)\nB=(';
    const field = await textArea(page);
    await field.fill(draft);
    // Suspend the pause before letting startup finish: neither startup nor a file action
    // may change the draft's base document while the user decides what to save.
    await page.getByRole('button', { name: /^File: /u }).click();
    await page.evaluate(() => {
      window.dispatchEvent(new Event('release-storage'));
    });
    await saved(page);
    expect((await readRecovery(page)).revisions.some((r) => r.text === original)).toBe(true);
    await expect(field).toHaveValue(draft);
    await expect(page.locator('.text-actions')).not.toContainText('The figure changed meanwhile');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save / Download .geo', exact: true }).click();
    if (!valid) {
      const dialog = page.getByRole('dialog', { name: 'Save figure' });
      await expect(dialog).toContainText('draft has errors');
      await expect(dialog).not.toContainText('older figure');
      await dialog.getByRole('button', { name: 'Download draft text', exact: true }).click();
    }
    const file = await downloading;
    expect(readFileSync(await file.path(), 'utf8')).toBe(
      valid ? '@version 1\nA = (123, 456)\n' : draft,
    );
    expect((await readRecovery(page)).revisions.some((r) => r.text === original)).toBe(true);
  });
}
