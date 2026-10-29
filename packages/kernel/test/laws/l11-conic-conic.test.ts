/**
 * Law L11 (SPEC §17) for conic ∩ conic (ADR-0043): a selected common point moves continuously
 * under a drag until two candidates merge; there it is the double point within the band or
 * Undefined, never a jump to another candidate. Against closed forms, with the ellipse
 * x²/4 + y² = 1:
 *   - the circle about (0, s) of radius 1, near((1, 2)): (2√(1 − y²), y) with
 *     y = (√(4s² + 9) − s)/3, until the tangency at (0, 1) for s = 2, nothing beyond;
 *   - the circle about the origin of radius r, same_side((1, 1), x-axis) and
 *     same_side((1, 1), y-axis): the first quadrant's point x = √(4(r² − 1)/3), y = √(r² − x²),
 *     for 1 < r < 2 (four-point merges at both ends: the double contacts at r = 1 and r = 2);
 *   - circles tangent to the ellipse at P = (6/5, 4/5) whose radius passes through the radius of
 *     curvature there (an osculation: three common points merge at P): far_from(P) is the fourth
 *     point, continuous through the whole drag, and near(P) stays P (or Undefined where a
 *     candidate is within the band of it).
 */
import { FloatField } from '@geomira/num/float-field';
import { fromNumber } from '@geomira/num/rational';
import { BAND, EPS } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { call, lit, type Expr, type Selector } from '../../src/expr';
import type { Value } from '../../src/value';
import { Builder, contextOf, evalDoc, valueOf } from '../helpers/doc';
import { lawCount } from '../helpers/laws';

const STEPS = lawCount(400);
const n = (x: number): Expr => lit(fromNumber(x));
const P = (x: number, y: number): Expr => call('point', [n(x), n(y)]);
const ELL = call('conic', [P(1.2, 0.8), P(2, 0), P(0, 1), P(-2, 0), P(0, -1)]);
const circle = (cx: number, cy: number, r: number): Expr =>
  call('circle', [P(cx, cy), P(cx + r, cy)]);

function valueAt(def: Expr): { v: Value<number>; scale: number } {
  const b = new Builder();
  b.add('X', def);
  const ctx = contextOf(b.doc);
  return { v: valueOf(b.doc, evalDoc(b.doc, FloatField, ctx), 'X'), scale: ctx.scale };
}

interface Sweep {
  readonly name: string;
  readonly def: (s: number) => Expr;
  readonly exact: (s: number) => [number, number] | undefined;
  readonly from: number;
  readonly to: number;
  /** The parameters where candidates merge (Undefined or the double point allowed nearby). */
  readonly merges: readonly number[];
}

const NEAR_12: Selector = { kind: 'near', p: P(1, 2) };
const Q1: readonly Selector[] = [
  { kind: 'same_side', q: P(1, 1), l: call('line', [P(0, 0), P(1, 0)]) },
  { kind: 'same_side', q: P(1, 1), l: call('line', [P(0, 0), P(0, 1)]) },
];

const SWEEPS: readonly Sweep[] = [
  {
    name: 'the circle about (0, s) of radius 1, near((1, 2)), through the tangency at s = 2',
    def: (s) => call('intersect', [ELL, circle(0, s, 1)], [NEAR_12]),
    exact: (s) => {
      if (s > 2) return undefined;
      const y = (Math.sqrt(4 * s * s + 9) - s) / 3;
      return [2 * Math.sqrt(Math.max(0, 1 - y * y)), y];
    },
    from: 0.5,
    to: 2.5,
    merges: [2],
  },
  {
    name: 'the circle about the origin of radius r, two side filters, between two double contacts',
    def: (r) => call('intersect', [circle(0, 0, r), ELL], Q1),
    exact: (r) => {
      if (r <= 1 || r >= 2) return undefined;
      const x = Math.sqrt((4 * (r * r - 1)) / 3);
      return [x, Math.sqrt(r * r - x * x)];
    },
    from: 0.9,
    to: 2.1,
    merges: [1, 2],
  },
];

/** Within this parameter distance of a merge, Undefined or the double point is allowed. */
const NEAR_MERGE = 1e-5;

