/**
 * The construction facts of the registry's tools (ADR-0035): what a call's result has by
 * definition, as claim templates over the call (`Signature.guarantees`). Each list is the data
 * of the overloads that name it; nothing here enumerates tools (the tool files attach them).
 * packages/discovery reads them to tell a finding from a fact that holds by construction, and
 * checks every one of them on registry-built figures (a wrong guarantee would hide a fact).
 * Terms: 'result', an argument position (0-based), a nested call, an exact literal.
 */
import { fits, type ArgKinds } from './kinds';
import type { Guarantee, GuaranteeTerm, Signature, ToolSpec } from './tool';

const R = 'result';
const ONE: GuaranteeTerm = { lit: '1' };

function g(claim: string, ...args: GuaranteeTerm[]): Guarantee {
  return { claim, args };
}

function t(tool: string, ...args: GuaranteeTerm[]): GuaranteeTerm {
  return { tool, args };
}

/** The result lies on both curves (intersect, other). */
export const ON_BOTH: readonly Guarantee[] = [g('on', R, 0), g('on', R, 1)];

/** A glider lies on its curve. */
export const ON_FIRST: readonly Guarantee[] = [g('on', R, 0)];

const TWO: GuaranteeTerm = { lit: '2' };

export const MIDPOINT: readonly Guarantee[] = [
  g('collinear', R, 0, 1),
  g('length', 0, R, R, 1, ONE),
  g('length', 0, 1, 0, R, TWO),
  g('length', 0, 1, R, 1, TWO),
];

export const DIVIDE: readonly Guarantee[] = [g('collinear', R, 0, 1)];

export const FOOT_LINE: readonly Guarantee[] = [
  g('on', R, 1),
  g('perpendicular', t('line', 0, R), 1),
];

export const FOOT_POINTS: readonly Guarantee[] = [
  g('collinear', R, 1, 2),
  g('perpendicular', t('line', 0, R), t('line', 1, 2)),
];

export const CIRCUMCENTER: readonly Guarantee[] = [
  g('length', R, 0, R, 1, ONE),
  g('length', R, 1, R, 2, ONE),
  g('length', R, 0, R, 2, ONE),
  g('on', R, t('perp_bisector', 0, 1)),
  g('on', R, t('perp_bisector', 1, 2)),
  g('on', R, t('perp_bisector', 2, 0)),
];

export const CENTROID: readonly Guarantee[] = [
  g('collinear', 0, R, t('midpoint', 1, 2)),
  g('collinear', 1, R, t('midpoint', 2, 0)),
  g('collinear', 2, R, t('midpoint', 0, 1)),
];

export const ORTHOCENTER: readonly Guarantee[] = [
  g('perpendicular', t('line', 0, R), t('line', 1, 2)),
  g('perpendicular', t('line', 1, R), t('line', 2, 0)),
  g('perpendicular', t('line', 2, R), t('line', 0, 1)),
];

export const NINEPOINT_CENTER: readonly Guarantee[] = [
  g('equal', R, t('midpoint', t('circumcenter', 0, 1, 2), t('orthocenter', 0, 1, 2))),
  g('collinear', R, t('circumcenter', 0, 1, 2), t('orthocenter', 0, 1, 2)),
];

export const INCENTER: readonly Guarantee[] = [
  g('on', R, t('bisector', 1, 0, 2)),
  g('on', R, t('bisector', 0, 1, 2)),
  g('on', R, t('bisector', 0, 2, 1)),
];

/** The excenter opposite the first vertex. */
export const EXCENTER: readonly Guarantee[] = [
  g('on', R, t('bisector', 1, 0, 2)),
  g('on', R, t('ext_bisector', 0, 1, 2)),
  g('on', R, t('ext_bisector', 0, 2, 1)),
];

/** line, segment, ray: through both points. */
export const THROUGH_BOTH: readonly Guarantee[] = [g('on', 0, R), g('on', 1, R)];

