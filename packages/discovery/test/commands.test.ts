/**
 * SPEC §16, ADR-0035 decision 15, ADR-0036 decision 6: the jobs answer the host's commands at
 * EVERY step. `cancel` at step k ends the job `cancelled` at once (nothing reported); `stop` at
 * step k ends it with a result marked stopped (find, hunt) or a time-budget note (branchFix),
 * after at most a bounded tail of steps, and every fact it reports is still one the local test
 * confirmed.
 */
import { describe, expect, it } from 'vitest';
import { Figure, n, orient, sameSide } from '../../claims/test/helpers/build';
import { runDiscoveryJob, type DiscoveryJob, type DiscoveryOutcome } from '../src/job';
import type { DiscoveryCommand } from '../src/types';
import { REGISTRY, triangle } from './helpers';

const ENV = { registry: REGISTRY };

/** Each sweep runs a job a dozen times (slower under coverage instrumentation). */
const SWEEP_TIMEOUT = 120_000;

/** The job's step count with no command. */
function length(job: DiscoveryJob): number {
  const g = runDiscoveryJob(job, ENV);
  let k = 0;
  while (g.next().done !== true) k++;
  return k;
}

/** Runs `job`, sending `cmd` after `at` steps; the outcome and the steps after the command. */
function withCommand(job: DiscoveryJob, at: number, cmd: DiscoveryCommand) {
  const g = runDiscoveryJob(job, ENV);
  for (let i = 0; i < at; i++) {
    const r = g.next();
    if (r.done === true) return { out: r.value, tail: 0 };
  }
  let r = g.next(cmd);
  let tail = 0;
  while (r.done !== true) {
    r = g.next();
    tail++;
  }
  return { out: r.value, tail };
}

/**
 * Command points spread over the job: the first steps, then evenly to the last yield. A command
 * reaches a generator only at a yield (the first `next()` starts it), so points start at 1.
 */
function points(total: number): number[] {
  const out = new Set([1, 2, 3]);
  for (let i = 1; i <= 12; i++) out.add(Math.floor((total * i) / 12));
  return [...out].filter((k) => k >= 1 && k <= total).sort((a, b) => a - b);
}

function circles(): Figure {
  return new Figure()
    .point('A', 0, 0)
    .point('B', 8, 0)
    .point('Q', 4, -10)
    .def('c1', 'circle', 'A', n(5))
    .def('c2', 'circle', 'B', n(5))
    .def('ab', 'line', 'A', 'B')
    .def('Y', 'intersect', 'c1', 'c2', sameSide('Q', 'ab'))
    .def('X', 'intersect', 'c1', 'c2', orient(1));
}

function stopped(out: DiscoveryOutcome): boolean {
  switch (out.kind) {
    case 'found':
    case 'positions':
      return out.stopped;
    case 'fixes':
      return out.note?.endsWith('time budget') === true || out.checked === out.total;
    case 'cancelled':
    case 'invalid':
      return false;
    default:
      return false;
  }
}

describe('commands at every step', () => {
  const f = triangle();
  const g = circles();
  const claim = g.claim('equal', 'X', 'Y');
  const jobs: { name: string; job: DiscoveryJob }[] = [
    { name: 'find', job: { kind: 'find', doc: f.doc, seed: 2, budget: { n: 6, tests: 4 } } },
    { name: 'hunt', job: { kind: 'hunt', doc: f.doc, seed: 2, budget: { targets: 3 } } },
    {
      name: 'branchFix',
      job: { kind: 'branchFix', doc: g.doc, claim, regime: 'local', seed: 2, n: 6 },
    },
  ];
  for (const { name, job } of jobs) {
    const total = length(job);
    it(
      `${name}: cancel at any step is cancelled at once`,
      () => {
        for (const k of points(total)) {
          const r = withCommand(job, k, 'cancel');
          expect(r.out, `${name} at ${String(k)}`).toEqual({ kind: 'cancelled' });
          expect(r.tail).toBe(0);
        }
      },
      SWEEP_TIMEOUT,
    );
    it(
      `${name}: stop at any step ends with what it has, said so`,
      () => {
        for (const k of points(total)) {
          const r = withCommand(job, k, 'stop');
          expect(stopped(r.out), `${name} at ${String(k)}: ${r.out.kind}`).toBe(true);
          if (r.out.kind === 'found') {
            for (const fact of r.out.facts) expect(fact.verdict.kind).toBe('holds');
            expect(r.out.caps).toContain('stopped at the time budget');
          }
        }
      },
      SWEEP_TIMEOUT,
    );
  }

  it('an unknown claim is invalid for branchFix', () => {
    const r = withCommand(
      { kind: 'branchFix', doc: g.doc, claim: 999, regime: 'global', seed: 1 },
      0,
      undefined,
    );
    expect(r.out.kind).toBe('invalid');
  });
});
