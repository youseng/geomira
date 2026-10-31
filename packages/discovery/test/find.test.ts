/**
 * ADR-0035: the find job. Only facts the LOCAL test confirms are reported (HOLDS IN THIS
 * CONFIGURATION, with the rungs used); construction facts are hidden and counted; every cap is
 * stated; the result is deterministic for a seed; cancel and stop are honoured.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { evalClaim } from '@geomira/claims/eval-claim';
import { buildClosure } from '../src/closure';
import { find, runFind, withFact } from '../src/find';
import { EULER } from '../src/lemmas';
import type { FindJob, FindResult } from '../src/types';
import { REGISTRY, show, triangle } from './helpers';

const KINDS = claimKindRegistry();

function found(job: FindJob): FindResult {
  const r = find(job, { registry: REGISTRY });
  if (r.kind !== 'found') throw new Error(JSON.stringify(r));
  return r;
}

describe('the find job (ADR-0035)', () => {
  const f = triangle();
  const r = found({ kind: 'find', doc: f.doc, seed: 1, budget: { n: 30, tests: 40 } });
  const texts = r.facts.map((x) => show(f.doc, x));

  it('reports the Euler line, tagged, exact over Q', () => {
    const euler = r.facts.find((x) => x.kind === 'collinear');
    expect(euler && show(f.doc, euler)).toBe('collinear(O, H, G_c)');
    expect(euler?.tag).toBe(EULER);
    expect(euler?.rungs).toBe('exact over Q, 30/30');
    expect(euler?.exact).toBe(true);
    expect(r.facts[0]).toBe(euler);
    expect(texts).toContain('length(A, G_c, G_c, M_a, 2)');
    expect(texts).toContain('length(H, G_c, O, G_c, 2)');
  });

  it('every reported fact holds locally and in the current figure, and is not a construction fact', () => {
    const cl = buildClosure(f.doc, REGISTRY, KINDS);
    expect(r.facts.length).toBeGreaterThanOrEqual(8);
    for (const x of r.facts) {
      expect(x.verdict.kind, show(f.doc, x)).toBe('holds');
      expect(x.verdict.regime).toBe('local');
      expect(cl.isConstruction(x), show(f.doc, x)).toBe(false);
      const w = withFact(f.doc, x);
      expect(evalClaim(w.doc, w.id, REGISTRY).value, show(f.doc, x)).toBe('true');
    }
  });

  it('construction facts are hidden and counted, never reported', () => {
    const hidden = r.construction.shown.map((x) => show(f.doc, x));
    expect(r.construction.count).toBeGreaterThanOrEqual(hidden.length);
    expect(hidden).toContain('collinear(B, C, M_a)');
    expect(hidden).toContain('on(A, w)');
    expect(texts).not.toContain('length(B, M_a, C, M_a, 1)');
    expect(r.construction.count).toBeGreaterThan(200);
    for (const h of hidden) expect(texts).not.toContain(h);
  });

  it('states its caps and what it did not search', () => {
    expect(r.notSearched.map((x) => x.kind)).toEqual([
      ...['ratio', 'ratio_value'],
      ...['cross_ratio', 'cross_ratio_lines'],
      ...['similar', 'similar_direct', 'similar_opposite'],
      ...['congruent', 'congruent_direct', 'congruent_opposite'],
      ...['length_product', 'length_sum'],
    ]);
    expect(r.caps).toContain('ratio not searched: eight points: too many tuples to search in v1');
    expect(r.untested).toBeGreaterThan(0);
    expect(r.caps.some((c) => /^tested 40 of [\d,]+ facts: test budget$/u.test(c))).toBe(true);
    const small = found({
      kind: 'find',
      doc: f.doc,
      seed: 1,
      budget: { n: 10, tests: 3, results: 1, candidatesPerKind: 20 },
    });
    expect(small.facts).toHaveLength(1);
    expect(small.caps).toContain(`showing 1 of ${String(1 + small.beyondResults)} facts`);
    const coll = small.kinds.find((k) => k.kind === 'collinear');
    expect(coll).toMatchObject({ checked: 20, total: 84, stop: 'budget' });
    expect(small.caps).toContain('checked 20 of 84 collinear candidates: budget');
  });

  it('is deterministic for a seed; carries the seed', () => {
    const again = found({ kind: 'find', doc: f.doc, seed: 1, budget: { n: 30, tests: 40 } });
    expect(again.facts.map((x) => x.key)).toEqual(r.facts.map((x) => x.key));
    expect(again.seed).toBe(1);
  });

  it('cancel ends with nothing; stop ends with what is confirmed and says so', () => {
    const job: FindJob = { kind: 'find', doc: f.doc, seed: 2, budget: { n: 10, tests: 5 } };
    const it1 = runFind(job, { registry: REGISTRY });
    it1.next();
    expect(it1.next('cancel')).toEqual({ done: true, value: { kind: 'cancelled' } });
    const it2 = runFind(job, { registry: REGISTRY });
    // Advance into the screen (the first steps evaluate the figure and build the closure).
    let res = it2.next();
    while (res.done !== true && !res.value.phase.startsWith('screening')) res = it2.next();
    for (let k = 0; k < 4 && res.done !== true; k++) res = it2.next();
    const stopped = res.done === true ? res.value : it2.next('stop').value;
    if (stopped.kind !== 'found') throw new Error('stop');
    expect(stopped.stopped).toBe(true);
    expect(stopped.caps).toContain('stopped at the time budget');
    // Stopped while screening: that kind says so, and later kinds were not reached.
    expect(stopped.kinds.some((k) => k.stop === 'time')).toBe(true);
    expect(stopped.kinds.length).toBeLessThan(KINDS.kinds.length - 2);
    expect(stopped.caps.some((c) => c.endsWith(': time budget'))).toBe(true);
  });

  it('a figure without an evaluation context is invalid', () => {
    const t = triangle();
    const bad = {
      ...t.doc,
      objects: t.doc.objects.map((o) =>
        o.name === 'A' && o.def.kind === 'call'
          ? {
              ...o,
              def: {
                ...o.def,
                args: [
                  { kind: 'lit' as const, value: { num: 10n ** 400n, den: 1n } },
                  { kind: 'lit' as const, value: { num: 0n, den: 1n } },
                ],
              },
            }
          : o,
      ),
    };
    expect(find({ kind: 'find', doc: bad, seed: 1 }, { registry: REGISTRY }).kind).toBe('invalid');
  });
});
