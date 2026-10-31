/**
 * Law L3 for the common tangents of two circles and the centres of similitude (ADR-0045): the
 * exact oracle on figures whose four common tangents are RATIONAL. With D the distance of the
 * centres and two rational points (cα, sα), (cβ, sβ) of the unit circle, cα > |cβ|, the radii
 * r₁ = D(cα + cβ)/2 and r₂ = D(cα − cβ)/2 make s − (r₁ ∓ r₂)² = D²s²_{β,α}, squares, so every
 * touch point is rational (the line of centres along a Pythagorean direction). Some samples are
 * tangent (cα = 1: the double internal tangent), some have equal radii (cβ = 0), and a quarter
 * are random circles (irrational radii: the exact signs decide the count over Q, the positions
 * are Inexact). Random selectors (near, far_from, orient, side filters); FloatField agrees with
 * RationalField (same kind, same Undefined reason, numbers within 1e-9 relative) wherever no
 * float decision saw a quantity within the band (helpers/laws.ts bandWatch).
 */
import { FloatField } from '@geomira/num/float-field';
import { add, mul, rational, sub, div, tryToNumber, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/evaluate';
import { call, lit, type Expr, type Selector } from '../../src/expr';
import { numbersOf, type Value } from '../../src/value';
import { Builder, REGISTRY, contextOf } from '../helpers/doc';
import { LAW_TIMEOUT, bandWatch, lawCount } from '../helpers/laws';

const SAMPLES = lawCount(3000);
const TOLERANCE = 1e-9;
const TOOLS = ['tangent', 'tangent_point', 'exsimilicenter', 'insimilicenter'] as const;

const R = (n: number, d = 1): Rational => rational(BigInt(n), BigInt(d));

/** A rational point of the unit circle, ((1 − t²), 2t)/(1 + t²), with t = n/d ≥ 0. */
function unit(rng: Rng): readonly [Rational, Rational] {
  const t = R(rng.nextInt(9), rng.nextInt(4) + 1);
  const den = add(R(1), mul(t, t));
  return [div(sub(R(1), mul(t, t)), den), div(mul(R(2), t), den)];
}

const PYTHAGOREAN: readonly (readonly [number, number])[] = [
  [5, 0],
  [3, 4],
  [-4, 3],
  [0, -5],
  [12, 5],
  [-8, -15],
];

class Fig {
  readonly b = new Builder();
  private n = 0;
  constructor(readonly rng: Rng) {}

  point(x: Rational, y: Rational): Expr {
    this.n += 1;
    return this.b.add(`P${String(this.n)}`, call('point', [lit(x), lit(y)]));
  }

  random(): Expr {
    const c = () => R(this.rng.nextInt(641) - 320, 16);
    return this.point(c(), c());
  }

  /** Two circles with rational common tangents (module comment), or random ones. */
  circles(): readonly [Expr, Expr, Expr] {
    const { rng } = this;
    if (rng.nextFloat() < 0.25) {
      const c = () =>
        this.b.add(
          `c${String(this.n++)}`,
          call('circle', [this.random(), lit(R(rng.nextInt(80) + 1, 8))]),
        );
      return [c(), c(), this.random()];
    }
    let [a, b] = [unit(rng), unit(rng)];
    if (rng.nextFloat() < 0.15) a = [R(1), R(0)];
    if (rng.nextFloat() < 0.15) b = [R(0), R(1)];
    if ((tryToNumber(a[0]) ?? 0) < Math.abs(tryToNumber(b[0]) ?? 0)) [a, b] = [b, a];
    const [ca, cb] = [a[0], rng.nextFloat() < 0.5 ? b[0] : sub(R(0), b[0])];
    if (!((tryToNumber(ca) ?? 0) > Math.abs(tryToNumber(cb) ?? 0))) return this.circles();
    const D = R(rng.nextInt(40) + 2, rng.nextInt(3) + 1);
    const [r1, r2] = [mul(D, div(add(ca, cb), R(2))), mul(D, div(sub(ca, cb), R(2)))];
    const [ux, uy] = PYTHAGOREAN[rng.nextInt(PYTHAGOREAN.length)] ?? [5, 0];
    const [ox, oy] = [R(rng.nextInt(161) - 80, 4), R(rng.nextInt(161) - 80, 4)];
    const O2: readonly [Rational, Rational] = [
      add(ox, mul(D, R(ux, 5))),
      add(oy, mul(D, R(uy, 5))),
    ];
    const P1 = this.point(ox, oy);
    const P2 = this.point(O2[0], O2[1]);
    const c1 = this.b.add('c_1', call('circle', [P1, lit(r1)]));
    const c2 = this.b.add('c_2', call('circle', [P2, lit(r2)]));
    return rng.nextFloat() < 0.5 ? [c1, c2, P2] : [c2, c1, P1];
  }

  selector(centre: Expr): Selector {
    const { rng } = this;
    switch (rng.nextInt(6)) {
      case 0:
        return { kind: rng.nextFloat() < 0.5 ? 'near' : 'far_from', p: this.random() };
      case 1:
        return { kind: rng.nextFloat() < 0.5 ? 'near' : 'far_from', p: centre };
      case 2:
        return {
          kind: rng.nextFloat() < 0.5 ? 'same_side' : 'opposite_side',
          q: this.random(),
          l: call('line', [this.random(), this.random()]),
        };
      default:
        return { kind: 'orient', sign: rng.nextFloat() < 0.5 ? 1 : -1 };
    }
  }
}

function disagreement(fv: Value<number>, rv: Value<Rational>, scale: number): string | undefined {
  if (fv.kind !== rv.kind) return `kinds ${fv.kind} vs ${rv.kind}`;
  if (fv.kind === 'undefined' && rv.kind === 'undefined' && fv.reason !== rv.reason)
    return `reasons "${fv.reason}" vs "${rv.reason}"`;
  if (fv.kind === 'line' && rv.kind === 'line' && fv.chiral !== rv.chiral)
    return 'chirality differs';
  const [fs, rs] = [numbersOf(fv), numbersOf(rv)];
  if (fs.length !== rs.length) return 'shapes differ';
  for (const [i, x] of fs.entries()) {
    const e = rs[i] === undefined ? undefined : tryToNumber(rs[i]);
    if (e === undefined || !(Math.abs(x - e) <= TOLERANCE * Math.max(1, Math.abs(e), scale)))
      return `component ${String(i)}: ${String(x)} vs ${String(e)}`;
  }
  return undefined;
}

describe(
  `L3 (ADR-0045): common tangents and centres of similitude agree with the exact oracle (${String(SAMPLES)} samples)`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('rational tangents, tangencies, equal radii, random circles', () => {
      const watch = bandWatch(FloatField);
      const tally = { defined: 0, undefinedAgree: 0, inexact: 0, excluded: 0 };
      const perTool: Record<string, number> = {};
      for (let k = 0; k < SAMPLES; k += 1) {
        const f = new Fig(createRng(deriveSeed(4545, k)));
        const tool = TOOLS[k % TOOLS.length] ?? 'tangent';
        const [c1, c2, centre] = f.circles();
        const branch = tool === 'tangent' || tool === 'tangent_point';
        // A random selector or two, then near / far_from a random point (which decides).
        const sels: Selector[] = branch
          ? [
              ...Array.from({ length: f.rng.nextInt(3) }, () => f.selector(centre)),
              { kind: f.rng.nextFloat() < 0.5 ? 'near' : 'far_from', p: f.random() },
            ]
          : [];
        const x = f.b.add('X', call(tool, [c1, c2], sels));
        const ctx = contextOf(f.b.doc);
        watch.reset();
        const fv = evaluate(f.b.doc, REGISTRY, watch.field, ctx).values.get(x.id);
        const rv = evaluate(f.b.doc, REGISTRY, RationalField, ctx).values.get(x.id);
        if (fv === undefined || rv === undefined) throw new Error('missing value');
        if (rv.kind === 'inexact') tally.inexact += 1;
        else if (watch.touched()) tally.excluded += 1;
        else {
          expect(
            disagreement(fv, rv, ctx.scale),
            `sample ${String(k)} ${tool} ${JSON.stringify(sels.map((s) => s.kind))}`,
          ).toBeUndefined();
          if (rv.kind === 'undefined') tally.undefinedAgree += 1;
          else {
            tally.defined += 1;
            perTool[tool] = (perTool[tool] ?? 0) + 1;
          }
        }
      }
      process.stdout.write(
        `L3 common tangents: ${JSON.stringify(tally)} defined per tool ${JSON.stringify(perTool)}\n`,
      );
      for (const t of TOOLS) expect(perTool[t] ?? 0, t).toBeGreaterThan(SAMPLES / 20);
    });
  },
);
