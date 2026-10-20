/**
 * Law L11 (SPEC §17): continuity. For every branchable tool (intersect of curves,
 * tangent_point, tangent_from) and for other() (the tool and the other(P) selector), a
 * figure moves along a path that passes THROUGH TANGENCY; the samples include exactly
 * tangent figures (integer data) and nearly tangent ones (the tangency parameter ± 10⁻¹²,
 * ± EPS, ± BAND multiples of the scale). Against the selected branch computed
 * independently (helpers/branch-figures.ts formulas):
 *   - where the discriminant (a gap, as a length) is clearly positive the value IS that
 *     branch, never the other one; within the band it is the double point; clearly
 *     negative it is Undefined ("no intersection …"): through tangency → Undefined;
 *   - movement: away from tangency (gap ≥ 5% of the radius) |ΔV| ≤ 1.5·L·Δs, with L the
 *     analytic speed of the branch; near tangency |ΔV| ≤ |ΔE| + h_band, the motion of the
 *     exact branch plus the exact half chord at the band edge (gap g = BAND·scale), which
 *     is also how far the exact candidates move across the band (ADR-0006 item 16).
 * other() moves continuously THROUGH tangency (the curves keep meeting at P): |ΔX| ≤
 * 1.01·L·Δφ, and at tangency X = P.
 */
import { FloatField } from '@geomira/num/float-field';
import { fromNumber } from '@geomira/num/rational';
import { BAND, EPS } from '@geomira/num/tolerance';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, lit, type Expr, type Selector } from '../../src/expr';
import type { Value } from '../../src/value';
import { Builder, contextOf, evalDoc, valueOf } from '../helpers/doc';
import { add, dot, len, mul, resultPoint, rot, sub, unit, type V } from '../helpers/branch-figures';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const PATHS = lawCount(40);

type State =
  { readonly kind: 'two' | 'double'; readonly X: V; readonly exact: V } | { readonly kind: 'none' };

interface Path {
  readonly name: string;
  /** The value at parameter s, and the figure's scale. */
  value(s: number): { readonly v: Value<number>; readonly scale: number };
  /** The signed gap (a length) at s: > 0 two candidates, < 0 none. */
  gap(s: number): number;
  /** The selected branch at s: the exact point (and the double point in the band). */
  state(s: number, band: number): State;
  /** |dE/ds| of the selected branch at s (where it has two candidates). */
  speed(s: number): number;
  /** The exact half chord at gap g: the motion of the exact branch across the band. */
  halfChord(g: number): number;
  /** A radius of the figure (sets "away from tangency": gap ≥ 5% of it). */
  readonly r: number;
  /** The parameter of tangency (the samples cluster around it). */
  readonly sStar: number;
  readonly range: readonly [number, number];
  readonly reason: string;
}

const pt = (p: V): Expr => call('point', [lit(fromNumber(p[0])), lit(fromNumber(p[1]))]);

function evaluateAt(build: (b: Builder) => void): { v: Value<number>; scale: number } {
  const b = new Builder();
  build(b);
  const ctx = contextOf(b.doc);
  return { v: valueOf(b.doc, evalDoc(b.doc, FloatField, ctx), 'X'), scale: ctx.scale };
}

/** Line ∩ circle: the line at signed distance s from O, along(sign); achiral or chiral. */
function linePath(O: V, r: number, e: V, chiral: boolean, sign: 1 | -1): Path {
  const n = rot(e);
  const d = chiral ? mul(e, 2) : e; // perp_bisector(F + n, F − n): direction rot90(−2n) = 2e
  const dir = mul(d, 1 / len(d));
  return {
    name: `line ∩ circle, ${chiral ? 'perp_bisector (chiral)' : 'line (achiral)'}, along(${sign === 1 ? '+' : '-'})`,
    value: (s) =>
      evaluateAt((b) => {
        const F = add(O, mul(n, s));
        const [U, W] = chiral ? [add(F, n), sub(F, n)] : [sub(F, mul(e, 3)), add(F, mul(e, 3))];
        const l = call(chiral ? 'perp_bisector' : 'line', [pt(U), pt(W)]);
        const c = call('circle', [pt(O), pt(add(O, [r, 0]))]);
        b.add('X', call('intersect', [l, c], [{ kind: 'along', sign }]));
      }),
    gap: (s) => r - Math.abs(s),
    state: (s, band) => {
      const g = r - Math.abs(s);
      if (g <= -band) return { kind: 'none' };
      const F = add(O, mul(n, s));
      const a = Math.sqrt(Math.max(0, r * r - s * s));
      const exact = add(F, mul(dir, sign * a));
      return g < band ? { kind: 'double', X: F, exact } : { kind: 'two', X: exact, exact };
    },
    speed: (s) => r / Math.sqrt(r * r - s * s),
    halfChord: (g) => Math.sqrt(g * (2 * r - g)),
    r,
    sStar: r,
    range: [0, 1.5 * r],
    reason: 'no intersection: the line misses the circle',
  };
}

