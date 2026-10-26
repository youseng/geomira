/**
 * Ranges through an inversion, exhaustively (ADR-0032 decision 7): on a line through the
 * center, every range (segments, rays both ways, the two rays `outside`) with ends before, at
 * and after the center, base points anywhere on the line and both directions; and on a line off
 * the center and a circle through it, every range or arc. Each image is compared point by point
 * with the definition: X lies on the range iff its image lies on the image range (exactly over
 * Q; the center itself has no image). The law tests (l13-mobius) fuzz the same with random maps.
 */
import { RationalField } from '@geomira/num/rational-field';
import { fromNumber, rational, type Rational } from '@geomira/num/rational';
import { describe, expect, it } from 'vitest';
import { applyMap } from '../src/transform/apply-map';
import type { Circle, Line, Value, Vec } from '../src/value';
import { inversionMap, onCircle } from './helpers/mobius-gen';

const F = RationalField;
const r = (n: number, d = 1): Rational => rational(BigInt(n), BigInt(d));
const v = (x: number, y: number): Vec<Rational> => ({ x: fromNumber(x), y: fromNumber(y) });
const CTX = { scale: 1 };
const J = inversionMap(F, v(0, 0), r(6));

/** Whether position X lies on the range of l (exact). */
function onLine(l: Line<Rational>, X: Vec<Rational>): boolean {
  const w = { x: F.sub(X.x, l.p.x), y: F.sub(X.y, l.p.y) };
  if (!F.eq(F.sub(F.mul(w.x, l.d.y), F.mul(w.y, l.d.x)), F.zero)) return false;
  const t = F.div(
    F.add(F.mul(w.x, l.d.x), F.mul(w.y, l.d.y)),
    F.add(F.mul(l.d.x, l.d.x), F.mul(l.d.y, l.d.y)),
  );
  const ge = (a: Rational, b: Rational) => F.sign(F.sub(a, b), 'dimensionless', CTX) !== -1;
  const [lo, hi] = [l.lo, l.hi];
  if (l.outside === true && lo !== null && hi !== null) return ge(lo, t) || ge(t, hi);
  return (lo === null || ge(t, lo)) && (hi === null || ge(hi, t));
}

/** Whether position X lies on the circle and its arc (exact; the arc is counter-clockwise). */
function onCircleArc(c: Circle<Rational>, X: Vec<Rational>): boolean {
  const w = { x: F.sub(X.x, c.c.x), y: F.sub(X.y, c.c.y) };
  if (!F.eq(F.add(F.mul(w.x, w.x), F.mul(w.y, w.y)), c.r2)) return false;
  if (c.arc === null) return true;
  const ch = { x: F.sub(c.arc.to.x, c.arc.from.x), y: F.sub(c.arc.to.y, c.arc.from.y) };
  const xf = { x: F.sub(X.x, c.arc.from.x), y: F.sub(X.y, c.arc.from.y) };
  return F.sign(F.sub(F.mul(ch.x, xf.y), F.mul(ch.y, xf.x)), 'dimensionless', CTX) !== 1;
}

const on = (img: Value<Rational>, X: Vec<Rational>): boolean =>
  img.kind === 'line' ? onLine(img, X) : img.kind === 'circle' && onCircleArc(img, X);

const show = (x: unknown): string =>
  JSON.stringify(x, (_k, val: unknown) => (typeof val === 'bigint' ? String(val) : val));

const image = (X: Vec<Rational>): Vec<Rational> => {
  const p = applyMap(F, J, { kind: 'point', ...X }, CTX);
  if (p.kind !== 'point') throw new Error('no image');
  return p;
};

/** Every range on the parameter grid −3…3 (in halves), as (lo, hi, outside). */
function ranges(): [Rational | null, Rational | null, boolean][] {
  const grid = [-6, -5, -3, -2, -1, 0, 1, 2, 3, 5, 6].map((n) => r(n, 2));
  const out: [Rational | null, Rational | null, boolean][] = [[null, null, false]];
  for (const a of grid) {
    out.push([a, null, false], [null, a, false]);
    for (const b of grid)
      if (F.sign(F.sub(b, a), 'dimensionless', CTX) === 1) out.push([a, b, false], [a, b, true]);
  }
  return out;
}

describe('ranges through an inversion (exact, point by point)', () => {
  it('a line through the center: every range, base point and direction', () => {
    let n = 0;
    for (const [px, d] of [
      [0, 1],
      [2, 1],
      [-3, 2],
      [1, -1],
      [-1, -2],
    ] as const) {
      for (const [lo, hi, outside] of ranges()) {
        const l: Line<Rational> = {
          kind: 'line',
          p: v(px, 0),
          d: v(d, 0),
          lo,
          hi,
          chiral: false,
          ...(outside ? { outside: true as const } : {}),
        };
        const img = applyMap(F, J, l, CTX);
        expect(img.kind, show([px, d, lo, hi, outside])).toBe('line');
        if (img.kind !== 'line') continue;
        if (img.lo !== null && img.hi !== null)
          expect(F.sign(F.sub(img.hi, img.lo), 'dimensionless', CTX)).toBe(1);
        for (let k = -40; k <= 40; k += 1) {
          if (k === 0) continue;
          const X = v(k / 8, 0);
          expect(on(img, image(X)), `${show([px, d, lo, hi, outside])} at ${String(k / 8)}`).toBe(
            onLine(l, X),
          );
          n += 1;
        }
      }
    }
    expect(n).toBeGreaterThan(10000);
  });

  it('a line off the center: every range becomes the arc of its points', () => {
    for (const d of [1, -1])
      for (const [lo, hi, outside] of ranges()) {
        const l: Line<Rational> = {
          kind: 'line',
          p: v(1, 2),
          d: v(d, 0),
          lo,
          hi,
          chiral: false,
          ...(outside ? { outside: true as const } : {}),
        };
        const img = applyMap(F, J, l, CTX);
        expect(img.kind).toBe('circle');
        for (let k = -40; k <= 40; k += 1) {
          const X = v(1 + (d * k) / 8, 2);
          expect(on(img, image(X)), `${show([d, lo, hi, outside])} at ${String(k)}`).toBe(
            onLine(l, X),
          );
        }
      }
  });

  it('a circle through the center and one off it: every arc maps to the image of its points', () => {
    for (const [c, rad] of [
      [v(3, 4), 5],
      [v(1, 1), 3],
    ] as const) {
      const pts = [-9, -4, -2, -1, 0, 1, 2, 3, 7].map((s) => onCircle(F, c, r(rad), r(s, 3)));
      for (const from of pts)
        for (const to of pts) {
          if (F.eq(from.x, to.x) && F.eq(from.y, to.y)) continue;
          const k: Circle<Rational> = { kind: 'circle', c, r2: r(rad * rad), arc: { from, to } };
          const img = applyMap(F, J, k, CTX);
          for (let s = -30; s <= 30; s += 1) {
            const X = onCircle(F, c, r(rad), r(s, 4));
            if (F.eq(X.x, F.zero) && F.eq(X.y, F.zero)) continue;
            expect(on(img, image(X)), show([from, to, s])).toBe(onCircleArc(k, X));
          }
        }
    }
  });
});
