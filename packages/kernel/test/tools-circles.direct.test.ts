/**
 * compute<T> on hand-made values the circle tools never produce themselves: circles with
 * r² = 0 or r² < 0, without an anchor, with the anchor at the centre, lines with no
 * direction, (0 : 0)-like numbers. Every tool, every argument list of up to three values
 * from the pool, all three fields: never a throw, never a non-finite number (SPEC §4:
 * evaluate stays total because every compute does).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { numbersOf, type Value } from '../src/value';
import { REGISTRY } from './helpers/doc';

function pool<T>(F: Field<T>): Value<T>[] {
  const n = (k: number): T => {
    let x = F.zero;
    for (let i = 0; i < Math.abs(k); i += 1) x = k > 0 ? F.add(x, F.one) : F.sub(x, F.one);
    return x;
  };
  const o = { x: F.zero, y: F.zero };
  const circle = (r2: T, anchor?: { x: T; y: T }): Value<T> =>
    anchor === undefined
      ? { kind: 'circle', c: o, r2, arc: null }
      : { kind: 'circle', c: o, r2, arc: null, anchor };
  return [
    { kind: 'point', x: n(3), y: n(4) },
    { kind: 'point', x: F.zero, y: F.zero },
    { kind: 'number', v: F.zero },
    { kind: 'number', v: n(2) },
    circle(n(25), { x: n(3), y: n(4) }),
    circle(n(25)),
    circle(F.zero, o),
    circle(n(-4), o),
    circle(n(25), o),
    { kind: 'line', p: o, d: o, lo: null, hi: null, chiral: false },
    {
      kind: 'line',
      p: { x: n(3), y: n(4) },
      d: { x: n(1), y: F.zero },
      lo: F.zero,
      hi: n(1),
      chiral: false,
    },
  ];
}

function lists<X>(xs: readonly X[], max: number): X[][] {
  const out: X[][] = [[]];
  let frontier: X[][] = [[]];
  for (let k = 1; k <= max; k += 1) {
    frontier = frontier.flatMap((l) => xs.map((x) => [...l, x]));
    out.push(...frontier);
  }
  return out;
}

describe('compute on malformed circle and line values', () => {
  for (const F of [FloatField, RationalField, ModPField] as Field<unknown>[]) {
    it(`${F.name}: every tool returns a value, never throws, never a non-finite number`, () => {
      const finite = (x: unknown) => typeof x !== 'number' || Number.isFinite(x);
      let calls = 0;
      for (const tool of REGISTRY.tools) {
        for (const args of lists(pool(F), 3)) {
          const v = tool.compute(F, args, { scale: 1 });
          expect(typeof v.kind).toBe('string');
          expect(
            numbersOf(v).every(finite),
            `${tool.name}(${args.map((a) => a.kind).join(', ')})`,
          ).toBe(true);
          calls += 1;
        }
      }
      expect(calls).toBeGreaterThan(REGISTRY.tools.length * 1000);
    });
  }

  it('a circle with no positive radius is degenerate for every tool that needs a radius', () => {
    const bad: Value<number> = {
      kind: 'circle',
      c: { x: 0, y: 0 },
      r2: 0,
      arc: null,
      anchor: { x: 0, y: 0 },
    };
    const good: Value<number> = {
      kind: 'circle',
      c: { x: 0, y: 0 },
      r2: 25,
      arc: null,
      anchor: { x: 5, y: 0 },
    };
    const P: Value<number> = { kind: 'point', x: 5, y: 0 };
    const one: Value<number> = { kind: 'number', v: 1 };
    for (const [tool, args] of [
      ['tangent', [P, bad]],
      ['polar', [P, bad]],
      ['radical_axis', [bad, good]],
      ['radical_axis', [good, bad]],
      ['other', [good, bad, P]],
      ['other', [bad, good, P]],
      ['on', [bad, one, one]],
      ['on', [bad, one]],
    ] as const) {
      expect(REGISTRY.get(tool)?.compute(FloatField, args, { scale: 1 }), tool).toEqual({
        kind: 'undefined',
        reason: 'the circle has no positive radius',
      });
    }
  });
});

describe('the Run 3a tools on argument lists their signatures reject', () => {
  for (const F of [FloatField, RationalField, ModPField] as Field<unknown>[]) {
    it(`${F.name}: compute returns "<tool> received arguments it does not accept"`, () => {
      let rejected = 0;
      for (const tool of REGISTRY.tools) {
        for (const args of lists(pool(F), 3)) {
          if (REGISTRY.resolve(tool.name, args).ok) continue;
          expect(tool.compute(F, args, { scale: 1 }), tool.name).toEqual({
            kind: 'undefined',
            reason: `${tool.name} received arguments it does not accept`,
          });
          rejected += 1;
        }
      }
      expect(rejected).toBeGreaterThan(REGISTRY.tools.length * 1000);
      // One argument too many for each Run 3a signature (a valid list plus a point).
      const [P, , , n, c] = pool(F);
      const L = pool(F)[10];
      if (P === undefined || n === undefined || c === undefined || L === undefined)
        throw new Error('pool');
      for (const [tool, args] of [
        ['on', [c, n, n, n]],
        ['on', [L, n, P]],
        ['other', [L, c, P, P]],
        ['other', [c, c, P, P]],
        ['tangent', [P, c, P]],
        ['circle', [P, n, P, P]],
        ['incenter', [P, P, P, P]],
      ] as const) {
        expect(REGISTRY.resolve(tool, args).ok).toBe(false);
        expect(REGISTRY.get(tool)?.compute(F, args, { scale: 1 })).toEqual({
          kind: 'undefined',
          reason: `${tool} received arguments it does not accept`,
        });
      }
    });
  }
});

describe('guards that documents rarely reach', () => {
  const circle = (F: Field<unknown>, r: Value<unknown>) =>
    REGISTRY.get('circle')?.compute(F, [{ kind: 'point', x: F.zero, y: F.zero }, r], { scale: 1 });

  it('circle(O, r): a zero radius without an exact value (mod p), and an exact zero that floats round to −1', () => {
    expect(circle(ModPField as Field<unknown>, { kind: 'number', v: 0n })).toEqual({
      kind: 'undefined',
      reason: 'zero radius: circle(O, r) needs r > 0',
    });
    expect(circle(ModPField as Field<unknown>, { kind: 'number', v: 3n })).toMatchObject({
      r2: 9n,
    });
    const exactZero = { kind: 'number', v: -1, exact: { num: 0n, den: 1n } } as const;
    expect(circle(FloatField as Field<unknown>, exactZero)).toEqual({
      kind: 'undefined',
      reason: 'zero radius: circle(O, r) needs r > 0',
    });
  });

  it('the excenter of a triangle flatter than its side lengths can resolve', () => {
    const ex = (h: number) => {
      const P = (x: number, y: number): Value<number> => ({ kind: 'point', x, y });
      return REGISTRY.get('excenter')?.compute(FloatField, [P(0, h), P(-1, 0), P(1, 0)], {
        scale: 2,
      });
    };
    expect(ex(1e-4)).toEqual({
      kind: 'undefined',
      reason: 'ambiguous: excenter: the triangle is within the band of flat',
    });
    expect(ex(3e-5)).toEqual({
      kind: 'undefined',
      reason: 'collinear points: excenter needs a non-degenerate triangle',
    });
    expect(ex(1)).toMatchObject({ kind: 'point' });
  });

  it('bisectors: one component of w exactly 0 is a regular direction; the band in either component', () => {
    const P = (x: number, y: number): Value<number> => ({ kind: 'point', x, y });
    const bis = (tool: string, a: Value<number>, c: Value<number>) =>
      REGISTRY.get(tool)?.compute(FloatField, [a, P(0, 0), c], { scale: 2 });
    expect(bis('bisector', P(-1, 1), P(1, 1))).toMatchObject({
      kind: 'line',
      d: { x: 0 },
      chiral: false,
    });
    expect(bis('bisector', P(1, -1), P(1, 1))).toMatchObject({
      kind: 'line',
      d: { y: 0 },
      chiral: false,
    });
    for (const tool of ['bisector', 'ext_bisector']) {
      expect(bis(tool, P(0, -1), P(1e-8, 1))).toEqual({
        kind: 'undefined',
        reason: `ambiguous: ${tool}: the angle is within the band of a straight angle`,
      });
      expect(bis(tool, P(-1, 0), P(1, 1e-8))).toMatchObject({ kind: 'undefined' });
    }
  });
});
