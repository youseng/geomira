/**
 * Gliders (SPEC §6.2): round trips parameter → point → parameter (exact over Q and mod p
 * for lines and the stereographic (u : v), including the anchor at v = 0), the angle form,
 * and the drag map cursor → parameter.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { rational, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, lit, type Expr } from '../src/expr';
import { dragParameter, gliderParameter, gliderPoint, type GliderParameter } from '../src/glider';
import type { Value, Vec } from '../src/value';
import { Builder, contextOf, evalDoc, valueOf } from './helpers/doc';

const ROUNDS = 300;

function grid(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(2049) - 1024), 64n);
}

/** A random curve (circle tool or line tool) and the field values of its document. */
function curve<T>(F: Field<T>, rng: Rng, which: number): { v: Value<T>; ctx: { scale: number } } {
  const b = new Builder();
  const p = (n: string): Expr => b.add(n, call('point', [lit(grid(rng)), lit(grid(rng))]));
  const [A, B, C] = [p('A'), p('B'), p('C')];
  const defs: Expr[] = [
    call('circle', [A, B]),
    call('circle', [A, B, C]),
    call('diameter_circle', [A, B]),
    call('ninepoint_circle', [A, B, C]),
    call('line', [A, B]),
    call('segment', [A, B]),
    call('ray', [A, B]),
  ];
  b.add('x', defs[which % defs.length] ?? call('line', [A, B]));
  const ctx = contextOf(b.doc);
  return { v: valueOf(b.doc, evalDoc(b.doc, F, ctx), 'x'), ctx };
}

function param<T>(F: Field<T>, rng: Rng, v: Value<T>, k: number): GliderParameter<T> {
  const r = (x: Rational): T => {
    const y = F.fromRational(x);
    if (typeof y === 'object' && y !== null && 'kind' in y) throw new Error(y.reason);
    return y;
  };
  const small = () => rational(BigInt(rng.nextInt(41) - 20), BigInt(rng.nextInt(7) + 1));
  if (v.kind === 'line') {
    const t = v.lo === null ? small() : rational(BigInt(rng.nextInt(9)), 8n);
    return { form: 'line', t: r(t) };
  }
  // Every fifth draw is the anchor (v = 0), every seventh the antipode (u = 0).
  const u = k % 7 === 0 ? rational(0n) : small();
  const w = k % 5 === 0 ? rational(0n) : small();
  return { form: 'stereo', u: r(u.num === 0n && w.num === 0n ? rational(1n) : u), v: r(w) };
}

function point<T>(v: Value<T>): Vec<T> {
  if (v.kind !== 'point') throw new Error(`expected a point, got ${v.kind}`);
  return v;
}

function roundTrip<T>(F: Field<T>, seed: number, same: (a: T, b: T) => boolean): number {
  let anchors = 0;
  for (let k = 0; k < ROUNDS; k += 1) {
    const rng = createRng(deriveSeed(seed, k));
    const { v, ctx } = curve(F, rng, k);
    if (v.kind !== 'line' && v.kind !== 'circle') continue;
    const p = param(F, rng, v, k);
    const X = point(gliderPoint(F, v, p, ctx));
    const back = gliderParameter(F, v, X, p.form, ctx);
    if ('kind' in back) throw new Error(back.reason);
    const Y = point(gliderPoint(F, v, back, ctx));
    expect(same(X.x, Y.x) && same(X.y, Y.y), `round ${String(k)}`).toBe(true);
    if (p.form === 'line' && back.form === 'line') expect(same(p.t, back.t)).toBe(true);
    if (p.form === 'stereo' && back.form === 'stereo') {
      // (u : v) and (u′ : v′) are the same parameter: u·v′ = u′·v.
      expect(same(F.mul(p.u, back.v), F.mul(back.u, p.v)), `ratio ${String(k)}`).toBe(true);
      if (F.eq(p.v, F.zero) && v.kind === 'circle' && v.anchor !== undefined) {
        expect(same(X.x, v.anchor.x) && same(X.y, v.anchor.y)).toBe(true);
        expect(same(back.v, F.zero)).toBe(true);
        anchors += 1;
      }
    }
  }
  return anchors;
}

