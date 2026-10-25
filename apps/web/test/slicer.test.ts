import { describe, expect, it } from 'vitest';
import type { JobProgress, JobResult } from '@geomira/claims/job';
import { runSliced, type SliceClock } from '../src/worker/slicer';

/**
 * Run 12, SPEC §16: the loop that runs a job's generator in time slices, shared by the Web
 * Worker and the page's fallback without workers. A fake clock: each generator step advances
 * it by the step's cost, and `later` queues the next slice as a separate task.
 */
class FakeClock implements SliceClock {
  t = 0;
  readonly tasks: (() => void)[] = [];
  /** The duration of every task that ran (ms of fake time). */
  readonly durations: number[] = [];
  now = (): number => this.t;
  later = (f: () => void): void => {
    this.tasks.push(f);
  };
  /** Runs queued tasks until none is left (or `max` ran), recording their durations. */
  drain(max = 100_000): number {
    let ran = 0;
    while (this.tasks.length > 0 && ran < max) {
      const f = this.tasks.shift();
      if (f === undefined) break;
      const start = this.t;
      f();
      this.durations.push(this.t - start);
      ran++;
    }
    return ran;
  }
}

/** A generator of `n` steps whose step i costs cost(i) ms of fake time. */
function* job(
  clock: FakeClock,
  n: number,
  cost: (i: number) => number,
): Generator<JobProgress, JobResult, 'cancel' | undefined> {
  for (let i = 0; i < n; i++) {
    clock.t += cost(i);
    const cmd = yield { kind: 'progress', regime: 'local', done: i + 1, n, attempts: i + 1 };
    if (cmd === 'cancel') return { kind: 'cancelled', done: i + 1, attempts: i + 1 };
  }
  return { kind: 'invalid', reason: `finished ${String(n)}` };
}

interface Sink {
  progress: JobProgress[];
  result: JobResult[];
  error: string[];
}

function sink(): Sink & {
  callbacks: {
    progress: (p: JobProgress) => void;
    result: (r: JobResult) => void;
    error: (m: string) => void;
  };
} {
  const s: Sink = { progress: [], result: [], error: [] };
  return {
    ...s,
    callbacks: {
      progress: (p) => s.progress.push(p),
      result: (r) => s.result.push(r),
      error: (m) => s.error.push(m),
    },
  };
}

describe('runSliced', () => {
  it('runs the whole job in slices no longer than the budget when steps are uniform', () => {
    const clock = new FakeClock();
    const s = sink();
    runSliced(
      job(clock, 200, () => 1),
      { sliceMs: 12, progressMs: 100 },
      clock,
      s.callbacks,
      {
        deferStart: true,
      },
    );
    clock.drain();
    expect(s.result).toEqual([{ kind: 'invalid', reason: 'finished 200' }]);
    expect(Math.max(...clock.durations)).toBeLessThanOrEqual(12);
    // Each slice is used: 200 steps of 1 ms in slices of 12 ms → well under 30 tasks.
    expect(clock.durations.length).toBeLessThan(30);
    expect(s.error).toEqual([]);
  });

  it('predicts from the longest step so far: a slice stops before a step would overrun it', () => {
    const clock = new FakeClock();
    const s = sink();
    // Steps of 5 ms: after two (10 ms) a third would end at 15 > 12, so the slice stops.
    runSliced(
      job(clock, 60, () => 5),
      { sliceMs: 12, progressMs: 100 },
      clock,
      s.callbacks,
      {
        deferStart: true,
      },
    );
    clock.drain();
    expect(s.result).toHaveLength(1);
    expect(Math.max(...clock.durations)).toBeLessThanOrEqual(12);
  });

  it('a step longer than every earlier one overruns once; later ones run alone', () => {
    const clock = new FakeClock();
    const s = sink();
    runSliced(
      job(clock, 12, (i) => (i === 4 || i === 8 ? 30 : 1)),
      { sliceMs: 12, progressMs: 100 },
      clock,
      s.callbacks,
      { deferStart: true },
    );
    clock.drain();
    expect(s.result).toHaveLength(1);
    const over = clock.durations.filter((d) => d > 12);
    // The first long step was not predicted: its slice is at most the budget plus the step.
    expect(over).toHaveLength(2);
    expect(over[0]).toBeLessThanOrEqual(12 + 30);
    // The second was: it runs alone in its slice (at least one step per slice).
    expect(over[1]).toBe(30);
  });

  it('a slow first step (the setup of the job) and old outliers do not shrink later slices', () => {
    const clock = new FakeClock();
    const s = sink();
    runSliced(
      job(clock, 400, (i) => (i === 0 ? 50 : i === 2 ? 20 : 1)),
      { sliceMs: 12, progressMs: 100 },
      clock,
      s.callbacks,
      { deferStart: true },
    );
    clock.drain();
    expect(s.result).toHaveLength(1);
    // After RECENT_STEPS steps the outlier is forgotten: slices hold ~11 steps again.
    expect(clock.durations.length).toBeLessThan(60);
    expect(clock.durations.slice(-10).every((d) => d >= 10 && d <= 12)).toBe(true);
  });

  it('posts progress at most every progressMs, never after the result', () => {
    const clock = new FakeClock();
    const s = sink();
    runSliced(
      job(clock, 1000, () => 1),
      { sliceMs: 10, progressMs: 100 },
      clock,
      s.callbacks,
    );
    clock.drain();
    expect(s.progress.length).toBeGreaterThan(5);
    expect(s.progress.length).toBeLessThanOrEqual(11);
    const done = s.progress.map((p) => p.done);
    expect(done).toEqual([...done].sort((a, b) => a - b));
    expect(s.result).toHaveLength(1);
  });

  it('cancels between two steps when asked, with the generator answering cancel', () => {
    const clock = new FakeClock();
    const s = sink();
    let stop = false;
    runSliced(
      job(clock, 1000, () => 1),
      { sliceMs: 10, progressMs: 100, cancelled: () => stop },
      clock,
      s.callbacks,
    );
    clock.drain(3);
    stop = true;
    clock.drain();
    expect(s.result).toHaveLength(1);
    expect(s.result[0]?.kind).toBe('cancelled');
    const r = s.result[0];
    if (r?.kind !== 'cancelled') throw new Error('not cancelled');
    expect(r.done).toBeLessThan(1000);
  });

  it('reports a throwing generator as an error and stops', () => {
    const clock = new FakeClock();
    const s = sink();
    function* broken(): Generator<JobProgress, JobResult, 'cancel' | undefined> {
      yield { kind: 'progress', regime: 'global', done: 1, n: 2, attempts: 1 };
      throw new Error('boom');
    }
    runSliced(broken(), { sliceMs: 10, progressMs: 100 }, clock, s.callbacks);
    clock.drain();
    expect(s.error).toEqual(['boom']);
    expect(s.result).toEqual([]);
    expect(clock.tasks).toEqual([]);
  });

  it('the first slice runs synchronously only when asked; otherwise every slice is a task', () => {
    const clock = new FakeClock();
    const s = sink();
    runSliced(
      job(clock, 3, () => 1),
      { sliceMs: 10, progressMs: 100 },
      clock,
      s.callbacks,
      {
        deferStart: true,
      },
    );
    expect(clock.t).toBe(0);
    expect(clock.tasks).toHaveLength(1);
    clock.drain();
    expect(s.result).toHaveLength(1);
  });
});
