/**
 * The service worker of the site build (Run 12, SPEC §1 v1.1: PWA). The build writes it as
 * `sw.js` (build/pwa.ts), with the list of the build's files and its version filled in; it is
 * one self-contained script, so this module imports nothing.
 *
 * - install: every file of the build is fetched into the cache `geomira-<version>`, bypassing
 *   the HTTP cache, so after the first visit the app opens and works offline;
 * - fetch: a GET for a file of the build is answered from that cache; a navigation to any
 *   other address in scope gets the app's index.html (the app reads its own hash and query);
 *   everything else goes to the network untouched;
 * - activate: caches of other versions are deleted, and the open pages are claimed;
 * - a new version installs beside the running one and WAITS: the page shows the version banner
 *   and, when the user agrees, asks it to take over (`skip-waiting`), then reloads. A page can
 *   ask any worker for its version (`version`, answered on the message's port).
 */

/** The names the build fills in (build/pwa.ts). */
declare const __GEOMIRA_PRECACHE__: readonly string[];
declare const __GEOMIRA_CACHE__: string;
declare const __GEOMIRA_BUILD__: string;

export const CACHE_PREFIX = 'geomira-';

/** What a service worker does with a request: answer from the cache, or not handle it. */
export type FetchPlan = { readonly kind: 'cache'; readonly key: string } | null;

export interface RequestLike {
  readonly url: string;
  readonly method: string;
  readonly mode: string;
}

/**
 * The plan for one request: files of the build (paths relative to the scope, query and hash
 * ignored) from the cache; navigations in scope to the app's index.html; anything else
 * (other methods, other origins, out of scope) is left to the network.
 */
export function planFetch(
  req: RequestLike,
  scope: string,
  precache: ReadonlySet<string>,
): FetchPlan {
  if (req.method !== 'GET') return null;
  const url = new URL(req.url);
  const base = new URL(scope);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
  const path = decodeURIComponent(url.pathname.slice(base.pathname.length));
  if (precache.has(path)) return { kind: 'cache', key: path };
  if (req.mode === 'navigate' && precache.has('index.html'))
    return { kind: 'cache', key: 'index.html' };
  return null;
}

/** The caches an activating worker of `current` deletes: ours, of other versions. */
export function staleCaches(names: readonly string[], current: string): string[] {
  return names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== current);
}

/** What the worker needs of its global scope (a fake in tests). */
export interface CacheLike {
  addAll(requests: Request[]): Promise<void>;
  match(request: string): Promise<Response | undefined>;
}

export interface ScopeLike {
  readonly registration: { readonly scope: string };
  readonly caches: {
    open(name: string): Promise<CacheLike>;
    keys(): Promise<string[]>;
    delete(name: string): Promise<boolean>;
  };
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  fetch(request: Request): Promise<Response>;
  addEventListener(type: string, listener: (e: Event) => void): void;
}

export interface SwConfig {
  readonly precache: readonly string[];
  readonly cache: string;
  readonly build: string;
}

interface Extendable extends Event {
  waitUntil(p: Promise<unknown>): void;
}

interface FetchLike extends Extendable {
  readonly request: Request;
  respondWith(r: Promise<Response>): void;
}

interface MessageLike extends Extendable {
  readonly data: unknown;
  readonly ports: readonly MessagePort[];
}

function isExtendable(e: Event): e is Extendable {
  return 'waitUntil' in e && typeof e.waitUntil === 'function';
}

function isFetch(e: Event): e is FetchLike {
  return isExtendable(e) && 'request' in e && 'respondWith' in e;
}

function isMessage(e: Event): e is MessageLike {
  return isExtendable(e) && 'data' in e && 'ports' in e;
}

function messageType(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('type' in data)) return null;
  return typeof data.type === 'string' ? data.type : null;
}

/** Answers a planned request from the cache, or from the network when the entry is gone. */
async function fromCache(scope: ScopeLike, cfg: SwConfig, key: string, request: Request) {
  const cache = await scope.caches.open(cfg.cache);
  const hit = await cache.match(new URL(key, scope.registration.scope).href);
  return hit ?? scope.fetch(request);
}

/** Registers the worker's event handlers on `scope`. */
export function install(scope: ScopeLike, cfg: SwConfig): void {
  const files = new Set(cfg.precache);
  scope.addEventListener('install', (e) => {
    if (!isExtendable(e)) return;
    const urls = cfg.precache.map(
      (p) => new Request(new URL(p, scope.registration.scope).href, { cache: 'reload' }),
    );
    e.waitUntil(scope.caches.open(cfg.cache).then((c) => c.addAll(urls)));
  });
  scope.addEventListener('activate', (e) => {
    if (!isExtendable(e)) return;
    const cleanup = scope.caches
      .keys()
      .then((names) =>
        Promise.all(staleCaches(names, cfg.cache).map((n) => scope.caches.delete(n))),
      )
      .then(() => scope.clients.claim());
    e.waitUntil(cleanup);
  });
  scope.addEventListener('fetch', (e) => {
    if (!isFetch(e)) return;
    const plan = planFetch(e.request, scope.registration.scope, files);
    if (plan !== null) e.respondWith(fromCache(scope, cfg, plan.key, e.request));
  });
  scope.addEventListener('message', (e) => {
    if (!isMessage(e)) return;
    const type = messageType(e.data);
    if (type === 'skip-waiting') e.waitUntil(scope.skipWaiting());
    if (type === 'version') e.ports[0]?.postMessage({ build: cfg.build, cache: cfg.cache });
  });
}

function isScope(g: unknown): g is ScopeLike {
  return (
    typeof g === 'object' &&
    g !== null &&
    'registration' in g &&
    'skipWaiting' in g &&
    'clients' in g &&
    'caches' in g
  );
}

// In the built sw.js (and only there) the global scope is a service worker's.
const global: unknown = globalThis;
if (typeof __GEOMIRA_CACHE__ === 'string' && isScope(global))
  install(global, {
    precache: __GEOMIRA_PRECACHE__,
    cache: __GEOMIRA_CACHE__,
    build: __GEOMIRA_BUILD__,
  });
