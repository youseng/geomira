import { createHash } from 'node:crypto';
import { failWrites, holdConnections } from './recovery-helpers';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { command, expectLines, openApp, tab } from './helpers';
import { serve, offlineReady, controllerBuild, type Site } from './pwa-site';

let site: Site;

test.beforeEach(async () => {
  site = await serve();
});

test.afterEach(async () => {
  await site.stop();
  rmSync(site.dir, { recursive: true, force: true });
});

test('after the first visit the site opens and works offline', async ({ page, context }) => {
  const errors = await openApp(page, site.url);
  await offlineReady(page);
  for (const line of ['A = (1, 3)', 'B = (0, 0)', 'C = (4, 0)', 'H = orthocenter(A, B, C)'])
    await command(page, line);
  await expectLines(page, 'H = orthocenter(ABC)');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  // The server is gone and the browser is offline.
  await site.stop();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('Geometry canvas')).toBeVisible();
  await expectLines(page, 'H = orthocenter(ABC)');
  // Claim statements survive offline edits without creating verdicts or a worker.
  await command(page, 'claim ∠BHC + ∠BAC = 180');
  await expectLines(page, 'claim ∠BHC + ∠BAC = 180');
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveCount(0);
  await expect(page.locator('.claim-chips, .verdict')).toHaveCount(0);
  await tab(page, 'Help');
  await expect(page.getByTestId('runner')).toHaveCount(0);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Export' }).getByLabel('Export content'),
  ).toHaveValue(/data-name="H"/u);
  // Another address of the app, never visited, opens offline too.
  const other = await context.newPage();
  await openApp(other, `${site.url}?dev=1`);
  expect(errors).toEqual([]);
});

test('a new version shows the version banner; Reload keeps the figure and runs it', async ({
  page,
}) => {
  const errors = await openApp(page, site.url);
  await offlineReady(page);
  const first = await controllerBuild(page);
  await command(page, 'P = (2, 1)');
  await expectLines(page, 'P = (2, 1)');
  await expect(page.getByRole('status', { name: 'New version' })).toHaveCount(0);
  // Deploy a new version: another build id in sw.js (so another file and another cache).
  const sw = join(site.dir, 'sw.js');
  writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll(first, 'next0001'));
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  const banner = page.getByRole('status', { name: 'New version' });
  await expect(banner).toContainText('A new version of Geomira is available (build next0001;', {
    timeout: 30_000,
  });
  await expect(banner).toContainText(`this page runs build ${first}`);
  const reloaded = page.waitForEvent('load');
  await banner.getByRole('button', { name: 'Reload to update' }).click();
  await reloaded;
  await expect(page.getByLabel('Geometry canvas')).toBeVisible();
  await expectLines(page, 'P = (2, 1)');
  expect(await controllerBuild(page)).toBe('next0001');
  await expect(page.getByRole('status', { name: 'New version' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Later hides the banner and keeps the running version', async ({ page }) => {
  await openApp(page, site.url);
  await offlineReady(page);
  const first = await controllerBuild(page);
  const sw = join(site.dir, 'sw.js');
  writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll(first, 'later002'));
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  const banner = page.getByRole('status', { name: 'New version' });
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await banner.getByRole('button', { name: 'Later' }).click();
  await expect(banner).toHaveCount(0);
  expect(await controllerBuild(page)).toBe(first);
});

test('an update waits for durable saving and leaves a failed edit usable until retry', async ({
  page,
}) => {
  await openApp(page, site.url);
  await offlineReady(page);
  const first = await controllerBuild(page);
  await command(page, 'A = (0, 0)');
  const status = page.getByRole('status', { name: 'Local save status' });
  await expect(status).toContainText('Saved locally');
  const sw = join(site.dir, 'sw.js');
  writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll(first, 'safe0002'));
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  const banner = page.getByRole('status', { name: 'New version' });
  await expect(banner).toBeVisible({ timeout: 30000 });
  await failWrites(page, 'complete');
  await command(page, 'B = (1, 0)');
  await expect(status).toContainText('Not saved');
  await banner.getByRole('button', { name: 'Reload to update' }).click();
  await expect(status).toContainText('Not saved');
  expect(await controllerBuild(page)).toBe(first);
  await expectLines(page, 'A = (0, 0)', 'B = (1, 0)');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('allow-storage'));
  });
  const reloaded = page.waitForEvent('load');
  await banner.getByRole('button', { name: 'Reload to update' }).click();
  await reloaded;
  await expectLines(page, 'A = (0, 0)', 'B = (1, 0)');
  expect(await controllerBuild(page)).toBe('safe0002');
});

