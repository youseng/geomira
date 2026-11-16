import { readFile } from 'node:fs/promises';
import { currentText, readRecovery, holdConnections, failWrites } from './recovery-helpers';
import { expect, test } from '@playwright/test';
import { command, expectLines, openApp, textArea, tool, clickWorld } from './helpers';

test('two tabs retain A+B and A+C after closing and reopening', async ({
  page,
  context,
  baseURL,
}) => {
  await openApp(page, baseURL?.startsWith('file:') ? 'index.html' : './');
  await command(page, 'A = (0, 0)');
  await page.waitForTimeout(400);
  const other = await context.newPage();
  await openApp(other, baseURL?.startsWith('file:') ? 'index.html' : './');
  await expectLines(other, 'A = (0, 0)');
  await command(page, 'B = (1, 0)');
  await page.waitForTimeout(400);
  await command(other, 'C = (0, 1)');
  await other.waitForTimeout(400);
  await page.close();
  await other.close();
  const third = await context.newPage();
  await openApp(third, baseURL?.startsWith('file:') ? 'index.html' : './');
  await third.getByRole('button', { name: 'Recovery versions', exact: true }).click();
  const versions = third.getByRole('region', { name: 'Recovery versions' });
  await expect(versions).toContainText('B = (1, 0)');
  await expect(versions).toContainText('C = (0, 1)');
});

test('storage denial leaves the figure usable and offers a canonical backup', async ({
  page,
  baseURL,
}) => {
  await page.addInitScript(() => {
    const local = window.localStorage;
    const db = window.indexedDB;
    window.addEventListener('allow-storage', () => {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: local });
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: db });
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked by this test', 'SecurityError');
      },
    });
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('blocked by this test', 'SecurityError');
      },
    });
  });
  await openApp(page, baseURL?.startsWith('file:') ? 'index.html' : './');
  await command(page, 'A = (123, 456)');
  await expectLines(page, 'A = (123, 456)');
  const status = page.getByRole('status', { name: 'Local save status' });
  await expect(status).toContainText('Not saved');
  await command(page, 'B = (1, 0)');
  await expect(status).toContainText('Not saved');
  await expect(await textArea(page)).toHaveValue(/A = \(123, 456\)/u);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .geo backup', exact: true }).click();
  const backup = await downloaded;
  expect(backup.suggestedFilename()).toMatch(/\.geo$/u);
  expect(await backup.failure()).toBeNull();
  const file = await backup.path();
  expect(file).not.toBeNull();
  const canonical = await readFile(file, 'utf8');
  expect(canonical).toContain('@version 1');
  expect(canonical).toContain('A = (123, 456)');
  expect(canonical).toContain('B = (1, 0)');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('allow-storage'));
  });
  await page.getByRole('button', { name: 'Retry local save', exact: true }).click();
  await expect(status).toContainText('Saved locally');
  expect(await currentText(page)).toContain('A = (123, 456)');
});

for (const reverse of [false, true])
  test(`simultaneous stale writers with delayed events, reverse ${String(reverse)}`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'BroadcastChannel', { value: undefined });
    });
    const entry = baseURL?.startsWith('file:') ? 'index.html' : './';
    await openApp(page, entry);
    await command(page, 'A = (0, 0)');
    await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
      'Saved locally',
    );
    const other = await context.newPage();
    await openApp(other, entry);
    await expectLines(other, 'A = (0, 0)');
    await holdConnections(page);
    await holdConnections(other);
    await command(page, 'B = (1, 0)');
    await command(other, 'C = (0, 1)');
    await expect(page.locator('html')).toHaveAttribute('data-held-storage', 'yes');
    await expect(other.locator('html')).toHaveAttribute('data-held-storage', 'yes');
    const first = reverse ? other : page;
    const second = reverse ? page : other;
    await first.evaluate(() => {
      window.dispatchEvent(new Event('release-storage'));
    });
    await expect(first.getByRole('status', { name: 'Local save status' })).toContainText(
      'Saved locally',
    );
    await second.evaluate(() => {
      window.dispatchEvent(new Event('release-storage'));
    });
    await expect(second.getByRole('status', { name: 'Local save status' })).toContainText(
      'Conflict',
    );
    const state = await readRecovery(second);
    expect(state.revisions.map((r) => r.text)).toEqual(
      expect.arrayContaining([
        '@version 1\nA = (0, 0)\nB = (1, 0)\n',
        '@version 1\nA = (0, 0)\nC = (0, 1)\n',
      ]),
    );
    expect(state.conflicts).toHaveLength(2);
    const third = await context.newPage();
    await openApp(third, entry);
    await expect(third.getByRole('status', { name: 'Local save status' })).toContainText(
      'Conflict',
    );
    // Resume a tab with stale editor contents after a third tab saved a descendant.
    await command(third, 'D = (2, 2)');
    await expect(third.getByRole('status', { name: 'Local save status' })).toContainText(
      'Conflict',
    );
    await expect
      .poll(async () => (await readRecovery(third)).revisions.some((r) => r.text.includes('D =')))
      .toBe(true);
    await command(first, 'E = (3, 3)');
    await expect(first.getByRole('status', { name: 'Local save status' })).toContainText(
      'Conflict',
    );
    expect(
      (await readRecovery(first)).revisions.map((r) => r.text).some((t) => t.includes('D =')),
    ).toBe(true);
  });

