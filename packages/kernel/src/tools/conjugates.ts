/**
 * v1.1 tools (SPEC §6.2, Run 13, ADR-0031): isogonal(P, A, B, C), symmedian(A, B, C) and
 * spiral_center(A, B, C, D). Each is rational in its arguments (no square root), so exact
 * over Q and mod p.
 */
import type { Field } from '@geomira/num/field';
import { isZeroVec, vAdd, vCross, vDot, vScale, vSub } from '../geom';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { pointOf, undef, type Value, type Vec } from '../value';
import { badArgs, pointsOf } from './args';
import { circumcenterOf, triangle } from './triangle';

/** |X − Y|². */
function d2<T>(F: Field<T>, X: Vec<T>, Y: Vec<T>): T {
  const w = vSub(F, X, Y);
  return vDot(F, w, w);
}

/**
 * The isogonal conjugate of P in triangle ABC. With the signed areas u = [PBC], v = [PCA],
 * w = [PAB] (barycentrics of P, times 2·[ABC]), the conjugate is (a²vw : b²wu : c²uv), i.e.
 *   X = A + (b²wu·(B − A) + c²uv·(C − A)) / S,  S = a²vw + b²wu + c²uv = −(2[ABC])²·pow(P),
 * pow(P) the power of P with respect to the circumcircle, so S = 0 exactly when P is on the
 * circumcircle (its conjugate is at infinity). Degenerate cases:
 * coincident vertices → Undefined; collinear vertices → Undefined; P a vertex → Undefined;
 * P on the circumcircle → Undefined; P on a side line (not a vertex) → the opposite vertex.
 */
function isogonal<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [P, A, B, C] = pointsOf(args, 4) ?? [];
  if (P === undefined || A === undefined || B === undefined || C === undefined)
    return badArgs('isogonal');
  const t = triangle(F, [A, B, C], ctx, 'isogonal');
  if ('kind' in t) return t;
  if ([A, B, C].some((V) => isZeroVec(F, vSub(F, P, V), ctx)))
    return undef('P is a vertex: its isogonal conjugate is not defined');
  // u = [PBC] as cross(B − P, C − B): no cancellation when P is far from the triangle.
  const [ab, bc, ca] = [vSub(F, B, A), vSub(F, C, B), vSub(F, A, C)];
  const u = vCross(F, vSub(F, B, P), bc);
  const v = vCross(F, vSub(F, C, P), ca);
  const w = vCross(F, vSub(F, A, P), ab);
  const [b2, c2] = [vDot(F, ca, ca), vDot(F, ab, ab)];
  const [wu, uv] = [F.mul(b2, F.mul(w, u)), F.mul(c2, F.mul(u, v))];
  // S = a²vw + b²wu + c²uv = −(2[ABC])²·pow(P), pow(P) = |P − O|² − R² (O the circumcenter):
  // the sum cancels badly for a flat triangle, the power does not.
  const O = circumcenterOf(F, t);
  const pow = F.sub(d2(F, P, O), d2(F, A, O));
  if (F.isZero(pow, 'area', ctx))
    return undef('P is on the circumcircle: its isogonal conjugate is at infinity');
  const S = F.neg(F.mul(F.mul(t.cross, t.cross), pow));
  const X = vAdd(F, A, vScale(F, vAdd(F, vScale(F, t.u, wu), vScale(F, t.v, uv)), F.div(F.one, S)));
  return pointOf(X.x, X.y);
}

/**
 * The symmedian of triangle ABC from A: the line through A and D on BC with
 * BD : DC = AB² : AC², D = (b²·B + c²·C) / (b² + c²) (b = CA, c = AB); the reflection of the
 * median from A in the bisector at A. Achiral (a direction from two points). Degenerate
 * cases: coincident vertices → Undefined; collinear vertices → Undefined.
 */
function symmedian<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const t = triangle(F, args, ctx, 'symmedian');
  if ('kind' in t) return t;
  const [b2, c2] = [vDot(F, t.v, t.v), vDot(F, t.u, t.u)];
  const sum = vAdd(F, vScale(F, t.u, b2), vScale(F, t.v, c2));
  const d = vScale(F, sum, F.div(F.one, F.add(b2, c2)));
  return { kind: 'line', p: { x: t.a.x, y: t.a.y }, d, lo: null, hi: null, chiral: false };
}

