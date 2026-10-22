/**
 * Run 10 audit, hunt item "NaN/Infinity leaks" (CLAUDE.md: no Value holds NaN or ±Infinity):
 * an extreme-value fuzz of every tool. Free points with coordinates near 2^200 and 1e-300,
 * tiny and huge radii, near-degenerate configurations; every tool on random arguments of the
 * right kinds (and random selectors on the branching tools), the results fed back into the
 * pool. evaluate never throws and no value holds a non-finite number, in every field.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { createRng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '../src/context';
import { evaluate } from '../src/evaluate';
import { call, type Expr, type RefExpr, type Selector } from '../src/expr';
import { capabilityKinds, numbersOf, type ValueKind } from '../src/value';
import { Builder, REGISTRY, num } from './helpers/doc';

/** Just below 2^200 ≈ 1.607e60, the largest argument the float rungs accept. */
const BIG = 1.5e60;
const COORDS = [0, 1, -1, 3, 1e-300, -1e-300, 1e-9, 2e-9, 1e-7, BIG, -BIG, 1e30, 7.25, 1e-5, 0.5];
const NUMS = [
  0,
  1,
  -1,
  2,
  90,
  180,
  45,
  1e-300,
  1e-9,
  2e-9,
  1e-7,
  BIG,
  -BIG,
  1e30,
  0.5,
  1e-20,
  1e20,
];

interface Pooled {
  readonly ref: RefExpr;
  readonly kind: ValueKind;
}

function pick<X>(rng: { uniform(a: number, b: number): number }, xs: readonly X[]): X {
  const x = xs[Math.floor(rng.uniform(0, xs.length))];
  if (x === undefined) throw new Error('empty');
  return x;
}

function buildDoc(seed: number): Builder {
  const rng = createRng(seed);
  const b = new Builder();
  const pool: Pooled[] = [];
  let n = 0;
  const add = (kind: ValueKind, def: Expr): void => {
    n += 1;
    pool.push({ ref: b.add(`o${String(n)}`, def), kind });
  };
  const ofKind = (k: ValueKind): Pooled[] => pool.filter((p) => p.kind === k);
  for (let i = 0; i < 8; i++) {
    const x = pick(rng, COORDS);
    const y = rng.uniform(0, 1) < 0.5 ? pick(rng, COORDS) : x;
    add('point', call('point', [num(x), num(y)]));
  }
  for (let i = 0; i < 5; i++) add('number', num(pick(rng, NUMS)));
  for (let i = 0; i < 4; i++) {
    const [p, q] = [pick(rng, ofKind('point')), pick(rng, ofKind('point'))];
    add('line', call(pick(rng, ['line', 'segment', 'ray', 'perp_bisector']), [p.ref, q.ref]));
    add('circle', call('circle', [p.ref, q.ref]));
    add('circle', call('circle', [p.ref, pick(rng, ofKind('number')).ref]));
    add(
      'transform',
      call(pick(rng, ['homothety', 'rotate']), [p.ref, pick(rng, ofKind('number')).ref]),
    );
    add('transform', call('reflect', [pick(rng, ofKind('line')).ref]));
  }
  const pts = ofKind('point');
  for (let i = 0; i < 3; i++) {
    add(
      'transform',
      call(
        'spiral',
        [0, 1, 2, 3].map(() => pick(rng, pts).ref),
      ),
    );
    add(
      'transform',
      call('compose', [pick(rng, ofKind('transform')).ref, pick(rng, ofKind('transform')).ref]),
    );
    add('transform', call('inverse', [pick(rng, ofKind('transform')).ref]));
  }
  add(
    'circle',
    call(
      'incircle',
      [0, 1, 2].map(() => pick(rng, pts).ref),
    ),
  );
  add(
    'polygon',
    call(
      'polygon',
      [0, 1, 2].map(() => pick(rng, pts).ref),
    ),
  );
  const sel = (): Selector[] => {
    const P = pick(rng, pts).ref;
    const opts: Selector[][] = [
      [{ kind: 'along', sign: 1 }],
      [{ kind: 'orient', sign: -1 }],
      [{ kind: 'near', p: P }],
      [{ kind: 'far_from', p: P }],
      [{ kind: 'other', p: P }],
      [{ kind: 'same_side', q: P, l: pick(rng, ofKind('line')).ref }],
      [{ kind: 'inside', c: pick(rng, ofKind('circle')).ref }],
      [{ kind: 'between', a: P, b: pick(rng, pts).ref }],
      [{ kind: 'on_arc', b: P, c: pick(rng, pts).ref, a: pick(rng, pts).ref, not: false }],
    ];
    return pick(rng, opts);
  };
  for (const tool of REGISTRY.tools) {
    for (const s of tool.signatures) {
      for (let k = 0; k < 2; k++) {
        const caps = [
          ...s.params,
          ...(s.rest !== undefined && rng.uniform(0, 1) < 0.5 ? [s.rest] : []),
        ];
        const args: Expr[] = [];
        let ok = true;
        for (const c of caps) {
          const cands = pool.filter((p) => capabilityKinds(c).includes(p.kind));
          if (c === 'string') {
            args.push({ kind: 'str', value: 'x' });
            continue;
          }
          if (cands.length === 0) {
            ok = false;
            break;
          }
          args.push(pick(rng, cands).ref);
        }
        if (!ok) continue;
        const sels = s.branch !== undefined && s.branch.candidates === 2 ? sel() : [];
        n += 1;
        b.add(`t${String(n)}`, call(tool.name, args, sels));
        // The result joins the pool when its kind is known statically.
        const outs = s.output ?? tool.outputKinds;
        const out = outs[0];
        if (outs.length === 1 && out !== undefined && out !== 'string') {
          pool.push({ ref: b.ref(`t${String(n)}`), kind: out });
        }
      }
    }
  }
  return b;
}

function check<T>(F: Field<T>, seed: number): string[] {
  const b = buildDoc(seed);
  const c = evalContextFor(b.doc);
  const ctx = c.ok ? c.ctx : { scale: 1 };
  const bad: string[] = [];
  try {
    const ev = evaluate(b.doc, REGISTRY, F, ctx);
    for (const o of b.doc.objects) {
      const v = ev.values.get(o.id);
      if (v === undefined) continue;
      for (const x of numbersOf(v)) {
        if (F.kind === 'float' && !Number.isFinite(F.toNumber(x))) {
          bad.push(
            `seed ${String(seed)} ${o.name} ${JSON.stringify(o.def)} -> ${JSON.stringify(v)}`,
          );
          break;
        }
      }
    }
  } catch (e) {
    bad.push(`seed ${String(seed)} THROW ${String(e)}`);
  }
  return bad;
}

describe('extreme values through every tool: no throw, no non-finite number', () => {
  it('FloatField', () => {
    const bad: string[] = [];
    for (let s = 1; s <= 300; s++) bad.push(...check(FloatField, s));
    expect(bad.slice(0, 5)).toEqual([]);
  }, 600_000);
  it('ModPField', () => {
    const bad: string[] = [];
    for (let s = 1; s <= 60; s++) bad.push(...check(ModPField, s));
    expect(bad.slice(0, 5)).toEqual([]);
  }, 600_000);
  it('RationalField', () => {
    const bad: string[] = [];
    for (let s = 1; s <= 15; s++) bad.push(...check(RationalField, s));
    expect(bad.slice(0, 5)).toEqual([]);
  }, 600_000);
});
