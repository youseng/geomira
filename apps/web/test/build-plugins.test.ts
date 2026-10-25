import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { contentVersion, precacheList, serviceWorkerScript, SW_FILE } from '../build/pwa';
import { singleFileHtml } from '../build/singlefile';

/** Run 12: the two build plugins (the site's service worker, the single file's index.html). */

const TEMPLATE = readFileSync(new URL('../src/sw/service-worker.ts', import.meta.url), 'utf8');
const enc = (s: string) => new TextEncoder().encode(s);

describe('the service worker of the site build', () => {
  it('precaches every file but source maps and itself, in a fixed order', () => {
    expect(
      precacheList(['index.html', 'assets/a.js.map', SW_FILE, 'assets/a.js', 'favicon.svg']),
    ).toEqual(['assets/a.js', 'favicon.svg', 'index.html']);
  });

  it('versions a build by its contents: any changed byte or name changes it', () => {
    const first = { path: 'index.html', bytes: enc('<html>') };
    const a = [first, { path: 'assets/a.js', bytes: enc('x=1') }];
    const v = contentVersion(a);
    expect(v).toMatch(/^[0-9a-f]{12}$/u);
    expect(contentVersion([...a].reverse())).toBe(v);
    expect(contentVersion([first, { path: 'assets/a.js', bytes: enc('x=2') }])).not.toBe(v);
    expect(contentVersion([first, { path: 'assets/b.js', bytes: enc('x=1') }])).not.toBe(v);
  });

  it('writes a self-contained classic script that installs the worker with its constants', async () => {
    const code = await serviceWorkerScript(TEMPLATE, {
      precache: ['index.html', 'assets/a.js'],
      cache: 'geomira-0123456789ab',
      build: 'abcd1234',
    });
    expect(code).not.toMatch(/\bimport\b|\bexport\b/u);
    expect(code).toContain('build abcd1234');
    // Run it in a scope that looks like a service worker's and record what it registers.
    const types: string[] = [];
    const answers: unknown[] = [];
    const scope: Record<string, unknown> = {
      registration: { scope: 'https://example.org/' },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
      caches: {},
      URL,
      Request,
      addEventListener: (type: string, f: (e: unknown) => void) => {
        types.push(type);
        if (type === 'message')
          f({
            data: { type: 'version' },
            ports: [{ postMessage: (m: unknown) => answers.push(m) }],
            waitUntil: () => undefined,
          });
      },
    };
    scope['globalThis'] = scope;
    runInNewContext(code, scope);
    expect(types.sort()).toEqual(['activate', 'fetch', 'install', 'message']);
    expect(answers).toEqual([{ build: 'abcd1234', cache: 'geomira-0123456789ab' }]);
  });
});

describe('the single file', () => {
  const html =
    '<head><link rel="icon" type="image/svg+xml" href="/favicon.svg" />\n' +
    '<link rel="manifest" href="/manifest.webmanifest" />\n<title>Geomira</title></head>';

  it('inlines the favicon and drops the manifest (no file beside it, no service worker)', () => {
    const out = singleFileHtml(html, '<svg viewBox="0 0 1 1"></svg>\n');
    expect(out).toContain(
      'href="data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%201%201%22%3E%3C%2Fsvg%3E"',
    );
    expect(out).not.toContain('manifest');
    expect(out).not.toContain('/favicon.svg');
  });
});
