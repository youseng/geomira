/**
 * Undirected linear forms at the ends of θ's range (pre-beta review, ADR-0027): α + β = 0°
 * and α + β = 360°, α − β = 180° and α − β = −180° agree mod 360° but are different claims.
 * A false one was reported true over Q and by the float residual (folded mod 360°).
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { evalClaim } from '../src/eval-claim';
import type { ClaimKindSpec } from '../src/kind';
import { claimKind } from '../src/kinds';
import { Figure, n, REGISTRY } from './helpers/build';
import { lit, pt, type Xy } from './helpers/values';

/** A = (0, 0), B = (4, 0), M their midpoint: ∠ABM = 0°, ∠AMB = 180°. */
function flat(): Figure {
  return new Figure().point('A', 0, 0).point('B', 4, 0).def('M', 'midpoint', 'A', 'B');
}

function verdict(kind: string, a: readonly string[], b: readonly string[], theta: number) {
  const f = flat();
  const id = f.claim(kind, ...a, ...b, n(theta));
  return evalClaim(f.doc, id, REGISTRY);
}

const ZERO = ['A', 'B', 'M'] as const;
const HALF = ['A', 'M', 'B'] as const;
const TRUE_Q = { value: 'true', rung: 'exact over Q' };
const FALSE_Q = { value: 'false', rung: 'exact over Q' };

describe('undirected angle forms are not taken mod 360°', () => {
  it('angle_diff: 0° − 180° is −180°, never 180°', () => {
    expect(verdict('angle_diff', ZERO, HALF, 180)).toMatchObject(FALSE_Q);
    expect(verdict('angle_diff', ZERO, HALF, -180)).toMatchObject(TRUE_Q);
    expect(verdict('angle_diff', HALF, ZERO, 180)).toMatchObject(TRUE_Q);
    expect(verdict('angle_diff', HALF, ZERO, -180)).toMatchObject(FALSE_Q);
  });

  it('angle_sum: 180° + 180° is 360°, never 0°; 0° + 0° is 0°, never 360°', () => {
    expect(verdict('angle_sum', HALF, HALF, 0)).toMatchObject(FALSE_Q);
    expect(verdict('angle_sum', HALF, HALF, 360)).toMatchObject(TRUE_Q);
    expect(verdict('angle_sum', ZERO, ZERO, 360)).toMatchObject(FALSE_Q);
    expect(verdict('angle_sum', ZERO, ZERO, 0)).toMatchObject(TRUE_Q);
  });

  it('the float residual is |α + σβ − θ| in radians, not folded mod 2π', () => {
    const k: ClaimKindSpec | undefined = claimKind('angle_sum');
    const d: ClaimKindSpec | undefined = claimKind('angle_diff');
    if (k === undefined || d === undefined) throw new Error('kinds');
    const P = (...xs: Xy[]) => xs.map((x) => pt(FloatField, x));
    const half = P([0, 0], [2, 0], [4, 0]);
    const zero = P([0, 0], [4, 0], [2, 0]);
    const S = { scale: 4 };
    expect(k.residual([...half, ...half, lit(FloatField, 0)], S)).toBeCloseTo(2 * Math.PI, 12);
    expect(k.residual([...half, ...half, lit(FloatField, 360)], S)).toBeCloseTo(0, 12);
    expect(d.residual([...zero, ...half, lit(FloatField, 180)], S)).toBeCloseTo(2 * Math.PI, 12);
    expect(d.residual([...zero, ...half, lit(FloatField, -180)], S)).toBeCloseTo(0, 12);
  });

  it('away from the ends nothing changes: ∠BAC + ∠ABC + ∠BCA = 180° style forms still hold', () => {
    const f = new Figure().point('A', 1, 3).point('B', 0, 0).point('C', 4, 0);
    f.def('H', 'orthocenter', 'A', 'B', 'C');
    const id = f.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180));
    expect(evalClaim(f.doc, id, REGISTRY)).toMatchObject(TRUE_Q);
  });
});
