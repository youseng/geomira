/**
 * The bounded-step helpers: sortSteps sorts exactly as a stable sort does, in steps; drain runs
 * a computation to its end; asSteps answers a command between two chunks.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { asSteps, drain, sortSteps } from '../src/ticking';

describe('sortSteps', () => {
  it('equals a stable sort (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -20, max: 20 }), { maxLength: 300 }), (xs) => {
        const items = xs.map((m, i) => ({ m, i }));
        const want = [...items].sort((a, b) => a.m - b.m);
        expect(drain(sortSteps(items, (a, b) => a.m < b.m))).toEqual(want);
      }),
    );
  });

  it('yields on a large input and keeps every element', () => {
    const items = Array.from({ length: 20_000 }, (_, i) => ({ m: (i * 7919) % 1000, i }));
    const g = sortSteps(items, (a, b) => a.m < b.m);
    let steps = 0;
    let r = g.next();
    while (r.done !== true) {
      steps++;
      r = g.next();
    }
    expect(steps).toBeGreaterThan(10);
    expect(r.value).toHaveLength(20_000);
    expect(r.value.every((x, k) => k === 0 || (r.value[k - 1]?.m ?? 0) <= x.m)).toBe(true);
  });
});

describe('asSteps', () => {
  function* three() {
    yield undefined;
    yield undefined;
    return 3;
  }
  it('gives the value, or the command that interrupted it', () => {
    const run = asSteps<number, string, 'stop' | undefined>(three(), () => 'p');
    expect(run.next().value).toBe('p');
    expect(run.next('stop').value).toEqual({ cmd: 'stop' });
    const all = asSteps<number, string, 'stop' | undefined>(three(), () => 'p');
    let r = all.next();
    while (r.done !== true) r = all.next();
    expect(r.value).toEqual({ value: 3 });
  });
});
