/**
 * What the registry's maps do (ADR-0039), as data over their calls (`Signature.map`), and which
 * overloads are images (`Signature.imageOf`): the map overloads of reflect, rotate, homothety,
 * translate, spiral and the inversions, the image sugar (`reflect(X, l)` is the image of X under
 * `reflect(l)`), and `apply(T, X)`. packages/discovery reads them to hide facts that hold by the
 * map alone, and checks every one of them on registry-built figures (a wrong declaration would
 * hide a real fact). Terms are guarantee terms (guarantees.ts): argument positions, nested
 * calls, exact literals.
 */
import { fits, type ArgKinds } from './kinds';
import { paramsKey } from './guarantees';
import type { GuaranteeTerm, ImageOf, MapFacts, Signature, ToolSpec } from './tool';

const ONE: GuaranteeTerm = { lit: '1' };
const ZERO: GuaranteeTerm = { lit: '0' };

function t(tool: string, ...args: GuaranteeTerm[]): GuaranteeTerm {
  return { tool, args };
}

/** Each pair both ways (the images of an involution). */
function swaps(
  ...pairs: (readonly [GuaranteeTerm, GuaranteeTerm])[]
): [GuaranteeTerm, GuaranteeTerm][] {
  return pairs.flatMap(([a, b]) => [
    [a, b],
    [b, a],
  ]);
}

/** reflect(l): the mirror l is fixed point by point; lengths kept; directed angles reversed. */
const REFLECT_LINE: MapFacts = {
  type: 'anti-similarity',
  involution: true,
  ratio: ONE,
  fixedCurve: 0,
  invariantCurves: [0],
};

/** reflect(P): the half turn about P (directions kept). */
const REFLECT_POINT: MapFacts = {
  type: 'similarity',
  involution: true,
  ratio: ONE,
  turn: ZERO,
  fixedPoints: [0],
  factor: { lit: '-1' },
};

const ROTATE: MapFacts = { type: 'similarity', ratio: ONE, turn: 1, fixedPoints: [0] };

const HOMOTHETY: MapFacts = {
  type: 'similarity',
  ratio: 1,
  turn: ZERO,
  fixedPoints: [0],
  factor: 1,
};

const TRANSLATE: MapFacts = { type: 'similarity', ratio: ONE, turn: ZERO, sends: [[0, 1]] };

const SPIRAL: MapFacts = {
  type: 'similarity',
  sends: [
    [0, 2],
    [1, 3],
  ],
};

/** inversion(c): c is fixed point by point; its centre is the centre of c. */
const INVERSION_CIRCLE: MapFacts = {
  type: 'inversion',
  involution: true,
  center: t('center', 0),
  fixedCurve: 0,
  invariantCurves: [0],
};

/** inversion(O, k): centre O (k < 0: followed by the half turn about O). */
const INVERSION_POWER: MapFacts = { type: 'inversion', involution: true, center: 0 };

/** sqrt_bc(A, B, C): swaps B and C, and the circumcircle with line BC (ADR-0032). */
const SQRT_BC: MapFacts = {
  type: 'moebius',
  involution: true,
  sends: swaps([1, 2], [t('circumcircle', 0, 1, 2), t('line', 1, 2)]),
};

/** Each vertex with the foot of its altitude, the circumcircle with the nine-point circle. */
const ORTHOCENTER_INVERSION: MapFacts = {
  type: 'inversion',
  involution: true,
  center: t('orthocenter', 0, 1, 2),
  sends: swaps(
    [0, t('foot', 0, 1, 2)],
    [1, t('foot', 1, 2, 0)],
    [2, t('foot', 2, 0, 1)],
    [t('circumcircle', 0, 1, 2), t('ninepoint_circle', 0, 1, 2)],
  ),
};

/** inversion_fixing(O, c): centre O, c onto itself. */
const INVERSION_FIXING: MapFacts = {
  type: 'inversion',
  involution: true,
  center: 0,
  invariantCurves: [1],
};

/** inversion_swap(O, A, B): centre O, A and B swapped. */
const INVERSION_SWAP: MapFacts = {
  type: 'inversion',
  involution: true,
  center: 0,
  sends: swaps([1, 2]),
};

/** feet_inversion(A, B, C): centre A; B with the foot from C on AB, C with the foot from B on AC. */
const FEET_INVERSION: MapFacts = {
  type: 'inversion',
  involution: true,
  center: 0,
  sends: swaps([1, t('foot', 2, 0, 1)], [2, t('foot', 1, 0, 2)]),
};

/** sqrt_bc2(A, B, C): B with the midpoint of AC, C with the midpoint of AB (ADR-0034). */
const SQRT_BC2: MapFacts = {
  type: 'moebius',
  involution: true,
  sends: swaps([1, t('midpoint', 0, 2)], [2, t('midpoint', 0, 1)]),
};

