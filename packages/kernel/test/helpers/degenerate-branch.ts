/**
 * Degenerate cases of the branchable tools (Run 3b, SPEC §7): the cases intersect gains
 * for curves (spread into degenerate.test.ts's `intersect` entry) and those of
 * tangent_point and tangent_from. Fixtures: C5 = circle((0, 0), (5, 0)); the line through
 * (−4, −3) and (4, 3) meets it at (±4, ±3); circle((6, 0), (3, 4)) meets it at (3, ±4).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr, type Selector } from '../../src/expr';
import type { Value } from '../../src/value';
import { FIELDS, ORDERED, line, plain, reason, seg } from './degenerate';
import { C5, O0, circ, shape } from './degenerate-circles';
import { Builder, evalDoc, num, pt, valueOf } from './doc';

/** tool(args…, selectors…) as the only object of a document, over F. */
export function choose<T>(
  F: Field<T>,
  tool: string,
  args: Expr[],
  sels: Selector[] = [],
): Value<T> {
  const b = new Builder();
  b.add('x', call(tool, args, sels));
  return valueOf(b.doc, evalDoc(b.doc, F), 'x');
}

/** The coordinates of a FloatField point (a test failure otherwise). */
function xy(v: Value<number>): [number, number] {
  if (v.kind !== 'point') throw new Error(`expected a point, got ${reason(v)}`);
  return [v.x, v.y];
}

export const ALONG_P: Selector = { kind: 'along', sign: 1 };
export const ALONG_M: Selector = { kind: 'along', sign: -1 };
export const ORIENT_P: Selector = { kind: 'orient', sign: 1 };
export const ORIENT_M: Selector = { kind: 'orient', sign: -1 };
export const other = (p: Expr): Selector => ({ kind: 'other', p });
export const sameSide = (q: Expr, l: Expr): Selector => ({ kind: 'same_side', q, l });

const DIAG = line(pt(-4, -3), pt(4, 3));
const C6 = circ(pt(6, 0), pt(3, 4));
const vertical = (x: number | string): Expr => line(pt(x, -1), pt(x, 1));