for (const failure of ['put', 'complete'] as const)
  test(`native storage failure at ${failure} keeps memory and old state until retry`, async ({
    page,
    baseURL,
  }) => {
    await openApp(page, baseURL?.startsWith('file:') ? 'index.html' : './');
    await command(page, 'A = (0, 0)');
    const status = page.getByRole('status', { name: 'Local save status' });
    await expect(status).toContainText('Saved locally');
    const before = await readRecovery(page);
    await failWrites(page, failure);
    await command(page, 'B = (1, 0)');
    await expect(status).toContainText('Not saved');
    await expectLines(page, 'A = (0, 0)', 'B = (1, 0)');
    expect(await readRecovery(page)).toEqual(before);
    await page.getByRole('button', { name: 'Retry local save', exact: true }).click();
    await expect(status).toContainText('Not saved');
    expect(await readRecovery(page)).toEqual(before);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('allow-storage'));
    });
    await page.getByRole('button', { name: 'Retry local save', exact: true }).click();
    await expect(status).toContainText('Saved locally');
    expect(await currentText(page)).toContain('B = (1, 0)');
    await page.reload();
    await expectLines(page, 'A = (0, 0)', 'B = (1, 0)');
  });

test('legacy migration and keyboard recovery preserve the full figure and canonical backup', async ({
  page,
  baseURL,
}) => {
  const rich = [
    '@version 1',
    '@title "Recovery fixture"',
    '@author "Geomira"',
    '@layer aux [visible=false, opacity=0.5]',
    '@view only [layers=aux,-main] [viewport=1,-2,50]',
    '@viewport 1 -2 50',
    'A = (0, 0) [color=red, label="origin", layers=aux,main]',
    'B = (4, 0)',
    'M = midpoint(A, B)',
    'claim collinear(A, M, B) [name=saved]',
    'assume greater(dist(A, B), 0)',
    '',
  ].join('\n');
  await page.addInitScript((text) => {
    if (sessionStorage.getItem('seeded-recovery') !== null) return;
    sessionStorage.setItem('seeded-recovery', 'yes');
    localStorage.setItem('geomira.autosave.current', text);
    localStorage.setItem('geomira.autosave.previous', '@version 1\nZ = (9, 9)\n');
  }, rich);
  await openApp(page, baseURL?.startsWith('file:') ? 'index.html' : './');
  await expectLines(page, '@title "Recovery fixture"', 'claim collinear(A, M, B) [name=saved]');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  const original = await currentText(page);
  expect(original).toContain('@viewport 1 -2 50');
  expect((await readRecovery(page)).legacy.map((r) => r.text)).toContain(rich);
  expect(await page.evaluate(() => localStorage.getItem('geomira.autosave.current'))).toBeNull();
  const recovery = page.getByRole('button', { name: 'Recovery versions', exact: true });
  await recovery.focus();
  await page.keyboard.press('Enter');
  await expect(recovery).toHaveAttribute('aria-expanded', 'true');
  const region = page.getByRole('region', { name: 'Recovery versions' });
  const old = region.getByRole('listitem').filter({ hasText: 'Z = (9, 9)' });
  await old.getByRole('button', { name: 'Restore this version', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expectLines(page, 'Z = (9, 9)');
  await region
    .getByRole('listitem')
    .filter({ hasText: '@title "Recovery fixture"' })
    .first()
    .getByRole('button', { name: 'Restore this version', exact: true })
    .click();
  await expectLines(
    page,
    '@title "Recovery fixture"',
    '@author "Geomira"',
    '@viewport 1 -2 50',
    'claim collinear(A, M, B) [name=saved]',
  );
  await expect.poll(() => currentText(page)).toBe(original);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .geo backup', exact: true }).click();
  const file = await (await downloading).path();
  expect(await readFile(file, 'utf8')).toBe(original);
  if (process.env['GEOMIRA_ENGINE_E2E'] === '1') {
    expect(page.workers()).toHaveLength(1);
    await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toBeVisible();
  } else {
    expect(page.workers()).toEqual([]);
    await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveCount(0);
  }
  await page.reload();
  await expectLines(page, '@title "Recovery fixture"', 'claim collinear(A, M, B) [name=saved]');
});

test('editing while startup storage is delayed never replaces the current figure', async ({
  page,
  baseURL,
}) => {
  await holdConnections(page, true);
  await openApp(page, baseURL?.startsWith('file:') ? 'index.html' : './');
  await expect(page.locator('html')).toHaveAttribute('data-held-storage', 'yes');
  await command(page, 'A = (123, 456)');
  await expectLines(page, 'A = (123, 456)');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('release-storage'));
  });
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  await expectLines(page, 'A = (123, 456)');
  expect(await currentText(page)).toContain('A = (123, 456)');
});

