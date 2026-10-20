/**
 * Argument plans for law L3 (Run 3a). Random inputs never satisfy an incidence (P on c),
 * and the side lengths of a random triangle are never rational, so without plans the
 * exact oracle could not compare tangent, other or the incircle family at all.
 *   - Incidence tools (tangent, other; Run 3b: tangent_point and tangent_from, whose
 *     double point P on c is then compared): a dyadic point P and curves through P built so
 *     that the float run decides "P on c" on an EXACT zero (dyadic coordinates with few
 *     bits make every product exact). A rounding residual would put the sample in the
 *     band and exclude it, so this is what lets L3 compare these tools.
 *   - Side-length tools (incenter, excenter, incircle, excircle, bisector,
 *     ext_bisector): triangles inscribed in a circle at rational points w², whose chords
 *     2·|sin(φ₁ − φ₂)| are all rational (Heronian triangles).
 *   - Circle arguments: a random circle from the circle tools.
 */
import { add, div, mul, rational, sub, type Rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { call, lit, type Expr } from '../../src/expr';
import type { Capability } from '../../src/value';
import type { Builder } from './doc';
import { FUNCTION_TOOLS, functionPlan } from './l3-plans-functions';

type XY = readonly [Rational, Rational];

/** The integer vectors of length 5: equal lengths, so their tips are concyclic. */
const LENGTH5: readonly (readonly [number, number])[] = [
  [5, 0],
  [0, 5],
  [-5, 0],
  [0, -5],
  [3, 4],
  [4, 3],
  [-3, 4],
  [-4, 3],
  [3, -4],
  [4, -3],
  [-3, -4],
  [-4, -3],
];

function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('pick from an empty list');
  return x;
}

function dyadic(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(16385) - 8192), 512n);
}

function name(b: Builder, point: boolean): string {
  const n = String(b.doc.objects.length);
  return point ? `Q_{${n}}` : `k${n}`;
}

function pointAt(b: Builder, [x, y]: XY): Expr {
  return b.add(name(b, true), call('point', [lit(x), lit(y)]));
}

function offset([x, y]: XY, k: Rational, [vx, vy]: readonly [number, number], s: 1 | -1): XY {
  return [add(x, mul(k, rational(BigInt(s * vx)))), add(y, mul(k, rational(BigInt(s * vy))))];
}

/** A curve through the dyadic point P (a ref) whose float incidence test is exactly 0. */
function curveThrough(b: Builder, rng: Rng, P: Expr, p: XY, round: boolean): Expr {
  const q = (): Expr => pointAt(b, [dyadic(rng), dyadic(rng)]);
  if (round) {
    const k = rational(BigInt(rng.nextInt(16) + 1), 4n);
    const centre = offset(p, k, pick(rng, LENGTH5), -1);
    const choices = [
      () => call('circle', [q(), P]),
      () => call('diameter_circle', [P, q()]),
      () => call('diameter_circle', [q(), P]),
      () =>
        call('circle', [pointAt(b, centre), pointAt(b, offset(centre, k, pick(rng, LENGTH5), 1))]),
    ];
    return b.add(name(b, false), pick(rng, choices)());
  }
  const tool = pick(rng, ['line', 'segment', 'ray']);
  const choices = [
    () => call(tool, [P, q()]),
    () => call(tool, [q(), P]),
    () => call(pick(rng, ['perp', 'parallel']), [P, call('line', [q(), q()])]),
  ];
  return b.add(name(b, false), pick(rng, choices)());
}

/** A rational point on the unit circle: ((1 − t²) + 2t·i) / (1 + t²). */
function unit(rng: Rng): XY {
  const t = rational(BigInt(rng.nextInt(19) - 9), BigInt(rng.nextInt(5) + 1));
  const den = add(rational(1n), mul(t, t));
  const re = sub(rational(1n), mul(t, t));
  const im = mul(rational(2n), t);
  return [div(re, den), div(im, den)];
}

/** Three vertices R·w² + centre with every side length rational. */
function heronian(b: Builder, rng: Rng): Expr[] {
  const r = rational(BigInt(rng.nextInt(12) + 1), BigInt(rng.nextInt(3) + 1));
  const centre: XY = [
    rational(BigInt(rng.nextInt(21) - 10)),
    rational(BigInt(rng.nextInt(21) - 10)),
  ];
  return [0, 1, 2].map(() => {
    const [x, y] = unit(rng);
    const [sx, sy] = [sub(mul(x, x), mul(y, y)), mul(rational(2n), mul(x, y))];
    return pointAt(b, [add(centre[0], mul(r, sx)), add(centre[1], mul(r, sy))]);
  });
}

const HERONIAN = ['incenter', 'excenter', 'incircle', 'excircle', 'bisector', 'ext_bisector'];

/** Tools planned with P exactly on their curves. */
const INCIDENCE = ['tangent', 'other', 'tangent_point', 'tangent_from'];

/**
 * The planned arguments of `tool` for the capabilities `caps`, or undefined to let the
 * sampler draw them (every tool not planned here, and half the samples of the
 * side-length tools, so their Undefined and Inexact paths are compared too).
 */
export function planArgs(
  b: Builder,
  rng: Rng,
  tool: string,
  caps: readonly Capability[],
): Expr[] | undefined {
  if (HERONIAN.includes(tool)) return rng.nextFloat() < 0.5 ? heronian(b, rng) : undefined;
  if (FUNCTION_TOOLS.includes(tool)) return functionPlan(b, rng, tool);
  if (!INCIDENCE.includes(tool)) return undefined;
  // tangent_point / tangent_from (Run 3b): half the samples random (P inside or outside:
  // Undefined in both fields), half with P exactly on c (the double point, defined).
  if (tool.startsWith('tangent_') && rng.nextFloat() < 0.5) return undefined;
  const p: XY = [dyadic(rng), dyadic(rng)];
  const P = pointAt(b, p);
  return caps.map((c) => (c === 'point' ? P : curveThrough(b, rng, P, p, c === 'round')));
}

/** A random circle argument, from the circle tools and the sampler's own points. */
export function randomCircle(b: Builder, rng: Rng, point: () => Expr, number: () => Expr): Expr {
  const choices = [
    () => call('circle', [point(), point()]),
    () => call('circle', [point(), number()]),
    () => call('circle', [point(), point(), point()]),
    () => call('diameter_circle', [point(), point()]),
    () => call('ninepoint_circle', [point(), point(), point()]),
    () => call('cline', [point(), point(), point()]),
  ];
  return b.add(name(b, false), pick(rng, choices)());
}
