/** Unit tests of the internal modules: paths, free inputs, probes, the budget field, float helpers. */
import { ModPField } from '@geomira/num/modp';
import { rational } from '@geomira/num/rational';
import { createRng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, lit, ref, type Expr, type Selector } from '@geomira/kernel/expr';
import { budgetField } from '../src/budget';
import { exactDecide } from '../src/decide';
import { valueOf } from '../src/eval-claim';
import { callsOf, children, exprAt, flipSelector, replaceAt } from '../src/expr-path';
import * as f from '../src/float';
import { readFree, writeFree } from '../src/free';
import { claimKind } from '../src/kinds';
import { prepare } from '../src/prepare';
import { addProbes, closureOf, truncate, withoutProbes } from '../src/probes';
import { decideSample } from '../src/rungs';
import { drawSample } from '../src/sampler';
import { c, Figure, n, REGISTRY } from './helpers/build';
import { line, pt } from './helpers/values';

const P = lit(rational(7n));
const SELECTORS: Selector[] = [
  { kind: 'same_side', q: ref(1), l: ref(2) },
  { kind: 'opposite_side', q: ref(1), l: ref(2) },
  { kind: 'on_arc', b: ref(1), c: ref(2), a: ref(3), not: true },
  { kind: 'between', a: ref(1), b: ref(2) },
  { kind: 'inside', c: ref(1) },
  { kind: 'outside', c: ref(1) },
  { kind: 'other', p: ref(1) },
  { kind: 'near', p: ref(1) },
  { kind: 'far_from', p: ref(1) },
  { kind: 'along', sign: 1 },
  { kind: 'orient', sign: -1 },
];

describe('expression paths', () => {
  it('replace a selector expression of every selector kind (children after the arguments)', () => {
    for (const s of SELECTORS) {
      const e = call('intersect', [ref(8), ref(9)], [s]);
      const kids = children(e);
      for (let i = 2; i < kids.length; i++) {
        const r = replaceAt(e, [i], () => P);
        expect(exprAt(r, [i])).toEqual(P);
        expect(r.kind === 'call' ? r.selectors[0]?.kind : '').toBe(s.kind);
        expect(children(r).filter((_, k) => k !== i)).toEqual(kids.filter((_, k) => k !== i));
      }
    }
  });

  it('invalid paths change nothing; flipping only touches along and orient', () => {
    const e: Expr = call(
      'intersect',
      [ref(1), ref(2)],
      [
        { kind: 'orient', sign: 1 },
        { kind: 'near', p: ref(3) },
      ],
    );
    expect(replaceAt(e, [7], () => P)).toEqual(e);
    expect(replaceAt(ref(1), [0], () => P)).toEqual(ref(1));
    expect(exprAt(e, [0, 4])).toBeUndefined();
    const flipped = flipSelector(e, [], 0);
    expect(flipped.kind === 'call' ? flipped.selectors : []).toEqual([
      { kind: 'orient', sign: -1 },
      { kind: 'near', p: ref(3) },
    ]);
    expect(flipSelector(e, [], 1)).toEqual(e);
    expect(flipSelector(ref(4), [], 0)).toEqual(ref(4));
    expect(callsOf(call('midpoint', [call('point', [P, P]), ref(1)])).map((x) => x.path)).toEqual([
      [],
      [0],
    ]);
  });
});

describe('free inputs, probes, the budget field, float helpers', () => {
  it('free points inside a selector are sampled like any other', () => {
    const g = new Figure().point('A', 0, 0).point('B', 4, 0);
    g.add(
      'X',
      call(
        'intersect',
        [
          call('circle', [ref(g.id('A')), ref(g.id('B'))]),
          call('circle', [ref(g.id('B')), ref(g.id('A'))]),
        ],
        [
          {
            kind: 'same_side',
            q: call('point', [lit(rational(1n)), lit(rational(3n))]),
            l: call('line', [ref(g.id('A')), ref(g.id('B'))]),
          },
        ],
      ),
    );
    const id = g.claim('collinear', 'A', 'B', 'X');
    const p = prepare(g.doc, id, REGISTRY);
    if (!p.ok) throw new Error(p.reason);
    expect(p.prepared.free.map((x) => [x.kind, x.path])).toEqual([
      ['point', []],
      ['point', []],
      ['point', [2]],
    ]);
    const s = drawSample(p.prepared, 'global', 3, false);
    expect(readFree(s, p.prepared.free[2] ?? p.prepared.free[0] ?? fail())).not.toEqual([
      rational(1n),
      rational(3n),
    ]);
  });

  it('readFree of a vanished input is undefined; writeFree ignores extra values', () => {
    const g = new Figure().point('A', 1, 2);
    const p = prepare(
      { ...g.doc, claims: [{ id: 99, kind: 'equal', args: [ref(g.id('A')), ref(g.id('A'))] }] },
      99,
      REGISTRY,
    );
    if (!p.ok) throw new Error(p.reason);
    const input = p.prepared.free[0] ?? fail();
    expect(readFree({ ...p.prepared.doc, objects: [] }, input)).toBeUndefined();
    const w = writeFree(p.prepared.doc, [
      { input, values: [rational(5n), rational(6n), rational(7n)] },
    ]);
    expect(readFree(w, input)).toEqual([rational(5n), rational(6n)]);
  });

  it('probes, closures and truncation', () => {
    const g = new Figure().point('A', 1, 2).point('B', 3, 4).def('M', 'midpoint', 'A', 'B');
    const pr = addProbes(g.doc, [ref(g.id('M'))]);
    const [probe] = pr.ids;
    expect(closureOf(pr.doc, [probe ?? -1, 12345])).toEqual(
      new Set([probe, g.id('M'), g.id('A'), g.id('B')]),
    );
    expect(truncate(pr.doc, new Set([g.id('A')])).objects.map((o) => o.name)).toEqual(['A']);
    expect(withoutProbes(pr.doc).objects.map((o) => o.name)).toEqual(['A', 'B', 'M']);
  });

  it('the budget field answers 1 once a result exceeds the budget, and says so', () => {
    const b = budgetField(20);
    const x = b.field.mul(rational(255n), rational(255n));
    expect(b.exceeded()).toBe(false);
    expect(x).toEqual(rational(65025n));
    expect(b.field.mul(x, x)).toEqual(rational(1n));
    expect(b.exceeded()).toBe(true);
    expect([b.field.add(x, x), b.field.sub(x, x), b.field.div(x, x), b.field.neg(x)]).toEqual(
      Array(4).fill(rational(1n)),
    );
  });

  it('float helpers never return NaN', () => {
    expect(f.ratio(1, 0)).toBe(Infinity);
    expect(f.ratio(Infinity, 1)).toBe(Infinity);
    expect(f.maxOf([1, NaN, 2])).toBe(Infinity);
    expect(f.maxOf([])).toBe(0);
  });
});

