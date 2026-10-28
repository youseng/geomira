/**
 * compose(T1, T2) (T2 first), inverse(T) and apply(T, X) for both map types (SPEC §6.2, §8.1;
 * ADR-0032): similarities and Möbius maps (transform/). Every map argument is checked to be
 * valid (hand-built values may not be); numbers and maps are never imaged. Moved out of
 * transforms.ts (which builds the similarities and their image sugar) when Run 14 added the
 * Möbius cases.
 */
import type { Field, Inexact } from '@geomira/num/field';
import type { EvalContext, ExampleArg, Signature, ToolSpec } from '../tool';
import { applyMap } from '../transform/apply-map';
import { composeMaps, inverseMap, mapProblem } from '../transform/mobius';
import {
  capabilityKinds,
  type Capability,
  type TransformData,
  type Undefined,
  type Value,
  type ValueKind,
} from '../value';
import { badArgs } from './args';

/** What the image sugar (reflect(X, l), rotate(X, O, θ), …) takes: figures. */
export const IMAGED: readonly Capability[] = ['point', 'curve', 'polygon'];

/** The figure kinds a map takes to the same kind (the sugar's result kinds). */
export const IMAGE_KINDS: readonly ValueKind[] = ['point', 'line', 'circle', 'polygon'];

/**
 * apply also maps marks and text (ADR-0011: derived layers image them), points at infinity
 * (ADR-0040) and conics (ADR-0042).
 */
const APPLIED: readonly Capability[] = [...IMAGED, 'annotation', 'ideal', 'conic'];
const APPLIED_KINDS: readonly ValueKind[] = [
  ...IMAGE_KINDS,
  'angle_mark',
  'segment_mark',
  'text',
  'ideal_point',
  'conic',
];

export const TRANSFORM_KIND: readonly ValueKind[] = ['transform'];

/** apply with the kind check of the sugar and apply (numbers and maps are not imaged). */
export function applyChecked<T>(
  F: Field<T>,
  t: TransformData<T>,
  X: Value<T>,
  ctx: EvalContext,
  tool: string,
): Value<T> {
  return APPLIED_KINDS.includes(X.kind) ? applyMap(F, t, X, ctx) : badArgs(tool);
}

/** The transform argument at i, checked to be valid (hand-built values may not be). */
function mapAt<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  i: number,
  tool: string,
): TransformData<T> | Undefined | Inexact {
  const v = args[i];
  if (v?.kind !== 'transform') return badArgs(tool);
  return mapProblem(F, v.t, tool) ?? v.t;
}

/** A map that passed the validity check, as a value. */
function finished<T>(F: Field<T>, t: TransformData<T>, tool: string): Value<T> {
  return mapProblem(F, t, tool) ?? { kind: 'transform', t };
}

/**
 * compose(S, T) = S∘T. A product of valid maps never collapses (ADR-0019); in floats a product
 * beyond the double range is Inexact.
 */
function compose<T>(F: Field<T>, args: readonly Value<T>[]): Value<T> {
  if (args.length !== 2) return badArgs('compose');
  const [s, t] = [mapAt(F, args, 0, 'compose'), mapAt(F, args, 1, 'compose')];
  if ('kind' in s) return s;
  if ('kind' in t) return t;
  return finished(F, composeMaps(F, s, t), 'compose');
}

function inverse<T>(F: Field<T>, args: readonly Value<T>[]): Value<T> {
  if (args.length !== 1) return badArgs('inverse');
  const s = mapAt(F, args, 0, 'inverse');
  return 'kind' in s ? s : { kind: 'transform', t: inverseMap(F, s) };
}

function apply<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [X] = args.slice(1);
  if (args.length !== 2 || X === undefined) return badArgs('apply');
  const s = mapAt(F, args, 0, 'apply');
  return 'kind' in s ? s : applyChecked(F, s, X, ctx, 'apply');
}

const P = (x: string, y: string): readonly [string, string] => [x, y];
const lineArg = (a: readonly [string, string], b: readonly [string, string]): ExampleArg => ({
  through: [a, b],
  as: 'line',
});
const callArg = (name: string, ...args: ExampleArg[]): ExampleArg => ({ call: name, args });
const O0 = P('0', '0');

/** compose and inverse of a map that may be Möbius may be Möbius (kinds.ts, ADR-0032). */
const MAP_PAIR: Signature = { params: ['transform', 'transform'], output: TRANSFORM_KIND };

