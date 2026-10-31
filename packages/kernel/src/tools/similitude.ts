/**
 * The centres of similitude of two circles (ADR-0045): exsimilicenter(c1, c2), the centre of the
 * homothety of positive ratio r₂/r₁ that maps c1 to c2, and insimilicenter(c1, c2), the centre of
 * the one of negative ratio −r₂/r₁:
 *     E = (r₂·O₁ − r₁·O₂)/(r₂ − r₁),   I = (r₂·O₁ + r₁·O₂)/(r₂ + r₁).
 * Both formulas are symmetric in the two circles (the same value, bit for bit, in either order).
 * Circles store r², so the radii are rational only when r² is the square of a rational: exact over
 * Q then, else Inexact; mod p there are no square roots (always Inexact), except equal radii
 * (r₁² = r₂² exactly), where no root is needed: E is the point at infinity of the direction O₁O₂
 * (ADR-0040) and I the midpoint of O₁O₂. The centres are taken of the carrier circles (an arc's
 * circle), as radical_axis does. Concentric circles → Undefined (both), as the maintainer's
 * request decides (ADR-0045, Uncertain: the limit would be the common centre).
 */
import { inexact, isInexact, type Field, type Inexact } from '@geomira/num/field';
import { half, isZeroVec, vAdd, vScale, vSub } from '../geom';
import { rootGap } from '../incidence';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { pointOf, undef, type Circle, type Undefined, type Value, type Vec } from '../value';
import { badArgs, circleAt, degenerateCircle } from './args';

type Which = 'exsimilicenter' | 'insimilicenter';

/** The two circles, or why they have no centre of similitude. */
function circlesOf<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  tool: Which,
): readonly [Circle<T>, Circle<T>] | Undefined {
  const [c1, c2] = [circleAt(args, 0), circleAt(args, 1)];
  if (c1 === undefined || c2 === undefined || args.length !== 2) return badArgs(tool);
  const bad = degenerateCircle(F, c1, ctx) ?? degenerateCircle(F, c2, ctx);
  if (bad !== undefined) return bad;
  if (isZeroVec(F, vSub(F, c2.c, c1.c), ctx)) return undef('concentric circles');
  return [c1, c2];
}

/** (r₂·O₁ ± r₁·O₂)/(r₂ ± r₁) for rational (representable) radii, or the Inexact root. */
function weighted<T>(F: Field<T>, c1: Circle<T>, c2: Circle<T>, sign: 1 | -1): Vec<T> | Inexact {
  const [r1, r2] = [F.sqrt(c1.r2), F.sqrt(c2.r2)];
  if (isInexact(r1)) return r1;
  if (isInexact(r2)) return r2;
  const k = sign === 1 ? r1 : F.neg(r1);
  const num = vAdd(F, vScale(F, c1.c, r2), vScale(F, c2.c, k));
  return vScale(F, num, F.div(F.one, F.add(r2, k)));
}

/**
 * The direction w or −w, whichever has its first non-zero coordinate positive (exact comparisons:
 * both represent the same point at infinity, so this is a choice of representative, not a
 * decision), so exsimilicenter(c1, c2) and exsimilicenter(c2, c1) are the same value. Mod p (no
 * order, so no representative both orders agree on) → Inexact.
 */
function canonical<T>(F: Field<T>, w: Vec<T>): Vec<T> | Inexact {
  if (F.kind === 'modp')
    return inexact('the point at infinity of O₁O₂: choosing its representative needs an order');
  const [x, y] = [F.toNumber(w.x), F.toNumber(w.y)];
  return x < 0 || (x === 0 && y < 0) ? { x: F.neg(w.x), y: F.neg(w.y) } : w;
}

/**
 * The exsimilicenter. Degenerate cases: concentric circles (equal ones included) → Undefined;
 * equal radii (r₁ − r₂ zero as a length; exact fields: r₁² = r₂²) → the point at infinity of the
 * direction O₁O₂ (mod p Inexact: canonical); radii within the band of equal → Undefined (ambiguous: near infinity); radii
 * not rational → Inexact over Q, always mod p; a circle with no positive radius → Undefined.
 */
