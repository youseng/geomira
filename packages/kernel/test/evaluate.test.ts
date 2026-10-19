import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField, P } from '@geomira/num/modp';
import { rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { MAX_SCALE } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { evaluate, evaluateFrom } from '../src/evaluate';
import { call, lit, ref } from '../src/expr';
import { redefineObject } from '../src/edit';
import { createRegistry } from '../src/registry';
import type { ToolSpec } from '../src/tool';
import { numOf, undef, type Value } from '../src/value';
import { Builder, REGISTRY, contextOf, evalDoc, must, num, pt, valueOf } from './helpers/doc';

const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];

describe('evaluate', () => {
  it('evaluates in construction order over every field', () => {
    const b = new Builder();
    const A = b.point('A', 0, 0);
    const B = b.point('B', 4, 2);
    b.call('M', 'midpoint', A, B);
    expect(valueOf(b.doc, evalDoc(b.doc, FloatField), 'M')).toEqual({ kind: 'point', x: 2, y: 1 });
    expect(valueOf(b.doc, evalDoc(b.doc, RationalField), 'M')).toEqual({
      kind: 'point',
      x: rational(2n),
      y: rational(1n),
    });
    expect(valueOf(b.doc, evalDoc(b.doc, ModPField), 'M')).toEqual({ kind: 'point', x: 2n, y: 1n });
  });

  it('literals are exact numbers in every field', () => {
    const b = new Builder();
    b.add('k', num('2/3'));
    expect(valueOf(b.doc, evalDoc(b.doc, FloatField), 'k')).toEqual(numOf(2 / 3, rational(2n, 3n)));
    expect(valueOf(b.doc, evalDoc(b.doc, RationalField), 'k')).toEqual(
      numOf(rational(2n, 3n), rational(2n, 3n)),
    );
    // A denominator divisible by p is not representable mod p.
    b.add('j', lit(rational(1n, P)));
    expect(valueOf(b.doc, evalDoc(b.doc, ModPField), 'j').kind).toBe('inexact');
  });

  it('propagates Undefined with the name of the undefined object, and Inexact as it is', () => {
    const b = new Builder();
    const A = b.point('A', 0, 0);
    const l = b.call('l', 'line', A, A);
    b.call('F', 'foot', A, l);
    b.call('G', 'foot', A, call('line', [A, A]));
    const d = b.call('d', 'dist', A, pt(1, 1));
    b.call('e', 'add', d, num(1));
    for (const F of FIELDS) {
      const ev = evalDoc(b.doc, F);
      expect(valueOf(b.doc, ev, 'F')).toEqual(undef('l is undefined'));
      expect(valueOf(b.doc, ev, 'G')).toEqual(valueOf(b.doc, ev, 'l'));
    }
    const ev = evalDoc(b.doc, RationalField);
    expect(valueOf(b.doc, ev, 'e')).toEqual(valueOf(b.doc, ev, 'd'));
    expect(valueOf(b.doc, ev, 'e').kind).toBe('inexact');
  });

  it('unknown tools, rejected arguments, selectors and bad references are Undefined', () => {
    const b = new Builder();
    const A = b.point('A', 0, 0);
    b.add('u', call('no_such_tool', [A]));
    b.add('w', call('midpoint', [A, num(1)]));
    b.add('s', call('line', [A, pt(1, 1)], [{ kind: 'along', sign: 1 }]));
    const doc = {
      ...b.doc,
      objects: [...b.doc.objects, { id: 90, name: 'z', def: ref(91), style: {}, layers: ['main'] }],
      nextId: 92,
    };
    const ev = evalDoc(doc, FloatField);
    expect(valueOf(doc, ev, 'u')).toEqual(undef('unknown tool "no_such_tool"'));
    expect(valueOf(doc, ev, 'w')).toEqual(
      undef('midpoint does not accept (point, number); signatures: midpoint(point, point)'),
    );
    expect(valueOf(doc, ev, 's')).toEqual(undef('line takes no selectors'));
    expect(valueOf(doc, ev, 'z')).toEqual(undef('refers to #91, which is not an earlier object'));
  });

  it('an expression outside the Expr union is a programming error (TypeError), not a value', () => {
    const b = new Builder();
    const doc = {
      ...b.doc,
      nextId: 2,
      objects: [{ id: 1, name: 'z', def: { kind: 'bogus' } as never, style: {}, layers: ['main'] }],
    };
    expect(() => evaluate(doc, REGISTRY, FloatField, { scale: 1 })).toThrow(
      /unexpected expression/,
    );
  });

  it('an invalid context makes every object Undefined (never a throw)', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    for (const scale of [0, Number.NaN, Infinity, MAX_SCALE * 10]) {
      const v = valueOf(b.doc, evaluate(b.doc, REGISTRY, FloatField, { scale }), 'A');
      expect(v.kind === 'undefined' && v.reason).toMatch(/^invalid figure scale/);
    }
  });

  it('regression (found by L1): huge coordinates never reach a throwing square root', () => {
    // divide(A, B, 1e200) would have coordinates ~1e200: |d|² would overflow to ∞ and
    // FloatField.sqrt(∞) throws. Arguments beyond 2^200 are Inexact instead, and so is
    // everything built on them.
    const b = new Builder();
    const A = b.point('A', 0, 0);
    const B = b.point('B', 1, 1);
    const X = b.call('X', 'divide', A, B, num(1e200));
    b.call('r', 'ratio', A, X, A, B);
    b.call('d', 'dist', A, X);
    const q = b.call('q', 'mul', num(2 ** 199), num(2 ** 199));
    b.call('Y', 'point', q, num(0));
    b.call('e', 'dist', A, b.ref('Y'));
    const ev = evalDoc(b.doc, FloatField);
    const tooLarge = (tool: string) => ({
      kind: 'inexact',
      reason: `${tool}: an argument is too large for double-precision geometry`,
    });
    expect(valueOf(b.doc, ev, 'X')).toEqual(tooLarge('divide'));
    expect(valueOf(b.doc, ev, 'r')).toEqual(tooLarge('divide'));
    expect(valueOf(b.doc, ev, 'd')).toEqual(tooLarge('divide'));
    expect(valueOf(b.doc, ev, 'q')).toMatchObject({ kind: 'number', v: 2 ** 398 });
    expect(valueOf(b.doc, ev, 'Y')).toEqual(tooLarge('point'));
    expect(valueOf(b.doc, ev, 'e')).toEqual(tooLarge('point'));
    expect(valueOf(b.doc, evalDoc(b.doc, RationalField), 'X').kind).toBe('point');
    // An overflowing result with in-range arguments is Inexact too.
    const c = new Builder();
    c.call('q', 'mul', num(2 ** 199), num(2 ** 199));
    c.call('o', 'mul', c.ref('q'), num(2 ** 199));
    expect(valueOf(c.doc, evalDoc(c.doc, FloatField), 'q').kind).toBe('number');
    const huge: ToolSpec = {
      ...must(REGISTRY.get('add')),
      id: 'inf',
      name: 'inf',
      compute: <T>(): Value<T> => numOf(Infinity as unknown as T),
    };
    const d = new Builder();
    d.add('h', call('inf', [num(1), num(1)]));
    const ev2 = evaluate(d.doc, createRegistry([huge]), FloatField, contextOf(d.doc));
    expect(valueOf(d.doc, ev2, 'h')).toEqual({
      kind: 'inexact',
      reason: 'inf: the result is beyond the double range',
    });
  });
});

