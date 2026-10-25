/**
 * The page's side of the PWA (Run 12, SPEC §1 v1.1): registers the service worker of the site
 * build (src/sw/service-worker.ts, written as sw.js), says whether the site works offline, and
 * offers a new version when one has installed beside the running one (the version banner).
 * The update is never applied behind the user's back: the banner's Reload saves the figure,
 * lets the new worker take over and reloads the page; "Later" keeps the running version.
 */

/** Whether this copy of the app works without the network. */
export type OfflineStatus =
  /** No service worker for this copy: the reason says why (a file, a browser without one). */
  | { readonly kind: 'unavailable'; readonly reason: string }
  /** Registered; the files are being cached. */
  | { readonly kind: 'installing' }
  /** A service worker controls the page: the site opens and works offline from now on. */
  | { readonly kind: 'ready' }
  | { readonly kind: 'failed'; readonly reason: string };

export interface PwaState {
  readonly offline: OfflineStatus;
  /** A new version waiting to take over (its build id), or null. */
  readonly update: { readonly build: string } | null;
}

/** What the page needs of a ServiceWorker, a registration and the container (fakes in tests). */
export interface WorkerRef {
  readonly state: string;
  postMessage(message: unknown, transfer: Transferable[]): void;
  addEventListener(type: 'statechange', f: () => void): void;
}

export interface RegistrationLike {
  readonly waiting: WorkerRef | null;
  readonly installing: WorkerRef | null;
  addEventListener(type: 'updatefound', f: () => void): void;
  update(): Promise<unknown>;
}

export interface ContainerLike {
  readonly controller: WorkerRef | null;
  register(url: string, options: { scope: string }): Promise<RegistrationLike>;
  addEventListener(type: 'controllerchange', f: () => void): void;
}

export interface PwaEnv {
  /** The service worker container, or the reason there is none for this copy. */
  readonly container: ContainerLike | { readonly unavailable: string };
  readonly swUrl: string;
  readonly scope: string;
  /** Asks a worker for its build id. */
  readonly askVersion: (w: WorkerRef) => Promise<string>;
  readonly reload: () => void;
}

function hasContainer(c: PwaEnv['container']): c is ContainerLike {
  return 'register' in c;
}

function reasonOf(e: unknown): string {
  return e instanceof Error && e.message !== '' ? e.message : String(e);
}

export class Pwa {
  private state: PwaState = { offline: { kind: 'installing' }, update: null };
  private readonly listeners = new Set<() => void>();
  private registration: RegistrationLike | null = null;
  private waiting: WorkerRef | null = null;
  private reloading = false;

  constructor(private readonly env: PwaEnv) {
    if (!hasContainer(env.container))
      this.state = {
        offline: { kind: 'unavailable', reason: env.container.unavailable },
        update: null,
      };
  }

  readonly current = (): PwaState => this.state;

  readonly subscribe = (f: () => void): (() => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };

  private set(next: Partial<PwaState>): void {
    this.state = { ...this.state, ...next };
    for (const f of this.listeners) f();
  }

  /** Registers the service worker (once; nothing for a copy without one). */
  async start(): Promise<void> {
    const c = this.env.container;
    if (!hasContainer(c) || this.registration !== null) return;
    c.addEventListener('controllerchange', () => {
      if (this.reloading) this.env.reload();
      else this.set({ offline: { kind: 'ready' } });
    });
    try {
      const reg = await c.register(this.env.swUrl, { scope: this.env.scope });
      this.registration = reg;
      if (c.controller !== null) this.set({ offline: { kind: 'ready' } });
      this.watch(c, reg);
    } catch (e) {
      this.set({ offline: { kind: 'failed', reason: reasonOf(e) } });
    }
  }

  private watch(c: ContainerLike, reg: RegistrationLike): void {
    const offer = (w: WorkerRef) => {
      // Without a controller this is the first install: it takes over by itself.
      if (c.controller === null) return;
      this.waiting = w;
      void this.env.askVersion(w).then((build) => {
        if (this.waiting === w) this.set({ update: { build } });
      });
    };
    if (reg.waiting !== null) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w === null) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed') offer(w);
      });
    });
  }

  /** Looks for a new version (the page calls it when it becomes visible again). */
  checkForUpdate(): void {
    void this.registration?.update().catch(() => undefined);
  }

  /** The banner's Reload: save first, then let the new version take over and reload. */
  applyUpdate(beforeReload: () => void): void {
    const w = this.waiting;
    if (w === null) return;
    beforeReload();
    this.reloading = true;
    w.postMessage({ type: 'skip-waiting' }, []);
  }

  /** The banner's Later: hidden until another version installs. */
  dismiss(): void {
    this.waiting = null;
    this.set({ update: null });
  }
}

/** How long a page waits for a worker to say its version (ms). */
const VERSION_MS = 3000;

/** Asks a worker for its build id on a MessageChannel ('unknown' if it does not answer). */
export function askVersion(w: WorkerRef): Promise<string> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      resolve('unknown');
    }, VERSION_MS);
    channel.port1.onmessage = (e: MessageEvent<unknown>) => {
      clearTimeout(timer);
      const d = e.data;
      resolve(
        typeof d === 'object' && d !== null && 'build' in d && typeof d.build === 'string'
          ? d.build
          : 'unknown',
      );
    };
    w.postMessage({ type: 'version' }, [channel.port2]);
  });
}
