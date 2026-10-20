/**
 * Branch choices under transformations (Run 4, note C; ADR-0006, ADR-0007). An image is
 * apply(T, value): the selector is never re-evaluated in the image. These tests check,
 * on random float figures, what a selector means when the construction is REBUILT from the
 * images, so that the chirality flag behaves as the mirror tests of Run 3b expect:
 *   - along(±) on apply(T, l) ∩ apply(T, c) picks apply(T, the source choice) for EVERY
 *     similarity (apply keeps the parameter t of p + t·d);
 *   - rebuilt from the images of the defining points, along(±) keeps its choice under a
 *     direct map, and under an anti map keeps it on an achiral line and swaps it on a
 *     chiral one (perp): exactly the orientation dependence of SPEC §7;
 *   - orient(±) keeps its choice under direct maps and swaps under anti maps;
 *   - other(P) (reflection-equivariant) always keeps it.
 */
import { FloatField } from '@geomira/num/float-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { fromNumber } from '@geomira/num/rational';
import { describe, expect, it } from 'vitest';
import { call, lit, type Expr, type Selector } from '../src/expr';
import type { Value } from '../src/value';
import { Builder, contextOf, evalDoc, num, valueOf } from './helpers/doc';
import { sameValues } from './helpers/similarity-gen';

const FIGURES = 400;
const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);

/** The maps: two direct, two anti. */
const MAPS: readonly {
  readonly name: string;
  readonly anti: boolean;
  make: (p: Expr[]) => Expr;
}[] = [
  { name: 'rotate', anti: false, make: ([U]) => T('rotate', must(U), num(90)) },
  {
    name: 'spiral',
    anti: false,
    make: ([U, V, W, Z]) => T('spiral', must(U), must(V), must(W), must(Z)),
  },
  { name: 'reflect', anti: true, make: ([U, V]) => T('reflect', T('line', must(U), must(V))) },
  {
    name: 'reflect∘homothety',
    anti: true,
    make: ([U, V, W]) =>
      T('compose', T('reflect', T('line', must(U), must(V))), T('homothety', must(W), num('-3/2'))),
  },
];

function must(e: Expr | undefined): Expr {
  if (e === undefined) throw new Error('missing');
  return e;
}

function freePoint(b: Builder, rng: Rng, name: string): Expr {
  return b.add(
    name,
    T('point', lit(fromNumber(rng.uniform(-10, 10))), lit(fromNumber(rng.uniform(-10, 10)))),
  );
}

interface Outcome {
  same: number;
  swapped: number;
  undefined: number;
}

/** Evaluates `x` (the source choice's image), `y` (the rebuilt choice) and `z` (the other branch's image). */
function compare(b: Builder, out: Outcome, expectSame: boolean, what: string): void {
  const ev = evalDoc(b.doc, FloatField, contextOf(b.doc));
  const [x, y, z] = ['X', 'Y', 'Z'].map((n) => valueOf(b.doc, ev, n)) as [
    Value<number>,
    Value<number>,
    Value<number>,
  ];
  if (x.kind !== 'point' || y.kind !== 'point' || z.kind !== 'point') {
    out.undefined += 1;
    return;
  }
  const [toX, toZ] = [sameValues(FloatField, y, x), sameValues(FloatField, y, z)];
  expect([toX, toZ], what).toEqual(expectSame ? [true, false] : [false, true]);
  if (expectSame) out.same += 1;
  else out.swapped += 1;
}

type Line = 'line' | 'perp';

