/**
 * Argument plans of law L3 for sqrt, sin, cos and tan (ADR-0005). A random literal is
 * rarely a rational square or a special angle, and a literal carries its exact value, so
 * both fields would decide it exactly. The plans add:
 *   - exact literals that hit the exact cases (k²/m², ±; multiples of 15°, incl. 90° mod
 *     180° for tan);
 *   - numbers WITHOUT an exact value, from measures on dyadic points, so the float run
 *     decides with its own (banded) sign and is compared with the exact run: area², −area²,
 *     area² − area² (exactly 0), dist² along Pythagorean directions, and angles between
 *     axis or diagonal directions (exact multiples of 45° in both fields), also shifted by
 *     literal multiples of 15°.
 * Half the samples (and every other tool) are left to the sampler's own draws.
 */
import { rational, type Rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { call, lit, type Expr } from '../../src/expr';
import type { Builder } from './doc';

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const PYTHAGOREAN: readonly (readonly [number, number])[] = [
  [3, 4],
  [-5, 12],
  [8, -15],
  [-7, -24],
];

export const FUNCTION_TOOLS = ['sqrt', 'sin', 'cos', 'tan'];

function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('pick from an empty list');
  return x;
}

function dyadic(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(16385) - 8192), 512n);
}

class Plan {
  constructor(
    private readonly b: Builder,
    private readonly rng: Rng,
  ) {}

  private point(x: Rational, y: Rational): Expr {
    return this.b.add(`F_{${String(this.b.doc.objects.length)}}`, call('point', [lit(x), lit(y)]));
  }

  /** P + k·v for a dyadic P, a small integer k and an integer direction v. */
  private offset(P: readonly [Rational, Rational], v: readonly [number, number]): Expr {
    const k = BigInt(this.rng.nextInt(12) + 1);
    const [x, y] = P;
    return this.point(
      rational(x.num + k * BigInt(v[0]) * x.den, x.den),
      rational(y.num + k * BigInt(v[1]) * y.den, y.den),
    );
  }

  /** An area of a dyadic triangle: a rational with no exact value attached. */
  area(): Expr {
    const p = (): Expr => this.point(dyadic(this.rng), dyadic(this.rng));
    return call('area', [p(), p(), p()]);
  }

  /** dist² of two points along a Pythagorean direction: a rational square, no exact value. */
  distSquared(): Expr {
    const P = [dyadic(this.rng), dyadic(this.rng)] as const;
    const d = call('dist', [this.point(...P), this.offset(P, pick(this.rng, PYTHAGOREAN))]);
    return call('mul', [d, d]);
  }

  /** The angle between two axis or diagonal directions at a dyadic vertex (k·45°). */
  angle(): Expr {
    const Q = [dyadic(this.rng), dyadic(this.rng)] as const;
    const [a, b] = [pick(this.rng, DIRS), pick(this.rng, DIRS)];
    const tool = this.rng.nextFloat() < 0.5 ? 'angle' : 'dangle';
    return call(tool, [this.offset(Q, a), this.point(...Q), this.offset(Q, b)]);
  }

  literal15(): Expr {
    return lit(rational(BigInt(15 * (this.rng.nextInt(61) - 30))));
  }

  square(): Expr {
    const k = BigInt(this.rng.nextInt(25) - 12);
    const m = BigInt(this.rng.nextInt(6) + 1);
    const sign = this.rng.nextFloat() < 0.3 ? -1n : 1n;
    return lit(rational(sign * k * k, m * m));
  }
}

function sqrtArg(p: Plan, rng: Rng): Expr {
  const a = p.area();
  const choices = [
    () => p.square(),
    () => call('mul', [a, a]),
    () => call('neg', [call('mul', [a, a])]),
    () => call('sub', [call('mul', [a, a]), call('mul', [a, a])]),
    () => p.distSquared(),
    () => call('neg', [p.distSquared()]),
    () => p.area(),
  ];
  return pick(rng, choices)();
}

function angleArg(p: Plan, rng: Rng): Expr {
  const choices = [
    () => p.literal15(),
    () => p.angle(),
    () => call('add', [p.angle(), p.literal15()]),
    () => call('mul', [lit(rational(BigInt(rng.nextInt(5) - 2))), p.angle()]),
  ];
  return pick(rng, choices)();
}

/** The planned argument of sqrt/sin/cos/tan, or undefined (half the time) to let L3 draw. */
export function functionPlan(b: Builder, rng: Rng, tool: string): Expr[] | undefined {
  if (rng.nextFloat() < 0.5) return undefined;
  const p = new Plan(b, rng);
  return [tool === 'sqrt' ? sqrtArg(p, rng) : angleArg(p, rng)];
}
