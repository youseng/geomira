/**
 * Law L3 for images under projective maps (Run 16a, ADR-0040): FloatField agrees with the exact
 * RationalField oracle on apply(M, X) for maps M from the projective constructors (and their
 * compositions with similarities and each other, inverses, and composites with an inversion)
 * and figures X of every kind (points, points at infinity, lines, segments, rays, polygons,
 * marks, texts, circles). Points lie on a small grid, so figures on the line sent to infinity
 * (points at infinity, rays, two rays) occur often and exactly. Draws whose float run decided
 * anything within BAND of a degeneracy are excluded (SPEC §17); mod p, every defined exact value
 * reduces to the mod-p value.
 */
import { FloatField } from '@geomira/num/float-field';
import { isInexact } from '@geomira/num/field';
import { ModPField } from '@geomira/num/modp';
import { rational, tryToNumber, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/evaluate';
import { call, lit, type Expr } from '../../src/expr';
import { numbersOf, type Value } from '../../src/value';
import { Builder, REGISTRY, contextOf } from '../helpers/doc';
import { LAW_TIMEOUT, bandWatch, lawCount } from '../helpers/laws';

const SAMPLES = lawCount(3000);
const TOLERANCE = 1e-9;

const pick = <X>(rng: Rng, xs: readonly X[]): X => {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('empty');
  return x;
};

function point(rng: Rng): Expr {
  const c = () => lit(rational(BigInt(rng.nextInt(9) - 4), BigInt(pick(rng, [1, 1, 2]))));
  return call('point', [c(), c()]);
}

/** A point at infinity: the meeting point of a line and a parallel to it. */
function ideal(rng: Rng): Expr {
  const l = call('line', [point(rng), point(rng)]);
  return call('intersect', [l, call('parallel', [point(rng), l])]);
}

/** A projective map (its parts from the grid; some are degenerate, and so Undefined). */
export function projectiveMap(rng: Rng): Expr {
  const P = () => point(rng);
  const base = pick(rng, [
    () => call('send_to_infinity', [call(pick(rng, ['line', 'segment']), [P(), P()])]),
    () => call('projective', Array.from({ length: 8 }, P)),
    () => call('projective', [...Array.from({ length: 7 }, P), ideal(rng)]),
  ])();
  const sim = () =>
    pick(rng, [
      call('rotate', [P(), lit(rational(90n))]),
      call('reflect', [call('line', [P(), P()])]),
      call('homothety', [P(), lit(rational(BigInt(pick(rng, [-2, 2, 3])), 1n))]),
    ]);
  return pick(rng, [
    () => base,
    () => base,
    () => call('inverse', [base]),
    () => call('compose', [sim(), base]),
    () => call('compose', [base, sim()]),
    () => call('compose', [base, call('send_to_infinity', [call('line', [P(), P()])])]),
    () => call('compose', [call('inversion', [P(), lit(rational(4n))]), base]),
  ])();
}

function figure(rng: Rng): Expr {
  const P = () => point(rng);
  return pick(rng, [
    P,
    P,
    () => ideal(rng),
    () => call('line', [P(), P()]),
    () => call('segment', [P(), P()]),
    () => call('segment', [P(), P()]),
    () => call('ray', [P(), P()]),
    () => call('polygon', [P(), P(), P()]),
    () => call('circle', [P(), P()]),
    () => call('mark_angle', [P(), P(), P()]),
    () => call('mark_segment', [P(), P()]),
    () => call('text', [P(), { kind: 'str', value: 'P' }]),
  ])();
}

function disagreement(f: Value<number>, r: Value<Rational>, scale: number): string | undefined {
  if (f.kind !== r.kind) return `kinds ${f.kind} vs ${r.kind}`;
  if (f.kind === 'undefined' && r.kind === 'undefined' && f.reason !== r.reason)
    return `reasons "${f.reason}" vs "${r.reason}"`;
  if (f.kind === 'line' && r.kind === 'line') {
    const flags = (l: typeof f | typeof r) =>
      [l.chiral, l.lo === null, l.hi === null, l.outside === true].join();
    if (flags(f) !== flags(r)) return `line flags ${flags(f)} vs ${flags(r)}`;
  }
  if (f.kind === 'ideal_point' && r.kind === 'ideal_point' && f.chiral !== r.chiral)
    return 'ideal flags differ';
  if (f.kind === 'angle_mark' && r.kind === 'angle_mark' && f.right !== r.right)
    return 'right flags differ';
  const [fs, rs] = [numbersOf(f), numbersOf(r)];
  if (fs.length !== rs.length) return 'shapes differ';
  for (const [i, x] of fs.entries()) {
    const e = rs[i] === undefined ? undefined : tryToNumber(rs[i]);
    if (e === undefined || !(Math.abs(x - e) <= TOLERANCE * Math.max(1, Math.abs(e), scale)))
      return `component ${String(i)}: ${String(x)} vs ${String(e)}`;
  }
  return undefined;
}

describe(
  `L3: images under projective maps (${String(SAMPLES)} samples)`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('FloatField agrees with RationalField; mod p reduces the exact value', () => {
      const tally = { defined: 0, undefinedAgree: 0, inexact: 0, excluded: 0, modp: 0 };
      const kinds = new Map<string, number>();
      const watch = bandWatch(FloatField);
      for (let i = 0; i < SAMPLES; i += 1) {
        const rng = createRng(deriveSeed(1601, i));
        const b = new Builder();
        const x = b.add('x', call('apply', [projectiveMap(rng), figure(rng)]));
        const ctx = contextOf(b.doc);
        watch.reset();
        const fv = evaluate(b.doc, REGISTRY, watch.field, ctx).values.get(x.id);
        const rv = evaluate(b.doc, REGISTRY, RationalField, ctx).values.get(x.id);
        const mv = evaluate(b.doc, REGISTRY, ModPField, ctx).values.get(x.id);
        if (fv === undefined || rv === undefined || mv === undefined)
          throw new Error('missing value');
        if (rv.kind !== 'inexact' && rv.kind !== 'undefined' && mv.kind !== 'inexact') {
          expect(mv.kind, `sample ${String(i)}`).toBe(rv.kind);
          const [ms, rs] = [numbersOf(mv), numbersOf(rv)];
          for (const [j, r] of rs.entries()) {
            const red = ModPField.fromRational(r);
            if (!isInexact(red)) expect(ms[j], `sample ${String(i)} mod p`).toBe(red);
          }
          tally.modp += 1;
        }
        if (rv.kind === 'inexact') tally.inexact += 1;
        else if (watch.touched()) tally.excluded += 1;
        else {
          expect(disagreement(fv, rv, ctx.scale), `sample ${String(i)}`).toBeUndefined();
          const key =
            rv.kind === 'line' ? `line${rv.outside === true ? ' (two rays)' : ''}` : rv.kind;
          kinds.set(key, (kinds.get(key) ?? 0) + 1);
          if (rv.kind === 'undefined') tally.undefinedAgree += 1;
          else tally.defined += 1;
        }
      }
      process.stdout.write(
        `L3 projective images: ${String(tally.defined)} defined + ${String(tally.undefinedAgree)} Undefined agree, ` +
          `${String(tally.inexact)} not exact, ${String(tally.excluded)} excluded (band); mod p ${String(tally.modp)}; ` +
          `${JSON.stringify([...kinds])}\n`,
      );
      expect(tally.defined).toBeGreaterThan(SAMPLES / 3);
      for (const k of [
        'point',
        'ideal_point',
        'line',
        'line (two rays)',
        'polygon',
        'angle_mark',
        'text',
      ])
        expect(kinds.get(k) ?? 0, k).toBeGreaterThan(0);
    });
  },
);