export const INTERSECT_CURVE_CASES: Record<string, () => void> = {
  'line ∩ circle: the line misses the circle → Undefined': () => {
    for (const F of ORDERED) {
      expect(reason(choose(F, 'intersect', [vertical(6), C5], [ALONG_P]))).toBe(
        'undefined: no intersection: the line misses the circle',
      );
      expect(reason(choose(F, 'intersect', [C5, vertical(-6)], [ALONG_P]))).toBe(
        'undefined: no intersection: the line misses the circle',
      );
    }
    // Mod p there is no order, so no "misses": two algebraic points, not representable.
    expect(choose(ModPField, 'intersect', [vertical(6), C5], [ALONG_P]).kind).toBe('inexact');
  },
  'line ∩ circle: tangency (the gap within the band) → the double point': () => {
    // Exact tangency: one candidate in every field, no selector needed.
    for (const F of ORDERED)
      expect(plain(F, choose(F, 'intersect', [vertical(5), C5]))).toEqual([5, 0]);
    expect(choose(ModPField, 'intersect', [vertical(5), C5])).toEqual({
      kind: 'point',
      x: 5n,
      y: 0n,
    });
    // Within the band of tangency (gap ±1e-8 · scale): the double point in FloatField.
    for (const x of [5 - 1e-8, 5 + 1e-8, 5 - 1e-12]) {
      expect(plain(FloatField, choose(FloatField, 'intersect', [vertical(x), C5]))).toEqual([x, 0]);
    }
    expect(reason(choose(RationalField, 'intersect', [vertical(5 + 1e-8), C5]))).toBe(
      'undefined: no intersection: the line misses the circle',
    );
    expect(reason(choose(RationalField, 'intersect', [vertical(5 - 1e-8), C5]))).toMatch(
      /^undefined: ambiguous: add a selector/,
    );
    // Beyond the band: two candidates in FloatField too.
    const [x, y] = xy(choose(FloatField, 'intersect', [vertical(4.99), C5], [ALONG_P]));
    expect(x).toBe(4.99);
    expect(y).toBeCloseTo(Math.sqrt(25 - 4.99 * 4.99), 12);
  },
  'circle ∩ circle: apart or one inside the other → Undefined': () => {
    for (const F of ORDERED) {
      expect(reason(choose(F, 'intersect', [C5, circ(pt(20, 0), pt(21, 0))], [ORIENT_P]))).toBe(
        'undefined: no intersection: the circles are apart',
      );
      expect(reason(choose(F, 'intersect', [C5, circ(pt(1, 0), pt(2, 0))], [ORIENT_P]))).toBe(
        'undefined: no intersection: one circle lies inside the other',
      );
    }
    expect(choose(ModPField, 'intersect', [C5, circ(pt(20, 0), pt(21, 0))], [ORIENT_P]).kind).toBe(
      'inexact',
    );
  },
  'circle ∩ circle: tangency (a gap within the band) → the double point': () => {
    const external = circ(pt(8, 0), pt(5, 0));
    const internal = circ(pt(2, 0), pt(5, 0));
    for (const F of ORDERED) {
      expect(plain(F, choose(F, 'intersect', [C5, external]))).toEqual([5, 0]);
      expect(plain(F, choose(F, 'intersect', [internal, C5]))).toEqual([5, 0]);
      expect(plain(F, choose(F, 'intersect', [C5, external], [ORIENT_M]))).toEqual([5, 0]);
    }
    expect(choose(ModPField, 'intersect', [C5, external])).toEqual({ kind: 'point', x: 5n, y: 0n });
    // Radius 3 ± 1e-8: within the band in FloatField; apart / two points over Q.
    for (const r of [3 + 1e-8, 3 - 1e-8]) {
      const [x, y] = xy(choose(FloatField, 'intersect', [C5, circ(pt(8, 0), num(r))]));
      expect([x - 5 + (r * r - 9) / 16, y].map((e) => Math.abs(e) < 1e-14)).toEqual([true, true]);
    }
    expect(reason(choose(RationalField, 'intersect', [C5, circ(pt(8, 0), num(3 - 1e-8))]))).toBe(
      'undefined: no intersection: the circles are apart',
    );
  },
  'concentric circles → Undefined': () => {
    for (const F of FIELDS) {
      expect(reason(choose(F, 'intersect', [C5, circ(O0, pt(1, 0))], [ORIENT_P]))).toBe(
        'undefined: concentric circles',
      );
      expect(reason(choose(F, 'intersect', [C5, C5], [other(pt(5, 0))]))).toBe(
        'undefined: concentric circles',
      );
    }
  },
  'two candidates and no selector → Undefined (ambiguous: add a selector)': () => {
    for (const F of FIELDS) {
      expect(reason(choose(F, 'intersect', [DIAG, C5]))).toBe(
        'undefined: ambiguous: add a selector: line ∩ circle has two intersections (for example other(P), near(P), same_side(Q, l) or along(±))',
      );
      expect(reason(choose(F, 'intersect', [C5, C6]))).toBe(
        'undefined: ambiguous: add a selector: circle ∩ circle has two intersections (for example other(P), near(P), same_side(Q, l) or orient(±))',
      );
    }
  },
  'a deciding quantity of a selector within the band → Undefined (ambiguous)': () => {
    const xAxis = line(O0, pt(1, 0));
    expect(
      reason(choose(FloatField, 'intersect', [DIAG, C5], [sameSide(pt('0', '1/10000000'), xAxis)])),
    ).toBe(
      'undefined: ambiguous: same_side(point(0, 1/10000000), line(point(0, 0), point(1, 0))): the reference point is within the band of the line',
    );
    expect(
      reason(
        choose(
          FloatField,
          'intersect',
          [DIAG, C5],
          [sameSide(pt(0, 1), line(pt(4, 3), pt(4 + 1e-8, -2)))],
        ),
      ),
    ).toMatch(
      /^undefined: ambiguous: same_side\(.*\): a candidate is within the band of the line$/,
    );
    // Exactly decided over Q; beyond the band in FloatField.
    expect(
      plain(
        RationalField,
        choose(RationalField, 'intersect', [DIAG, C5], [sameSide(pt('0', '1/10000000'), xAxis)]),
      ),
    ).toEqual([4, 3]);
    expect(
      plain(
        FloatField,
        choose(FloatField, 'intersect', [DIAG, C5], [sameSide(pt('0', '1/100000'), xAxis)]),
      ),
    ).toEqual([4, 3]);
    // A tie of near(P) within the band: the centre is equally far from both candidates.
    expect(
      reason(
        choose(FloatField, 'intersect', [DIAG, C5], [{ kind: 'near', p: pt('1/100000000', 0) }]),
      ),
    ).toBe(
      'undefined: ambiguous: near(point(1/100000000, 0)): the candidates are equally far from the point',
    );
    expect(
      plain(
        RationalField,
        choose(RationalField, 'intersect', [DIAG, C5], [{ kind: 'near', p: pt('1/100000000', 0) }]),
      ),
    ).toEqual([4, 3]);
  },
  'no candidate satisfies the selectors → Undefined': () => {
    for (const F of ORDERED) {
      expect(
        reason(
          choose(
            F,
            'intersect',
            [DIAG, C5],
            [{ kind: 'inside', c: circ(pt(100, 100), pt(101, 100)) }],
          ),
        ),
      ).toBe(
        'undefined: no intersection satisfies inside(circle(point(100, 100), point(101, 100)))',
      );
      expect(
        reason(choose(F, 'intersect', [vertical(5), C5], [sameSide(pt(-9, 0), vertical(4))])),
      ).toBe(
        'undefined: no intersection satisfies same_side(point(-9, 0), line(point(4, -1), point(4, 1)))',
      );
    }
  },
  'two candidates satisfy the selectors → Undefined (ambiguous: add a selector)': () => {
    for (const F of ORDERED) {
      expect(reason(choose(F, 'intersect', [DIAG, C5], [sameSide(pt(-9, 0), vertical(7))]))).toBe(
        'undefined: ambiguous: add a selector: both intersections satisfy same_side(point(-9, 0), line(point(7, -1), point(7, 1)))',
      );
    }
  },
  'along(±), orient(±) or other(P) where it does not apply → Undefined': () => {
    for (const F of FIELDS) {
      expect(reason(choose(F, 'intersect', [DIAG, C5], [ORIENT_P]))).toBe(
        'undefined: orient(+) does not apply to line ∩ circle: use along(±)',
      );
      expect(reason(choose(F, 'intersect', [C5, C6], [ALONG_M]))).toBe(
        'undefined: along(-) does not apply to circle ∩ circle: use orient(±)',
      );
      expect(reason(choose(F, 'intersect', [DIAG, line(O0, pt(1, 0))], [ALONG_P]))).toBe(
        'undefined: along(+) does not apply to line ∩ line',
      );
      expect(reason(choose(F, 'intersect', [DIAG, line(O0, pt(1, 0))], [other(O0)]))).toBe(
        'undefined: other(point(0, 0)) does not apply to line ∩ line: they meet only once',
      );
      expect(reason(choose(F, 'intersect', [DIAG, C5], [other(pt(4, 3)), other(pt(-4, -3))]))).toBe(
        'undefined: other(·) may appear only once in a call',
      );
    }
  },
  'other(P) with P not on both objects → Undefined (within the band: ambiguous)': () => {
    for (const F of FIELDS) {
      expect(reason(choose(F, 'intersect', [DIAG, C5], [other(O0)]))).toBe(
        'undefined: other(point(0, 0)) needs the point on the circle',
      );
      expect(reason(choose(F, 'intersect', [C5, C6], [other(pt(5, 0))]))).toBe(
        'undefined: other(point(5, 0)) needs the point on the second circle',
      );
    }
    const xAxis = line(pt(-1, 0), pt(1, 0));
    expect(reason(choose(FloatField, 'intersect', [xAxis, C5], [other(pt(5 + 1e-8, 0))]))).toMatch(
      /^undefined: ambiguous: within the band of incidence \(other\(point\(.*\)\) needs the point on the circle\)$/,
    );
    for (const F of ORDERED)
      expect(plain(F, choose(F, 'intersect', [xAxis, C5], [other(pt(5, 0))]))).toEqual([-5, 0]);
  },
  'a candidate outside a segment or ray is not a candidate': () => {
    const half = seg(pt(-4, -3), O0);
    for (const F of ORDERED) {
      expect(plain(F, choose(F, 'intersect', [half, C5]))).toEqual([-4, -3]);
      expect(reason(choose(F, 'intersect', [seg(pt(-1, 0), pt(1, 0)), C5]))).toBe(
        'undefined: no intersection: it lies outside the segment',
      );
      expect(reason(choose(F, 'intersect', [half, C5], [other(pt(-4, -3))]))).toBe(
        'undefined: no other intersection: it lies outside the segment',
      );
    }
    expect(
      reason(
        choose(FloatField, 'intersect', [seg(pt(-4, -3), pt(4 + 4e-8, 3 + 3e-8)), C5], [ALONG_P]),
      ),
    ).toMatch(
      /^undefined: ambiguous: the intersection is within the band of an end of the segment$/,
    );
    expect(choose(ModPField, 'intersect', [half, C5], [ALONG_M]).kind).toBe('inexact');
  },
  'square roots not representable → Inexact over Q and mod p (other(P) is exact)': () => {
    const c2 = circ(O0, pt(1, 1));
    const xAxis = line(O0, pt(1, 0));
    expect(reason(choose(RationalField, 'intersect', [xAxis, c2], [ALONG_P]))).toBe(
      'inexact: √(2) is not rational',
    );
    expect(plain(FloatField, choose(FloatField, 'intersect', [xAxis, c2], [ALONG_P]))).toEqual([
      Math.SQRT2,
      0,
    ]);
    expect(choose(ModPField, 'intersect', [DIAG, C5], [ALONG_P]).kind).toBe('inexact');
    expect(choose(ModPField, 'intersect', [C5, C6], [ORIENT_P]).kind).toBe('inexact');
    for (const F of ORDERED) {
      expect(plain(F, choose(F, 'intersect', [DIAG, C5], [other(pt(4, 3))]))).toEqual([-4, -3]);
    }
    expect(choose(ModPField, 'intersect', [DIAG, C5], [other(pt(4, 3))])).toEqual({
      kind: 'point',
      x: ModPField.neg(4n),
      y: ModPField.neg(3n),
    });
    expect(choose(ModPField, 'intersect', [C5, C6], [other(pt(3, 4))])).toEqual({
      kind: 'point',
      x: 3n,
      y: ModPField.neg(4n),
    });
  },
  'a sign-based selector mod p → Inexact': () => {
    const xAxis = line(O0, pt(1, 0));
    expect(
      reason(
        choose(ModPField, 'intersect', [DIAG, C5], [other(pt(4, 3)), sameSide(pt(0, 1), xAxis)]),
      ),
    ).toBe(
      'inexact: same_side(point(0, 1), line(point(0, 0), point(1, 0))) needs an order, which ModPField lacks',
    );
    expect(reason(choose(ModPField, 'intersect', [DIAG, C5], [other(pt(4, 3)), ALONG_P]))).toBe(
      'inexact: along(+) needs an order, which ModPField lacks',
    );
    expect(
      choose(ModPField, 'intersect', [DIAG, C5], [other(pt(4, 3)), { kind: 'near', p: O0 }]).kind,
    ).toBe('point');
  },
};

