import { describe, expect, it } from 'vitest';
import { Pwa, type ContainerLike, type RegistrationLike, type WorkerRef } from '../src/pwa';

/**
 * Run 12, SPEC §1 v1.1 (PWA): the page's view of its service worker. Offline is "ready" once a
 * worker controls the page; a version that installs beside a running one is offered (the
 * version banner) with its build id, and applied only on Reload, after the figure is saved.
 */

class FakeWorker implements WorkerRef {
  state = 'installing';
  readonly messages: unknown[] = [];
  private readonly listeners: (() => void)[] = [];
  postMessage(message: unknown): void {
    this.messages.push(message);
  }
  addEventListener(_type: 'statechange', f: () => void): void {
    this.listeners.push(f);
  }
  to(state: string): void {
    this.state = state;
    for (const f of this.listeners) f();
  }
}

class FakeRegistration implements RegistrationLike {
  waiting: WorkerRef | null = null;
  installing: WorkerRef | null = null;
  updates = 0;
  private readonly listeners: (() => void)[] = [];
  addEventListener(_type: 'updatefound', f: () => void): void {
    this.listeners.push(f);
  }
  update(): Promise<unknown> {
    this.updates++;
    return Promise.resolve();
  }
  found(w: WorkerRef): void {
    this.installing = w;
    for (const f of this.listeners) f();
  }
}

class FakeContainer implements ContainerLike {
  controller: WorkerRef | null = null;
  readonly registered: { url: string; scope: string }[] = [];
  readonly reg = new FakeRegistration();
  fail: Error | null = null;
  private readonly listeners: (() => void)[] = [];
  register(url: string, options: { scope: string }): Promise<RegistrationLike> {
    this.registered.push({ url, scope: options.scope });
    return this.fail === null ? Promise.resolve(this.reg) : Promise.reject(this.fail);
  }
  addEventListener(_type: 'controllerchange', f: () => void): void {
    this.listeners.push(f);
  }
  takeOver(w: WorkerRef): void {
    this.controller = w;
    for (const f of this.listeners) f();
  }
}

const builds = new Map<WorkerRef, string>();

function setup(container: FakeContainer | { unavailable: string }) {
  let reloads = 0;
  const pwa = new Pwa({
    container,
    swUrl: '/geomira/sw.js',
    scope: '/geomira/',
    askVersion: (w) => Promise.resolve(builds.get(w) ?? 'unknown'),
    reload: () => {
      reloads++;
    },
  });
  return { pwa, reloads: () => reloads };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Pwa', () => {
  it('a copy without service workers says why, and registers nothing', async () => {
    const { pwa } = setup({ unavailable: 'this is the single-file copy' });
    await pwa.start();
    expect(pwa.current().offline).toEqual({
      kind: 'unavailable',
      reason: 'this is the single-file copy',
    });
  });

  it('first visit: installing, then ready when the new worker takes the page', async () => {
    const c = new FakeContainer();
    const { pwa } = setup(c);
    await pwa.start();
    expect(c.registered).toEqual([{ url: '/geomira/sw.js', scope: '/geomira/' }]);
    expect(pwa.current().offline.kind).toBe('installing');
    // The first worker installs: no banner (nothing runs that it would replace).
    const w = new FakeWorker();
    c.reg.found(w);
    w.to('installed');
    await tick();
    expect(pwa.current().update).toBeNull();
    c.takeOver(w);
    expect(pwa.current().offline.kind).toBe('ready');
  });

  it('a later visit is ready at once', async () => {
    const c = new FakeContainer();
    c.controller = new FakeWorker();
    const { pwa } = setup(c);
    await pwa.start();
    expect(pwa.current().offline.kind).toBe('ready');
  });

  it('a new version installed beside the running one is offered with its build', async () => {
    const c = new FakeContainer();
    c.controller = new FakeWorker();
    const { pwa, reloads } = setup(c);
    let heard = 0;
    pwa.subscribe(() => heard++);
    await pwa.start();
    const next = new FakeWorker();
    builds.set(next, 'b2c3d4e5');
    c.reg.found(next);
    next.to('installed');
    await tick();
    expect(pwa.current().update).toEqual({ build: 'b2c3d4e5' });
    expect(heard).toBeGreaterThan(0);
    // Reload: save, ask the new worker to take over, reload when it has.
    const order: string[] = [];
    pwa.applyUpdate(() => order.push('saved'));
    expect(order).toEqual(['saved']);
    expect(next.messages).toEqual([{ type: 'skip-waiting' }]);
    expect(reloads()).toBe(0);
    c.takeOver(next);
    expect(reloads()).toBe(1);
  });

  it('a version already waiting at load is offered too; Later hides it', async () => {
    const c = new FakeContainer();
    c.controller = new FakeWorker();
    const waiting = new FakeWorker();
    builds.set(waiting, 'c0ffee00');
    c.reg.waiting = waiting;
    const { pwa } = setup(c);
    await pwa.start();
    await tick();
    expect(pwa.current().update).toEqual({ build: 'c0ffee00' });
    pwa.dismiss();
    expect(pwa.current().update).toBeNull();
    // Nothing to apply after Later.
    pwa.applyUpdate(() => {
      throw new Error('must not save');
    });
    expect(waiting.messages).toEqual([]);
  });

  it('a failed registration is reported, never thrown', async () => {
    const c = new FakeContainer();
    c.fail = new Error('SecurityError: blocked');
    const { pwa } = setup(c);
    await pwa.start();
    expect(pwa.current().offline).toEqual({ kind: 'failed', reason: 'SecurityError: blocked' });
  });

  it('checks for updates on request', async () => {
    const c = new FakeContainer();
    const { pwa } = setup(c);
    await pwa.start();
    pwa.checkForUpdate();
    expect(c.reg.updates).toBe(1);
  });
});