export const PARALLEL: readonly Guarantee[] = [g('on', 0, R), g('parallel', R, 1)];

export const PERP: readonly Guarantee[] = [g('on', 0, R), g('perpendicular', R, 1)];

export const PERP_BISECTOR: readonly Guarantee[] = [
  g('perpendicular', R, t('line', 0, 1)),
  g('on', t('midpoint', 0, 1), R),
];

export const BISECTOR: readonly Guarantee[] = [g('on', 1, R)];

export const EXT_BISECTOR: readonly Guarantee[] = [
  g('on', 1, R),
  g('perpendicular', R, t('bisector', 0, 1, 2)),
];

export const TANGENT_AT: readonly Guarantee[] = [
  g('on', 0, R),
  g('tangent', R, 1),
  g('perpendicular', R, t('line', t('center', 1), 0)),
];

export const TANGENT_FROM: readonly Guarantee[] = [g('on', 0, R), g('tangent', R, 1)];

export const TANGENT_POINT: readonly Guarantee[] = [
  g('on', R, 1),
  g('on', R, t('polar', 0, 1)),
  g('perpendicular', t('line', 0, R), t('line', t('center', 1), R)),
];

/** A touch point of a tangent from P to a conic (ADR-0042): on the conic and on P's polar. */
const CONIC_TANGENT_POINT: readonly Guarantee[] = [g('on', R, 1), g('on', R, t('polar', 0, 1))];

/**
 * The conic through five points passes through each, and its known point (the glider at
 * (1 : 0)) is the first (ADR-0042).
 */
const THROUGH_FIVE: readonly Guarantee[] = [
  ...[0, 1, 2, 3, 4].map((i) => g('on', i, R)),
  g('equal', 0, t('on', R, ONE, { lit: '0' })),
];

export const POLAR: readonly Guarantee[] = [g('perpendicular', R, t('line', t('center', 1), 0))];

export const POLE: readonly Guarantee[] = [g('perpendicular', t('line', t('center', 1), R), 0)];

export const RADICAL_AXIS: readonly Guarantee[] = [
  g('perpendicular', R, t('line', t('center', 0), t('center', 1))),
];

export const RADICAL_CENTER: readonly Guarantee[] = [
  g('on', R, t('radical_axis', 0, 1)),
  g('on', R, t('radical_axis', 1, 2)),
  g('on', R, t('radical_axis', 0, 2)),
];

/** circle(O, A): through A, centred at O. */
export const CIRCLE_CENTER_POINT: readonly Guarantee[] = [
  g('on', 1, R),
  g('equal', t('center', R), 0),
];

/** circle(O, r): centred at O. */
export const CIRCLE_CENTER_RADIUS: readonly Guarantee[] = [g('equal', t('center', R), 0)];

/** circle(A, B, C), circumcircle(A, B, C): through the three points, centred at O. */
export const CIRCLE_THREE: readonly Guarantee[] = [
  g('on', 0, R),
  g('on', 1, R),
  g('on', 2, R),
  g('equal', t('center', R), t('circumcenter', 0, 1, 2)),
];

/** harmonic_conjugate (ADR-0040): the quadruple is harmonic, the point on line AB. */
export const HARMONIC_POINT: readonly Guarantee[] = [
  g('harmonic', 0, 1, 2, R),
  g('collinear', 0, 1, R),
];
export const HARMONIC_LINE: readonly Guarantee[] = [g('harmonic_lines', 0, 1, 2, R)];

/** cline(A, B, C) and arc(A, B, C): through the three points (a cline may be a line). */
export const THROUGH_THREE: readonly Guarantee[] = [g('on', 0, R), g('on', 1, R), g('on', 2, R)];

export const DIAMETER_CIRCLE: readonly Guarantee[] = [
  g('on', 0, R),
  g('on', 1, R),
  g('equal', t('center', R), t('midpoint', 0, 1)),
];

