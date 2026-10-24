/**
 * Bug-fix round (ADR-0028): the canvas stayed blurry after a devicePixelRatio change (a window
 * moved to another screen, a browser zoom): its pixel size was set on resize only. The
 * surface now watches the ratio with a resolution media query, renewed after each change.
 */
import { describe, expect, it } from 'vitest';
import { watchPixelRatio, type RatioSource } from '../src/surface';

/** A window whose ratio the test sets; each media query fires when the ratio leaves it. */
class FakeWindow implements RatioSource {
  devicePixelRatio = 1;
  readonly queries: { query: string; listeners: Set<() => void> }[] = [];
  matchMedia(query: string) {
    const q = { query, listeners: new Set<() => void>() };
    this.queries.push(q);
    return {
      addEventListener: (_: 'change', f: () => void) => q.listeners.add(f),
      removeEventListener: (_: 'change', f: () => void) => q.listeners.delete(f),
    };
  }
  setRatio(r: number): void {
    const was = `(resolution: ${String(this.devicePixelRatio)}dppx)`;
    this.devicePixelRatio = r;
    for (const q of [...this.queries]) if (q.query === was) for (const f of [...q.listeners]) f();
  }
  listening(): number {
    return this.queries.reduce((n, q) => n + q.listeners.size, 0);
  }
}

describe('watchPixelRatio', () => {
  it('calls back on every change, each time watching the new ratio', () => {
    const win = new FakeWindow();
    let n = 0;
    const stop = watchPixelRatio(win, () => n++);
    expect(win.queries[0]?.query).toBe('(resolution: 1dppx)');
    win.setRatio(2);
    expect(n).toBe(1);
    expect(win.queries.at(-1)?.query).toBe('(resolution: 2dppx)');
    win.setRatio(1.5);
    expect(n).toBe(2);
    expect(win.listening()).toBe(1);
    stop();
    expect(win.listening()).toBe(0);
    win.setRatio(3);
    expect(n).toBe(2);
  });
});
