/**
 * Run 16c audit (mutation shard kernel-b, ADR-0042 decisions 7–8): line ∩ conic and the
 * tangents from a point, the behaviour the earlier tests left open, in every field where it is
 * decided: the reasons by name (the two tools' nouns, P inside, P the centre, P on an asymptote
 * and within its band, an asymptote, other(P) off the line, outside a segment, at infinity, a
 * degenerate line or conic), a segment keeping the one candidate on it, a line parallel to an
 * asymptote meeting the conic once, and the tangent line's chirality.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr, type Selector } from '../src/expr';
import type { Value } from '../src/value';
import { Builder, evalDoc, pt, valueOf } from './helpers/doc';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
const ELL = T('conic', pt(2, 0), pt(0, 1), pt(-2, 0), pt(0, -1), pt('6/5', '4/5'));
const HYP = T('conic', pt(1, 1), pt(2, '1/2'), pt(-1, -1), pt(4, '1/4'), pt('1/2', 2));
const BAD = T('conic', pt(0, 0), pt(1, 0), pt(2, 0), pt(0, 1), pt(0, 2));
const ALL: readonly Field<unknown>[] = [FloatField, RationalField, ModPField];
const ORDERED: readonly Field<unknown>[] = [FloatField, RationalField];

function value<T>(F: Field<T>, tool: string, args: Expr[], sel: Selector[] = []): Value<T> {
  const b = new Builder();
  b.add('x', call(tool, args, sel));
  return valueOf(b.doc, evalDoc(b.doc, F), 'x');
}
const why = <T>(v: Value<T>) =>
  v.kind === 'undefined' || v.kind === 'inexact' ? v.reason : v.kind;
const xy = <T>(F: Field<T>, v: Value<T>) =>
  v.kind === 'point' ? [F.toNumber(v.x), F.toNumber(v.y)] : why(v);
const plus: Selector[] = [{ kind: 'orient', sign: 1 }];

describe('the tangents from P to a conic, by name', () => {
  it('without a selector: two touch points, two tangents', () => {
    for (const F of ALL) {
      expect(why(value(F, 'tangent_point', [pt(0, 3), ELL]))).toBe(
        'ambiguous: add a selector: tangent_point(P, k) has two touch points (for example other(P), near(P), same_side(Q, l) or orient(±))',
      );
      expect(why(value(F, 'tangent_from', [pt(0, 3), ELL]))).toBe(
        'ambiguous: add a selector: tangent_from(P, k) has two tangents (for example other(P), near(P), same_side(Q, l) or orient(±))',
      );
    }
  });

  it('P inside, P the centre, P on an asymptote, P within the band of one', () => {
    for (const F of ORDERED)
      expect(why(value(F, 'tangent_point', [pt(0, '1/2'), ELL], plus))).toBe(
        'tangent_point(P, k): no tangent from P to the conic (P is inside it)',
      );
    for (const F of ALL) {
      expect(why(value(F, 'tangent_point', [pt(0, 0), ELL], plus))).toBe(
        'tangent_point(P, k): no tangent from P to the conic (P is its center)',
      );
      expect(why(value(F, 'tangent_from', [pt(3, 0), HYP], plus))).toBe(
        'tangent_from(P, k): P lies on an asymptote, so one touch point is at infinity',
      );
    }
    expect(why(value(FloatField, 'tangent_point', [pt(3, '0.00000003'), HYP], plus))).toBe(
      'ambiguous: the line is within the band of an asymptotic direction of the conic',
    );
  });

  it('a tangent is a chiral full line through its touch point', () => {
    const v = value(FloatField, 'tangent_from', [pt(0, 3), ELL], plus);
    expect(v.kind === 'line' && [v.chiral, v.lo, v.hi]).toEqual([true, null, null]);
  });
});

describe('line ∩ conic, by name', () => {
  it('an asymptote meets the hyperbola nowhere; a parallel line once', () => {
    for (const F of ALL) {
      expect(
        why(
          value(F, 'intersect', [T('line', pt(0, 0), pt(1, 0)), HYP], [{ kind: 'along', sign: 1 }]),
        ),
      ).toBe('no intersection: the line meets the conic only at infinity (an asymptote)');
      expect(
        xy(
          F,
          value(F, 'intersect', [T('line', pt(0, 1), pt(1, 1)), HYP], [{ kind: 'along', sign: 1 }]),
        ),
      ).toEqual([expect.closeTo(1, 12), expect.closeTo(1, 12)]);
    }
  });

  it('a segment keeps the one candidate on it; a line needs a selector', () => {
    for (const F of ORDERED) {
      expect(xy(F, value(F, 'intersect', [T('segment', pt(0, 0), pt(3, 0)), ELL]))).toEqual([2, 0]);
      expect(why(value(F, 'intersect', [T('line', pt(0, 0), pt(3, 0)), ELL]))).toMatch(
        /^ambiguous: add a selector: line ∩ conic has two intersections/u,
      );
    }
  });

  it('a degenerate line, a degenerate conic', () => {
    for (const F of ALL) {
      const a: Selector[] = [{ kind: 'along', sign: 1 }];
      expect(why(value(F, 'intersect', [T('line', pt(0, 0), pt(0, 0)), ELL], a))).toBe(
        'coincident points: line(A, B) needs A ≠ B',
      );
      expect(why(value(F, 'intersect', [T('line', pt(0, 0), pt(1, 1)), BAD], a))).toBe(
        'three of the points are collinear: the conic through them is a pair of lines',
      );
    }
  });

  it('other(P): off the line (either order), outside a segment, at infinity', () => {
    const o = (x: number, y: number): Selector[] => [{ kind: 'other', p: pt(x, y) }];
    for (const F of ALL) {
      for (const args of [
        [T('line', pt(0, 0), pt(1, 0)), ELL],
        [ELL, T('line', pt(0, 0), pt(1, 0))],
      ])
        expect(why(value(F, 'intersect', args, o(0, 1)))).toBe(
          'other(point(0, 1)) needs the point on the line',
        );
      expect(why(value(F, 'intersect', [T('line', pt(1, 1), pt(2, 1)), HYP], o(1, 1)))).toBe(
        'the other intersection is at infinity (the line has an asymptotic direction)',
      );
    }
    for (const F of ORDERED)
      expect(why(value(F, 'intersect', [T('segment', pt(2, 0), pt(1, 0)), ELL], o(2, 0)))).toBe(
        'no other intersection: it lies outside the segment',
      );
  });
});