export const NINEPOINT_CIRCLE: readonly Guarantee[] = [
  g('on', t('midpoint', 1, 2), R),
  g('on', t('midpoint', 2, 0), R),
  g('on', t('midpoint', 0, 1), R),
  g('equal', t('center', R), t('ninepoint_center', 0, 1, 2)),
];

const SIDES_TANGENT: readonly Guarantee[] = [
  g('tangent', R, t('line', 0, 1)),
  g('tangent', R, t('line', 1, 2)),
  g('tangent', R, t('line', 2, 0)),
];

export const INCIRCLE: readonly Guarantee[] = [
  ...SIDES_TANGENT,
  g('equal', t('center', R), t('incenter', 0, 1, 2)),
];

/** The excircle opposite the first vertex. */
export const EXCIRCLE: readonly Guarantee[] = [
  ...SIDES_TANGENT,
  g('equal', t('center', R), t('excenter', 0, 1, 2)),
];

export const SYMMEDIAN: readonly Guarantee[] = [g('on', 0, R)];

export const SYMMEDIAN_POINT: readonly Guarantee[] = [
  g('on', R, t('symmedian', 0, 1, 2)),
  g('on', R, t('symmedian', 1, 2, 0)),
  g('on', R, t('symmedian', 2, 0, 1)),
];

/** reflect(P, l): PP* ⟂ l, the midpoint of PP* on l. */
export const REFLECT_IN_LINE: readonly Guarantee[] = [
  g('perpendicular', t('line', 0, R), 1),
  g('on', t('midpoint', 0, R), 1),
];

/** reflect(P, O): the half turn about O. */
export const REFLECT_IN_POINT: readonly Guarantee[] = [
  g('collinear', 0, 1, R),
  g('length', 0, 1, 1, R, ONE),
];

/** rotate(P, O, θ): OP = OP*. */
export const ROTATE_POINT: readonly Guarantee[] = [g('length', 1, 0, 1, R, ONE)];

/** homothety(P, O, k): O, P, P* collinear. */
export const HOMOTHETY_POINT: readonly Guarantee[] = [g('collinear', 1, 0, R)];

/** translate(P, A, B): PP* = AB and PP* ∥ AB. */
export const TRANSLATE_POINT: readonly Guarantee[] = [
  g('length', 0, R, 1, 2, ONE),
  g('parallel', t('line', 0, R), t('line', 1, 2)),
];

/**
 * Which overloads carry which guarantees: tool name → the overload's parameter capabilities
 * (comma-separated) → its guarantees. Read only by `withGuarantees` (tools/index.ts builds the
 * registry's tools through it); a kernel test checks that every entry names an existing tool
 * and overload, so no entry can go stale.
 */
export const GUARANTEE_TABLE: Readonly<
  Record<string, Readonly<Record<string, readonly Guarantee[]>>>
