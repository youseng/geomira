/**
 * The bounded-step helpers: sortSteps sorts exactly as a stable sort does, in steps; drain runs
 * a computation to its end; asSteps answers a command between two chunks.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { asSteps, drain, sortIndexSteps } from '../src/ticking';

describe('sortIndexSteps', () => {
  it('equals a stable sort of the indices (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -20, max: 20 }), { maxLength: 300 }), (xs) => {
        const want = xs.map((_, i) => i).sort((a, b) => (xs[a] ?? 0) - (xs[b] ?? 0));
        expect([...drain(sortIndexSteps(xs))]).toEqual(want);
      }),
    );
  });

  it('yields on a large input and keeps every index', () => {
    const xs = Array.from({ length: 20_000 }, (_, i) => (i * 7919) % 1000);
    const g = sortIndexSteps(xs);
    let steps = 0;
    let r = g.next();
    while (r.done !== true) {
      steps++;
      r = g.next();
    }
    expect(steps).toBeGreaterThan(10);
    expect(new Set(r.value).size).toBe(20_000);
    const sorted = [...r.value].map((i) => xs[i] ?? 0);
    expect(sorted.every((x, k) => k === 0 || (sorted[k - 1] ?? 0) <= x)).toBe(true);
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