export const MAP_OPERATIONS: readonly ToolSpec[] = [
  {
    id: 'compose',
    name: 'compose',
    family: 'transformations',
    signatures: [MAP_PAIR],
    outputKinds: ['transform'],
    compute: compose,
    degenerate: [
      'scale factors below EPS (10⁻⁵ · 10⁻⁵) → a valid map: a composition never collapses',
      'a scale factor beyond the double range (floats) → Inexact',
      'compose(T, inverse(T)) → the identity',
      'two anti-similarities → a direct similarity',
      'two inversions → a direct Möbius map (the same center: a homothety, with no pole)',
      'a hand-built Möbius map with ad − bc = 0 → Undefined',
    ],
    export: { constructive: 'compose' },
    doc:
      'compose(T1, T2): the map X ↦ T1(T2(X)) (T2 first). Similarities and Möbius maps ' +
      '(inversions) compose in any combination.',
    examples: [
      {
        args: [
          callArg('reflect', lineArg(O0, P('1', '0'))),
          callArg('reflect', lineArg(O0, P('0', '1'))),
        ],
      },
      { args: [callArg('inversion', O0, '4'), callArg('inversion', O0, '1')] },
    ],
  },
  {
    id: 'inverse',
    name: 'inverse',
    family: 'transformations',
    signatures: [{ params: ['transform'], output: TRANSFORM_KIND }],
    outputKinds: ['transform'],
    compute: inverse,
    degenerate: [
      'a reflection or a half turn → itself',
      'a hand-built map with scale factor 0 → Undefined',
      'an inversion → itself (its matrix up to a factor)',
    ],
    export: { constructive: 'inverse' },
    doc: 'inverse(T): the inverse map (the preimage of Y is apply(inverse(T), Y)).',
    examples: [
      { args: [callArg('homothety', P('1', '1'), '2')] },
      { args: [callArg('inversion', P('1', '1'), '2')] },
    ],
  },
  {
    id: 'apply',
    name: 'apply',
    family: 'transformations',
    signatures: APPLIED.map((x) => ({
      params: ['transform', x],
      output: capabilityKinds(x),
      preserves: 1,
    })),
    outputKinds: APPLIED_KINDS,
    compute: apply,
    degenerate: [
      'X a number or a transform → Undefined (not imaged)',
      'an Undefined T or X → Undefined',
      'an anti-similarity reverses arcs; ranges and the chirality flag are kept',
      'a circle without an anchor → an image without one',
      'an anti-similarity reverses an angle mark (its arms swap)',
      'the center of an inversion → Undefined (its image is at infinity)',
      'a point within the band of the center → Undefined (ambiguous)',
      'a line through the center → that line; a circle through it → a line (chiral)',
      'a line off the center → a circle through it; a circle off it → a circle',
      'a curve within the band of the center → Undefined (ambiguous)',
      'a segment → an arc; a segment with an end at the center → a ray',
      'a segment containing the center → the two rays outside',
      'an arc through the center → a segment, a ray or two rays',
      'a polygon under an inversion → Undefined (its sides become arcs)',
      'a segment mark under an inversion → Undefined (lengths are not kept)',
      'an angle mark under an inversion → the mark on the tangents (arms swapped)',
      'mod p, an arc or a range through an inversion → Inexact (needs an order)',
      'a point at infinity under a similarity → the point at infinity of the mapped direction',
      'a point at infinity under a Möbius map with a pole → Undefined',
      'under a projective map: a point on the line sent to infinity → a point at infinity',
      'under a projective map: a point at infinity off its direction → a point',
      'under a projective map: a segment crossing the line sent to infinity → two rays',
      'under a projective map: the line sent to infinity → Undefined',
      'under a projective map: a circle → a conic (never a circle); an arc → Undefined',
      'a conic under a similarity or a projective map → a conic (its known point mapped, dropped at infinity)',
      'a conic under a Möbius map with a pole → Undefined (a curve of degree 3 or 4)',
      'under a projective map: a polygon with a side through infinity → Undefined',
      'under a projective map: a segment mark → Undefined; an angle mark → not right',
      'under a projective map: a position within the band of the line sent to infinity → Undefined (ambiguous)',
      'mod p, a range through a projective map → Inexact (needs an order)',
      'a composite of a Möbius map and a projective map → each map in turn',
    ],
    export: { constructive: 'apply' },
    doc:
      'apply(T, X): the image of a point, line, segment, ray, circle, arc, polygon, mark or ' +
      'text. Ranges ' +
      'are kept, an anti-similarity reverses arcs, the chirality flag and the anchor of a ' +
      'circle are mapped with it (gliders on an image circle stay exact). Under an inversion ' +
      'lines and circles exchange kinds, segments become arcs or rays, and the center has no ' +
      'image.',
    examples: [
      { args: [callArg('rotate', O0, '90'), { polygon: [P('1', '0'), P('2', '0'), P('2', '1')] }] },
      {
        args: [
          callArg('reflect', lineArg(O0, P('1', '0'))),
          callArg('circle', P('1', '2'), P('1', '3')),
        ],
      },
      { args: [callArg('inversion', O0, '4'), lineArg(P('1', '0'), P('1', '1'))] },
    ],
  },
];
