/**
 * ADR-0054 (mutation shards kernel-a and kernel-h: conic.ts, conic-glider.ts, tools/foci.ts):
 * the conic core at the edges the earlier tests left open. coeffsProblem refuses an imaginary
 * ellipse (and its band), coefficients without a quadratic part, and a pair of lines over Q
 * whose degeneracy length is not rational; conicType names the three types and needs an order;
 * chordGap is the signed chord gap (floats only, none in an asymptotic direction or through the
 * centre); a glider needs a known point other than the centre and a parameter other than
 * (0 : 0), its known point has the parameter (1 : 0), and a drag lands on the conic (floats
 * only, never from the centre); foci lists a circle's centre and a conic's two foci, wherever
 * the focal axis points.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { chordGap, coeffsProblem, conicType, makeConic, qValue, type Coeffs } from '../src/conic';
import { conicDragParameter, conicGliderParameter, conicGliderPoint } from '../src/conic-glider';
import type { EvalContext } from '../src/tool';
import type { Conic, Value, Vec } from '../src/value';
import { REGISTRY, must, q } from './helpers/doc';

const CTX: EvalContext = { scale: 4 };
const F = FloatField;
type QN = Coeffs<number>;
const ELL: QN = [1, 0, 4, 0, 0, -4];

function coeffs<T>(Fd: Field<T>, xs: readonly (number | string)[]): Coeffs<T> {
  const v = xs.map((x) => {
    const r = Fd.fromRational(q(x));
    if (typeof r === 'object' && r !== null && 'kind' in r) throw new Error('inexact');
    return r;
  });
  return [v[0], v[1], v[2], v[3], v[4], v[5]] as unknown as Coeffs<T>;
}
function conic<T>(Fd: Field<T>, xs: readonly (number | string)[], anchor?: Vec<T>): Conic<T> {
  const k = makeConic(Fd, coeffs(Fd, xs), anchor, CTX);
  if (k.kind !== 'conic') throw new Error(k.reason);
  return k;
}
/** 'valid' for undefined, '<kind>: <reason>' for Undefined or Inexact, else the kind or form. */
function why(v: object | string | undefined): string {
  if (v === undefined) return 'valid';
  if (typeof v === 'string') return v;
  if ('reason' in v && 'kind' in v) return `${String(v.kind)}: ${String(v.reason)}`;
  return 'kind' in v ? String(v.kind) : 'form';
}

describe('coeffsProblem', () => {
  it('an imaginary ellipse has no real point; within the band of one, ambiguous', () => {
    for (const Fd of [F, RationalField] as Field<unknown>[])
      for (const s of [1, -1])
        expect(why(coeffsProblem(Fd, coeffs(Fd, [s, 0, s, 0, 0, s]), CTX))).toBe(
          'undefined: the conic has no real point (an imaginary ellipse)',
        );
    // ac − b² = 10⁻⁸ (inside the band) with a·det M > 0.
    expect(why(coeffsProblem(F, [1, 0, 1e-8, 0, 0, 1], CTX))).toBe(
      'undefined: ambiguous: the conic is within the band of an imaginary ellipse',
    );
    // The same with a·det M < 0 is a real hyperbola-like conic: no problem.
    expect(why(coeffsProblem(F, [1, 0, 1e-8, 0, 0, -1], CTX))).toBe('valid');
    // Mod p there is no order: not checked.
    expect(why(coeffsProblem(ModPField, coeffs(ModPField, [1, 0, 1, 0, 0, 1]), CTX))).toBe('valid');
  });

  it('no quadratic part: a line, not a conic', () => {
    for (const Fd of [F, RationalField, ModPField] as Field<unknown>[])
      expect(why(coeffsProblem(Fd, coeffs(Fd, [0, 0, 0, 1, 1, 1]), CTX))).toBe(
        'undefined: degenerate conic: it has no quadratic part (a line)',
      );
  });

  it('a pair of lines over Q whose degeneracy length is not rational: degenerate', () => {
    // xy = 0: a² + 2b² + c² = 1/2 has no rational square root; det M = 0 decides.
    for (const Fd of [RationalField, ModPField, F] as Field<unknown>[])
      expect(why(coeffsProblem(Fd, coeffs(Fd, [0, '1/2', 0, 0, 0, 0]), CTX))).toBe(
        'undefined: degenerate conic: a pair of lines, a double line or a point',
      );
  });
});