> = {
  midpoint: { 'point,point': MIDPOINT },
  divide: { 'point,point,number': DIVIDE },
  foot: { 'point,linear': FOOT_LINE, 'point,point,point': FOOT_POINTS },
  intersect: {
    'linear,linear': ON_BOTH,
    'linear,round': ON_BOTH,
    'round,linear': ON_BOTH,
    'round,round': ON_BOTH,
    'linear,conic': ON_BOTH,
    'conic,linear': ON_BOTH,
  },
  circumcenter: { 'point,point,point': CIRCUMCENTER },
  centroid: { 'point,point,point': CENTROID },
  orthocenter: { 'point,point,point': ORTHOCENTER },
  line: { 'point,point': THROUGH_BOTH, 'ppoint,ppoint': THROUGH_BOTH },
  harmonic_conjugate: {
    'point,point,ppoint': HARMONIC_POINT,
    'linear,linear,linear': HARMONIC_LINE,
  },
  segment: { 'point,point': THROUGH_BOTH },
  ray: { 'point,point': THROUGH_BOTH },
  parallel: { 'point,linear': PARALLEL },
  perp: { 'point,linear': PERP },
  perp_bisector: { 'point,point': PERP_BISECTOR },
  circle: {
    'point,point': CIRCLE_CENTER_POINT,
    'point,number': CIRCLE_CENTER_RADIUS,
    'point,point,point': CIRCLE_THREE,
  },
  circumcircle: { 'point,point,point': CIRCLE_THREE },
  cline: { 'point,point,point': THROUGH_THREE },
  diameter_circle: { 'point,point': DIAMETER_CIRCLE },
  ninepoint_circle: { 'point,point,point': NINEPOINT_CIRCLE },
  on: {
    'linear,number': ON_FIRST,
    'round,number,number': ON_FIRST,
    'round,number': ON_FIRST,
    'conic,number,number': ON_FIRST,
  },
  other: {
    'linear,round,point': ON_BOTH,
    'round,linear,point': ON_BOTH,
    'round,round,point': ON_BOTH,
    'linear,conic,point': ON_BOTH,
    'conic,linear,point': ON_BOTH,
  },
  tangent: { 'point,round': TANGENT_AT, 'point,conic': TANGENT_FROM },
  polar: { 'point,round': POLAR },
  radical_axis: { 'round,round': RADICAL_AXIS },
  incenter: { 'point,point,point': INCENTER },
  excenter: { 'point,point,point': EXCENTER },
  incircle: { 'point,point,point': INCIRCLE },
  excircle: { 'point,point,point': EXCIRCLE },
  bisector: { 'point,point,point': BISECTOR },
  ext_bisector: { 'point,point,point': EXT_BISECTOR },
  ninepoint_center: { 'point,point,point': NINEPOINT_CENTER },
  tangent_point: { 'point,round': TANGENT_POINT, 'point,conic': CONIC_TANGENT_POINT },
  tangent_from: { 'point,round': TANGENT_FROM, 'point,conic': TANGENT_FROM },
  reflect: { 'point,linear': REFLECT_IN_LINE, 'point,point': REFLECT_IN_POINT },
  rotate: { 'point,point,number': ROTATE_POINT },
  homothety: { 'point,point,number': HOMOTHETY_POINT },
  translate: { 'point,point,point': TRANSLATE_POINT },
  symmedian: { 'point,point,point': SYMMEDIAN },
  symmedian_point: { 'point,point,point': SYMMEDIAN_POINT },
  pole: { 'linear,round': POLE },
  radical_center: { 'round,round,round': RADICAL_CENTER },
  arc: { 'point,point,point': THROUGH_THREE },
  conic: { 'point,point,point,point,point': THROUGH_FIVE },
};

/** The overload's parameter key in GUARANTEE_TABLE ("point,point"; a rest capability ends in …). */
export function paramsKey(s: Signature): string {
  return [...s.params, ...(s.rest === undefined ? [] : [`${s.rest}…`])].join(',');
}

/** The tool with its table entries attached to its overloads (unchanged when it has none). */
export function withGuarantees(spec: ToolSpec): ToolSpec {
  const entry = GUARANTEE_TABLE[spec.name];
  if (entry === undefined) return spec;
  const signatures = spec.signatures.map((s) => {
    const facts = entry[paramsKey(s)];
    return facts === undefined ? s : { ...s, guarantees: facts };
  });
  return { ...spec, signatures };
}

/**
 * The guarantees every overload that arguments of these static kinds can match declares (a
 * key does not evaluate, so it cannot know the overload a call resolves to; an unknown kind
 * matches every overload of the arity), as symmetriesFor does for symmetries. Degenerate: no
 * overload fits, or the overloads disagree → none.
 */
export function guaranteesFor(spec: ToolSpec | undefined, args: ArgKinds): readonly Guarantee[] {
  const takes = (spec?.signatures ?? []).filter((s) => fits(s, args));
  const [first, ...others] = takes;
  if (first === undefined) return [];
  return (first.guarantees ?? []).filter((g) => others.every((o) => o.guarantees?.includes(g)));
}