describe('evaluateFrom', () => {
  it('re-evaluates only changed objects and their dependents', () => {
    let calls = 0;
    const counting: ToolSpec = {
      ...must(REGISTRY.get('midpoint')),
      id: 'mid',
      name: 'mid',
      compute: (F, args, ctx) => {
        calls += 1;
        return must(REGISTRY.get('midpoint')).compute(F, args, ctx);
      },
    };
    const registry = createRegistry([counting]);
    const b = new Builder();
    const A = b.point('A', 0, 0);
    const B = b.point('B', 4, 0);
    const C = b.point('C', 0, 4);
    b.call('M', 'mid', A, B);
    b.call('N', 'mid', A, C);
    const ctx = contextOf(b.doc);
    const first = evaluate(b.doc, registry, FloatField, ctx);
    expect(calls).toBe(2);
    const same = evaluateFrom(first, b.doc, registry, FloatField, ctx, []);
    expect(calls).toBe(2);
    expect(same.values).toEqual(first.values);
    const r = redefineObject(b.doc, b.id('C'), pt(0, 2));
    if (!r.ok) throw new Error(r.error);
    const next = evaluateFrom(first, r.doc, registry, FloatField, ctx, [b.id('C')]);
    expect(calls).toBe(3);
    expect(valueOf(r.doc, next, 'N')).toEqual({ kind: 'point', x: 0, y: 1 });
  });
});
