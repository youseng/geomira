/**
 * Found in the Run 10 audit: `evaluate` was not total (SPEC §9, law L1) on deeply nested
 * definitions: x = neg(neg(…(1)…)) 2000 levels deep threw "Maximum call stack size exceeded".
 * A definition nested deeper than MAX_EXPR_DEPTH is Undefined with its reason, in every field,
 * and exprDepth itself never recurses.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '../src/context';
import { evaluate } from '../src/evaluate';
import { addObject, redefineObject } from '../src/edit';
import { call, type Expr } from '../src/expr';
import { exprDepth, MAX_EXPR_DEPTH } from '../src/limits';
import { createRegistry } from '../src/registry';
import { Builder, num, pt } from './helpers/doc';

function negs(n: number): Expr {
  let e: Expr = num(1);
  for (let k = 0; k < n; k++) e = call('neg', [e]);
  return e;
}

describe('deeply nested definitions', () => {
  it('exprDepth counts levels without recursion (a million levels)', () => {
    expect(exprDepth(num(1))).toBe(1);
    expect(exprDepth(pt(1, 2))).toBe(2);
    expect(exprDepth(call('midpoint', [pt(0, 0), call('neg', [pt(1, 1)])]))).toBe(4);
    expect(exprDepth(negs(1_000_000))).toBe(1_000_001);
  });

  it('addObject and redefineObject refuse a definition deeper than the limit', () => {
    const b = new Builder();
    b.add('ok', negs(MAX_EXPR_DEPTH - 1));
    const id = b.doc.objects[0]?.id ?? -1;
    for (const n of [MAX_EXPR_DEPTH, 100_000]) {
      const why = `k is nested more than ${String(MAX_EXPR_DEPTH)} levels deep: write intermediate objects`;
      expect(addObject(b.doc, { name: 'k', def: negs(n) })).toEqual({ ok: false, error: why });
      expect(redefineObject(b.doc, id, negs(n))).toEqual({
        ok: false,
        error: why.replace('k is', 'ok is'),
      });
    }
  });

  it('a hand-built document deeper than the limit evaluates to Undefined in every field', () => {
    const registry = createRegistry();
    const b = new Builder();
    b.add('ok', negs(MAX_EXPR_DEPTH - 1));
    b.point('A', 1, 2);
    // Objects the document model would refuse, written directly (as a corrupt file could).
    let next = b.doc.nextId;
    const deep = [MAX_EXPR_DEPTH, 2000, 100_000].map((n) => ({
      id: next++,
      name: `k_${String(n)}`,
      def: negs(n),
      style: {},
      layers: ['main'],
    }));
    b.doc = { ...b.doc, objects: [...b.doc.objects, ...deep], nextId: next };
    const ctx = evalContextFor(b.doc);
    if (!ctx.ok) throw new Error(ctx.reason);
    const check = <T>(F: Field<T>) => {
      const values = evaluate(b.doc, registry, F, ctx.ctx).values;
      const byName = (name: string) =>
        values.get(b.doc.objects.find((o) => o.name === name)?.id ?? -1);
      expect(byName('ok')?.kind).toBe('number');
      for (const n of [MAX_EXPR_DEPTH, 2000, 100_000]) {
        const v = byName(`k_${String(n)}`);
        expect(v).toEqual({
          kind: 'undefined',
          reason: `k_${String(n)} is nested more than ${String(MAX_EXPR_DEPTH)} levels deep`,
        });
      }
      expect(byName('A')?.kind).toBe('point');
    };
    check(FloatField);
    check(RationalField);
    check(ModPField);
  });
});
