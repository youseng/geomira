/**
 * Law L3 for branch selection (Run 3b): the exact oracle. Random figures whose candidates
 * are RATIONAL (so the exact run succeeds): a line through a rational point P of a circle
 * meets it again at a rational point (Vieta); two circles through P meet again at P's
 * mirror image in the line of centres; the tangents from the pole of a chord T₁T₂ touch at
 * T₁ and T₂. Every branchable call gets random selectors (filters with random references,
 * rankers, other(P) with P a candidate, along / orient as they apply). FloatField agrees
 * with RationalField (same kind, same Undefined reason, numbers within 1e-9 relative)
 * wherever no float decision saw a quantity within the band (helpers/laws.ts bandWatch);
 * ModPField agrees with the reduction of the exact result wherever it is not Inexact
 * (other(P) is exact mod p; order-based selectors are Inexact there).
 */
import { FloatField } from '@geomira/num/float-field';
import { isInexact } from '@geomira/num/field';
import { ModPField } from '@geomira/num/modp';
import { add, rational, sub, tryToNumber, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/evaluate';
import { call, lit, type Expr, type RefExpr, type Selector } from '../../src/expr';
import { numbersOf, type Value } from '../../src/value';
import { Builder, REGISTRY, contextOf } from '../helpers/doc';
import { LAW_TIMEOUT, bandWatch, lawCount } from '../helpers/laws';

const SAMPLES = lawCount(4000);
const TOLERANCE = 1e-9;

type XY = readonly [Rational, Rational];
type Shape = 'lc' | 'cl' | 'cc' | 'tangent_point' | 'tangent_from';

function grid(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(1025) - 512), 32n);
}

/** The integer vectors of length 5 (Pythagorean): k·v lies on the circle of radius 5k. */
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

/** O + k·v for a random v of LENGTH5: an integer point of the circle (O, 5k). */
function onCircle(rng: Rng, O: XY, k: bigint): XY {
  const [vx, vy] = LENGTH5[rng.nextInt(LENGTH5.length)] ?? [5, 0];
  return [add(O[0], rational(k * BigInt(vx))), add(O[1], rational(k * BigInt(vy)))];
}

class Figure {
  readonly b = new Builder();
  private n = 0;
  constructor(readonly rng: Rng) {}
  point(xy: XY): RefExpr {
    this.n += 1;
    return this.b.add(`P_{${String(this.n)}}`, call('point', [lit(xy[0]), lit(xy[1])]));
  }
  random(): RefExpr {
    return this.point([grid(this.rng), grid(this.rng)]);
  }
  obj(def: Expr): RefExpr {
    this.n += 1;
    return this.b.add(`k${String(this.n)}`, def);
  }
}

/**
 * The branch call's arguments and a candidate other(·) may use. Integer data: every float
 * product is exact, so few samples come near the band (and are excluded).
 */
function build(f: Figure, shape: Shape): { args: Expr[]; known: RefExpr } {
  const { rng } = f;
  const O: XY = [rational(BigInt(rng.nextInt(21) - 10)), rational(BigInt(rng.nextInt(21) - 10))];
  const k = BigInt(rng.nextInt(4) + 1);
  const Pxy = onCircle(rng, O, k);
  const [o, A, P] = [f.point(O), f.point(onCircle(rng, O, k)), f.point(Pxy)];
  const c = f.obj(call('circle', [o, A]));
  if (shape === 'lc' || shape === 'cl') {
    const Q: XY = [rational(BigInt(rng.nextInt(41) - 20)), rational(BigInt(rng.nextInt(41) - 20))];
    const kind = ['line', 'segment', 'ray'][rng.nextInt(3)] ?? 'line';
    // P is the midpoint of the segment (2P − Q, Q), or the ray from 2P − Q: away from ends.
    const back = f.point([sub(add(Pxy[0], Pxy[0]), Q[0]), sub(add(Pxy[1], Pxy[1]), Q[1])]);
    const l = f.obj(call(kind, kind === 'line' ? [P, f.point(Q)] : [back, f.point(Q)]));
    return { args: shape === 'lc' ? [l, c] : [c, l], known: P };
  }
  if (shape === 'cc') {
    const O2 = f.point([
      rational(BigInt(rng.nextInt(21) - 10)),
      rational(BigInt(rng.nextInt(21) - 10)),
    ]);
    return { args: [c, f.obj(call('circle', [O2, P]))], known: P };
  }
  const T2 = f.point(onCircle(rng, O, k));
  const pole = f.obj(call('intersect', [call('tangent', [P, c]), call('tangent', [T2, c])]));
  return { args: [pole, c], known: P };
}