/** Circle ∩ circle: O₂ = O₁ + s·e, orient(sign); external tangency at s = r₁ + r₂. */
function circlesPath(O1: V, r1: number, r2: number, e: V, sign: 1 | -1, internal: boolean): Path {
  const sStar = internal ? Math.abs(r1 - r2) : r1 + r2;
  return {
    name: `circle ∩ circle (${internal ? 'internal' : 'external'} tangency), orient(${sign === 1 ? '+' : '-'})`,
    value: (s) =>
      evaluateAt((b) => {
        const O2 = add(O1, mul(e, s));
        const c1 = call('circle', [pt(O1), pt(add(O1, [0, r1]))]);
        const c2 = call('circle', [pt(O2), pt(add(O2, [0, r2]))]);
        b.add('X', call('intersect', [c1, c2], [{ kind: 'orient', sign }]));
      }),
    gap: (s) => Math.min(r1 + r2 - s, s - Math.abs(r1 - r2)),
    state: (s, band) => {
      const g = Math.min(r1 + r2 - s, s - Math.abs(r1 - r2));
      if (g <= -band) return { kind: 'none' };
      const a = (s * s + r1 * r1 - r2 * r2) / (2 * s);
      const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
      const mid = add(O1, mul(e, a));
      const exact = add(mid, mul(rot(e), sign * h));
      return g < band ? { kind: 'double', X: mid, exact } : { kind: 'two', X: exact, exact };
    },
    speed: (s) => {
      const a = (s * s + r1 * r1 - r2 * r2) / (2 * s);
      const da = (s * s - r1 * r1 + r2 * r2) / (2 * s * s);
      return (Math.abs(da) * r1) / Math.sqrt(r1 * r1 - a * a) + Math.abs(da);
    },
    halfChord: (g) => {
      const d = internal ? Math.abs(r1 - r2) + g : r1 + r2 - g;
      const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
      return Math.sqrt(Math.max(0, r1 * r1 - a * a));
    },
    r: Math.min(r1, r2),
    sStar,
    range: internal
      ? [Math.max(0.5, sStar - 0.8 * Math.min(r1, r2)), sStar + 0.6 * Math.min(r1, r2)]
      : [sStar - 0.8 * Math.min(r1, r2), sStar + 2],
    reason: internal
      ? 'no intersection: one circle lies inside the other'
      : 'no intersection: the circles are apart',
  };
}

/** Tangents from P = O + s·e to circle (O, r), orient(sign); tangency at s = r. */
function tangentPath(
  O: V,
  r: number,
  e: V,
  sign: 1 | -1,
  tool: 'tangent_point' | 'tangent_from',
): Path {
  return {
    name: `${tool}, orient(${sign === 1 ? '+' : '-'})`,
    value: (s) =>
      evaluateAt((b) => {
        b.add(
          'X',
          call(
            tool,
            [pt(add(O, mul(e, s))), call('circle', [pt(O), pt(add(O, [r, 0]))])],
            [{ kind: 'orient', sign }],
          ),
        );
      }),
    gap: (s) => s - r,
    state: (s, band) => {
      if (s - r <= -band) return { kind: 'none' };
      const mid = add(O, mul(e, (r * r) / s));
      // orient(+) has cross(O − P, T − P) > 0: T = mid − k·rot90(e) (ADR-0006 item 7).
      const k = (r * Math.sqrt(Math.max(0, s * s - r * r))) / s;
      const exact = sub(mid, mul(rot(e), sign * k));
      return s - r < band ? { kind: 'double', X: mid, exact } : { kind: 'two', X: exact, exact };
    },
    speed: (s) => (r * r) / (s * Math.sqrt(s * s - r * r)),
    halfChord: (g) => (r * Math.sqrt((r + g) * (r + g) - r * r)) / (r + g),
    r,
    sStar: r,
    range: [0.6 * r, 3 * r],
    reason: `${tool}(P, c): P lies inside the circle`,
  };
}

