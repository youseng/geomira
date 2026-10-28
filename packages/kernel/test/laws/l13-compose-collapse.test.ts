/**
 * Law L13, compositions (ADR-0019, proposal P1 of the Run 10 audit): a map collapses only
 * when one of its factors is degenerate where that factor is built (homothety k = 0,
 * spiral with coincident points, …); a composition of valid maps is always a valid map,
 * so compose is associative as a TOOL in every field: compose(compose(R, S), T) and
 * compose(R, compose(S, T)) are both defined and equal, and apply(compose(R, S), X) =
 * apply(R, apply(S, X)).
 *
 * The maps are drawn through the registry's tools with scale factors from 10⁻⁸ to 10⁸
 * (homothety ratios, spiral ratios), mixed with reflections, quarter turns, translations
 * and inverses, so their products span 10⁻²⁴ to 10²⁴. Before ADR-0019, float compositions
 * whose factor fell within EPS of 0 were "the map collapses the plane" on one side of the
 * associativity and a map on the other (h₁ = h₂ = homothety(O, 10⁻⁵), h₃ = homothety(O, 10⁵)).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../../src/expr';
import type { Value } from '../../src/value';
import { Builder, evalDoc, num, pt, valueOf } from '../helpers/doc';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const DOCS = lawCount(300);
const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];

/** 10^e as an exact rational literal text. */
function pow10(e: number): string {
  return e >= 0 ? `1${'0'.repeat(e)}` : `1/1${'0'.repeat(-e)}`;
}

/** A value as text for failure messages (bigints of the exact fields as decimals). */
function show(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => (typeof x === 'bigint' ? x.toString() : x));
}

function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('empty');
  return x;
}

/** A random valid map, built by a tool, with a scale factor 10^e (|e| ≤ 8) or 1. */
function randomMap(b: Builder, rng: Rng, P: () => Expr, name: string): void {
  const e = rng.nextInt(17) - 8;
  const sign = rng.nextFloat() < 0.5 ? '' : '-';
  // Spiral ratios 10⁻⁵ … 10²: its points enter the figure's scale, and a larger ratio would
  // make another spiral's short segment CD coincident at that scale (degenerate as built).
  const s = rng.nextInt(8) - 5;
  switch (rng.nextInt(6)) {
    case 0:
      b.add(name, call('homothety', [P(), num(`${sign}${pow10(e)}`)]));
      return;
    case 1: {
      // A = (0, 0) ↦ C and B = (3, 4) ↦ D = C + 10^s·(−4, 3): the ratio |CD|/|AB| is 10^s.
      const [x, y, f] = [rng.nextInt(9) - 4, rng.nextInt(9) - 4, 10 ** s];
      b.add(name, call('spiral', [pt(0, 0), pt(3, 4), pt(x, y), pt(x - 4 * f, y + 3 * f)]));
      return;
    }
    case 2:
      // A mirror through two fixed distinct points (two random points may coincide).
      b.add(name, call('reflect', [call('line', [b.ref('L1'), b.ref('L2')])]));
      return;
    case 3:
      b.add(name, call('rotate', [P(), num(90 * rng.nextInt(4))]));
      return;
    case 4:
      b.add(name, call('translate', [P(), P()]));
      return;
    default:
      b.add(name, call('inverse', [call('homothety', [P(), num(pow10(e))])]));
  }
}

function draw(i: number): { readonly b: Builder } {
  const rng = createRng(deriveSeed(1913, i));
  const b = new Builder();
  const pts = ['P1', 'P2', 'P3', 'P4'].map((n) => {
    b.point(n, rng.nextInt(17) - 8, rng.nextInt(17) - 8);
    return n;
  });
  b.point('L1', 0, 0);
  b.point('L2', 1, 2);
  const P = (): Expr => b.ref(pick(rng, pts));
  for (const m of ['R', 'S', 'T']) randomMap(b, rng, P, m);
  const [R, S, T] = [b.ref('R'), b.ref('S'), b.ref('T')];
  b.add('left', call('compose', [call('compose', [R, S]), T]));
  b.add('right', call('compose', [R, call('compose', [S, T])]));
  b.point('X', rng.nextInt(17) - 8, rng.nextInt(17) - 8);
  const X = b.ref('X');
  b.add('once', call('apply', [b.ref('left'), X]));
  b.add('steps', call('apply', [R, call('apply', [S, call('apply', [T, X])])]));
  return { b };
}