/** send_to_infinity(l): a projective involution (it swaps l and the line at infinity). */
const SEND_TO_INFINITY: MapFacts = { type: 'projective', involution: true, infinityImage: 0 };

/** projective(A, B, C, D, A′, B′, C′, D′): a projective map with four known images. */
const PROJECTIVE: MapFacts = {
  type: 'projective',
  sends: [
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ],
};

/** conic_to_circle(k): a projective map whose image of k is a circle (ADR-0042). */
const CONIC_TO_CIRCLE: MapFacts = { type: 'projective', circleImage: 0 };

/** circle_to_centre(c, P): a projective map keeping c and sending P to its center (ADR-0042). */
const CIRCLE_TO_CENTRE: MapFacts = {
  type: 'projective',
  invariantCurves: [0],
  sends: [[1, t('center', 0)]],
};

/**
 * The map overloads: tool name → the overload's parameter capabilities → its facts. Read only
 * by `withMapFacts`; a kernel test checks that every entry names an existing overload.
 */
export const MAP_TABLE: Readonly<Record<string, Readonly<Record<string, MapFacts>>>> = {
  reflect: { linear: REFLECT_LINE, point: REFLECT_POINT },
  rotate: { 'point,number': ROTATE },
  homothety: { 'point,number': HOMOTHETY },
  translate: { 'point,point': TRANSLATE },
  spiral: { 'point,point,point,point': SPIRAL },
  inversion: { round: INVERSION_CIRCLE, 'point,number': INVERSION_POWER },
  sqrt_bc: { 'point,point,point': SQRT_BC },
  orthocenter_inversion: { 'point,point,point': ORTHOCENTER_INVERSION },
  inversion_fixing: { 'point,round': INVERSION_FIXING },
  inversion_swap: { 'point,point,point': INVERSION_SWAP },
  feet_inversion: { 'point,point,point': FEET_INVERSION },
  sqrt_bc2: { 'point,point,point': SQRT_BC2 },
  send_to_infinity: { linear: SEND_TO_INFINITY },
  projective: {
    'ppoint,ppoint,ppoint,ppoint,ppoint,ppoint,ppoint,ppoint': PROJECTIVE,
  },
  conic_to_circle: { conic: CONIC_TO_CIRCLE },
  circle_to_centre: { 'round,point': CIRCLE_TO_CENTRE },
};

/** `apply(T, X)`: the image of X under T. */
const APPLY: ImageOf = { of: 1, map: 0 };

/**
 * An overload's image data: `apply`'s, or the image sugar of a map tool (an overload that
 * preserves its first argument's kind and takes a map overload's parameters after it).
 */
function imageOfSignature(spec: ToolSpec, s: Signature): ImageOf | undefined {
  if (spec.name === 'apply') return APPLY;
  const entry = MAP_TABLE[spec.name];
  if (entry === undefined || s.preserves !== 0 || s.rest !== undefined) return undefined;
  const base = s.params.slice(1);
  if (entry[base.join(',')] === undefined) return undefined;
  return { of: 0, map: { tool: spec.name, args: base.map((_, i) => i + 1) } };
}

/** The tool with its map facts and image data attached (unchanged when it has none). */
export function withMapFacts(spec: ToolSpec): ToolSpec {
  const entry = MAP_TABLE[spec.name];
  if (entry === undefined && spec.name !== 'apply') return spec;
  const signatures = spec.signatures.map((s) => {
    const map = entry?.[paramsKey(s)];
    const imageOf = imageOfSignature(spec, s);
    return {
      ...s,
      ...(map === undefined ? {} : { map }),
      ...(imageOf === undefined ? {} : { imageOf }),
    };
  });
  return { ...spec, signatures };
}

/**
 * The data every overload that arguments of these static kinds can match declares (as
 * guaranteesFor): one value shared by all of them, else none.
 */
function agreed<X>(
  spec: ToolSpec | undefined,
  args: ArgKinds,
  of: (s: Signature) => X | undefined,
): X | undefined {
  const takes = (spec?.signatures ?? []).filter((s) => fits(s, args));
  const [first, ...others] = takes;
  if (first === undefined) return undefined;
  const v = of(first);
  const same = JSON.stringify(v);
  return v !== undefined && others.every((o) => JSON.stringify(of(o)) === same) ? v : undefined;
}

/** The map facts of a call with arguments of these static kinds (undefined: not a map, or unclear). */
export function mapFactsFor(spec: ToolSpec | undefined, args: ArgKinds): MapFacts | undefined {
  return agreed(spec, args, (s) => s.map);
}

/** The image data of a call with arguments of these static kinds. */
export function imageOfFor(spec: ToolSpec | undefined, args: ArgKinds): ImageOf | undefined {
  return agreed(spec, args, (s) => s.imageOf);
}
