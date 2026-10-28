/**
 * Law L13 for projective maps (SPEC §8.1 laws; Run 16a, ADR-0040), exact over Q and mod p on
 * random maps from the constructors and their compositions: apply∘inverse = id (on points and
 * points at infinity); compose is associative; apply(compose(S, T)) = apply(S)∘apply(T);
 * incidence is kept (a point of a line, a point at infinity of its direction, lands on the image
 * line); the cross ratio of four collinear points is kept; the points of a segment, ray or pair
 * of rays land in the range of its image; send_to_infinity is an involution that sends l to
 * infinity and the points at infinity to l. Floats: totality (no throw, no NaN) on the same draws.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { rational, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/evaluate';
import { call, lit, type Expr } from '../../src/expr';
import { applyMap } from '../../src/transform/apply-map';
import { composeMaps, inverseMap } from '../../src/transform/mobius';
import { numbersOf, type TransformData, type Value, type Vec } from '../../src/value';
import { Builder, REGISTRY, contextOf } from '../helpers/doc';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const DRAWS = lawCount(400);
const CTX = { scale: 1 };

const pick = <X>(rng: Rng, xs: readonly X[]): X => {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('empty');
  return x;
};

function coord(rng: Rng): Expr {
  return lit(rational(BigInt(rng.nextInt(41) - 20), BigInt(pick(rng, [1, 2, 3]))));
}
const P = (rng: Rng): Expr => call('point', [coord(rng), coord(rng)]);

function mapExpr(rng: Rng): Expr {
  return pick(rng, [
    () => call('send_to_infinity', [call('line', [P(rng), P(rng)])]),
    () =>
      call(
        'projective',
        Array.from({ length: 8 }, () => P(rng)),
      ),
    () =>
      call('compose', [
        call('rotate', [P(rng), lit(rational(90n))]),
        call(
          'projective',
          Array.from({ length: 8 }, () => P(rng)),
        ),
      ]),
  ])();
}

/** Values of the expressions in a fresh document, in field F. */
function values<T>(F: Field<T>, exprs: readonly Expr[]): Value<T>[] {
  const b = new Builder();
  b.point('Z0', 0, 0);
  b.point('Z1', 40, 40);
  const refs = exprs.map((e, i) => b.add(`x${String(i)}`, e));
  const ev = evaluate(b.doc, REGISTRY, F, contextOf(b.doc));
  return refs.map((r) => ev.values.get(r.id) ?? { kind: 'undefined', reason: 'missing' });
}

function mapOf<T>(v: Value<T> | undefined): TransformData<T> | undefined {
  return v?.kind === 'transform' ? v.t : undefined;
}

/** Projective equality of two points or points at infinity (homogeneous columns proportional). */
function samePoint<T>(F: Field<T>, a: Value<T>, b: Value<T>): boolean {
  if (a.kind === 'point' && b.kind === 'point') return F.eq(a.x, b.x) && F.eq(a.y, b.y);
  if (a.kind === 'ideal_point' && b.kind === 'ideal_point')
    return F.eq(F.mul(a.d.x, b.d.y), F.mul(a.d.y, b.d.x));
  return false;
}

/** Whether a point or a point at infinity lies on a line's carrier. */
function onCarrier<T>(F: Field<T>, x: Value<T>, l: Value<T>): boolean {
  if (l.kind !== 'line') return false;
  const cr = (u: Vec<T>, v: Vec<T>) => F.sub(F.mul(u.x, v.y), F.mul(u.y, v.x));
  if (x.kind === 'point')
    return F.eq(cr(l.d, { x: F.sub(x.x, l.p.x), y: F.sub(x.y, l.p.y) }), F.zero);
  return x.kind === 'ideal_point' && F.eq(cr(l.d, x.d), F.zero);
}

function exactFields(): readonly Field<unknown>[] {
  return [RationalField, ModPField];
}