/**
 * The center O of the spiral similarity taking A to C and B to D (spiral(A, B, C, D)):
 * C − O = k(A − O) and D − O = k(B − O) give O(A + D − B − C) = AD − BC in complex numbers,
 * so, relative to A (b = B − A, c = C − A, d = D − A), O = A − b·c / (d − b − c). The formula
 * is symmetric in B ↔ C and in A ↔ D: O is also the center of the spiral similarity taking
 * A to B and C to D. Degenerate cases: D − C = B − A (the map is a translation, equal
 * points included) → Undefined; two points of a pair (A, B), (C, D), (A, C) or (B, D)
 * coincide → that point (the other map of the two fixes it).
 */
function spiralCenter<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [A, B, C, D] = pointsOf(args, 4) ?? [];
  if (A === undefined || B === undefined || C === undefined || D === undefined)
    return badArgs('spiral_center');
  const [b, c, d] = [vSub(F, B, A), vSub(F, C, A), vSub(F, D, A)];
  const den = vSub(F, vSub(F, d, b), c);
  if (isZeroVec(F, den, ctx))
    return undef('the spiral similarity is a translation (D − C = B − A): it has no center');
  const bc = {
    x: F.sub(F.mul(b.x, c.x), F.mul(b.y, c.y)),
    y: F.add(F.mul(b.x, c.y), F.mul(b.y, c.x)),
  };
  const nn = vDot(F, den, den);
  // bc / den = bc · conj(den) / |den|².
  const q = {
    x: F.div(F.add(F.mul(bc.x, den.x), F.mul(bc.y, den.y)), nn),
    y: F.div(F.sub(F.mul(bc.y, den.x), F.mul(bc.x, den.y)), nn),
  };
  const O = vSub(F, A, q);
  return pointOf(O.x, O.y);
}

const A: ExampleArg = ['0', '0'];
const B: ExampleArg = ['4', '0'];
const C: ExampleArg = ['1', '3'];

export const CONJUGATE_TOOLS: readonly ToolSpec[] = [
  {
    id: 'spiral_center',
    name: 'spiral_center',
    family: 'points',
    signatures: [
      {
        params: ['point', 'point', 'point', 'point'],
        symmetry: [
          { kind: 'permute', positions: [1, 2], same: 'value' },
          { kind: 'permute', positions: [0, 3], same: 'value' },
        ],
      },
    ],
    outputKinds: ['point'],
    compute: spiralCenter,
    degenerate: [
      'D − C = B − A (a translation; four equal points included) → Undefined',
      'A = B, C = D, A = C or B = D → that point',
    ],
    export: 'numeric',
    doc: 'spiral_center(A, B, C, D): the center of the spiral similarity taking A to C and B to D (the fixed point of spiral(A, B, C, D)); also the center of the one taking A to B and C to D; exact.',
    examples: [{ args: [A, B, ['1', '1'], ['3', '3']] }],
  },
  {
    id: 'isogonal',
    name: 'isogonal',
    family: 'points',
    signatures: [
      {
        params: ['point', 'point', 'point', 'point'],
        symmetry: [{ kind: 'permute', positions: [1, 2, 3], same: 'value' }],
      },
    ],
    outputKinds: ['point'],
    compute: isogonal,
    degenerate: [
      'coincident vertices → Undefined',
      'collinear vertices → Undefined',
      'P a vertex → Undefined',
      'P on the circumcircle → Undefined (the conjugate is at infinity)',
      'P on a side line (not a vertex) → the opposite vertex',
    ],
    export: 'numeric',
    doc: 'isogonal(P, A, B, C): the isogonal conjugate of P in triangle ABC (the reflections of AP, BP, CP in the bisectors at A, B, C meet there); (a²vw : b²wu : c²uv) in barycentrics; exact.',
    examples: [{ args: [['2', '1'], A, B, C] }, { args: [['1', '1'], A, B, C] }],
  },
  {
    id: 'symmedian',
    name: 'symmedian',
    family: 'lines',
    signatures: [
      {
        params: ['point', 'point', 'point'],
        symmetry: [{ kind: 'permute', positions: [1, 2], same: 'value' }],
      },
    ],
    outputKinds: ['line'],
    compute: symmedian,
    degenerate: ['coincident vertices → Undefined', 'collinear vertices → Undefined'],
    export: 'numeric',
    doc: 'symmedian(A, B, C): the symmedian of triangle ABC from A (the median from A reflected in the bisector at A): the line from A to D on BC with BD : DC = AB² : AC²; achiral; exact. The symmedian point is isogonal(centroid(A, B, C), A, B, C).',
    examples: [{ args: [A, B, C] }],
  },
];
