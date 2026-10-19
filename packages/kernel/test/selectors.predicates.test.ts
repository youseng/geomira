/**
 * Every selector of SPEC §7 returns the candidate that satisfies its predicate (Run 3b),
 * in 500 DECISIVE random figures per selector (line ∩ circle, circle ∩ circle,
 * tangent_point, tangent_from as they apply). The candidates come from
 * helpers/branch-figures.ts (independent formulas); the predicate is evaluated here from
 * the selector's definition. One survivor → the call returns it; two → "ambiguous: add a
 * selector"; none → "no … satisfies …". A figure where some deciding quantity is within
 * 10⁻⁶·scale of its threshold is not decisive (it is the band tests' business) and is
 * counted, not judged.
 */
import { FloatField } from '@geomira/num/float-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, type Selector } from '../src/expr';
import { contextOf, evalDoc, valueOf } from './helpers/doc';
import {
  add,
  anywhere,
  branchFigure,
  cross,
  dot,
  freePoint,
  len,
  mul,
  resultPoint,
  sub,
  unit,
  type BranchFigure,
  type Kind,
  type V,
} from './helpers/branch-figures';
import { LAW_TIMEOUT, lawCount } from './helpers/laws';

const FIGURES = lawCount(500);
const DECISIVE = 1e-6;

/** keep: the predicate of each candidate; margin: its distance to the threshold (a length). */
interface Judged {
  readonly keep: readonly boolean[];
  readonly margin: number;
}

interface Case {
  readonly selector: Selector;
  readonly judge: Judged;
}

type Builder = (rng: Rng, f: BranchFigure) => Case;

const side = (X: V, P: V, Q: V): number => cross(sub(Q, P), sub(X, P)) / len(sub(Q, P));

function sideCase(kind: 'same_side' | 'opposite_side'): Builder {
  return (rng, f) => {
    const [X1, X2] = f.cands;
    const M = mul(add(X1, X2), 0.5);
    const P = rng.nextFloat() < 0.7 ? M : anywhere(rng);
    const Q = add(P, mul(unit(rng.uniform(0, 360)), rng.uniform(1, 10)));
    const R = anywhere(rng);
    const [l1, l2, q] = [
      freePoint(f.b, f.free, 'L_1', P),
      freePoint(f.b, f.free, 'L_2', Q),
      freePoint(f.b, f.free, 'Q', R),
    ];
    const sq = side(R, P, Q);
    const sx = f.cands.map((X) => side(X, P, Q));
    return {
      selector: { kind, q, l: call('line', [l1, l2]) },
      judge: {
        keep: sx.map((s) => (s > 0 === sq > 0) === (kind === 'same_side')),
        margin: Math.min(Math.abs(sq), ...sx.map(Math.abs)),
      },
    };
  };
}

function arcCase(not: boolean): Builder {
  return (rng, f) => {
    const { c, r } = f.circle;
    const on = rng.nextFloat() < 0.7;
    const at = (): V => (on ? add(c, mul(unit(rng.uniform(0, 360)), r)) : anywhere(rng));
    const [B, C, A] = [at(), at(), at()];
    const refs = [
      freePoint(f.b, f.free, 'B', B),
      freePoint(f.b, f.free, 'C', C),
      freePoint(f.b, f.free, 'D', A),
    ] as const;
    const sa = side(A, B, C);
    const sx = f.cands.map((X) => side(X, B, C));
    return {
      selector: { kind: 'on_arc', b: refs[0], c: refs[1], a: refs[2], not },
      judge: {
        keep: sx.map((s) => (s > 0 === sa > 0) !== not),
        margin: Math.min(Math.abs(sa), ...sx.map(Math.abs), len(sub(C, B))),
      },
    };
  };
}