/** Samples: a uniform grid plus the tangency parameter and its near neighbours. */
function samples(p: Path, scale: number): number[] {
  const [lo, hi] = p.range;
  const grid = Array.from({ length: 121 }, (_, i) => lo + ((hi - lo) * i) / 120);
  const near = [
    0,
    1e-12,
    EPS / 2,
    2 * EPS,
    BAND / 2,
    0.9 * BAND,
    1.1 * BAND,
    2 * BAND,
    1e-6,
    1e-4,
    1e-2,
  ].flatMap((k) => [p.sStar + k * scale, p.sStar - k * scale]);
  return [...new Set([...grid, ...near])].filter((s) => s >= lo && s <= hi).sort((a, b) => a - b);
}

function checkPath(p: Path, tally: Record<string, number>): void {
  const probe = p.value(p.sStar);
  const band = BAND * probe.scale;
  const hBand = p.halfChord(band);
  let prev: { s: number; V: V; st: State } | undefined;
  const seen = new Set<string>();
  for (const s of samples(p, probe.scale)) {
    const g = p.gap(s);
    if (Math.abs(Math.abs(g) - band) < 0.02 * band) continue; // not judged exactly on the edge
    const { v, scale } = p.value(s);
    const st = p.state(s, BAND * scale);
    seen.add(st.kind);
    const tol = 1e-9 * scale;
    if (st.kind === 'none') {
      expect(v, `${p.name} at s = ${String(s)}`).toEqual({ kind: 'undefined', reason: p.reason });
      prev = undefined;
      continue;
    }
    const V = resultPoint(v);
    expect(V, `${p.name} at s = ${String(s)}: ${JSON.stringify(v)}`).toBeDefined();
    if (V === undefined) return;
    expect(
      len(sub(V, st.X)),
      `${p.name} at s = ${String(s)} (${st.kind}): never the other branch`,
    ).toBeLessThan(tol);
    if (prev !== undefined) {
      const dV = len(sub(V, prev.V));
      const ds = s - prev.s;
      const away =
        Math.min(g, p.gap(prev.s)) >= 0.05 * p.r && st.kind === 'two' && prev.st.kind === 'two';
      if (away) {
        expect(dV, `${p.name}: movement < C·step at s = ${String(s)}`).toBeLessThanOrEqual(
          1.5 * Math.max(p.speed(s), p.speed(prev.s)) * ds + tol,
        );
        tally.lipschitz = (tally.lipschitz ?? 0) + 1;
      } else if (prev.st.kind !== 'none') {
        const dE = len(sub(st.exact, prev.st.exact));
        expect(dV, `${p.name}: near tangency at s = ${String(s)}`).toBeLessThanOrEqual(
          dE + hBand + 2 * tol,
        );
        tally.nearTangency = (tally.nearTangency ?? 0) + 1;
      }
    }
    prev = { s, V, st };
  }
  expect([...seen].sort(), `${p.name}: passes through tangency`).toEqual(['double', 'none', 'two']);
  tally.paths = (tally.paths ?? 0) + 1;
}

