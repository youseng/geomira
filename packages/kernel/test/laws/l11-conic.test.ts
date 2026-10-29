/**
 * Law L11 (SPEC §17) for line ∩ conic (ADR-0042): a line moves THROUGH a tangency and the
 * selected branch along(+) is continuous until the tangency, the double point within the band,
 * Undefined beyond ("no intersection"); other(P) on a line turning about P moves continuously
 * through the tangency at P, where it is P. Against closed forms:
 *   - the ellipse x²/4 + y² = 1 and the line y = s (direction (1, 0)): along(+) is
 *     (2√(1 − s²), s), tangent at s = 1;
 *   - the hyperbola xy = 1 and the line x + y = s through (0, s) and (s, 0): along(+) has
 *     x = (s + √(s² − 4))/2, tangent at s = 2;
 *   - other(P) on the ellipse, P = (2, 0), the line through P of direction (cos φ, sin φ):
 *     X = P + t·(cos φ, sin φ), t = −4 cos φ/(cos² φ + 4 sin² φ), X = P at φ = 90°.
 */
import { FloatField } from '@geomira/num/float-field';
import { fromNumber } from '@geomira/num/rational';
import { BAND } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { call, lit, type Expr, type Selector } from '../../src/expr';
import type { Value } from '../../src/value';
import { Builder, contextOf, evalDoc, valueOf } from '../helpers/doc';
import { lawCount } from '../helpers/laws';

const STEPS = lawCount(400);

const n = (x: number): Expr => lit(fromNumber(x));
const P = (x: number, y: number): Expr => call('point', [n(x), n(y)]);
const ALONG: Selector = { kind: 'along', sign: 1 };

const ELL = call('conic', [P(2, 0), P(0, 1), P(-2, 0), P(0, -1), P(1.2, 0.8)]);
const HYP = call('conic', [P(1, 1), P(2, 0.5), P(-1, -1), P(4, 0.25), P(0.5, 2)]);

function valueAt(def: Expr): { v: Value<number>; scale: number } {
  const b = new Builder();
  b.add('X', def);
  const ctx = contextOf(b.doc);
  return { v: valueOf(b.doc, evalDoc(b.doc, FloatField, ctx), 'X'), scale: ctx.scale };
}

function xy(v: Value<number>): [number, number] {
  if (v.kind !== 'point') throw new Error(`${v.kind}: ${'reason' in v ? v.reason : ''}`);
  return [v.x, v.y];
}

interface Sweep {
  readonly name: string;
  readonly def: (s: number) => Expr;
  /** The exact selected point, or undefined past the tangency. */
  readonly exact: (s: number) => [number, number] | undefined;
  readonly from: number;
  readonly to: number;
  readonly sStar: number;
}

const SWEEPS: readonly Sweep[] = [
  {
    name: 'ellipse ∩ the line y = s, along(+), through the tangency at s = 1',
    def: (s) => call('intersect', [call('line', [P(-3, s), P(3, s)]), ELL], [ALONG]),
    exact: (s) => (s <= 1 ? [2 * Math.sqrt(1 - s * s), s] : undefined),
    from: 0,
    to: 1.5,
    sStar: 1,
  },
  {
    name: 'hyperbola ∩ the line x + y = s, along(+), through the tangency at s = 2',
    def: (s) => call('intersect', [call('line', [P(0, s), P(s, 0)]), HYP], [ALONG]),
    exact: (s) => {
      if (s < 2) return undefined;
      const x = (s + Math.sqrt(s * s - 4)) / 2;
      return [x, s - x];
    },
    from: 3,
    to: 1.5,
    sStar: 2,
  },
];

describe('L11: line ∩ conic through a tangency', () => {
  for (const w of SWEEPS)
    it(w.name, () => {
      let prev: [number, number] | undefined;
      for (let i = 0; i <= STEPS; i++) {
        const s = w.from + ((w.to - w.from) * i) / STEPS;
        const { v, scale } = valueAt(w.def(s));
        const e = w.exact(s);
        const near = Math.abs(s - w.sStar) < 1e-6;
        if (e === undefined && !near) {
          expect(v.kind, `s = ${String(s)}`).toBe('undefined');
          prev = undefined;
          continue;
        }
        if (v.kind !== 'point') {
          // Only within the band of the tangency may the call be undefined.
          expect(near, `s = ${String(s)}: ${v.kind}`).toBe(true);
          continue;
        }
        const p = xy(v);
        if (e !== undefined && !near)
          expect(Math.hypot(p[0] - e[0], p[1] - e[1])).toBeLessThan(1e-9 * scale);
        // Continuity: the step of the selected point is at most the exact branch's (with slack).
        if (prev !== undefined && e !== undefined && !near) {
          const ds = Math.abs(w.to - w.from) / STEPS;
          const e2 = w.exact(s - Math.sign(w.to - w.from) * ds);
          const exactStep = e2 === undefined ? Infinity : Math.hypot(e[0] - e2[0], e[1] - e2[1]);
          expect(Math.hypot(p[0] - prev[0], p[1] - prev[1])).toBeLessThan(
            exactStep * 1.5 + BAND * scale,
          );
        }
        prev = p;
      }
    });

  it('other(P) on a line turning about P = (2, 0) of the ellipse: continuous, P at the tangency', () => {
    let prev: [number, number] | undefined;
    for (let i = 0; i <= STEPS; i++) {
      const phi = (Math.PI / 4) * (1 + (2 * i) / STEPS); // 45° … 135°, through 90°
      const d = [Math.cos(phi), Math.sin(phi)] as const;
      const line = call('line', [P(2, 0), P(2 + d[0], d[1])]);
      const { v, scale } = valueAt(call('other', [line, ELL, P(2, 0)]));
      const t = (-4 * d[0]) / (d[0] * d[0] + 4 * d[1] * d[1]);
      const p = xy(v);
      expect(Math.hypot(p[0] - (2 + t * d[0]), p[1] - t * d[1])).toBeLessThan(1e-9 * scale);
      if (prev !== undefined)
        expect(Math.hypot(p[0] - prev[0], p[1] - prev[1])).toBeLessThan(
          ((4 * Math.PI) / 2 / STEPS) * 1.5,
        );
      prev = p;
    }
  });
});
