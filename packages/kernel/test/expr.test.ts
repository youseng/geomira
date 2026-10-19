import { rational } from '@geomira/num/rational';
import { describe, expect, it } from 'vitest';
import { call, exprEquals, lit, ref, refsOf, selectorExprs, type Selector } from '../src/expr';

const SELECTORS: Selector[] = [
  { kind: 'same_side', q: ref(1), l: ref(2) },
  { kind: 'opposite_side', q: ref(1), l: ref(2) },
  { kind: 'on_arc', b: ref(1), c: ref(2), a: ref(3), not: false },
  { kind: 'between', a: ref(1), b: ref(2) },
  { kind: 'inside', c: ref(1) },
  { kind: 'outside', c: ref(1) },
  { kind: 'other', p: ref(1) },
  { kind: 'near', p: ref(1) },
  { kind: 'far_from', p: ref(1) },
  { kind: 'along', sign: 1 },
  { kind: 'orient', sign: -1 },
];

describe('expressions', () => {
  it('refsOf collects references in order, inside calls and selectors', () => {
    const e = call(
      'intersect',
      [ref(3), call('line', [ref(1), lit(rational(2n))])],
      [{ kind: 'other', p: ref(7) }],
    );
    expect(refsOf(e)).toEqual([3, 1, 7]);
    expect(refsOf(lit(rational(1n)))).toEqual([]);
    expect(SELECTORS.map((s) => selectorExprs(s).length)).toEqual([
      2, 2, 3, 2, 1, 1, 1, 1, 1, 0, 0,
    ]);
    expect(() => refsOf({ kind: 'bogus' } as never)).toThrow(/unexpected expression/);
    expect(() => selectorExprs({ kind: 'bogus' } as never)).toThrow(/unexpected selector/);
  });

  it('exprEquals is structural, literals by exact value', () => {
    expect(exprEquals(lit(rational(2n, 4n)), lit(rational(1n, 2n)))).toBe(true);
    expect(exprEquals(lit(rational(1n)), ref(1))).toBe(false);
    expect(exprEquals(ref(1), ref(1))).toBe(true);
    expect(exprEquals(ref(1), ref(2))).toBe(false);
    expect(exprEquals(call('f', [ref(1)]), call('f', [ref(1)]))).toBe(true);
    expect(exprEquals(call('f', [ref(1)]), call('g', [ref(1)]))).toBe(false);
    expect(exprEquals(call('f', [ref(1)]), call('f', [ref(1), ref(2)]))).toBe(false);
    expect(exprEquals(call('f', []), ref(1))).toBe(false);
    for (const [i, s] of SELECTORS.entries()) {
      for (const [j, t] of SELECTORS.entries())
        expect(exprEquals(call('f', [], [s]), call('f', [], [t]))).toBe(i === j);
    }
    const arc = (not: boolean): Selector => ({
      kind: 'on_arc',
      b: ref(1),
      c: ref(2),
      a: ref(3),
      not,
    });
    expect(exprEquals(call('f', [], [arc(true)]), call('f', [], [arc(false)]))).toBe(false);
    expect(
      exprEquals(
        call('f', [], [{ kind: 'along', sign: 1 }]),
        call('f', [], [{ kind: 'along', sign: -1 }]),
      ),
    ).toBe(false);
    expect(
      exprEquals(
        call('f', [], [{ kind: 'near', p: ref(1) }]),
        call('f', [], [{ kind: 'near', p: ref(2) }]),
      ),
    ).toBe(false);
    expect(exprEquals(call('f', [], []), call('f', [], [{ kind: 'along', sign: 1 }]))).toBe(false);
    expect(() => exprEquals({ kind: 'bogus' } as never, ref(1))).toThrow(/unexpected expression/);
  });
});