/** P = intersect(l, c, along(s)); the image and the choice on the rebuilt images. */
function alongCase(
  rng: Rng,
  map: (typeof MAPS)[number],
  kind: Line,
  rebuilt: boolean,
  out: Outcome,
): void {
  const b = new Builder();
  const [A, B, Q, O, R, U, V, W, Z] = ['A', 'B', 'Q', 'O', 'R', 'U', 'V', 'W', 'Z_0'].map((n) =>
    freePoint(b, rng, n),
  );
  const s = rng.nextFloat() < 0.5 ? 1 : -1;
  const along = (sign: 1 | -1): Selector[] => [{ kind: 'along', sign }];
  const lineOf = (a: Expr, bb: Expr, q: Expr) =>
    kind === 'line' ? T('line', a, bb) : T('perp', q, T('line', a, bb));
  const t = b.add('t', map.make([must(U), must(V), must(W), must(Z)]));
  const [l, c] = [
    b.add('l', lineOf(must(A), must(B), must(Q))),
    b.add('c', T('circle', must(O), must(R))),
  ];
  b.add('P', call('intersect', [l, c], along(s)));
  b.add('P_2', call('intersect', [l, c], along(-s as 1 | -1)));
  b.add('X', T('apply', t, b.ref('P')));
  b.add('Z', T('apply', t, b.ref('P_2')));
  const img = (e: Expr) => T('apply', t, e);
  const [li, ci] = rebuilt
    ? [lineOf(img(must(A)), img(must(B)), img(must(Q))), T('circle', img(must(O)), img(must(R)))]
    : [img(l), img(c)];
  b.add('Y', call('intersect', [li, ci], along(s)));
  const same = !rebuilt || !map.anti || kind === 'line';
  compare(b, out, same, `${map.name} ${kind} rebuilt=${String(rebuilt)}`);
}

/** P = intersect(c1, c2, orient(s)) or other(P) choices, imaged vs rebuilt. */
function circleCase(
  rng: Rng,
  map: (typeof MAPS)[number],
  sel: 'orient' | 'other',
  out: Outcome,
): void {
  const b = new Builder();
  const [O1, R1, O2, U, V, W, Z] = ['O_1', 'R_1', 'O_2', 'U', 'V', 'W', 'Z_0'].map((n) =>
    freePoint(b, rng, n),
  );
  const t = b.add('t', map.make([must(U), must(V), must(W), must(Z)]));
  const img = (e: Expr) => T('apply', t, e);
  b.add('c', T('circle', must(O1), must(R1)));
  b.add('d', T('circle', must(O2), must(R1)));
  const [c, d] = [b.ref('c'), b.ref('d')];
  const s = rng.nextFloat() < 0.5 ? 1 : -1;
  const pick = (sign: 1 | -1, p: Expr): Selector[] =>
    sel === 'orient' ? [{ kind: 'orient', sign }] : [{ kind: 'other', p }];
  // other(R1): R1 lies on both circles, so the other intersection is the choice.
  b.add('P', call('intersect', [c, d], pick(s, must(R1))));
  b.add(
    'P_2',
    sel === 'orient' ? call('intersect', [c, d], pick(-s as 1 | -1, must(R1))) : must(R1),
  );
  b.add('X', img(b.ref('P')));
  b.add('Z', img(b.ref('P_2')));
  const rebuilt = [
    T('circle', img(must(O1)), img(must(R1))),
    T('circle', img(must(O2)), img(must(R1))),
  ];
  b.add('Y', call('intersect', rebuilt, pick(s, img(must(R1)))));
  compare(b, out, sel === 'other' || !map.anti, `${map.name} ${sel}`);
}

describe('branch choices under similarities (note C)', () => {
  for (const map of MAPS) {
    for (const kind of ['line', 'perp'] as const) {
      for (const rebuilt of [false, true]) {
        const label = rebuilt ? 'rebuilt from the images' : 'apply(T, l) ∩ apply(T, c)';
        const expectText = !rebuilt || !map.anti || kind === 'line' ? 'keeps' : 'swaps';
        it(`along(±) on ${kind}, ${map.name}, ${label}: ${expectText} the choice`, () => {
          const out: Outcome = { same: 0, swapped: 0, undefined: 0 };
          for (let i = 0; i < FIGURES; i += 1)
            alongCase(createRng(deriveSeed(1400, i)), map, kind, rebuilt, out);
          expect(out.same + out.swapped).toBeGreaterThan(FIGURES / 4);
        });
      }
    }
    for (const sel of ['orient', 'other'] as const) {
      const expectText = sel === 'other' || !map.anti ? 'keeps' : 'swaps';
      it(`${sel} on circle ∩ circle, ${map.name}, rebuilt from the images: ${expectText} the choice`, () => {
        const out: Outcome = { same: 0, swapped: 0, undefined: 0 };
        for (let i = 0; i < FIGURES; i += 1)
          circleCase(createRng(deriveSeed(1401, i)), map, sel, out);
        expect(out.same + out.swapped).toBeGreaterThan(FIGURES / 4);
      });
    }
  }
});
