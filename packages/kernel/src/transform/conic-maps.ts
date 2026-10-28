/**
 * Projective maps for conics (ADR-0042), as derived layers' maps (no projective mode):
 *   - conic_to_circle(k): a projective map sending k to a circle. Normalisation: with A the
 *     known point of k and g = ∇Q(A)/2 (normal form), in the conformal frame
 *     X = A + x·rot90(e) + y·e, e = g/|g|², k is αx² + 2βxy + γy² + 2y = 0, and
 *     (x : y : z) ↦ (x + (β/α)y : y : (y − (2/α)·(z + (δ′/2)·y))/4), δ′ = γ − β²/α,
 *     sends it to x² + y² − 4y = 0. So the map fixes A and the tangent of k at A, and the image
 *     is the circle tangent to k at A with center A + 2e and radius 2/|g|; for a conic that is a
 *     circle it is the identity. Rational: exact over Q and mod p.
 *   - circle_to_centre(c, P): the projective map keeping c and sending P (inside c) to its
 *     center O: the hyperbolic translation of the Klein model along OP (a Lorentz boost, scaled
 *     to a matrix without square roots but one): with w = P − O, R = r², σ = √(R·(R − |w|²)),
 *     in coordinates X − O: X ↦ (σX + R·w·(w·X)/(R + σ) − R·w : −w·X + R). It keeps line OP and
 *     the two points where it meets c; P = O gives the identity. Radical (σ): exact over Q only
 *     when R·(R − |w|²) is a rational square.
 */
import { isInexact, type Field } from '@geomira/num/field';
import { coeffsOf, conicProblem, halfGradient, qDirection } from '../conic';
import { circleGap } from '../incidence';
import { vDot, vRot90, vScale } from '../geom';
import type { EvalContext, ExampleArg, Signature, ToolSpec } from '../tool';
import { undef, type Value, type ValueKind } from '../value';
import { badArgs, circleAt, conicAt, degenerateCircle, pointAt } from '../tools/args';
import { ELLIPSE } from '../tools/conics';
import { mapProblem } from './mobius';
import { adj3, mul3, projective, type Mat3 } from './projective';

/**
 * conic_to_circle(k). Degenerate cases: an invalid conic → Undefined; a conic without a known
 * point → Undefined.
 */
function conicToCircle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const k = conicAt(args, 0);
  if (k === undefined || args.length !== 1) return badArgs('conic_to_circle');
  const bad = conicProblem(F, k, ctx);
  if (bad !== undefined) return bad;
  const A = k.anchor;
  if (A === undefined) return undef('conic_to_circle(k): the conic has no known point');
  const q = coeffsOf(k);
  const g = halfGradient(F, q, A);
  const gg = vDot(F, g, g);
  if (F.eq(gg, F.zero)) return undef('conic_to_circle(k): the known point is the center');
  const e = vScale(F, g, F.div(F.one, gg));
  const t = vRot90(F, e);
  const alpha = qDirection(F, q, t);
  if (F.eq(alpha, F.zero)) return undef('conic_to_circle(k): the conic is degenerate');
  const sum = { x: F.add(t.x, e.x), y: F.add(t.y, e.y) };
  // β = tᵀM₂e from the quadratic part's polarisation: (Q₂(t + e) − Q₂(t) − Q₂(e))/2.
  const gamma = qDirection(F, q, e);
  const two = F.add(F.one, F.one);
  const beta = F.div(F.sub(F.sub(qDirection(F, q, sum), alpha), gamma), two);
  const dp = F.sub(gamma, F.div(F.mul(beta, beta), alpha));
  const four = F.mul(two, two);
  const z = F.zero;
  const n: Mat3<T> = [
    F.one,
    F.div(beta, alpha),
    z,
    z,
    F.one,
    z,
    z,
    F.div(F.sub(F.one, F.div(dp, alpha)), four),
    F.neg(F.div(F.one, F.mul(two, alpha))),
  ];
  const s: Mat3<T> = [t.x, e.x, A.x, t.y, e.y, A.y, z, z, F.one];
  const m = mul3(F, mul3(F, s, n), adj3(F, s));
  const map = projective(m);
  return mapProblem(F, map, 'conic_to_circle') ?? { kind: 'transform', t: map };
}

/**
 * circle_to_centre(c, P). Degenerate cases: P on c (the gap |OP| − r within the band) →
 * Undefined; P outside c → Undefined (no projective map keeping c sends it to the center); mod p
 * (no order) → Inexact; σ not representable → Inexact.
 */