function randomSelector(f: Figure, shape: Shape, known: RefExpr): Selector {
  const { rng } = f;
  const sign = rng.nextFloat() < 0.5 ? 1 : -1;
  const low: Selector =
    shape === 'lc' || shape === 'cl' ? { kind: 'along', sign } : { kind: 'orient', sign };
  switch (rng.nextInt(9)) {
    case 0:
      return {
        kind: rng.nextFloat() < 0.5 ? 'same_side' : 'opposite_side',
        q: f.random(),
        l: call('line', [f.random(), f.random()]),
      };
    case 1:
      return { kind: 'on_arc', b: f.random(), c: f.random(), a: f.random(), not: sign === 1 };
    case 2:
      return { kind: 'between', a: f.random(), b: f.random() };
    case 3:
      return {
        kind: rng.nextFloat() < 0.5 ? 'inside' : 'outside',
        c: call('circle', [f.random(), f.random()]),
      };
    case 4:
      return { kind: rng.nextFloat() < 0.5 ? 'near' : 'far_from', p: f.random() };
    case 5:
    case 6:
      return { kind: 'other', p: known };
    default:
      return low;
  }
}

function disagreement(fv: Value<number>, rv: Value<Rational>, scale: number): string | undefined {
  if (fv.kind !== rv.kind) return `kinds ${fv.kind} vs ${rv.kind}`;
  if (fv.kind === 'undefined' && rv.kind === 'undefined' && fv.reason !== rv.reason)
    return `reasons "${fv.reason}" vs "${rv.reason}"`;
  if (fv.kind === 'line' && rv.kind === 'line' && fv.chiral !== rv.chiral)
    return 'chirality differs';
  const [fs, rs] = [numbersOf(fv), numbersOf(rv)];
  for (const [i, x] of fs.entries()) {
    const e = rs[i] === undefined ? undefined : tryToNumber(rs[i]);
    if (e === undefined || !(Math.abs(x - e) <= TOLERANCE * Math.max(1, Math.abs(e), scale)))
      return `component ${String(i)}: ${String(x)} vs ${String(e)}`;
  }
  return undefined;
}

describe(
  `L3 (branch selection): FloatField agrees with RationalField on rational candidates (${String(SAMPLES)} samples)`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('every shape, every selector kind; mod p where exact', () => {
      const watch = bandWatch(FloatField);
      const tally = { defined: 0, undefinedAgree: 0, inexact: 0, excluded: 0, modp: 0 };
      const perKind: Record<string, number> = {};
      const shapes: readonly Shape[] = ['lc', 'cl', 'cc', 'tangent_point', 'tangent_from'];
      for (let k = 0; k < SAMPLES; k += 1) {
        const f = new Figure(createRng(deriveSeed(4401, k)));
        const shape = shapes[k % shapes.length] ?? 'lc';
        const { args, known } = build(f, shape);
        const sels = Array.from({ length: f.rng.nextInt(3) }, () =>
          randomSelector(f, shape, known),
        );
        const tool = shape === 'tangent_point' || shape === 'tangent_from' ? shape : 'intersect';
        const x = f.b.add('X', call(tool, args, sels));
        const ctx = contextOf(f.b.doc);
        watch.reset();
        const fv = evaluate(f.b.doc, REGISTRY, watch.field, ctx).values.get(x.id);
        const rv = evaluate(f.b.doc, REGISTRY, RationalField, ctx).values.get(x.id);
        const mv = evaluate(f.b.doc, REGISTRY, ModPField, ctx).values.get(x.id);
        if (fv === undefined || rv === undefined || mv === undefined)
          throw new Error('missing value');
        if (mv.kind !== 'inexact' && rv.kind !== 'inexact' && rv.kind !== 'undefined') {
          expect(mv.kind).toBe(rv.kind);
          for (const [i, q] of numbersOf(rv).entries()) {
            const red = ModPField.fromRational(q);
            if (!isInexact(red)) expect(numbersOf(mv)[i]).toBe(red);
          }
          tally.modp += 1;
        }
        if (rv.kind === 'inexact') tally.inexact += 1;
        else if (watch.touched()) tally.excluded += 1;
        else {
          expect(
            disagreement(fv, rv, ctx.scale),
            `sample ${String(k)} ${shape} ${JSON.stringify(sels.map((s) => s.kind))}`,
          ).toBeUndefined();
          if (rv.kind === 'undefined') tally.undefinedAgree += 1;
          else {
            tally.defined += 1;
            for (const s of sels) perKind[s.kind] = (perKind[s.kind] ?? 0) + 1;
            perKind[shape] = (perKind[shape] ?? 0) + 1;
          }
        }
      }
      process.stdout.write(
        `L3 branch: ${String(tally.defined)} defined + ${String(tally.undefinedAgree)} Undefined agree, ${String(tally.inexact)} not exact, ` +
          `${String(tally.excluded)} excluded (band); mod p ${String(tally.modp)}; defined per shape/selector: ${JSON.stringify(perKind)}\n`,
      );
      for (const key of [
        ...shapes,
        'same_side',
        'opposite_side',
        'on_arc',
        'between',
        'inside',
        'outside',
        'near',
        'far_from',
        'other',
        'along',
        'orient',
      ]) {
        expect(perKind[key] ?? 0, key).toBeGreaterThanOrEqual(lawCount(20));
      }
      expect(tally.modp).toBeGreaterThan(lawCount(200));
    });
  },
);
