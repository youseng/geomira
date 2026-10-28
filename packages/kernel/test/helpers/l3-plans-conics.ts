/**
 * Argument plans of law L3 for conics (ADR-0042): a conic is the conic through five dyadic points
 * (exact over Q, rational in floats); a point argument beside a conic is half the time a glider
 * on it (exactly on the conic over Q); a line is a chord through two gliders or the tangent at
 * one (the double point is then compared); a map is a reflection or a projective map of dyadic
 * points. circle_to_centre gets a circle of radius 5t and a point at distance 3t from its center
 * along a Pythagorean direction, so r²(r² − |OP|²) = (20t²)² is a square and the map is exact.
 */
import { add, mul, rational, type Rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { call, lit, type Expr } from '../../src/expr';
import type { Capability } from '../../src/value';
import type { Builder } from './doc';

function dyadic(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(16385) - 8192), 512n);
}

function small(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(41) - 20), BigInt(rng.nextInt(7) + 1));
}

function name(b: Builder, point: boolean): string {
  const n = String(b.doc.objects.length);
  return point ? `Q_{${n}}` : `k${n}`;
}

function point(b: Builder, rng: Rng): Expr {
  return b.add(name(b, true), call('point', [lit(dyadic(rng)), lit(dyadic(rng))]));
}

function conicArg(b: Builder, rng: Rng): Expr {
  const ps = [0, 1, 2, 3, 4].map(() => point(b, rng));
  return b.add(name(b, false), call('conic', ps));
}

function glider(b: Builder, rng: Rng, k: Expr): Expr {
  return b.add(name(b, true), call('on', [k, lit(small(rng)), lit(small(rng))]));
}

/** The planned arguments when `caps` take a conic (or for circle_to_centre), else undefined. */
export function conicPlan(
  b: Builder,
  rng: Rng,
  tool: string,
  caps: readonly Capability[],
): Expr[] | undefined {
  if (tool === 'circle_to_centre') return centrePlan(b, rng);
  if (!caps.includes('conic')) return undefined;
  const k = conicArg(b, rng);
  const onK = rng.nextFloat() < 0.5;
  return caps.map((c): Expr => {
    switch (c) {
      case 'conic':
        return k;
      case 'point':
        return onK ? glider(b, rng, k) : point(b, rng);
      case 'linear':
        return rng.nextFloat() < 0.5
          ? b.add(name(b, false), call('line', [glider(b, rng, k), glider(b, rng, k)]))
          : b.add(name(b, false), call('tangent', [glider(b, rng, k), k]));
      case 'number':
        return lit(small(rng));
      case 'transform':
        return rng.nextFloat() < 0.5
          ? call('reflect', [call('line', [point(b, rng), point(b, rng)])])
          : call(
              'projective',
              Array.from({ length: 8 }, () => point(b, rng)),
            );
      case 'curve':
      case 'round':
      case 'polygon':
      case 'annotation':
      case 'string':
      case 'ideal':
      case 'ppoint':
        // No conic overload takes these beside a conic: a point (both fields reject the call).
        return point(b, rng);
    }
  });
}

const PYTHAGOREAN: readonly (readonly [number, number])[] = [
  [3, 4],
  [4, -3],
  [-3, -4],
  [5, 0],
  [0, -5],
];

function centrePlan(b: Builder, rng: Rng): Expr[] {
  const t = BigInt(rng.nextInt(8) + 1);
  const [ox, oy] = [dyadic(rng), dyadic(rng)];
  const O = b.add(name(b, true), call('point', [lit(ox), lit(oy)]));
  const c = b.add(name(b, false), call('circle', [O, lit(rational(5n * t))]));
  const [vx, vy] = PYTHAGOREAN[rng.nextInt(PYTHAGOREAN.length)] ?? [5, 0];
  // |(vx, vy)| = 5, so O + (3t/5)·(vx, vy) is at distance 3t from O.
  const k = rational(3n * t, 5n);
  const px = add(ox, mul(k, rational(BigInt(vx))));
  const py = add(oy, mul(k, rational(BigInt(vy))));
  const P = b.add(name(b, true), call('point', [lit(px), lit(py)]));
  return [c, P];
}