describe(
  `L13 for projective maps (${String(DRAWS)} draws per law)`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('apply∘inverse = id; compose is associative; apply(compose(S, T)) = apply(S)∘apply(T)', () => {
      let checked = 0;
      for (let i = 0; i < DRAWS; i += 1) {
        const rng = createRng(deriveSeed(1611, i));
        const exprs = [mapExpr(rng), mapExpr(rng), mapExpr(rng), P(rng)];
        for (const F of exactFields()) {
          const [s, t, u, x] = values(F, exprs);
          const [S, Tm, U] = [mapOf(s), mapOf(t), mapOf(u)];
          if (S === undefined || Tm === undefined || U === undefined || x?.kind !== 'point')
            continue;
          const y = applyMap(F, S, x, CTX);
          if (y.kind === 'point' || y.kind === 'ideal_point')
            expect(samePoint(F, applyMap(F, inverseMap(F, S), y, CTX), x)).toBe(true);
          const left = composeMaps(F, composeMaps(F, S, Tm), U);
          const right = composeMaps(F, S, composeMaps(F, Tm, U));
          const [a, b] = [applyMap(F, left, x, CTX), applyMap(F, right, x, CTX)];
          const steps = applyMap(F, S, applyMap(F, Tm, applyMap(F, U, x, CTX), CTX), CTX);
          if (steps.kind === 'point' || steps.kind === 'ideal_point') {
            expect(samePoint(F, a, steps)).toBe(true);
            expect(samePoint(F, b, steps)).toBe(true);
            checked += 1;
          }
        }
      }
      expect(checked).toBeGreaterThan(DRAWS);
    });

    it('incidence: points of a line and its point at infinity land on its image', () => {
      let checked = 0;
      for (let i = 0; i < DRAWS; i += 1) {
        const rng = createRng(deriveSeed(1612, i));
        const [A, B] = [P(rng), P(rng)];
        const k = lit(rational(BigInt(rng.nextInt(21) - 10), BigInt(pick(rng, [1, 3, 7]))));
        const l = call('line', [A, B]);
        const exprs = [
          mapExpr(rng),
          l,
          call('divide', [A, B, k]),
          call('intersect', [l, call('parallel', [P(rng), l])]),
        ];
        for (const F of exactFields()) {
          const [m, lv, x, inf] = values(F, exprs);
          const M = mapOf(m);
          if (M === undefined || lv === undefined || x === undefined || inf === undefined) continue;
          const img = applyMap(F, M, lv, CTX);
          if (img.kind !== 'line') continue;
          for (const p of [x, inf]) {
            const q = applyMap(F, M, p, CTX);
            if (q.kind === 'point' || q.kind === 'ideal_point') {
              expect(onCarrier(F, q, img)).toBe(true);
              checked += 1;
            }
          }
        }
      }
      expect(checked).toBeGreaterThan(DRAWS);
    });

    it('the cross ratio of four collinear points is kept (exact over Q)', () => {
      let checked = 0;
      const F = RationalField;
      for (let i = 0; i < DRAWS; i += 1) {
        const rng = createRng(deriveSeed(1613, i));
        const [A, B] = [P(rng), P(rng)];
        const ks = [0, 1, 2, 3].map(() =>
          lit(rational(BigInt(rng.nextInt(41) - 20), BigInt(pick(rng, [1, 2, 5])))),
        );
        const pts = ks.map((k) => call('divide', [A, B, k]));
        const vals = values(F, [mapExpr(rng), ...pts]);
        const M = mapOf(vals[0]);
        const before = vals.slice(1);
        if (M === undefined) continue;
        const after = before.map((x) => applyMap(F, M, x, CTX));
        const cr = (xs: readonly Value<Rational>[]) => crossRatio(F, xs);
        const [c0, c1] = [cr(before), cr(after)];
        if (c0 === undefined || c1 === undefined) continue;
        expect(F.eq(c0, c1)).toBe(true);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(DRAWS / 2);
    });

    it('a range maps into the range of its image (segments, rays, two rays)', () => {
      let checked = 0;
      const F = RationalField;
      for (let i = 0; i < DRAWS; i += 1) {
        const rng = createRng(deriveSeed(1614, i));
        const [A, B] = [P(rng), P(rng)];
        const kind = pick(rng, ['segment', 'ray']);
        const t = rational(BigInt(rng.nextInt(19) + 1), 20n * (kind === 'ray' ? 1n : 1n));
        const k = kind === 'segment' ? t : rational(BigInt(rng.nextInt(40)), 3n);
        const vals = values(F, [mapExpr(rng), call(kind, [A, B]), call('divide', [A, B, lit(k)])]);
        const [m, seg, x] = vals;
        const M = mapOf(m);
        if (M === undefined || seg?.kind !== 'line' || x?.kind !== 'point') continue;
        const [img, y] = [applyMap(F, M, seg, CTX), applyMap(F, M, x, CTX)];
        if (img.kind !== 'line' || y.kind !== 'point') continue;
        // y = img.p + s·img.d: s in the image's range.
        const dd = F.add(F.mul(img.d.x, img.d.x), F.mul(img.d.y, img.d.y));
        const s = F.div(
          F.add(F.mul(F.sub(y.x, img.p.x), img.d.x), F.mul(F.sub(y.y, img.p.y), img.d.y)),
          dd,
        );
        expect(onCarrier(F, y, img)).toBe(true);
        expect(inRange(F, s, img)).toBe(true);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(DRAWS / 2);
    });

    it('send_to_infinity is an involution: l goes to infinity, points at infinity to l', () => {
      for (let i = 0; i < DRAWS; i += 1) {
        const rng = createRng(deriveSeed(1615, i));
        const [A, B, X] = [P(rng), P(rng), P(rng)];
        const l = call('line', [A, B]);
        const exprs = [
          call('send_to_infinity', [l]),
          X,
          call('divide', [A, B, lit(rational(BigInt(rng.nextInt(9) - 4), 3n))]),
          call('intersect', [
            call('line', [X, P(rng)]),
            call('parallel', [P(rng), call('line', [X, A])]),
          ]),
          l,
        ];
        for (const F of exactFields()) {
          const [f, x, onL, inf, lv] = values(F, exprs);
          const M = mapOf(f);
          if (M === undefined || x === undefined || onL === undefined || inf === undefined)
            continue;
          const once = applyMap(F, M, x, CTX);
          if (once.kind === 'point') expect(samePoint(F, applyMap(F, M, once, CTX), x)).toBe(true);
          if (onL.kind === 'point') expect(applyMap(F, M, onL, CTX).kind).toBe('ideal_point');
          const back = applyMap(F, M, inf, CTX);
          if (inf.kind === 'ideal_point' && back.kind === 'point' && lv !== undefined)
            expect(onCarrier(F, back, lv)).toBe(true);
        }
      }
    });

    it('floats: total on every draw (no throw, every number finite)', () => {
      for (let i = 0; i < DRAWS; i += 1) {
        const rng = createRng(deriveSeed(1616, i));
        const exprs = [
          mapExpr(rng),
          P(rng),
          call('segment', [P(rng), P(rng)]),
          call('polygon', [P(rng), P(rng), P(rng)]),
        ];
        const [m, ...xs] = values(FloatField, exprs);
        const M = mapOf(m);
        if (M === undefined) continue;
        for (const x of xs)
          expect(numbersOf(applyMap(FloatField, M, x, CTX)).every(Number.isFinite)).toBe(true);
      }
    });
  },
);

/** (A, B; C, D) of four collinear points, as the ratio of signed parameters on AB. */
function crossRatio<T>(F: Field<T>, xs: readonly Value<T>[]): T | undefined {
  const [a, b, c, d] = xs;
  if (a?.kind !== 'point' || b?.kind !== 'point' || c?.kind !== 'point' || d?.kind !== 'point')
    return undefined;
  const dir = { x: F.sub(b.x, a.x), y: F.sub(b.y, a.y) };
  const t = (p: Vec<T>) => F.add(F.mul(F.sub(p.x, a.x), dir.x), F.mul(F.sub(p.y, a.y), dir.y));
  const [ta, tb, tc, td] = [t(a), t(b), t(c), t(d)];
  const num = F.mul(F.sub(tc, ta), F.sub(td, tb));
  const den = F.mul(F.sub(tc, tb), F.sub(td, ta));
  return F.isZero(den, 'dimensionless', CTX) || F.isZero(num, 'dimensionless', CTX)
    ? undefined
    : F.div(num, den);
}

/** Whether s lies in a line value's range (rays, segments, the two rays outside). */
function inRange<T>(F: Field<T>, s: T, l: Value<T>): boolean {
  if (l.kind !== 'line') return false;
  const ge = (x: T, y: T) => F.toNumber(F.sub(x, y)) >= 0;
  const lo = l.lo === null || ge(s, l.lo);
  const hi = l.hi === null || ge(l.hi, s);
  if (l.outside === true && l.lo !== null && l.hi !== null)
    return !ge(s, l.lo) || ge(s, l.hi) || F.eq(s, l.lo);
  return lo && hi;
}