const P55 = pt(5, 5);

export const TANGENT_CASES: Record<string, Record<string, () => void>> = Object.fromEntries(
  (['tangent_point', 'tangent_from'] as const).map((tool) => [
    tool,
    {
      'P inside c (or P = the centre) → Undefined': () => {
        for (const F of FIELDS) {
          for (const P of F === ModPField ? [O0] : [pt(1, 1), O0]) {
            expect(reason(choose(F, tool, [P, C5], [ORIENT_P]))).toBe(
              `undefined: ${tool}(P, c): P lies inside the circle`,
            );
          }
        }
        // Mod p there is no inside: P off c has two (algebraic) touch points, not rational.
        expect(choose(ModPField, tool, [pt(1, 1), C5], [ORIENT_P]).kind).toBe('inexact');
      },
      'P on c (the gap |OP| − r within the band) → the double point': () => {
        for (const F of ORDERED) {
          const v = choose(F, tool, [pt(3, 4), C5]);
          if (tool === 'tangent_point') expect(plain(F, v)).toEqual([3, 4]);
          else expect(shape(F, v)).toEqual(shape(F, choose(F, 'tangent', [pt(3, 4), C5])));
        }
        const [x, y] = xy(choose(FloatField, 'tangent_point', [pt(5 + 1e-8, 0), C5], [ORIENT_M]));
        expect([Math.abs(x - 25 / (5 + 1e-8)) < 1e-14, y]).toEqual([true, 0]);
        expect(reason(choose(RationalField, tool, [pt(5 + 1e-8, 0), C5]))).toMatch(
          /^undefined: ambiguous: add a selector/,
        );
        expect(reason(choose(RationalField, tool, [pt(5 - 1e-8, 0), C5]))).toBe(
          `undefined: ${tool}(P, c): P lies inside the circle`,
        );
      },
      'two candidates and no selector → Undefined (ambiguous: add a selector)': () => {
        const noun = tool === 'tangent_point' ? 'touch points' : 'tangents';
        for (const F of FIELDS) {
          expect(reason(choose(F, tool, [P55, C5]))).toBe(
            `undefined: ambiguous: add a selector: ${tool}(P, c) has two ${noun} (for example other(P), near(P), same_side(Q, l) or orient(±))`,
          );
        }
      },
      'along(±) → Undefined (use orient(±))': () => {
        for (const F of FIELDS) {
          expect(reason(choose(F, tool, [P55, C5], [ALONG_P]))).toBe(
            `undefined: along(+) does not apply to ${tool}(P, c): use orient(±)`,
          );
        }
      },
      'other(T) with T not a touch point → Undefined': () => {
        for (const F of FIELDS) {
          expect(reason(choose(F, tool, [P55, C5], [other(pt(3, 4))]))).toBe(
            'undefined: other(point(3, 4)) needs the point on the polar of P (the chord of contact)',
          );
          expect(reason(choose(F, tool, [P55, C5], [other(P55)]))).toBe(
            'undefined: other(point(5, 5)) needs the point on the circle',
          );
        }
        for (const F of ORDERED) {
          const v = choose(F, tool, [P55, C5], [other(pt(5, 0))]);
          if (tool === 'tangent_point') expect(plain(F, v)).toEqual([0, 5]);
          else expect(shape(F, v)).toEqual({ p: [0, 5], d: [-5, 0], chiral: true });
        }
      },
      'square roots not representable → Inexact over Q and mod p (other(T) is exact)': () => {
        expect(reason(choose(RationalField, tool, [pt(6, 0), C5], [ORIENT_P]))).toBe(
          'inexact: √(275/1296) is not rational',
        );
        expect(choose(FloatField, tool, [pt(6, 0), C5], [ORIENT_P]).kind).not.toBe('inexact');
        expect(choose(ModPField, tool, [P55, C5], [ORIENT_P]).kind).toBe('inexact');
        const v = choose(ModPField, tool, [P55, C5], [other(pt(5, 0))]);
        if (tool === 'tangent_point') expect(v).toEqual({ kind: 'point', x: 0n, y: 5n });
        else expect(v).toMatchObject({ kind: 'line', p: { x: 0n, y: 5n }, chiral: true });
        expect(
          plain(RationalField, choose(RationalField, 'tangent_point', [P55, C5], [ORIENT_P])),
        ).toEqual([5, 0]);
        expect(
          plain(RationalField, choose(RationalField, 'tangent_point', [P55, C5], [ORIENT_M])),
        ).toEqual([0, 5]);
      },
    },
  ]),
);
