import { describe, expect, it } from 'vitest';
import {
  install,
  planFetch,
  staleCaches,
  type CacheLike,
  type ScopeLike,
} from '../src/sw/service-worker';

/**
 * Run 12 (PWA): the service worker. Files of the build come from the cache; a navigation in
 * scope gets index.html (so the app opens offline at any of its addresses, with any query);
 * other requests are left to the network; old versions' caches are deleted on activation.
 */

const SCOPE = 'https://example.org/geomira/';
const FILES = new Set(['index.html', 'assets/index-abc.js', 'about.html', 'sw-free.txt']);

describe('planFetch', () => {
  it('serves files of the build from the cache, query ignored', () => {
    const get = (url: string, mode = 'no-cors') =>
      planFetch({ url, method: 'GET', mode }, SCOPE, FILES);
    expect(get(`${SCOPE}assets/index-abc.js`)).toEqual({
      kind: 'cache',
      key: 'assets/index-abc.js',
    });
    expect(get(`${SCOPE}assets/index-abc.js?v=2`)).toEqual({
      kind: 'cache',
      key: 'assets/index-abc.js',
    });
    expect(get(`${SCOPE}about.html`, 'navigate')).toEqual({ kind: 'cache', key: 'about.html' });
  });

  it('a navigation anywhere in scope opens the app', () => {
    for (const url of [SCOPE, `${SCOPE}?dev=1`, `${SCOPE}#s=xyz`, `${SCOPE}old/page`])
      expect(planFetch({ url, method: 'GET', mode: 'navigate' }, SCOPE, FILES)).toEqual({
        kind: 'cache',
        key: 'index.html',
      });
  });

  it('leaves other methods, other origins, out-of-scope paths and unknown files alone', () => {
    const plan = (url: string, method = 'GET', mode = 'cors') =>
      planFetch({ url, method, mode }, SCOPE, FILES);
    expect(plan(`${SCOPE}assets/index-abc.js`, 'POST')).toBeNull();
    expect(plan('https://cdn.example.com/geomira/assets/index-abc.js')).toBeNull();
    expect(plan('https://example.org/other/index.html', 'GET', 'navigate')).toBeNull();
    expect(plan(`${SCOPE}assets/missing.js`)).toBeNull();
  });
});

describe('staleCaches', () => {
  it('deletes only our caches of other versions', () => {
    expect(
      staleCaches(['geomira-aaa', 'geomira-bbb', 'other-app', 'geomira-ccc'], 'geomira-bbb'),
    ).toEqual(['geomira-aaa', 'geomira-ccc']);
  });
});

/** A fake service worker scope with in-memory caches. */
function fakeScope() {
  const stores = new Map<string, Map<string, Response>>();
  const handlers = new Map<string, (e: Event) => void>();
  const log: string[] = [];
  const scope: ScopeLike = {
    registration: { scope: SCOPE },
    caches: {
      open: (name) => {
        const m = stores.get(name) ?? new Map<string, Response>();
        stores.set(name, m);
        const cache: CacheLike = {
          addAll: (requests) => {
            for (const r of requests) {
              log.push(`cache ${r.url} ${r.cache}`);
              m.set(r.url, new Response(`body of ${r.url}`));
            }
            return Promise.resolve();
          },
          match: (url) => Promise.resolve(m.get(url)?.clone()),
        };
        return Promise.resolve(cache);
      },
      keys: () => Promise.resolve([...stores.keys()]),
      delete: (name) => Promise.resolve(stores.delete(name)),
    },
    clients: {
      claim: () => {
        log.push('claim');
        return Promise.resolve();
      },
    },
    skipWaiting: () => {
      log.push('skipWaiting');
      return Promise.resolve();
    },
    fetch: (r) => {
      log.push(`network ${r.url}`);
      return Promise.resolve(new Response('from the network'));
    },
    addEventListener: (type, f) => {
      handlers.set(type, f);
    },
  };
  /** Dispatches an extendable event and waits for what it asked to wait for. */
  const dispatch = async (type: string, extra: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    const e = Object.assign(new Event(type), {
      waitUntil: (p: Promise<unknown>) => waits.push(p),
      respondWith: (r: Promise<Response>) => {
        response = r;
      },
      ...extra,
    });
    handlers.get(type)?.(e);
    await Promise.all(waits);
    return response;
  };
  return { scope, stores, log, dispatch };
}

describe('install (the worker)', () => {
  const cfg = { precache: ['index.html', 'assets/index-abc.js'], cache: 'geomira-v2', build: 'b2' };

  it('caches every file of the build, bypassing the HTTP cache', async () => {
    const f = fakeScope();
    install(f.scope, cfg);
    await f.dispatch('install');
    expect(f.log).toEqual([
      `cache ${SCOPE}index.html reload`,
      `cache ${SCOPE}assets/index-abc.js reload`,
    ]);
  });

  it('answers a navigation from the cache, and an evicted entry from the network', async () => {
    const f = fakeScope();
    install(f.scope, cfg);
    await f.dispatch('install');
    const request = new Request(`${SCOPE}?dev=1`);
    const nav = { request: { url: request.url, method: 'GET', mode: 'navigate' } };
    const r = await f.dispatch('fetch', nav);
    expect(await r?.text()).toBe(`body of ${SCOPE}index.html`);
    f.stores.get('geomira-v2')?.clear();
    const fetchReq = new Request(`${SCOPE}assets/index-abc.js`);
    const again = await f.dispatch('fetch', { request: fetchReq });
    expect(await again?.text()).toBe('from the network');
  });

  it('does not answer requests it does not plan for', async () => {
    const f = fakeScope();
    install(f.scope, cfg);
    const r = await f.dispatch('fetch', {
      request: new Request('https://example.org/api', { method: 'POST' }),
    });
    expect(r).toBeUndefined();
  });

  it('activation deletes old versions and claims the pages', async () => {
    const f = fakeScope();
    await f.scope.caches.open('geomira-v1');
    await f.scope.caches.open('someone-else');
    install(f.scope, cfg);
    await f.dispatch('install');
    await f.dispatch('activate');
    expect([...f.stores.keys()].sort()).toEqual(['geomira-v2', 'someone-else']);
    expect(f.log.at(-1)).toBe('claim');
  });

  it('takes over only when asked, and tells its version on a port', async () => {
    const f = fakeScope();
    install(f.scope, cfg);
    const answers: unknown[] = [];
    const port = { postMessage: (m: unknown) => answers.push(m) };
    await f.dispatch('message', { data: { type: 'version' }, ports: [port] });
    expect(answers).toEqual([{ build: 'b2', cache: 'geomira-v2' }]);
    expect(f.log).not.toContain('skipWaiting');
    await f.dispatch('message', { data: { type: 'skip-waiting' }, ports: [] });
    expect(f.log).toContain('skipWaiting');
  });
});
