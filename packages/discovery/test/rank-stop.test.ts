/**
 * ADR-0052 (found while measuring ADR-0037's gate): a `stop` that comes while the ranking
 * rebuilds the knowledge with a shown fact must end that rebuild. After a stop the find job
 * drives the ranking to its end in one step (ADR-0035 decision 15), so a rebuild that went on
 * ran whole in that step: 185 ms on the 150-object figure in Node, a 135 ms task on the page.
 * After a stop no snapshot is read again (no fact is checked against one), so the rebuild is
 * not needed.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { screenSteps } from '@geomira/claims/screen';
import { knowledgeSteps } from '../src/derive';
import { find } from '../src/find';
import { rankFacts } from '../src/rank';
import { drain } from '../src/ticking';
import { REGISTRY, triangle } from './helpers';

const KINDS = claimKindRegistry();

describe('a stop while ranking (ADR-0052)', { timeout: 120_000 }, () => {
  const { doc } = triangle();
  const r = find(
    { kind: 'find', doc, seed: 1, budget: { n: 10, tests: 12 } },
    { registry: REGISTRY },
  );
  if (r.kind !== 'found') throw new Error(r.kind);
  const screen = drain(screenSteps(doc, REGISTRY, 9));
  if ('reason' in screen) throw new Error(screen.reason);
  const values = screen.values;
  const k0 = drain(knowledgeSteps(doc, REGISTRY, KINDS, { values }));
  const order = new Map(doc.objects.map((o, i) => [o.id, i]));
  const env = { doc, registry: REGISTRY, kinds: KINDS, values, order };

  it('ends the knowledge rebuild in progress: the ranking returns without another yield', () => {
    expect(r.facts.length).toBeGreaterThan(2);
    let stopped = false;
    const g = rankFacts(r.facts, env, k0, () => stopped);
    // Into the first rebuild (it yields between bounded chunks).
    let x = g.next();
    for (let i = 0; i < 3 && x.done !== true; i++) x = g.next();
    expect(x.done).toBe(false);
    stopped = true;
    const end = g.next();
    expect(end.done).toBe(true);
    if (end.done !== true) return;
    // Every fact is shown or hidden; no snapshot beyond the construction's was added.
    expect(end.value.shown.length + end.value.hidden.length).toBe(r.facts.length);
    expect(end.value.snapshots.list).toHaveLength(1);
  });

  it('without a stop, one snapshot per shown fact, as before', () => {
    const ranked = drain(rankFacts(r.facts, env, k0));
    expect(ranked.snapshots.list).toHaveLength(ranked.shown.length + 1);
  });
});
