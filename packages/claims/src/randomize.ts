/**
 * Randomize (Run 9b, ADR-0016): a new figure of the SAME construction, drawn by the GLOBAL
 * sampler of SPEC §10.4 (sampler.ts: every free point, glider and param redrawn, never
 * mirrored here) and accepted by the tester's own hypothesis check (`checkAssumption`): the
 * document's `assume` lines plus the chosen triangle type as hypotheses on the TRIANGLE, the
 * first three free points in construction order (A, B, C below):
 *   - acute: acute(A, B, C);
 *   - obtuse: angle(B, A, C) > 100 (obtuse at the first vertex);
 *   - right: no hypothesis can say it (a right angle is a closed condition: SPEC §6.2 and
 *     §10.3 construct right angles, they never assume them), so C is moved onto the
 *     perpendicular to AB at A, exactly over Q: the right angle is a special position of
 *     THIS figure, not a property of the construction (dragging or testing leaves it);
 *   - any: the document's hypotheses only (no triangle needed).
 * Every type but `any` also asks each other angle of the triangle to exceed SHAPE_MIN_DEG,
 * as the `triangle` sugar does (ADR-0009 decision 11), so the new triangle is readable.
 * Free inputs are then rounded to short exact decimals (points and radii to 10^(⌊log10 size⌋
 * − 2), size the figure's diameter (ADR-0017); line parameters and (u : v) to 0.001, angles
 * to 0.1°, params to a thousandth of their range), so the text shows "A = (1.23, -0.5)"; the
 * hypotheses are checked after that.
 * A sample is accepted only when every object that is defined in the current figure stays
 * defined (a new figure, not a degenerate one). Degenerate cases: no free input, fewer than
 * three free points for a typed choice, an invalid figure or assumption, or no accepted
 * sample within the attempt budget → refused with the reason; the document is never changed
 * here (the editor applies the result as one edit).
 */
