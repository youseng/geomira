import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { tab } from './helpers';

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

export interface Site {
  readonly url: string;
  readonly dir: string;
  stop(): Promise<void>;
}

/** Serves a fresh copy of dist/ at BASE on a free port. */
export async function serve(): Promise<Site> {
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
export async function offlineReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 30_000,
    })
    .toBe(true);
  await tab(page, 'Help');
  await expect(page.getByTestId('offline')).toContainText('Offline: ready');
}

/** The build id the controlling service worker reports. */
export function controllerBuild(page: Page): Promise<string> {
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