const betweenCase: Builder = (rng, f) => {
  const [X1, X2] = f.cands;
  const i = rng.nextInt(2);
  const [Xi, Xj] = i === 0 ? [X1, X2] : [X2, X1];
  const structured = rng.nextFloat() < 0.6;
  const A = structured ? add(Xi, mul(sub(Xi, Xj), rng.uniform(0.1, 1))) : anywhere(rng);
  const B = structured
    ? add(mul(add(X1, X2), 0.5), mul(unit(rng.uniform(0, 360)), 0.1))
    : anywhere(rng);
  const [a, b] = [freePoint(f.b, f.free, 'E', A), freePoint(f.b, f.free, 'F', B)];
  const u = sub(B, A);
  const ts = f.cands.map((X) => dot(sub(X, A), u) / dot(u, u));
  return {
    selector: { kind: 'between', a, b },
    judge: {
      keep: ts.map((t) => t > 0 && t < 1),
      margin: Math.min(...ts.map((t) => Math.min(Math.abs(t), Math.abs(1 - t)) * len(u))),
    },
  };
};

function discCase(inside: boolean): Builder {
  return (rng, f) => {
    const [X1, X2] = f.cands;
    const Xi = rng.nextFloat() < 0.5 ? X1 : X2;
    const structured = rng.nextFloat() < 0.6;
    const Z = structured
      ? add(Xi, mul(unit(rng.uniform(0, 360)), len(sub(X1, X2)) * 0.1))
      : anywhere(rng);
    const rho = structured ? len(sub(X1, X2)) * rng.uniform(0.3, 0.7) : rng.uniform(1, 20);
    const z = freePoint(f.b, f.free, 'Z', Z);
    const w = freePoint(f.b, f.free, 'Z_1', add(Z, mul(unit(rng.uniform(0, 360)), rho)));
    const gaps = f.cands.map((X) => len(sub(X, Z)) - rho);
    return {
      selector: { kind: inside ? 'inside' : 'outside', c: call('circle', [z, w]) },
      judge: { keep: gaps.map((g) => g < 0 === inside), margin: Math.min(...gaps.map(Math.abs)) },
    };
  };
}

function rankCase(near: boolean): Builder {
  return (rng, f) => {
    const R =
      rng.nextFloat() < 0.5
        ? anywhere(rng)
        : add(f.cands[rng.nextInt(2)] ?? [0, 0], mul(unit(rng.uniform(0, 360)), rng.uniform(0, 5)));
    const p = freePoint(f.b, f.free, 'N', R);
    const [d1, d2] = f.cands.map((X) => len(sub(X, R))) as [number, number];
    const first = near ? d1 < d2 : d1 > d2;
    return {
      selector: { kind: near ? 'near' : 'far_from', p },
      judge: { keep: [first, !first], margin: Math.abs(d1 - d2) },
    };
  };
}

/** other(T) on a figure built through T (branchFigure's `through`): the candidate ≠ T. */
const otherCase: Builder = (_rng, f) => {
  const T = f.free[1] ?? [0, 0]; // the point both curves pass through (free[1], see branchFigure)
  const [d1, d2] = f.cands.map((X) => len(sub(X, T))) as [number, number];
  return {
    selector: { kind: 'other', p: f.b.ref('T') },
    judge: { keep: [d1 > d2, d2 > d1], margin: Math.abs(d1 - d2) },
  };
};

function alongCase(sign: 1 | -1): Builder {
  return (_rng, f) => {
    const d = f.line?.d ?? [1, 0];
    const [X1, X2] = f.cands;
    const t = (dot(sub(X2, X1), d) / len(d)) * sign;
    return {
      selector: { kind: 'along', sign },
      judge: { keep: [t < 0, t > 0], margin: Math.abs(t) },
    };
  };
}

function orientCase(sign: 1 | -1): Builder {
  return (_rng, f) => {
    const { from, to } = f.orient ?? { from: [0, 0], to: [1, 0] };
    const w = sub(to, from);
    const s = f.cands.map((X) => (cross(w, sub(X, from)) / len(w)) * sign);
    return {
      selector: { kind: 'orient', sign },
      judge: { keep: s.map((x) => x > 0), margin: Math.min(...s.map(Math.abs)) },
    };
  };
}

const ALL_KINDS: readonly Kind[] = ['lc', 'cc', 'tp', 'tf'];

