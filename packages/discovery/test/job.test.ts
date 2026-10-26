/** ADR-0035 decision 15: one entry point for the discovery jobs; steps stay small. */
import { describe, expect, it } from 'vitest';
import { Figure } from '../../claims/test/helpers/build';
import { runDiscoveryJob } from '../src/job';
import { REGISTRY, triangle } from './helpers';

function steps(g: Generator<unknown, unknown, unknown>): { steps: number; value: unknown } {
  let n = 0;
  for (;;) {
    const r = g.next();
    if (r.done === true) return { steps: n, value: r.value };
    n++;
  }
}

describe('runDiscoveryJob', () => {
  const f = triangle();
  it('dispatches find, hunt and branchFix', () => {
    const a = steps(
      runDiscoveryJob(
        { kind: 'find', doc: f.doc, seed: 1, budget: { n: 10, tests: 4 } },
        { registry: REGISTRY },
      ),
    );
    expect(a.value).toMatchObject({ kind: 'found' });
    // Progress after every bounded step: many steps, at least one per sample of each test.
    expect(a.steps).toBeGreaterThan(4 * 10);
    const b = steps(
      runDiscoveryJob(
        { kind: 'hunt', doc: f.doc, seed: 1, budget: { targets: 2, positions: 1 } },
        { registry: REGISTRY },
      ),
    );
    expect(b.value).toMatchObject({ kind: 'positions' });
    const g = new Figure().point('A', 0, 0).point('B', 1, 0);
    const id = g.claim('equal', 'A', 'B');
    const c = steps(
      runDiscoveryJob(
        { kind: 'branchFix', doc: g.doc, claim: id, regime: 'local', seed: 1 },
        { registry: REGISTRY },
      ),
    );
    expect(c.value).toMatchObject({ kind: 'fixes', fixes: [] });
  });
});