function circleToCentre<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [c, P] = [circleAt(args, 0), pointAt(args, 1)];
  if (c === undefined || P === undefined || args.length !== 2) return badArgs('circle_to_centre');
  const bad = degenerateCircle(F, c, ctx);
  if (bad !== undefined) return bad;
  const side = F.sign(circleGap(F, P, c), 'length', ctx);
  if (side === 'none')
    return {
      kind: 'inexact',
      reason: `circle_to_centre: inside c needs an order, which ${F.name} lacks`,
    };
  if (side === 0) return undef('circle_to_centre(c, P): P lies on c');
  if (side === 'ambiguous') return undef('ambiguous: P is within the band of c');
  if (side === 1)
    return undef(
      'circle_to_centre(c, P): P lies outside c: no projective map keeping c sends it to the center',
    );
  const R = c.r2;
  const w = { x: F.sub(P.x, c.c.x), y: F.sub(P.y, c.c.y) };
  const sigma = F.sqrt(F.mul(R, F.sub(R, vDot(F, w, w))));
  if (isInexact(sigma)) return sigma;
  const k = F.div(R, F.add(R, sigma));
  const m0: Mat3<T> = [
    F.add(sigma, F.mul(k, F.mul(w.x, w.x))),
    F.mul(k, F.mul(w.x, w.y)),
    F.neg(F.mul(R, w.x)),
    F.mul(k, F.mul(w.x, w.y)),
    F.add(sigma, F.mul(k, F.mul(w.y, w.y))),
    F.neg(F.mul(R, w.y)),
    F.neg(w.x),
    F.neg(w.y),
    R,
  ];
  const [O, z] = [c.c, F.zero];
  const to: Mat3<T> = [F.one, z, O.x, z, F.one, O.y, z, z, F.one];
  const from: Mat3<T> = [F.one, z, F.neg(O.x), z, F.one, F.neg(O.y), z, z, F.one];
  const map = projective(mul3(F, mul3(F, to, m0), from));
  return mapProblem(F, map, 'circle_to_centre') ?? { kind: 'transform', t: map };
}

const PROJECTIVE_OUT: readonly ValueKind[] = ['transform', 'projective'];

const CONIC_TO_CIRCLE: Signature = { params: ['conic'], output: PROJECTIVE_OUT, symmetry: [] };
const CIRCLE_TO_CENTRE: Signature = {
  params: ['round', 'point'],
  output: PROJECTIVE_OUT,
  symmetry: [],
  radical: true,
};

const C5: ExampleArg = {
  call: 'circle',
  args: [
    ['0', '0'],
    ['5', '0'],
  ],
};

export const CONIC_MAP_TOOLS: readonly ToolSpec[] = [
  {
    id: 'conic_to_circle',
    name: 'conic_to_circle',
    family: 'transformations',
    signatures: [CONIC_TO_CIRCLE],
    outputKinds: ['transform'],
    compute: conicToCircle,
    degenerate: ['a conic without a known point → Undefined', 'a circle as a conic → the identity'],
    export: 'numeric',
    doc:
      'conic_to_circle(k): a projective map sending the conic k to a circle. It fixes the known ' +
      'point A of k and the tangent there; the image is the circle tangent to k at A with center ' +
      'A + 2g/|g|² and radius 2/|g| (g = ∇Q(A)/2, normal form); for a circle it is the identity. ' +
      'Use it as `@layer c = image(f, main)` with f = conic_to_circle(k). Exact.',
    examples: [{ args: [ELLIPSE] }],
  },
  {
    id: 'circle_to_centre',
    name: 'circle_to_centre',
    family: 'transformations',
    signatures: [CIRCLE_TO_CENTRE],
    outputKinds: ['transform'],
    compute: circleToCentre,
    degenerate: [
      'P on c → Undefined',
      'P within the band of c → Undefined (ambiguous)',
      'P outside c → Undefined',
      'P = the center → the identity',
      'the square root not representable → Inexact over Q and mod p',
    ],
    export: 'numeric',
    doc:
      'circle_to_centre(c, P): the projective map keeping the circle c and sending the point P ' +
      'inside it to its center (the hyperbolic translation along OP of the Klein model). It ' +
      'needs √(r²(r² − |OP|²)): exact over Q only when that is rational.',
    examples: [{ args: [C5, ['3', '0']] }, { args: [C5, ['1', '2']] }],
  },
];