test('the public download keeps its exact bytes after the PWA claims and reloads the page', async ({
  page,
}) => {
  await openApp(page, site.url);
  await offlineReady(page);
  await page.reload();
  await offlineReady(page);
  const original = readFileSync(join(site.dir, 'geomira.html'));
  const manifestText = readFileSync(join(site.dir, 'release.json'), 'utf8');
  const manifest: unknown = JSON.parse(manifestText);
  await page.goto(new URL('about.html', site.url).href);
  const link = page.getByRole('link', { name: 'Download offline copy', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('download', 'geomira.html');
  const downloading = page.waitForEvent('download');
  await link.click();
  const native = await downloading;
  expect(native.suggestedFilename()).toBe('geomira.html');
  expect(await native.failure()).toBeNull();
  const saved = await native.path();
  const downloaded = readFileSync(saved);
  expect(downloaded.equals(original)).toBe(true);
  const response = await page.goto(new URL('geomira.html', site.url).href);
  if (response === null) throw new Error('the public download returned no response');
  const received = await response.body();
  expect(response.fromServiceWorker()).toBe(false);
  expect(received.equals(original)).toBe(true);
  expect(received.equals(readFileSync(new URL('../dist-single/index.html', import.meta.url)))).toBe(
    true,
  );
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('files' in manifest) ||
    typeof manifest.files !== 'object' ||
    manifest.files === null
  )
    throw new Error('release manifest has no file checksums');
  for (const bytes of [downloaded, received])
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      Reflect.get(manifest.files, 'geomira.html'),
    );
  await expect(page.getByLabel('Geometry canvas')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveCount(0);
  const provenance = await page.goto(new URL('release.json', site.url).href);
  if (provenance === null) throw new Error('provenance returned no response');
  expect(await provenance.text()).toBe(manifestText);
  expect(provenance.fromServiceWorker()).toBe(false);
});

test('Reload to update preserves an unapplied invalid draft and offers its exact raw backup', async ({
  page,
}) => {
  await openApp(page, site.url);
  await offlineReady(page);
  const first = await controllerBuild(page);
  await command(page, 'A=(1,2)');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  const sw = join(site.dir, 'sw.js');
  writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll(first, 'draft003'));
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  const banner = page.getByRole('status', { name: 'New version' });
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await tab(page, 'Text');
  const field = page.getByLabel('Text', { exact: true });
  const raw = '@version 1\nA=(1,2)\nB=midpoint(A, ';
  await field.fill(raw);
  await expect(page.getByLabel('Diagnostics')).toBeVisible();
  await banner.getByRole('button', { name: 'Reload to update' }).click();
  const warning = page.getByRole('alert', { name: 'Update paused' });
  await expect(warning).toBeVisible();
  expect(await controllerBuild(page)).toBe(first);
  await expect(field).toHaveValue(raw);
  const downloading = page.waitForEvent('download');
  await warning.getByRole('button', { name: 'Download unapplied text', exact: true }).click();
  const native = await downloading;
  expect(readFileSync(await native.path(), 'utf8')).toBe(raw);
  await expect(field).toHaveValue(raw);
  await warning.getByRole('button', { name: 'Review text before updating', exact: true }).click();
  await page.getByRole('button', { name: 'Revert text', exact: true }).click();
  const loaded = page.waitForEvent('load');
  await banner.getByRole('button', { name: 'Reload to update' }).click();
  await loaded;
  await expectLines(page, 'A = (1, 2)');
  expect(await controllerBuild(page)).toBe('draft003');
});

async function offerUpdate(page: import('@playwright/test').Page, build: string) {
  const first = await controllerBuild(page);
  const sw = join(site.dir, 'sw.js');
  writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll(first, build));
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  await expect(page.getByRole('status', { name: 'New version' })).toBeVisible({ timeout: 30_000 });
  return first;
}

test('Reload to update preserves a command draft without running it', async ({ page }) => {
  await openApp(page, site.url);
  await offlineReady(page);
  await command(page, 'A=(1,2)');
  const first = await offerUpdate(page, 'command004');
  const input = page.getByLabel('Command', { exact: true });
  const raw = 'B=midpoint(A, ';
  await input.fill(raw);
  await page.getByRole('button', { name: 'Reload to update' }).click();
  const warning = page.getByRole('alert', { name: 'Update paused' });
  await expect(warning).toBeVisible();
  expect(await controllerBuild(page)).toBe(first);
  await expect(input).toHaveValue(raw);
  const download = page.waitForEvent('download');
  await warning.getByRole('button', { name: 'Download command draft' }).click();
  expect(readFileSync(await (await download).path(), 'utf8')).toBe(raw);
  await expect(input).toHaveValue(raw);
});

test('Reload to update refuses a command entered during asynchronous saving', async ({ page }) => {
  await openApp(page, site.url);
  await offlineReady(page);
  await command(page, 'A=(1,2)');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  const first = await offerUpdate(page, 'pending005');
  await holdConnections(page);
  await page.getByRole('button', { name: 'Reload to update' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-held-storage', 'yes');
  const input = page.getByLabel('Command', { exact: true });
  await input.fill('B=midpoint(A, ');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('release-storage'));
  });
  await expect(page.getByRole('alert', { name: 'Update paused' })).toBeVisible();
  expect(await controllerBuild(page)).toBe(first);
  await expect(input).toHaveValue('B=midpoint(A, ');
});

test('Reload to update refuses an active IME composition and preserves its raw text', async ({
  page,
}) => {
  await openApp(page, site.url);
  await offlineReady(page);
  await command(page, 'A=(1,2)');
  const first = await offerUpdate(page, 'ime006');
  await tab(page, 'Text');
  const input = page.getByLabel('Text', { exact: true });
  const raw = '@version 1\nA=(1,2)\n名前=';
  await input.focus();
  await input.dispatchEvent('compositionstart');
  await input.evaluate((element: HTMLTextAreaElement, value: string) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      element,
      value,
    );
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        data: '名前',
        isComposing: true,
      }),
    );
  }, raw);
  await expect(input).toHaveValue(raw);
  await page.getByRole('button', { name: 'Reload to update' }).click();
  await expect(page.getByRole('alert', { name: 'Update paused' })).toBeVisible();
  expect(await controllerBuild(page)).toBe(first);
  await expect(input).toHaveValue(raw);
});
