/**
 * ADR-0035 decision 13: special positions. Each position is a complete document that differs
 * from the current one only in one free input; its target is false now and true there (by the
 * claim tester), and so is every fact it lists; positions that contradict an `assume` line or
 * make a defined object undefined are skipped and counted; the current document never changes.
 */
import { describe, expect, it } from 'vitest';
import { evalClaim } from '@geomira/claims/eval-claim';
import { hypothesesInFigure } from '@geomira/claims/figure-hypotheses';
import { exprEquals } from '@geomira/kernel/expr';
import { Figure } from '../../claims/test/helpers/build';
import { withFact } from '../src/find';
import { hunt, runHunt, type HuntJob, type HuntResult } from '../src/hunt';
import { REGISTRY, show } from './helpers';

function triangleFigure(): Figure {
  return new Figure()
    .point('A', 1, 5)
    .point('B', -3, 0)
    .point('C', 4, 1)
    .def('O', 'circumcenter', 'A', 'B', 'C')
    .def('H', 'orthocenter', 'A', 'B', 'C')
    .def('M', 'midpoint', 'B', 'C');
}

function positions(job: HuntJob): HuntResult {
  const r = hunt(job, { registry: REGISTRY });
  if (r.kind !== 'positions') throw new Error(r.kind);
  return r;
}

describe('special positions (ADR-0035)', () => {
  const f = triangleFigure();
  const before = structuredClone(f.doc);
  const r = positions({ kind: 'hunt', doc: f.doc, seed: 1 });

  it('finds positions; each changes one input; its facts are false now and true there', () => {
    expect(r.positions.length).toBeGreaterThan(2);
    for (const p of r.positions) {
      const changed = p.doc.objects.filter(
        (o, i) => !exprEquals(o.def, f.doc.objects[i]?.def ?? o.def),
      );
      expect(changed.map((o) => o.id)).toEqual([p.object]);
      for (const fact of p.facts) {
        const now = withFact(f.doc, fact);
        const there = withFact(p.doc, fact);
        expect(evalClaim(now.doc, now.id, REGISTRY).value, show(f.doc, fact)).toBe('false');
        expect(evalClaim(there.doc, there.id, REGISTRY).value, show(f.doc, fact)).toBe('true');
      }
      expect(p.facts[0]).toEqual(p.target);
      expect(['exact over Q', 'numeric']).toContain(p.rung);
    }
    expect(f.doc).toEqual(before);
  });

  it('finds the right angle at A (O on BC, the midpoint M)', () => {
    expect(r.positions.some((p) => show(f.doc, p.target) === 'equal(O, M)')).toBe(true);
  });

  it('skips positions that contradict an assume line', () => {
    const g = triangleFigure().assume('acute', 'A', 'B', 'C');
    const h = positions({ kind: 'hunt', doc: g.doc, seed: 1 });
    for (const p of h.positions)
      expect(hypothesesInFigure(p.doc, REGISTRY).every((x) => x.status === 'holds')).toBe(true);
    expect(h.positions.some((p) => show(g.doc, p.target) === 'equal(O, M)')).toBe(false);
    expect(h.skipped.hypotheses).toBeGreaterThan(0);
  });

  it('treats a position where a defined object becomes undefined as degenerate', () => {
    const g = new Figure()
      .point('A', 0, 0)
      .point('B', 4, 1)
      .point('C', 1, 3)
      .point('D', 5, 6)
      .def('l', 'line', 'A', 'B')
      .def('m', 'line', 'C', 'D')
      .def('X', 'intersect', 'l', 'm');
    const h = positions({ kind: 'hunt', doc: g.doc, seed: 2 });
    expect(h.positions.some((p) => show(g.doc, p.target) === 'parallel(l, m)')).toBe(false);
    expect(h.skipped.degenerate).toBeGreaterThan(0);
  });

  it('is deterministic for a seed; carries its seed and budget', () => {
    const again = positions({ kind: 'hunt', doc: f.doc, seed: 1 });
    expect(again.positions.map((p) => p.target.key)).toEqual(r.positions.map((p) => p.target.key));
    expect(again.seed).toBe(1);
    expect(again.budget.targets).toBe(24);
  });

  it('cancel and stop', () => {
    const job: HuntJob = { kind: 'hunt', doc: f.doc, seed: 1 };
    const a = runHunt(job, { registry: REGISTRY });
    a.next();
    expect(a.next('cancel').value).toEqual({ kind: 'cancelled' });
    const b = runHunt(job, { registry: REGISTRY });
    b.next();
    const s = b.next('stop');
    expect(s.done).toBe(true);
    expect(s.value).toMatchObject({ kind: 'positions', stopped: true, positions: [] });
  });
});