describe('glider round trips: parameter → point → parameter', () => {
  it('RationalField: exact for t and (u : v), the anchor at v = 0 included', () => {
    expect(roundTrip(RationalField, 11, (a, b) => RationalField.eq(a, b))).toBeGreaterThan(20);
  });

  it('ModPField: exact for lines and (u : v) (segments and rays are Inexact mod p)', () => {
    let checked = 0;
    for (let k = 0; k < ROUNDS; k += 1) {
      const rng = createRng(deriveSeed(12, k));
      const { v, ctx } = curve(ModPField, rng, k);
      if (v.kind !== 'circle' && !(v.kind === 'line' && v.lo === null)) continue;
      const p = param(ModPField, rng, v, k);
      const X = point(gliderPoint(ModPField, v, p, ctx));
      const back = gliderParameter(ModPField, v, X, p.form, ctx);
      if ('kind' in back) throw new Error(back.reason);
      expect(gliderPoint(ModPField, v, back, ctx)).toEqual(X);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(ROUNDS / 2);
  });

  it('FloatField: within EPS-relative rounding', () => {
    const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
    expect(roundTrip(FloatField, 13, close)).toBeGreaterThan(20);
  });

  it('the angle form: θ → point → θ (FloatField), exact at rational special angles over Q', () => {
    const { v, ctx } = curve(FloatField, createRng(5), 0);
    for (let k = -179; k <= 180; k += 7) {
      const X = point(gliderPoint(FloatField, v, { form: 'angle', degrees: k + 0.25 }, ctx));
      const back = gliderParameter(FloatField, v, X, 'angle', ctx);
      expect('form' in back && back.form === 'angle' ? back.degrees : Number.NaN).toBeCloseTo(
        k + 0.25,
        9,
      );
    }
    const c: Value<Rational> = {
      kind: 'circle',
      c: { x: rational(1n), y: rational(1n) },
      r2: rational(25n),
      arc: null,
    };
    const X = point(
      gliderPoint(RationalField, c, { form: 'angle', degrees: rational(-90n) }, { scale: 1 }),
    );
    expect([X.x, X.y]).toEqual([rational(1n), rational(-4n)]);
    expect(gliderParameter(RationalField, c, X, 'angle', { scale: 1 })).toEqual({
      form: 'angle',
      degrees: rational(-90n),
    });
  });
});

const O = { x: 0, y: 0 };
const C5: Value<number> = { kind: 'circle', c: O, r2: 25, arc: null, anchor: { x: 5, y: 0 } };
const SEG: Value<number> = { kind: 'line', p: O, d: { x: 4, y: 2 }, lo: 0, hi: 1, chiral: false };
const CTX = { scale: 10 };

function dragTo(obj: Value<number>, x: number, y: number): Vec<number> {
  const p = dragParameter(FloatField, obj, { x, y }, obj.kind === 'line' ? 'line' : 'stereo', CTX);
  if ('kind' in p) throw new Error(p.reason);
  return point(gliderPoint(FloatField, obj, p, CTX));
}

describe('the drag map: cursor → parameter', () => {
  it('lines: the projection of the cursor, clamped to a segment', () => {
    expect(dragParameter(FloatField, SEG, { x: 1, y: 3 }, 'line', CTX)).toEqual({
      form: 'line',
      t: 0.5,
    });
    expect(dragParameter(FloatField, SEG, { x: 10, y: 0 }, 'line', CTX)).toEqual({
      form: 'line',
      t: 1,
    });
    expect(dragParameter(FloatField, SEG, { x: -3, y: 0 }, 'line', CTX)).toEqual({
      form: 'line',
      t: 0,
    });
    const seg = {
      kind: 'line',
      p: { x: 0n, y: 0n },
      d: { x: 4n, y: 2n },
      lo: 0n,
      hi: 1n,
      chiral: false,
    } as const;
    expect(dragParameter(ModPField, seg, { x: 1n, y: 3n }, 'line', CTX)).toMatchObject({
      kind: 'inexact',
    });
    const line = { ...seg, lo: null, hi: null };
    expect(dragParameter(ModPField, line, { x: 1n, y: 3n }, 'line', CTX)).toEqual({
      form: 'line',
      t: ModPField.div(10n, 20n),
    });
  });

  it('circles: the radial projection of the cursor; a cursor on the circle stays put', () => {
    const rng = createRng(77);
    for (let k = 0; k < 500; k += 1) {
      const [x, y] = [rng.uniform(-12, 12), rng.uniform(-12, 12)];
      const X = dragTo(C5, x, y);
      const n = Math.hypot(x, y);
      expect(X.x).toBeCloseTo((5 * x) / n, 9);
      expect(X.y).toBeCloseTo((5 * y) / n, 9);
      const on = dragTo(C5, X.x, X.y);
      expect([on.x, on.y]).toEqual([expect.closeTo(X.x, 9), expect.closeTo(X.y, 9)]);
    }
  });

  it('circles over Q: exact when the square roots are rational, Inexact otherwise', () => {
    const q = (n: bigint) => rational(n);
    const c: Value<Rational> = {
      kind: 'circle',
      c: { x: q(0n), y: q(0n) },
      r2: q(25n),
      arc: null,
      anchor: { x: q(5n), y: q(0n) },
    };
    const p = dragParameter(RationalField, c, { x: q(6n), y: q(8n) }, 'stereo', CTX);
    if ('kind' in p) throw new Error(p.reason);
    expect(gliderPoint(RationalField, c, p, CTX)).toEqual({ kind: 'point', x: q(3n), y: q(4n) });
    expect(dragParameter(RationalField, c, { x: q(1n), y: q(1n) }, 'stereo', CTX)).toMatchObject({
      kind: 'inexact',
    });
    expect(
      dragParameter(
        ModPField,
        { kind: 'circle', c: { x: 0n, y: 0n }, r2: 25n, arc: null, anchor: { x: 5n, y: 0n } },
        { x: 1n, y: 1n },
        'stereo',
        CTX,
      ),
    ).toMatchObject({ kind: 'inexact' });
  });

  it('a point never jumps: a cursor going round the circle moves the glider continuously', () => {
    let prev = dragTo(C5, 5, 0);
    for (let k = 1; k <= 3600; k += 1) {
      const a = (k / 3600) * 2 * Math.PI;
      const X = dragTo(C5, 7 * Math.cos(a), 7 * Math.sin(a));
      expect(Math.hypot(X.x - prev.x, X.y - prev.y), `step ${String(k)}`).toBeLessThan(0.01);
      prev = X;
    }
    const angle = dragParameter(FloatField, C5, { x: 0, y: 2 }, 'angle', CTX);
    expect(angle).toEqual({ form: 'angle', degrees: 90 });
  });

  it('degenerate cases: the centre, a form that does not fit, a point, no anchor', () => {
    const why = (v: object) => ('reason' in v ? v.reason : 'defined');
    expect(why(dragParameter(FloatField, C5, O, 'stereo', CTX))).toBe(
      'the cursor is at the center: no nearest point',
    );
    expect(why(gliderParameter(FloatField, C5, O, 'angle', CTX))).toBe(
      'the point is the center: it has no angle',
    );
    expect(why(dragParameter(FloatField, SEG, O, 'stereo', CTX))).toBe(
      'a glider on a line takes one parameter t',
    );
    expect(why(gliderParameter(FloatField, C5, O, 'line', CTX))).toBe(
      'a glider on a circle takes (u : v) or an angle',
    );
    expect(why(gliderPoint(FloatField, C5, { form: 'line', t: 1 }, CTX))).toBe(
      'a glider on a circle takes (u : v) or an angle',
    );
    expect(why(gliderPoint(FloatField, SEG, { form: 'angle', degrees: 1 }, CTX))).toBe(
      'a glider on a line takes one parameter t',
    );
    const P: Value<number> = { kind: 'point', x: 1, y: 1 };
    expect(why(gliderPoint(FloatField, P, { form: 'line', t: 1 }, CTX))).toBe(
      'a glider needs a line or a circle, not point',
    );
    expect(why(dragParameter(FloatField, P, O, 'line', CTX))).toBe(
      'a glider needs a line or a circle, not point',
    );
    const bare: Value<number> = { kind: 'circle', c: O, r2: 4, arc: null };
    expect(why(gliderParameter(FloatField, bare, { x: 2, y: 0 }, 'stereo', CTX))).toMatch(
      /has no anchor/,
    );
    expect(why(gliderPoint(FloatField, { ...C5, r2: 0 }, { form: 'angle', degrees: 1 }, CTX))).toBe(
      'the circle has no positive radius',
    );
    expect(why(gliderPoint(FloatField, { ...SEG, d: O }, { form: 'line', t: 1 }, CTX))).toBe(
      'the line has no direction',
    );
    expect(
      dragParameter(
        RationalField,
        { kind: 'circle', c: { x: rational(0n), y: rational(0n) }, r2: rational(2n), arc: null },
        { x: rational(1n), y: rational(0n) },
        'stereo',
        CTX,
      ),
    ).toMatchObject({ kind: 'inexact' });
  });
});
