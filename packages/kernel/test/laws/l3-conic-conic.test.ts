/**
 * Law L3 for Run 16c (ADR-0043): the exact oracle where conic ∩ conic and foci are exact.
 *   - Two conics through four random grid points P, Q, R, S (their fifth points differ), and a
 *     circle through P, Q, R with a conic through P, Q, R and two more grid points: other(P, Q, R)
 *     gives the fourth common point exactly, sometimes followed by a random filter or ranker.
 *   - foci of the image of y = x² under a random rational similarity (a parabola: rational),
 *     and of the image of x²/25 + y²/9 = 1 (rational foci, two square roots that are rational).
 * FloatField agrees with RationalField (same kind, same Undefined reason, numbers within 1e-9
 * relative) wherever no float decision saw a quantity within the band; ModPField agrees with the
 * reduction of the exact result wherever it is not Inexact.
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { rational, tryToNumber, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/evaluate';
import { call, lit, type Expr, type Selector } from '../../src/expr';
import { numbersOf, type Value } from '../../src/value';
import { Builder, REGISTRY, contextOf } from '../helpers/doc';
import type { Field } from '@geomira/num/field';
import {
  bandThreshold,
  zeroThreshold,
  type Dim,
  type ToleranceContext,
} from '@geomira/num/tolerance';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const SAMPLES = lawCount(600);
const TOLERANCE = 1e-9;

function grid(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(1025) - 512), 32n);
}

function smallQ(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(21) - 10), BigInt(rng.nextInt(4) + 1));
}

class Fig {
  readonly b = new Builder();
  private n = 0;
  point(x: Rational, y: Rational): Expr {
    this.n += 1;
    return this.b.add(`P_{${String(this.n)}}`, call('point', [lit(x), lit(y)]));
  }
  obj(def: Expr): Expr {
    this.n += 1;
    return this.b.add(`o${String(this.n)}`, def);
  }
}

/** A random extra selector after other(P, Q, R): none, a filter or a ranker. */
function extra(rng: Rng, f: Fig): Selector[] {
  const r = rng.nextInt(4);
  if (r === 0) return [];
  const p = f.point(grid(rng), grid(rng));
  if (r === 1) return [{ kind: 'near', p }];
  const l = f.obj(call('line', [p, f.point(grid(rng), grid(rng))]));
  return [{ kind: r === 2 ? 'same_side' : 'opposite_side', q: f.point(grid(rng), grid(rng)), l }];
}

/** A conic ∩ conic or conic ∩ circle figure whose other(P, Q, R) is exact. */
function intersection(rng: Rng): { f: Fig; x: Expr } {
  const f = new Fig();
  const [P, Q, R] = [0, 1, 2].map(() => f.point(grid(rng), grid(rng))) as [Expr, Expr, Expr];
  const more = () => f.point(grid(rng), grid(rng));
  const circle = rng.nextInt(3) === 0;
  const S = more();
  const k1 = circle ? f.obj(call('circle', [P, Q, R])) : f.obj(call('conic', [P, Q, R, S, more()]));
  const k2 = f.obj(call('conic', circle ? [P, Q, R, more(), more()] : [P, Q, R, S, more()]));
  const order = rng.nextInt(2) === 0 ? [k1, k2] : [k2, k1];
  const names = [P, Q, R].sort(() => rng.nextInt(3) - 1) as [Expr, Expr, Expr];
  const sels: Selector[] = [{ kind: 'other', p: names[0], rest: [names[1], names[2]] }];
  const x = f.obj(call('intersect', order, [...sels, ...extra(rng, f)]));
  return { f, x };
}

/** The image of a conic's points under z ↦ a·z + b (a, b random rationals), and foci of it. */
function focus(rng: Rng): { f: Fig; x: Expr } {
  const f = new Fig();
  const [ax, ay, bx, by] = [smallQ(rng), smallQ(rng), grid(rng), grid(rng)];
  const map = (x: number, y: number): Expr => {
    const X = rational(BigInt(x * 5), 5n);
    const Y = rational(BigInt(Math.round(y * 5)), 5n);
    const re = RationalField.sub(RationalField.mul(ax, X), RationalField.mul(ay, Y));
    const im = RationalField.add(RationalField.mul(ax, Y), RationalField.mul(ay, X));
    return f.point(RationalField.add(re, bx), RationalField.add(im, by));
  };
  const parabola = rng.nextInt(2) === 0;
  const pts = parabola
    ? [map(0, 0), map(1, 1), map(-1, 1), map(2, 4), map(-2, 4)]
    : [map(5, 0), map(0, 3), map(-5, 0), map(0, -3), map(3, 2.4)];
  const k = f.obj(call('conic', pts));
  const sel: Selector = { kind: 'near', p: f.point(grid(rng), grid(rng)) };
  return { f, x: f.obj(call('foci', [k], [sel])) };
}