describe('decisions and outcomes', () => {
  it('an order item mod p is not evaluable: the exact decision is Inexact (the rung falls through)', () => {
    const k = claimKind('on') ?? fail();
    const args = [pt(ModPField, ['1/2', '1/2']), line(ModPField, [0, 0], [1, 1], 'segment')];
    expect(exactDecide(ModPField, k, args, { scale: 1 })).toMatchObject({ kind: 'inexact' });
    const bad = exactDecide(
      ModPField,
      claimKind('length') ?? fail(),
      [...args, ...args, { kind: 'number', v: 0n, exact: rational(0n) }],
      { scale: 1 },
    );
    expect(bad).toMatchObject({ kind: 'invalid' });
  });

  it('valueOf maps every outcome to a claim value', () => {
    expect(valueOf({ kind: 'rejected', reason: 'r' })).toEqual({
      value: 'undefined',
      status: 'undefined',
      reason: 'r',
    });
    for (const k of [
      'degenerate',
      'undefined',
      'ambiguous',
      'ill-conditioned',
      'invalid',
    ] as const) {
      expect(valueOf({ kind: k, reason: 'x' })).toEqual({
        value: 'undefined',
        status: k,
        reason: 'x',
      });
    }
  });

  it('a figure beyond the supported scale is undefined, never true or false', () => {
    const g = new Figure().point('A', 0, 0).point('B', 1, 0).point('C', 2, 0);
    const id = g.claim('collinear', 'A', 'B', 'C');
    const p = prepare(g.doc, id, REGISTRY);
    if (!p.ok) throw new Error(p.reason);
    const huge = writeFree(p.prepared.doc, [
      { input: p.prepared.free[0] ?? fail(), values: [rational(10n ** 200n), rational(0n)] },
    ]);
    expect(
      decideSample(p.prepared, huge, { budgetBits: 64, rng: createRng(1), hypotheses: false }).kind,
    ).toBe('undefined');
  });

  it('gliders and params in the numeric and mod-p rungs', () => {
    const g = new Figure()
      .point('O', 0, 0)
      .point('X', 5, 0)
      .add('w', c('circle', 'O', n(5)))
      .add('P', c('on', 'w', n(30)))
      .add('Q', c('on', c('ray', 'O', 'X'), n('1/2')))
      .add('k', c('param', n(0), n(2), n('1/2')))
      .def('R', 'divide', 'O', 'P', 'k');
    const id = g.claim('collinear', 'O', 'P', 'R');
    const p = prepare(g.doc, id, REGISTRY);
    if (!p.ok) throw new Error(p.reason);
    expect(p.prepared.free.map((x) => x.kind)).toEqual([
      'point',
      'point',
      'radius',
      'angle-glider',
      'line-glider',
      'param',
    ]);
    expect(
      decideSample(p.prepared, p.prepared.doc, {
        budgetBits: 4096,
        rng: createRng(1),
        hypotheses: false,
      }),
    ).toEqual({ kind: 'true', rung: 'numeric' });
    for (const regime of ['local', 'global'] as const) {
      for (let s = 0; s < 20; s++) {
        const d = drawSample(p.prepared, regime, s, false);
        expect(
          decideSample(p.prepared, d, { budgetBits: 4096, rng: createRng(s), hypotheses: false })
            .kind,
        ).toBe('true');
      }
    }
    const h = new Figure()
      .point('O', 0, 0)
      .point('X', 5, 0)
      .add('Q', c('on', c('ray', 'O', 'X'), n('1/2')))
      .add('k', c('param', n(0), n(2), n('1/2')))
      .def('R', 'divide', 'O', 'Q', 'k');
    const id2 = h.claim('collinear', 'O', 'Q', 'R');
    const p2 = prepare(h.doc, id2, REGISTRY);
    if (!p2.ok) throw new Error(p2.reason);
    const src = { nextUint32: () => 123456789 };
    // A ray glider is order-based mod p (Inexact), so the sample falls through to the numeric rung.
    expect(
      decideSample(p2.prepared, p2.prepared.doc, {
        budgetBits: 4,
        rng: createRng(1),
        hypotheses: false,
        entropy: src,
      }),
    ).toEqual({ kind: 'true', rung: 'numeric' });
  });
});

function fail(): never {
  throw new Error('missing');
}
