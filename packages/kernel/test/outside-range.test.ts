/**
 * The two rays `outside` (ADR-0032 decision 8) in the kernel tools that read a range: the
 * intersections and `other` keep only points on the rays (an end within the band →
 * ambiguous), a glider in the gap goes to the nearer end (the middle of the gap is ambiguous),
 * the drag map clamps the same way, and mod p no order is guessed. Fixture: R, the image of
 * segment((−1, 0), (2, 0)) under inversion((0, 0), 4): the rays x ≤ −4 and x ≥ 2 of the x-axis.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, lit, type Expr } from '../src/expr';
import { dragParameter } from '../src/glider';
import { rangeStatus } from '../src/tools/range';
import type { Line, Value } from '../src/value';
import { Builder, contextOf, evalDoc, num, pt, valueOf } from './helpers/doc';

const ORDERED = [FloatField, RationalField] as Field<unknown>[];
const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
const R = T('apply', T('inversion', pt(0, 0), num(4)), T('segment', pt(-1, 0), pt(2, 0)));

function evalWith<X>(F: Field<X>, defs: (b: Builder) => void): (name: string) => Value<X> {
  const b = new Builder();
  b.add('R', R);
  defs(b);
  const ev = evalDoc(b.doc, F, contextOf(b.doc));
  return (n) => valueOf(b.doc, ev, n);
}

const xy = <X>(F: Field<X>, v: Value<X>): unknown =>
  v.kind === 'point'
    ? [F.toNumber(v.x), F.toNumber(v.y)]
    : v.kind === 'undefined'
      ? v.reason
      : v.kind;

describe('the two rays outside in the kernel tools', () => {
  it('R is the two rays x ≤ −4 and x ≥ 2', () => {
    for (const F of ORDERED) {
      const r = evalWith(F, () => undefined)('R');
      expect(r.kind === 'line' && r.outside).toBe(true);
    }
  });

  it('intersect with a line or a circle keeps the points on the rays', () => {
    for (const F of ORDERED) {
      const get = evalWith(F, (b) => {
        b.call('a', 'intersect', b.ref('R'), T('line', pt(5, -1), pt(5, 1)));
        b.call('g', 'intersect', b.ref('R'), T('line', pt(0, -1), pt(0, 1)));
        b.call('c', 'intersect', b.ref('R'), T('circle', pt(0, 0), pt(3, 0)));
        b.call('n', 'intersect', b.ref('R'), T('circle', pt(0, 0), pt(1, 0)));
        b.call('e', 'intersect', b.ref('R'), T('line', pt(-4, -1), pt(-4, 1)));
      });
      expect(xy(F, get('a'))).toEqual([5, 0]);
      expect(xy(F, get('g'))).toBe('no intersection: it lies outside the pair of rays');
      expect(xy(F, get('c'))).toEqual([3, 0]);
      expect(get('n').kind).toBe('undefined');
      expect(xy(F, get('e'))).toEqual([-4, 0]);
    }
  });

  it('an intersection within the band of an end is ambiguous (floats)', () => {
    // R's direction is (12, 0): an x offset of 12·3·10⁻⁸ is a parameter gap of 3·10⁻⁸, in the band.
    const get = evalWith(FloatField, (b) => {
      b.call('x', 'intersect', b.ref('R'), T('line', pt('2.00000036', -1), pt('2.00000036', 1)));
      b.call('y', 'intersect', b.ref('R'), T('line', pt('1.99999964', -1), pt('1.99999964', 1)));
    });
    for (const n of ['x', 'y'])
      expect(xy(FloatField, get(n))).toBe(
        'ambiguous: the intersection is within the band of an end of the pair of rays',
      );
  });

  it('other(R, c, P) keeps the other point only when it is on a ray', () => {
    for (const F of ORDERED) {
      const get = evalWith(F, (b) => {
        b.call('o', 'other', b.ref('R'), T('circle', pt(5, 0), pt(8, 0)), pt(8, 0));
        b.call('p', 'other', b.ref('R'), T('circle', pt(4, 0), pt(7, 0)), pt(7, 0));
      });
      const o = get('o');
      expect(
        o.kind === 'point' &&
          [F.toNumber(o.x), F.toNumber(o.y)].map((z) => Math.round(z * 1e9) / 1e9),
      ).toEqual([2, 0]);
      expect(xy(F, get('p'))).toBe('no other intersection: it lies outside the pair of rays');
    }
  });

  it('a glider in the gap goes to the nearer end; the middle of the gap is ambiguous', () => {
    // R = p + t·(12, 0) with p = (0, 0), t ≤ −1/3 or t ≥ 1/6 (exactly over Q).
    for (const F of ORDERED) {
      const at = (n: bigint, d: bigint) =>
        evalWith(F, (b) => b.add('X', T('on', b.ref('R'), lit(rational(n, d)))))('X');
      expect(xy(F, at(-1n, 4n))).toEqual([-4, 0]);
      expect(xy(F, at(1n, 12n))).toEqual([2, 0]);
      expect(xy(F, at(-1n, 12n))).toBe(
        'ambiguous: the glider is in the middle of the gap between the two rays',
      );
      expect(xy(F, at(-1n, 2n))).toEqual([-6, 0]);
      expect(xy(F, at(1n, 4n))).toEqual([3, 0]);
    }
  });

  it('the drag map clamps to the rays', () => {
    const r = evalWith(FloatField, () => undefined)('R');
    const p = dragParameter(FloatField, r, { x: 0.5, y: 3 }, 'line', { scale: 8 });
    expect('form' in p && r.kind === 'line' && p.form === 'line' && p.t === r.hi).toBe(true);
    const q = dragParameter(FloatField, r, { x: -3.5, y: 3 }, 'line', { scale: 8 });
    expect('form' in q && r.kind === 'line' && q.form === 'line' && q.t === r.lo).toBe(true);
  });

  it('mod p, no order: a range status is Inexact', () => {
    const F = ModPField;
    const q = (n: bigint) => F.fromRational(rational(n)) as bigint;
    const l: Line<bigint> = {
      kind: 'line',
      p: { x: q(0n), y: q(0n) },
      d: { x: q(1n), y: q(0n) },
      lo: q(-4n),
      hi: q(2n),
      chiral: false,
      outside: true,
    };
    const s = rangeStatus(F, l, q(5n), { scale: 1 }, 'intersection');
    expect(typeof s === 'object' && s.kind).toBe('inexact');
  });
});