const SELECTORS: readonly (readonly [string, readonly Kind[], Builder, boolean?])[] = [
  ['same_side', ALL_KINDS, sideCase('same_side')],
  ['opposite_side', ALL_KINDS, sideCase('opposite_side')],
  ['on_arc', ALL_KINDS, arcCase(false)],
  ['on_arc not', ALL_KINDS, arcCase(true)],
  ['between', ALL_KINDS, betweenCase],
  ['inside', ALL_KINDS, discCase(true)],
  ['outside', ALL_KINDS, discCase(false)],
  ['near', ALL_KINDS, rankCase(true)],
  ['far_from', ALL_KINDS, rankCase(false)],
  ['other', ALL_KINDS, otherCase, true],
  ['along(+)', ['lc'], alongCase(1)],
  ['along(-)', ['lc'], alongCase(-1)],
  ['orient(+)', ['cc', 'tp', 'tf'], orientCase(1)],
  ['orient(-)', ['cc', 'tp', 'tf'], orientCase(-1)],
];

interface Tally {
  one: number;
  two: number;
  none: number;
  skipped: number;
}

function judgeFigure(f: BranchFigure, c: Case, t: Tally): void {
  f.b.add('X', call(f.tool, [...f.args], [c.selector]));
  const ctx = contextOf(f.b.doc);
  if (c.judge.margin < DECISIVE * ctx.scale) {
    t.skipped += 1;
    return;
  }
  const v = valueOf(f.b.doc, evalDoc(f.b.doc, FloatField, ctx), 'X');
  const kept = f.cands.filter((_, i) => c.judge.keep[i] === true);
  const noun =
    f.tool === 'intersect'
      ? 'intersection'
      : f.tool === 'tangent_point'
        ? 'touch point'
        : 'tangent';
  const [only] = kept;
  if (kept.length === 1 && only !== undefined) {
    const p = resultPoint(v);
    expect(p, JSON.stringify(v)).toBeDefined();
    if (p === undefined) return;
    expect(len(sub(p, only)), JSON.stringify([v, only])).toBeLessThan(1e-8 * ctx.scale);
    if (v.kind === 'line') {
      expect(v.chiral).toBe(true);
      expect(Math.abs(dot([v.d.x, v.d.y], sub(only, f.circle.c)))).toBeLessThan(
        1e-8 * ctx.scale * ctx.scale,
      );
    }
    t.one += 1;
  } else if (kept.length === 2) {
    expect(v).toMatchObject({
      kind: 'undefined',
      reason: expect.stringMatching(/^ambiguous: add a selector: both/) as unknown,
    });
    t.two += 1;
  } else {
    expect(v).toMatchObject({
      kind: 'undefined',
      reason: expect.stringMatching(new RegExp(`^no ${noun} satisfies `)) as unknown,
    });
    t.none += 1;
  }
}

describe(
  `each selector returns the candidate satisfying its predicate (${String(FIGURES)} decisive figures each)`,
  { timeout: LAW_TIMEOUT },
  () => {
    for (const [name, kinds, build, through] of SELECTORS) {
      it(name, () => {
        const t: Tally = { one: 0, two: 0, none: 0, skipped: 0 };
        for (let i = 0; t.one + t.two + t.none < FIGURES; i += 1) {
          expect(i, 'too many indecisive or failed draws').toBeLessThan(FIGURES * 4);
          const rng = createRng(deriveSeed(3301, i * 31 + name.length));
          const kind = kinds[rng.nextInt(kinds.length)] ?? 'lc';
          const f = branchFigure(rng, kind, through === true);
          if (f === undefined) {
            t.skipped += 1;
            continue;
          }
          judgeFigure(f, build(rng, f), t);
        }
        process.stdout.write(
          `selector ${name}: ${String(t.one)} one survivor, ${String(t.two)} two, ${String(t.none)} none; ${String(t.skipped)} draws not decisive\n`,
        );
        expect(t.one).toBeGreaterThanOrEqual(FIGURES / 3);
      });
    }
  },
);