function sameMap<T>(F: Field<T>, u: Value<T>, v: Value<T>): boolean {
  if (u.kind !== 'transform' || v.kind !== 'transform') return false;
  if (u.t.type === 'projective' || u.t.type === 'composite') return false;
  if (v.t.type === 'projective' || v.t.type === 'composite') return false;
  const vs = [v.t.a.re, v.t.a.im, v.t.b.re, v.t.b.im];
  if (F.kind !== 'float')
    return (
      u.t.anti === v.t.anti &&
      [u.t.a.re, u.t.a.im, u.t.b.re, u.t.b.im].every((x, i) => F.eq(x, vs[i] ?? F.zero))
    );
  const n = (x: T) => F.toNumber(x);
  // a relative to |a| (it may be 10⁻²⁴), b relative to its own size (at least 1).
  const size = Math.hypot(n(u.t.a.re), n(u.t.a.im));
  const near = (x: T, y: T, m: number) => Math.abs(n(x) - n(y)) <= 1e-9 * m;
  const bSize = Math.max(1, Math.hypot(n(u.t.b.re), n(u.t.b.im)));
  return (
    u.t.anti === v.t.anti &&
    near(u.t.a.re, v.t.a.re, size) &&
    near(u.t.a.im, v.t.a.im, size) &&
    near(u.t.b.re, v.t.b.re, bSize) &&
    near(u.t.b.im, v.t.b.im, bSize)
  );
}

function samePoint<T>(F: Field<T>, u: Value<T>, v: Value<T>): boolean {
  if (u.kind !== 'point' || v.kind !== 'point') return false;
  const m = Math.max(1, ...[u.x, u.y, v.x, v.y].map((x) => Math.abs(F.toNumber(x))));
  const near = (x: T, y: T) =>
    F.kind !== 'float' ? F.eq(x, y) : Math.abs(F.toNumber(x) - F.toNumber(y)) <= 1e-9 * m;
  return near(u.x, v.x) && near(u.y, v.y);
}

describe(
  `L13: compose is associative as a tool and never collapses valid maps (${String(DOCS)} documents per field)`,
  { timeout: LAW_TIMEOUT },
  () => {
    for (const F of FIELDS) {
      it(F.name, () => {
        let tiny = 0;
        for (let i = 0; i < DOCS; i += 1) {
          const { b } = draw(i);
          const ev = evalDoc(b.doc, F);
          const at = `document ${String(i)}`;
          for (const m of ['R', 'S', 'T']) {
            const v = valueOf(b.doc, ev, m);
            // Quarter turns are exact; every factor here is a valid map in every field.
            expect(v.kind, `${at}: ${m} ${show(v)}`).toBe('transform');
          }
          const [left, right] = [valueOf(b.doc, ev, 'left'), valueOf(b.doc, ev, 'right')];
          expect(left.kind, `${at}: left ${show(left)}`).toBe('transform');
          expect(right.kind, `${at}: right ${show(right)}`).toBe('transform');
          expect(sameMap(F, left, right), at).toBe(true);
          const [once, steps] = [valueOf(b.doc, ev, 'once'), valueOf(b.doc, ev, 'steps')];
          expect(samePoint(F, once, steps), `${at}: ${show([once, steps])}`).toBe(true);
          if (left.kind === 'transform') {
            if (left.t.type === 'projective' || left.t.type === 'composite')
              throw new Error(left.t.type);
            const a = Math.hypot(F.toNumber(left.t.a.re), F.toNumber(left.t.a.im));
            if (a < 1e-9) tiny += 1;
          }
        }
        // The law reaches the products that used to collapse in floats (sizes have no
        // meaning mod p).
        if (F.kind !== 'modp') expect(tiny).toBeGreaterThan(DOCS / 50);
      });
    }
  },
);

describe('the audit case (ADR-0019)', () => {
  it('h₁ = h₂ = homothety(O, 10⁻⁵), h₃ = homothety(O, 10⁵): both groupings are the identity', () => {
    for (const F of FIELDS) {
      const b = new Builder();
      const O = b.point('O', 1, 2);
      const h = (k: string) => call('homothety', [O, num(k)]);
      b.add('l', call('compose', [call('compose', [h('1/100000'), h('1/100000')]), h('100000')]));
      b.add('r', call('compose', [h('1/100000'), call('compose', [h('1/100000'), h('100000')])]));
      b.add('tiny', call('compose', [h('1/100000'), h('1/100000')]));
      const ev = evalDoc(b.doc, F);
      for (const n of ['l', 'r', 'tiny'])
        expect(valueOf(b.doc, ev, n).kind, `${F.name} ${n}`).toBe('transform');
      expect(sameMap(F, valueOf(b.doc, ev, 'l'), valueOf(b.doc, ev, 'r'))).toBe(true);
    }
  });
});