describe('conicType', () => {
  it('ellipse, hyperbola, parabola; mod p it needs an order', () => {
    for (const Fd of [F, RationalField] as Field<unknown>[]) {
      expect(conicType(Fd, conic(Fd, [1, 0, 4, 0, 0, -4]), CTX)).toBe('ellipse');
      expect(conicType(Fd, conic(Fd, [0, '1/2', 0, 0, 0, -1]), CTX)).toBe('hyperbola');
      expect(conicType(Fd, conic(Fd, [1, 0, 0, 0, '-1/2', 0]), CTX)).toBe('parabola');
    }
    expect(why(conicType(ModPField, conic(ModPField, [1, 0, 4, 0, 0, -4]), CTX))).toBe(
      `inexact: the type of a conic needs an order, which ${ModPField.name} lacks`,
    );
  });
});

describe('chordGap', () => {
  it('positive across, zero touching, negative missing; floats only', () => {
    const gap = (y: number, dx = 1) => chordGap(F, ELL, { x: 0, y }, { x: dx, y: 0 });
    // y = 1/2: Q(mid) = −3, |∇Q| = 4: the gap is 3/4; y = 2: −3/4; y = 1: 0.
    for (const dx of [1, -2]) {
      expect(gap(0.5, dx)).toBeCloseTo(0.75, 14);
      expect(gap(2, dx)).toBeCloseTo(-0.75, 14);
      expect(Math.abs(gap(1, dx) ?? 1)).toBe(0);
    }
    // A negative-definite form: the same gaps (the sign of α is taken out).
    const neg: QN = [-1, 0, -4, 0, 0, 4];
    expect(chordGap(F, neg, { x: 0, y: 0.5 }, { x: 1, y: 0 })).toBeCloseTo(0.75, 14);
    expect(chordGap(F, neg, { x: 0, y: 2 }, { x: 1, y: 0 })).toBeCloseTo(-0.75, 14);
    // Through the centre (∇Q(mid) = 0), in an asymptotic direction, or over Q: none.
    expect(chordGap(F, ELL, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeUndefined();
    expect(chordGap(F, [0, 0.5, 0, 0, 0, -1], { x: 0, y: 1 }, { x: 1, y: 0 })).toBeUndefined();
    const ellQ = coeffs(RationalField, [1, 0, 4, 0, 0, -4]);
    const v = (x: number, y: number) => ({ x: q(x), y: q(y) });
    expect(chordGap(RationalField, ellQ, v(0, 0.5), v(1, 0))).toBeUndefined();
  });
});

describe('the glider on a conic', () => {
  it('a known point at the centre, the parameter (0 : 0)', () => {
    const atCentre = { ...conic(F, ELL), anchor: { x: 0, y: 0 } };
    expect(why(conicGliderPoint(F, atCentre, 1, 0, CTX))).toBe(
      'undefined: the known point of the conic is its center',
    );
    const k = conic(F, ELL, { x: 2, y: 0 });
    expect(why(conicGliderPoint(F, k, 0, 0, CTX))).toBe(
      'undefined: the glider parameter (0 : 0) is not a point',
    );
    expect(why(conicGliderPoint(F, k, 1e-12, -1e-12, CTX))).toBe(
      'undefined: the glider parameter (0 : 0) is not a point',
    );
  });

  it('the known point has the parameter (1 : 0), and (1 : 0) is the known point', () => {
    for (const Fd of [F, RationalField] as Field<unknown>[]) {
      const A = { x: Fd.fromRational(q('6/5')), y: Fd.fromRational(q('4/5')) } as Vec<unknown>;
      const k = conic(Fd, [1, 0, 4, 0, 0, -4], A);
      expect(conicGliderParameter(Fd, k, A, CTX)).toEqual({
        form: 'stereo',
        u: Fd.one,
        v: Fd.zero,
      });
      const P = conicGliderPoint(Fd, k, Fd.one, Fd.zero, CTX);
      expect(P.kind === 'point' ? [Fd.toNumber(P.x), Fd.toNumber(P.y)] : why(P)).toEqual([
        1.2, 0.8,
      ]);
    }
  });

  it('a drag lands on the conic; from the centre or over Q there is none', () => {
    const k = conic(F, ELL, { x: 2, y: 0 });
    for (const cursor of [
      { x: 3, y: 1 },
      { x: -0.5, y: 0.2 },
      { x: 0.1, y: -2 },
    ]) {
      const s = conicDragParameter(F, k, cursor, CTX);
      if (!('form' in s)) throw new Error(s.reason);
      const P = conicGliderPoint(F, k, s.u, s.v, CTX);
      if (P.kind !== 'point') throw new Error(why(P));
      expect(Math.abs(qValue(F, ELL, P))).toBeLessThan(1e-12);
    }
    // On an axis the nearest point is the vertex: the Newton steps run until the cursor is on
    // the conic (one step from (3, 0) lands at (13/6, 0), off it).
    for (const [cursor, want] of [
      [{ x: 3, y: 0 }, [2, 0]],
      [{ x: 0, y: 2.5 }, [0, 1]],
      [{ x: -2.5, y: 0 }, [-2, 0]],
    ] as const) {
      const s = conicDragParameter(F, k, cursor, CTX);
      if (!('form' in s)) throw new Error(s.reason);
      const P = conicGliderPoint(F, k, s.u, s.v, CTX);
      expect(P.kind === 'point' ? [P.x, P.y] : why(P)).toEqual([
        expect.closeTo(want[0], 9),
        expect.closeTo(want[1], 9),
      ]);
    }
    expect(why(conicDragParameter(F, k, { x: 0, y: 0 }, CTX))).toBe(
      'undefined: the cursor is at the center: no nearest point',
    );
    const kq = conic(RationalField, [1, 0, 4, 0, 0, -4], { x: q(2), y: q(0) });
    expect(why(conicDragParameter(RationalField, kq, { x: q(3), y: q(1) }, CTX))).toBe(
      'inexact: dragging on a conic needs float iterations',
    );
  });
});

describe('foci', () => {
  const spec = must(REGISTRY.get('foci'));
  const cands = (args: readonly Value<number>[]) =>
    (spec.candidates?.(F, args, CTX) ?? []).map((v) => (v.kind === 'point' ? [v.x, v.y] : v.kind));

  it("a circle's candidate is its centre (none for a circle without radius); a conic has two", () => {
    expect(cands([{ kind: 'circle', c: { x: 1, y: 2 }, r2: 4, arc: null }])).toEqual([[1, 2]]);
    expect(cands([{ kind: 'circle', c: { x: 1, y: 2 }, r2: 0, arc: null }])).toEqual([]);
    const k = conic(F, [9, 0, 25, 0, 0, -225]);
    expect(cands([k])).toHaveLength(2);
    expect(cands([k, k])).toEqual([]);
  });

  it('the foci of an ellipse whose axis points in each quadrant', () => {
    // x²/25 + y²/9 = 1 rotated by θ: foci ±4·(cos θ, sin θ).
    for (const deg of [30, 120, 210, 300, 75, 165]) {
      const t = (deg * Math.PI) / 180;
      const [c, s] = [Math.cos(t), Math.sin(t)];
      // Q(R⁻¹X) with R the rotation by θ.
      const [A, B] = [1 / 25, 1 / 9];
      const qa = A * c * c + B * s * s;
      const qb = (A - B) * c * s;
      const qc = A * s * s + B * c * c;
      const k = conic(F, [qa, qb, qc, 0, 0, -1]);
      const got = cands([k]);
      expect(got).toHaveLength(2);
      for (const sign of [1, -1]) {
        const want = [sign * 4 * c, sign * 4 * s];
        expect(
          Math.min(
            ...got.map((p) =>
              Array.isArray(p)
                ? Math.hypot((p[0] ?? 0) - (want[0] ?? 0), (p[1] ?? 0) - (want[1] ?? 0))
                : 1,
            ),
          ),
          `${String(deg)}°`,
        ).toBeLessThan(1e-9);
      }
    }
  });
});
