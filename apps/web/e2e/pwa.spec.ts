import { createHash } from 'node:crypto';
import { failWrites } from './recovery-helpers';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { command, expectLines, openApp, tab } from './helpers';

/**
 * Run 12 (SPEC §1 v1.1): the site as a PWA, in Chromium (project pwa). Each test serves its own
 * copy of the site build (dist/) from a server it can stop, under the deploy's base path:
 * - after the first visit the site opens and works with the server gone and the browser
 *   offline: the figure, a local test in the worker, an export;
 * - when a new version is deployed, the running page shows the version banner with the new
 *   build; Reload saves the figure, lets the new version take over, and reloads into it.
 */

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const BASE = process.env['GEOMIRA_BASE'] ?? '/';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json',
  '.json': 'application/json',
};

interface Site {
  readonly url: string;
  readonly dir: string;
  stop(): Promise<void>;
}

/** Serves a fresh copy of dist/ at BASE on a free port. */
async function serve(): Promise<Site> {
  const dir = mkdtempSync(join(tmpdir(), 'geomira-pwa-'));
  cpSync(DIST, dir, { recursive: true });
  const sockets = new Set<Socket>();
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (!path.startsWith(BASE)) {
      res.writeHead(404).end();
      return;
    }
    const rel = normalize(path.slice(BASE.length) || 'index.html').replace(/^(\.\.[/\\])+/u, '');
    try {
      const body = readFileSync(
        join(dir, rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel),
      );
      const type = TYPES[extname(rel)] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${String(port)}${BASE}`,
    dir,
    stop: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** Waits until a service worker controls the page and the Help panel says offline is ready. */
async function offlineReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 30_000,
    })
    .toBe(true);
  await tab(page, 'Help');
  await expect(page.getByTestId('offline')).toContainText('Offline: ready');
}

/** The build id the controlling service worker reports. */
function controllerBuild(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const c = new MessageChannel();
        c.port1.onmessage = (e: MessageEvent<{ build: string }>) => {
          resolve(e.data.build);
        };
        navigator.serviceWorker.controller?.postMessage({ type: 'version' }, [c.port2]);
      }),
  );
}

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
  expect(createHash('sha256').update(received).digest('hex')).toBe(
    Reflect.get(manifest.files, 'geomira.html'),
  );
  await expect(page.getByLabel('Geometry canvas')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveCount(0);
  const provenance = await page.goto(new URL('release.json', site.url).href);
  if (provenance === null) throw new Error('provenance returned no response');
  expect(await provenance.text()).toBe(manifestText);
  expect(provenance.fromServiceWorker()).toBe(false);
});
