/**
 * ADR-0035: the finder hints of the v1 kinds. A measure says exactly what its claim says: on
 * every corpus claim of a measure kind whose literals are among those searched, the claim holds in the current figure iff the first
 * group's measure equals the target of the second's (within float rounding, or modulo the
 * period); measures of coincident points are undefined; the literal lists fit the kinds'
 * literal parameters; skipped kinds give a reason.
 */
import { describe, expect, it } from 'vitest';
import { FloatField } from '@geomira/num/float-field';
import { evaluate } from '@geomira/kernel/evaluate';
import { evalContextFor } from '@geomira/kernel/context';
import type { Vec } from '@geomira/kernel/value';
import { evalClaim } from '../src/eval-claim';
import { isLiteralParam, paramAt } from '../src/kind';
import { CLAIM_KINDS, claimKind } from '../src/kinds';
import { REGISTRY } from './helpers/build';
import { baseFigure, type Entry } from './helpers/corpus';
import { FALSE_CLAIMS } from './helpers/corpus-false';
import { TRUE_THEOREMS } from './helpers/corpus-true';
import { objectify } from './helpers/objectify';

function near(a: number, b: number, period: number | undefined): boolean {
  const d = Math.abs(a - b);
  const wrapped = period === undefined ? d : Math.min(d % period, period - (d % period));
  return wrapped <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

describe('finder hints (ADR-0035)', () => {
  it('literal lists fit the literal parameters; arities fit the parameters', () => {
    for (const k of CLAIM_KINDS) {
      const f = k.finder;
      expect(f, k.name).toBeDefined();
      if (f?.notSearched !== undefined) {
        expect(f.notSearched.length, k.name).toBeGreaterThan(10);
        continue;
      }
      const arity = f?.arity ?? k.params.length;
      expect(arity, k.name).toBeGreaterThanOrEqual(k.params.length);
      const litCount = Array.from({ length: arity }, (_, i) => paramAt(k, i)).filter(
        (p) => p !== undefined && isLiteralParam(p),
      ).length;
      if (litCount > 0) {
        expect(f?.literals?.length, k.name).toBeGreaterThan(0);
        for (const l of f?.literals ?? []) expect(l, k.name).toHaveLength(litCount);
      } else expect(f?.literals, k.name).toBeUndefined();
      const m = f?.measure;
      if (m !== undefined) {
        const pts = [...m.groups[0], ...m.groups[1]];
        expect(new Set(pts).size, k.name).toBe(pts.length);
        for (const i of pts) expect(paramAt(k, i), k.name).toBe('point');
      }
    }
  });

  it('a measure agrees with its claim on the corpora', () => {
    let checked = 0;
    const entries: readonly Entry[] = [...TRUE_THEOREMS, ...FALSE_CLAIMS];
    for (const e of entries) {
      const f = baseFigure();
      const id = e.build(f);
      const o = objectify(f.doc, id);
      const kind = claimKind(o.kind);
      const m = kind?.finder?.measure;
      if (kind === undefined || m === undefined) continue;
      const c = evalContextFor(o.doc);
      if (!c.ok) throw new Error(c.reason);
      const values = evaluate(o.doc, REGISTRY, FloatField, c.ctx).values;
      const pt = (i: number): Vec<number> => {
        const a = o.args[i];
        const v = a !== undefined && 'id' in a ? values.get(a.id) : undefined;
        if (v?.kind !== 'point') throw new Error(`${e.name}: argument ${String(i)}`);
        return v;
      };
      const lits = o.args.flatMap((a) => ('lit' in a ? [a.lit] : []));
      const searched = (kind.finder?.literals ?? [[]]).some(
        (l) =>
          l.length === lits.length &&
          l.every((x, i) => {
            const y = lits[i];
            return y !== undefined && x.num === y.num && x.den === y.den;
          }),
      );
      if (!searched) continue;
      const m1 = m.measure(m.groups[0].map(pt));
      const m2 = m.measure(m.groups[1].map(pt));
      if (m1 === undefined || m2 === undefined) continue;
      const holds = evalClaim(f.doc, id, REGISTRY).value === 'true';
      expect(near(m1, m.target(m2, lits), m.period), e.name).toBe(holds);
      checked++;
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('measures of coincident points are undefined; directed angles lie in [0, π)', () => {
    const len = claimKind('length')?.finder?.measure;
    const dang = claimKind('dangle')?.finder?.measure;
    const ang = claimKind('angle_eq')?.finder?.measure;
    if (len === undefined || dang === undefined || ang === undefined) throw new Error('hints');
    const P = (x: number, y: number) => ({ kind: 'point' as const, x, y });
    expect(len.measure([P(1, 1), P(4, 5)])).toBe(5);
    expect(len.measure([P(1, 1)])).toBeUndefined();
    expect(dang.measure([P(1, 0), P(0, 0), P(0, 0)])).toBeUndefined();
    expect(ang.measure([P(0, 0), P(0, 0), P(1, 1)])).toBeUndefined();
    expect(dang.measure([P(1, 0), P(0, 0), P(0, 1)])).toBeCloseTo(Math.PI / 2, 12);
    expect(dang.measure([P(0, 1), P(0, 0), P(1, 0)])).toBeCloseTo(Math.PI / 2, 12);
    expect(dang.measure([P(1, 0), P(0, 0), P(-1, 0)])).toBe(0);
    expect(dang.measure([P(1, 0), P(0, 0), P(1, -1)])).toBeCloseTo((3 * Math.PI) / 4, 12);
    expect(ang.measure([P(1, 0), P(0, 0), P(-1, 0)])).toBeCloseTo(Math.PI, 12);
    expect(dang.measure([P(0, 0), P(0, 0)])).toBeUndefined();
  });
});
