/**
 * Run 16c audit (ADR-0042 decision 8): the labels of the two tangents from P to a conic.
 * orient(+) is the touch point T with cross(mid − P, T − P) > 0, mid the midpoint of the chord
 * of contact; for a conic that is a circle mid − P points to the centre, so the labels are the
 * circle tools' (SPEC §7). They were the opposite ones: the flip was read from the sign of Q(P),
 * which the normal form does not tie to the side of P.
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../src/expr';
import { Builder, evalDoc, num, pt, valueOf } from './helpers/doc';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
type XY = { x: number; y: number };

function at(tool: string, args: Expr[], sign: 1 | -1): XY {
  const b = new Builder();
  b.add('x', call(tool, args, [{ kind: 'orient', sign }]));
  const v = valueOf(b.doc, evalDoc(b.doc, FloatField), 'x');
  if (v.kind === 'point') return v;
  if (v.kind === 'line') return v.p;
  throw new Error(v.kind === 'undefined' || v.kind === 'inexact' ? v.reason : v.kind);
}

const CIRCLE = T('circle', pt(0, 0), num(2));
const AS_CONIC = T('conic', pt(2, 0), pt(0, 2), pt(-2, 0), pt(0, -2), pt('6/5', '8/5'));
const ELLIPSE = T('conic', pt(2, 0), pt(0, 1), pt(-2, 0), pt(0, -1), pt('6/5', '4/5'));
const HYPERBOLA = T('conic', pt(1, 1), pt(2, '1/2'), pt(-1, -1), pt(4, '1/4'), pt('1/2', 2));
const near = (p: XY, q: XY) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-9;

describe('orient(±) on the tangents from P to a conic', () => {
  it("a conic that is a circle: the circle tools' labels", () => {
    for (const P of [pt(0, 3), pt(5, 1), pt(-3, -4)])
      for (const sign of [1, -1] as const)
        expect(
          near(at('tangent_point', [P, AS_CONIC], sign), at('tangent_point', [P, CIRCLE], sign)),
        ).toBe(true);
  });

  it('orient(+) is the touch point T with cross(mid − P, T − P) > 0 (ellipse, hyperbola)', () => {
    for (const [k, Ps] of [
      [
        ELLIPSE,
        [
          [0, 3],
          [5, 1],
          [-3, -4],
          [1, -2],
        ],
      ],
      [
        HYPERBOLA,
        [
          [2, -1],
          [-3, 1],
          [0.5, -0.25],
        ],
      ],
    ] as const)
      for (const [x, y] of Ps) {
        const P = { x, y };
        const [Tp, Tm] = [
          at('tangent_point', [pt(x, y), k], 1),
          at('tangent_point', [pt(x, y), k], -1),
        ];
        const mid = { x: (Tp.x + Tm.x) / 2, y: (Tp.y + Tm.y) / 2 };
        const cross = (mid.x - P.x) * (Tp.y - P.y) - (mid.y - P.y) * (Tp.x - P.x);
        expect(cross, `P = (${String(x)}, ${String(y)})`).toBeGreaterThan(0);
      }
  });

  it('tangent_from takes the same labels as tangent_point', () => {
    for (const sign of [1, -1] as const) {
      const T0 = at('tangent_point', [pt(5, 1), ELLIPSE], sign);
      expect(near(at('tangent_from', [pt(5, 1), ELLIPSE], sign), T0)).toBe(true);
    }
  });
});