/**
 * FloatField that records a decision inside the band but beyond EPS (the ambiguous zone, where
 * floats and Q can decide differently). Points on two conics by construction are within EPS of
 * them in floats (a zero decision, as over Q): unlike helpers/laws.ts's bandWatch, that zone is
 * compared, not excluded, so a float zero that Q calls non-zero fails the law.
 */
function ambiguityWatch(F: Field<number>) {
  let hit = false;
  const see = (x: number, dim: Dim, ctx: ToleranceContext) => {
    const a = Math.abs(x);
    if (a > zeroThreshold(dim, ctx) && a < bandThreshold(dim, ctx)) hit = true;
  };
  const field: Field<number> = {
    ...F,
    isZero: (x, dim, ctx) => (see(x, dim, ctx), F.isZero(x, dim, ctx)),
    sign: (x, dim, ctx) => (see(x, dim, ctx), F.sign(x, dim, ctx)),
  };
  return { field, touched: () => hit, reset: () => void (hit = false) };
}

function disagreement(fv: Value<number>, rv: Value<Rational>, scale: number): string | undefined {
  if (fv.kind !== rv.kind) return `kinds ${fv.kind} vs ${rv.kind}`;
  if (fv.kind === 'undefined' && rv.kind === 'undefined' && fv.reason !== rv.reason)
    return `reasons "${fv.reason}" vs "${rv.reason}"`;
  const [fs, rs] = [numbersOf(fv), numbersOf(rv)];
  for (const [i, x] of fs.entries()) {
    const e = rs[i] === undefined ? undefined : tryToNumber(rs[i]);
    if (e === undefined || !(Math.abs(x - e) <= TOLERANCE * Math.max(1, Math.abs(e), scale)))
      return `component ${String(i)}: ${String(x)} vs ${String(e)}`;
  }
  return undefined;
}

function law(name: string, make: (rng: Rng) => { f: Fig; x: Expr }, seed: number): void {
  it(name, () => {
    const tally = { defined: 0, undefined: 0, excluded: 0, modp: 0 };
    const watch = ambiguityWatch(FloatField);
    for (let i = 0; i < SAMPLES; i++) {
      const { f, x } = make(createRng(deriveSeed(seed, i)));
      if (x.kind !== 'ref') continue;
      const ctx = contextOf(f.b.doc);
      const rv = evaluate(f.b.doc, REGISTRY, RationalField, ctx).values.get(x.id);
      watch.reset();
      const fv = evaluate(f.b.doc, REGISTRY, watch.field, ctx).values.get(x.id);
      const mv = evaluate(f.b.doc, REGISTRY, ModPField, ctx).values.get(x.id);
      if (rv === undefined || fv === undefined || mv === undefined) throw new Error('no value');
      expect(rv.kind, `sample ${String(i)}: ${'reason' in rv ? rv.reason : ''}`).not.toBe(
        'inexact',
      );
      if (watch.touched()) tally.excluded += 1;
      else {
        expect(disagreement(fv, rv, ctx.scale), `sample ${String(i)}`).toBeUndefined();
        tally[rv.kind === 'undefined' ? 'undefined' : 'defined'] += 1;
      }
      if (mv.kind === 'point' && rv.kind === 'point') {
        const [mx, my] = [ModPField.fromRational(rv.x), ModPField.fromRational(rv.y)];
        expect([mv.x, mv.y]).toEqual([mx, my]);
        tally.modp += 1;
      }
    }
    process.stdout.write(`L3 ${name}: ${JSON.stringify(tally)}\n`);
    expect(tally.defined).toBeGreaterThan(SAMPLES / 4);
  });
}

describe(
  'L3: conic ∩ conic and foci agree with the exact oracle (ADR-0043)',
  { timeout: LAW_TIMEOUT },
  () => {
    law('conic ∩ conic: other(P, Q, R) (and a filter or ranker)', intersection, 1630);
    law('foci of parabolas and of conics with rational foci', focus, 1631);
  },
);
