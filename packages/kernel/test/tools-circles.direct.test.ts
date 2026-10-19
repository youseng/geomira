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