describe('L11: conic ∩ conic through tangencies and merges', () => {
  for (const w of SWEEPS)
    it(w.name, () => {
      let prev: [number, number] | undefined;
      for (let i = 0; i <= STEPS; i++) {
        const s = w.from + ((w.to - w.from) * i) / STEPS;
        const { v, scale } = valueAt(w.def(s));
        const e = w.exact(s);
        const near = w.merges.some((m) => Math.abs(s - m) < NEAR_MERGE);
        if (v.kind !== 'point') {
          expect(e === undefined || near, `s = ${String(s)}: ${v.kind}`).toBe(true);
          prev = undefined;
          continue;
        }
        expect(e !== undefined || near, `s = ${String(s)}: a point where there is none`).toBe(true);
        if (e === undefined || near) continue;
        expect(Math.hypot(v.x - e[0], v.y - e[1]), `s = ${String(s)}`).toBeLessThan(1e-9 * scale);
        if (prev !== undefined) {
          const ds = (w.to - w.from) / STEPS;
          const e2 = w.exact(s - ds);
          const step = e2 === undefined ? Infinity : Math.hypot(e[0] - e2[0], e[1] - e2[1]);
          expect(Math.hypot(v.x - prev[0], v.y - prev[1])).toBeLessThan(step * 1.5 + BAND * scale);
        }
        prev = [v.x, v.y];
      }
    });

  it('near the tangency of the first sweep: two points, the double point within the band, then nothing', () => {
    const w = SWEEPS[0];
    if (w === undefined) return;
    for (const k of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      for (const sign of [-1, 1]) {
        const s = 2 + sign * 10 ** -k;
        const { v, scale } = valueAt(w.def(s));
        const e = w.exact(s);
        // ADR-0006's band-edge bound: the selected point is within √(2r·BAND·scale) of the exact
        // branch (r the larger radius of curvature, 4 for this ellipse) or Undefined beyond.
        const bound = Math.sqrt(2 * 4 * BAND * scale);
        if (v.kind !== 'point') {
          expect(e === undefined || Math.abs(s - 2) < 1e-6, `s = ${String(s)}`).toBe(true);
          continue;
        }
        const target = e ?? [0, 1];
        expect(Math.hypot(v.x - target[0], v.y - target[1]), `s = ${String(s)}`).toBeLessThan(
          e === undefined ? bound : Math.max(bound, 1e-9 * scale),
        );
      }
    }
  });

  it('an osculation: far_from(P) is continuous through it, near(P) stays P', () => {
    const [px, py] = [1.2, 0.8];
    // Radius of curvature of x²/4 + y² = 1 at (2 cos t, sin t), cos t = 3/5, sin t = 4/5.
    const R = Math.pow(4 * 0.64 + 0.36, 1.5) / 2;
    const [nx, ny] = [-0.6, -1.6];
    const nl = Math.hypot(nx, ny);
    const tangentCircle = (k: number): Expr =>
      call('circle', [P(px + (R * k * nx) / nl, py + (R * k * ny) / nl), P(px, py)]);
    let prev: [number, number] | undefined;
    let steps: number[] = [];
    const M = STEPS;
    for (let i = 0; i <= M; i++) {
      const s = -2e-3 + (4e-3 * i) / M;
      const c = tangentCircle(1 + s);
      const far = valueAt(call('intersect', [ELL, c], [{ kind: 'far_from', p: P(px, py) }]));
      expect(far.v.kind, `s = ${String(s)}`).toBe('point');
      if (far.v.kind !== 'point') continue;
      if (prev !== undefined) steps.push(Math.hypot(far.v.x - prev[0], far.v.y - prev[1]));
      prev = [far.v.x, far.v.y];
      const at = valueAt(call('intersect', [ELL, c], [{ kind: 'near', p: P(px, py) }]));
      if (at.v.kind === 'point')
        expect(Math.hypot(at.v.x - px, at.v.y - py), `s = ${String(s)}`).toBeLessThan(
          Math.cbrt(EPS) * at.scale,
        );
      else expect(Math.abs(s), `s = ${String(s)}: ${at.v.kind}`).toBeLessThan(1e-4);
    }
    steps = steps.sort((a, b) => a - b);
    const median = steps[Math.floor(steps.length / 2)] ?? 0;
    expect(Math.max(...steps)).toBeLessThan(median * 3 + 1e-9);
  });
});