import { FloatField } from '@geomira/num/float-field';
import { assertNever } from '@geomira/num/assert';
import { decimalText, floorLog10, pow10, roundTo } from '@geomira/num/decimal';
import {
  add,
  compare,
  fromInteger,
  fromNumber,
  mul,
  sub,
  toNumber,
  type Rational,
} from '@geomira/num/rational';
import { deriveSeed, type Seed } from '@geomira/num/rng';
import { evalContextFor } from '@geomira/kernel/context';
import type { Assumption, Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import { call, exprEquals, lit, ref } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import type { Value } from '@geomira/kernel/value';
import { prepareFigure, type PreparedFigure } from './figure-prep';
import { readFree, writeFree, type Assignment, type FreeInput } from './free';
import { checkAssumption } from './hypotheses';
import { drawSample, figureSize } from './sampler';

export type TriangleType = 'acute' | 'obtuse' | 'right' | 'any';

export const TRIANGLE_TYPES: readonly TriangleType[] = Object.freeze([
  'acute',
  'obtuse',
  'right',
  'any',
]);

/** Samples tried before Randomize gives up. */
export const RANDOMIZE_ATTEMPTS = 500;

/** Every angle of a typed triangle (other than the special one) exceeds this, in degrees. */
export const SHAPE_MIN_DEG = 15;

/** The obtuse angle of an obtuse triangle exceeds this, in degrees. */
export const OBTUSE_MIN_DEG = 100;

export type RandomizeResult =
  | {
      readonly kind: 'figure';
      /** The user's document with new free inputs (ids, order, styles, claims unchanged). */
      readonly doc: Document;
      /** The ids of the objects whose definitions changed. */
      readonly changed: readonly number[];
      /** The names of the triangle's vertices (empty for `any`). */
      readonly triangle: readonly string[];
      readonly attempts: number;
    }
  | { readonly kind: 'refused'; readonly reason: string };

function refused(reason: string): RandomizeResult {
  return { kind: 'refused', reason };
}

/** angle(X, V, Y) > deg as an assumption (ids are assigned by the caller). */
function angleAbove(x: number, v: number, y: number, deg: number) {
  return {
    kind: 'greater',
    args: [call('angle', [ref(x), ref(v), ref(y)]), lit(fromInteger(deg))],
  };
}

/** The type's hypotheses on the triangle (a, b, c are object ids). */
function typeHypotheses(type: TriangleType, [a, b, c]: readonly number[]) {
  if (type === 'any' || a === undefined || b === undefined || c === undefined) return [];
  const others = [angleAbove(a, b, c, SHAPE_MIN_DEG), angleAbove(a, c, b, SHAPE_MIN_DEG)];
  switch (type) {
    case 'acute':
      return [{ kind: 'acute', args: [ref(a), ref(b), ref(c)] }, ...others];
    case 'obtuse':
      return [angleAbove(b, a, c, OBTUSE_MIN_DEG), ...others];
    case 'right':
      return others;
    default:
      return assertNever(type, 'triangle type');
  }
}

/** The free points that are whole objects (named points), in construction order. */
function freePoints(fig: PreparedFigure): FreeInput[] {
  return fig.free.filter((x) => x.kind === 'point' && x.path.length === 0);
}

/** Decimal exponents of the free inputs' grids (see the module comment). */
const PARAM_DIGITS = 3;
const ANGLE_EXP = -1;
const RATIO_EXP = -3;

/** x rounded to 10^e with its decimal text. */
function decimal(x: Rational, e: number): { value: Rational; text: string } {
  const value = roundTo(x, e);
  return { value, text: decimalText(value, e) };
}

/** A param's v on its grid, kept inside [min, max]. */
function paramDecimal(min: Rational, max: Rational, v: Rational) {
  const e = floorLog10(sub(max, min)) - PARAM_DIGITS;
  let r = roundTo(v, e);
  if (compare(r, max) > 0) r = sub(r, pow10(e));
  if (compare(r, min) < 0) r = add(r, pow10(e));
  return { value: r, text: decimalText(r, e) };
}

function roundInput(x: FreeInput, v: readonly Rational[], e: number): Assignment | undefined {
  const all = (k: number) => v.map((y) => decimal(y, k));
  const out = (d: readonly { value: Rational; text: string | undefined }[]): Assignment => ({
    input: x,
    values: d.map((y) => y.value),
    texts: d.map((y) => y.text),
  });
  switch (x.kind) {
    case 'point':
      return out(all(e));
    case 'radius': {
      const r = decimal(v[0] ?? fromInteger(0), e);
      return r.value.num === 0n ? undefined : out([r]);
    }
    case 'line-glider':
      return out(all(RATIO_EXP));
    case 'stereo': {
      const d = all(RATIO_EXP);
      return d.every((y) => y.value.num === 0n) ? undefined : out(d);
    }
    case 'angle-glider':
      return out(all(ANGLE_EXP));
    case 'param': {
      const [min, max, p] = v;
      return min === undefined || max === undefined || p === undefined
        ? undefined
        : out([
            ...[min, max].map((y) => ({ value: y, text: undefined })),
            paramDecimal(min, max, p),
          ]);
    }
    default:
      return assertNever(x.kind, 'free input');
  }
}

/** The sample with every free input on its decimal grid. */
function decimals(fig: PreparedFigure, sample: Document, e: number): Document {
  const out: Assignment[] = [];
  for (const x of fig.free) {
    const v = readFree(sample, x);
    const a = v === undefined ? undefined : roundInput(x, v, e);
    if (a !== undefined) out.push(a);
  }
  return writeFree(sample, out);
}

/** C moved onto the perpendicular to AB at A (exactly), or undefined if it lands on A. */
function rightAt(doc: Document, [a, b, c]: readonly FreeInput[], e: number): Document | undefined {
  const [A, B, C] = [a, b, c].map((x) => (x === undefined ? undefined : readFree(doc, x)));
  const [ax, ay, bx, by, cx, cy] = [A?.[0], A?.[1], B?.[0], B?.[1], C?.[0], C?.[1]];
  if (ax === undefined || ay === undefined || bx === undefined || by === undefined) return;
  if (cx === undefined || cy === undefined || c === undefined) return;
  // w = AB turned by 90°; C' = A + t·w with t the projection of AC on w, to two decimals.
  const w: readonly [Rational, Rational] = [sub(ay, by), sub(bx, ax)];
  const [wx, wy] = [toNumber(w[0]), toNumber(w[1])];
  const len2 = wx * wx + wy * wy;
  if (!(len2 > 0)) return undefined;
  const proj = ((toNumber(cx) - toNumber(ax)) * wx + (toNumber(cy) - toNumber(ay)) * wy) / len2;
  const t = roundTo(fromNumber(proj), -2);
  if (t.num === 0n) return undefined;
  const xy = [add(ax, mul(t, w[0])), add(ay, mul(t, w[1]))];
  const texts = xy.map((z) => decimalText(z, e - 2));
  return writeFree(doc, [{ input: c, values: xy, texts }]);
}

function definedIds(values: ReadonlyMap<number, Value<number>>): Set<number> {
  const out = new Set<number>();
  for (const [id, v] of values) if (v.kind !== 'undefined' && v.kind !== 'inexact') out.add(id);
  return out;
}

/** Whether a sample satisfies every hypothesis and keeps every defined object defined. */
function accepts(fig: PreparedFigure, sample: Document, keep: ReadonlySet<number>): boolean {
  const c = evalContextFor(sample);
  if (!c.ok) return false;
  const values = evaluate(sample, fig.registry, FloatField, c.ctx).values;
  for (const id of keep) {
    const v = values.get(id);
    if (v === undefined || v.kind === 'undefined' || v.kind === 'inexact') return false;
  }
  return fig.hypotheses.every((h) => {
    const args = h.probes.map(
      (id): Value<number> => values.get(id) ?? { kind: 'undefined', reason: 'missing' },
    );
    return checkAssumption(h.assumption.kind, args, h.dim, c.ctx) === 'holds';
  });
}

/** The user's document with the sample's definitions, and the ids that changed. */
function result(doc: Document, sample: Document): { doc: Document; changed: number[] } {
  const byId = new Map(sample.objects.map((o) => [o.id, o]));
  const changed: number[] = [];
  const objects = doc.objects.map((o) => {
    const s = byId.get(o.id);
    if (s === undefined || exprEquals(s.def, o.def)) return o;
    changed.push(o.id);
    return { ...o, def: s.def };
  });
  return { doc: { ...doc, objects }, changed };
}

/** The document with the type's hypotheses appended (for sampling only). */
function withHypotheses(doc: Document, type: TriangleType, tri: readonly number[]): Document {
  const extra: Assumption[] = typeHypotheses(type, tri).map((h, i) => ({
    id: doc.nextId + i,
    ...h,
  }));
  return { ...doc, assumptions: [...doc.assumptions, ...extra], nextId: doc.nextId + extra.length };
}

/**
 * A new figure of `doc` with a triangle of `type` (see the module comment), drawn from
 * `seed`; or the reason there is none.
 */
export function randomFigure(
  doc: Document,
  registry: Registry,
  type: TriangleType,
  seed: Seed,
  attempts: number = RANDOMIZE_ATTEMPTS,
): RandomizeResult {
  const plain = prepareFigure(doc, registry);
  if (!plain.ok) return refused(plain.reason);
  if (plain.figure.free.length === 0)
    return refused('nothing to randomize: the figure has no free points, gliders or params');
  const pts = freePoints(plain.figure).slice(0, 3);
  if (type !== 'any' && pts.length < 3)
    return refused(
      `a ${type} triangle needs three free points; this figure has ${String(pts.length)}`,
    );
  const tri = type === 'any' ? [] : pts.map((x) => x.id);
  const prep = prepareFigure(withHypotheses(doc, type, tri), registry);
  if (!prep.ok) return refused(prep.reason);
  const fig = prep.figure;
  const current = evalContextFor(doc);
  if (!current.ok) return refused(current.reason);
  const e = floorLog10(fromNumber(figureSize(fig))) - 2;
  const keep = definedIds(evaluate(doc, registry, FloatField, current.ctx).values);
  for (let i = 0; i < attempts; i++) {
    const drawn = decimals(fig, drawSample(fig, 'global', deriveSeed(seed, i), false), e);
    const sample = type === 'right' ? rightAt(drawn, pts, e) : drawn;
    if (sample === undefined || !accepts(fig, sample, keep)) continue;
    const names = tri.map((id) => doc.objects.find((o) => o.id === id)?.name ?? '?');
    return { kind: 'figure', ...result(doc, sample), triangle: names, attempts: i + 1 };
  }
  const what = type === 'any' ? 'figure' : `figure with a ${type} triangle`;
  return refused(
    `no ${what} satisfied the hypotheses with every object defined in ${String(attempts)} attempts`,
  );
}