function exsimilicenter<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const cs = circlesOf(F, args, ctx, 'exsimilicenter');
  if ('kind' in cs) return cs;
  const [c1, c2] = cs;
  const d = canonical(F, vSub(F, c2.c, c1.c));
  const ideal: Value<T> = isInexact(d) ? d : { kind: 'ideal_point', d, chiral: false };
  if (F.eq(c1.r2, c2.r2)) return ideal;
  const s = F.sign(rootGap(F, c1.r2, c2.r2), 'length', ctx);
  if (s === 0) return ideal;
  if (s === 'ambiguous')
    return undef(
      'ambiguous: the radii are within the band of equal (the exsimilicenter is near infinity)',
    );
  const E = weighted(F, c1, c2, -1);
  return isInexact(E) ? E : pointOf(E.x, E.y);
}

/**
 * The insimilicenter. Degenerate cases: concentric circles (equal ones included) → Undefined;
 * equal radii (exactly) → the midpoint of O₁O₂, exact in every field; radii not rational →
 * Inexact over Q, always mod p; a circle with no positive radius → Undefined.
 */
function insimilicenter<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const cs = circlesOf(F, args, ctx, 'insimilicenter');
  if ('kind' in cs) return cs;
  const [c1, c2] = cs;
  if (F.kind !== 'float' && F.eq(c1.r2, c2.r2)) {
    const M = vScale(F, vAdd(F, c1.c, c2.c), half(F));
    return pointOf(M.x, M.y);
  }
  const I = weighted(F, c1, c2, 1);
  return isInexact(I) ? I : pointOf(I.x, I.y);
}

const C1: ExampleArg = { call: 'circle', args: [['0', '0'], '1'] };
const C2: ExampleArg = { call: 'circle', args: [['6', '0'], '2'] };
const C3: ExampleArg = {
  call: 'circle',
  args: [
    ['6', '0'],
    ['7', '1'],
  ],
};

const COMMON = [
  'concentric circles (equal ones included) → Undefined',
  'radii not rational → Inexact over Q; always Inexact mod p (equal radii need no root)',
  'a circle with no positive radius → Undefined',
];

export const SIMILITUDE_TOOLS: readonly ToolSpec[] = [
  {
    id: 'exsimilicenter',
    name: 'exsimilicenter',
    family: 'points',
    signatures: [
      {
        params: ['round', 'round'],
        output: ['point', 'ideal_point'],
        radical: true,
        symmetry: [{ kind: 'permute', positions: [0, 1], same: 'value' }],
      },
    ],
    outputKinds: ['point', 'ideal_point'],
    compute: exsimilicenter,
    degenerate: [
      ...COMMON,
      'equal radii → the point at infinity of the direction O₁O₂ (ADR-0040)',
      'radii within the band of equal → Undefined (ambiguous: near infinity)',
    ],
    export: 'numeric',
    doc: 'exsimilicenter(c1, c2): the external centre of similitude (r₂·O₁ − r₁·O₂)/(r₂ − r₁), the centre of the homothety of ratio r₂/r₁ taking c1 to c2; the external common tangents pass through it. Equal radii: the point at infinity of O₁O₂. Exact over Q when the radii are rational.',
    examples: [{ args: [C1, C2] }, { args: [C1, { call: 'circle', args: [['5', '0'], '1'] }] }],
  },
  {
    id: 'insimilicenter',
    name: 'insimilicenter',
    family: 'points',
    signatures: [
      {
        params: ['round', 'round'],
        output: ['point'],
        radical: true,
        symmetry: [{ kind: 'permute', positions: [0, 1], same: 'value' }],
      },
    ],
    outputKinds: ['point'],
    compute: insimilicenter,
    degenerate: [...COMMON, 'equal radii → the midpoint of O₁O₂, exact in every field'],
    export: 'numeric',
    doc: 'insimilicenter(c1, c2): the internal centre of similitude (r₂·O₁ + r₁·O₂)/(r₂ + r₁), the centre of the homothety of ratio −r₂/r₁ taking c1 to c2; the internal common tangents pass through it. Exact over Q when the radii are rational.',
    examples: [{ args: [C1, C2] }, { args: [C1, C3] }],
  },
];