test('a tool chosen during delayed startup still constructs the figure', async ({
  page,
  baseURL,
}) => {
  await holdConnections(page, true);
  await openApp(page, baseURL?.startsWith('file:') ? 'index.html' : './');
  await tool(page, 'Polygon');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('release-storage'));
  });
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  await clickWorld(page, 0, 0);
  await expectLines(page, 'A = (0, 0)');
});

test('resolving a displayed version preserves a conflict written behind the restore barrier', async ({
  page,
  context,
  baseURL,
}) => {
  const entry = baseURL?.startsWith('file:') ? 'index.html' : './';
  await openApp(page, entry);
  await command(page, 'A = (0, 0)');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  const other = await context.newPage();
  await openApp(other, entry);
  await expectLines(other, 'A = (0, 0)');
  await command(page, 'B = (1, 0)');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  await command(other, 'C = (0, 1)');
  await expect(other.getByRole('status', { name: 'Local save status' })).toContainText('Conflict');
  const third = await context.newPage();
  await openApp(third, entry);
  await expectLines(third, 'C = (0, 1)');
  await third.getByLabel('Example', { exact: true }).selectOption('euler-line');
  await expect(third.getByRole('status', { name: 'Local save status' })).toContainText('Browsing');
  await third.getByRole('button', { name: 'Recovery versions', exact: true }).click();
  const before = (await readRecovery(third)).revisions.find(
    (r) => r.text === '@version 1\nA = (0, 0)\nB = (1, 0)\n',
  );
  expect(before).toBeDefined();
  await holdConnections(third);
  const row = third
    .getByRole('region', { name: 'Recovery versions' })
    .getByRole('listitem')
    .filter({ hasText: `revision ${before?.id ?? ''}` });
  await row
    .getByRole('button', {
      name: 'Use this version and resolve this document’s conflicts',
      exact: true,
    })
    .click();
  await expect(third.locator('html')).toHaveAttribute('data-held-storage', 'yes');
  await command(page, 'E = (3, 3)');
  await expect.poll(async () => (await currentText(page))?.includes('E = (3, 3)')).toBe(true);
  const unseen = (await readRecovery(page)).currentId;
  await third.evaluate(() => {
    window.dispatchEvent(new Event('release-storage'));
  });
  await expectLines(third, 'A = (0, 0)', 'B = (1, 0)');
  await expect(third.getByRole('status', { name: 'Local save status' })).toContainText('Conflict');
  const recovered = await readRecovery(third);
  expect(recovered.conflicts).toContain(unseen);
  expect(recovered.revisions.find((r) => r.id === unseen)?.text).toContain('E = (3, 3)');
  expect(recovered.revisions.some((r) => r.text.includes('@title "Euler line"'))).toBe(true);
});