function paths(i: number): Path[] {
  const rng = createRng(deriveSeed(1111, i));
  // i = 0: integer data, so the tangent samples are EXACTLY tangent.
  const O: V = i === 0 ? [0, 0] : [rng.uniform(-10, 10), rng.uniform(-10, 10)];
  const r = i === 0 ? 5 : rng.uniform(2, 12);
  const e = i === 0 ? ([1, 0] as V) : unit(rng.uniform(0, 360));
  const r2 = i === 0 ? 3 : rng.uniform(2, 12);
  const out: Path[] = [];
  for (const sign of [1, -1] as const) {
    out.push(linePath(O, r, e, false, sign), linePath(O, r, e, true, sign));
    out.push(circlesPath(O, r, r2, e, sign, false));
    if (Math.abs(r - r2) > 0.5) out.push(circlesPath(O, r, r2, e, sign, true));
    out.push(
      tangentPath(O, r, e, sign, 'tangent_point'),
      tangentPath(O, r, e, sign, 'tangent_from'),
    );
  }
  return out;
}

describe(
  `L11: continuity through tangency (${String(PATHS)} random figures, 10–12 paths each)`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('branchable tools: the selected branch, the double point in the band, Undefined beyond; no jump', () => {
      const tally: Record<string, number> = {};
      for (let i = 0; i < PATHS; i += 1) for (const p of paths(i)) checkPath(p, tally);
      process.stdout.write(
        `L11 branch: ${String(tally.paths)} paths through tangency, ${String(tally.lipschitz)} steps with |ΔV| ≤ 1.5·L·Δs, ${String(tally.nearTangency)} near-tangency steps with |ΔV| ≤ |ΔE| + h_band\n`,
      );
      expect(tally.paths).toBeGreaterThan(PATHS * 10 - 1);
    });

    it('other(): the tool and the other(P) selector move through tangency at P without a jump', () => {
      let steps = 0;
      for (let i = 0; i < PATHS; i += 1) {
        const rng = createRng(deriveSeed(2222, i));
        const O: V = i === 0 ? [0, 0] : [rng.uniform(-10, 10), rng.uniform(-10, 10)];
        const r = i === 0 ? 5 : rng.uniform(2, 12);
        const P = add(O, mul(unit(i === 0 ? 0 : rng.uniform(0, 360)), r));
        const tangentDeg = (Math.atan2(P[1] - O[1], P[0] - O[0]) * 180) / Math.PI + 90;
        const at = (deg: number, sel: boolean) =>
          evaluateAt((b) => {
            const Pr = b.add('P', pt(P));
            const c = call('circle', [pt(O), Pr]);
            const l = call('line', [Pr, pt(add(P, mul(unit(deg), 4)))]);
            const s: Selector[] = [{ kind: 'other', p: Pr }];
            b.add('X', sel ? call('intersect', [l, c], s) : call('other', [l, c, Pr]));
          });
        let prev: { deg: number; X: V } | undefined;
        const degs = [
          ...Array.from({ length: 91 }, (_, k) => tangentDeg - 45 + k),
          tangentDeg,
          tangentDeg + 1e-9,
          tangentDeg - 1e-9,
        ].sort((a, b) => a - b);
        for (const deg of degs) {
          const [tool, selected] = [at(deg, false), at(deg, true)];
          const X = resultPoint(tool.v);
          expect(X, `other() at ${String(deg)}°`).toBeDefined();
          if (X === undefined) return;
          expect(resultPoint(selected.v), 'other(P) selector = other() tool').toEqual(X);
          // The exact other point: P + chord, chord = 2·((O − P)·u)·u for the unit direction u.
          const u = unit(deg);
          const expected = add(P, mul(u, 2 * dot(sub(O, P), u)));
          expect(len(sub(X, expected))).toBeLessThan(1e-9 * tool.scale);
          if (prev !== undefined) {
            const dphi = ((deg - prev.deg) * Math.PI) / 180;
            expect(len(sub(X, prev.X))).toBeLessThanOrEqual(
              1.01 * 2 * r * dphi + 1e-9 * tool.scale,
            );
            steps += 1;
          }
          prev = { deg, X };
        }
        // At exact tangency the other point is P itself (the double point).
        const atTangency = resultPoint(at(tangentDeg, false).v);
        expect(atTangency !== undefined && len(sub(atTangency, P)) < 1e-9 * 30).toBe(true);
      }
      process.stdout.write(
        `L11 other(): ${String(steps)} steps through tangency, |ΔX| ≤ 2r·Δφ, no Undefined\n`,
      );
      expect(steps).toBeGreaterThan(PATHS * 90);
    });
  },
);
