/**
 * compute<T> called directly with arguments no signature allows: always Undefined, never a
 * throw (the registry never does this, but compute must be total on any Value list).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Value } from '../src/value';
import { numOf, pointOf } from '../src/value';
import { REGISTRY } from './helpers/doc';

describe('compute with arguments it does not accept', () => {
  for (const F of [FloatField, RationalField, ModPField] as Field<unknown>[]) {
    it(`${F.name}: every tool returns Undefined for bad argument lists`, () => {
      const p = pointOf(F.one, F.zero);
      const n = numOf(F.one);
      const o = { x: F.zero, y: F.zero };
      const l: Value<unknown> = {
        kind: 'line',
        p: o,
        d: { x: F.one, y: F.zero },
        lo: null,
        hi: null,
        chiral: false,
      };
      const g: Value<unknown> = { kind: 'polygon', pts: [p, { x: F.zero, y: F.one }, o] };
      const bogus: Value<unknown>[][] = [
        [],
        [n],
        [p],
        [n, n, n, n, n],
        [p, p, p, p, p],
        [n, p],
        [p, n, p],
        [p, p, n, p],
        [p, l, p],
        [p, l, n],
        [l, l, l],
        [g, p],
        [g, g],
        [p, p, p, n],
        [n, n, n, n],
        [l],
        [p, g, p],
      ];
      for (const tool of REGISTRY.tools) {
        for (const args of bogus) {
          if (REGISTRY.resolve(tool.name, args).ok) continue;
          const v = tool.compute(F, args, { scale: 1 });
          expect(v, `${tool.name}(${args.map((a) => a.kind).join(', ')})`).toEqual({
            kind: 'undefined',
            reason: `${tool.name} received arguments it does not accept`,
          });
        }
      }
    });
  }

  it('a line value with no direction is degenerate for every tool that divides by it', () => {
    const l: Value<number> = {
      kind: 'line',
      p: { x: 0, y: 0 },
      d: { x: 0, y: 0 },
      lo: null,
      hi: null,
      chiral: false,
    };
    const P = pointOf(1, 1);
    const good: Value<number> = { ...l, d: { x: 1, y: 0 } };
    for (const [tool, args] of [
      ['foot', [P, l]],
      ['intersect', [l, l]],
      ['intersect', [l, good]],
      ['intersect', [good, l]],
      ['dist', [P, l]],
    ] as const) {
      expect(REGISTRY.get(tool)?.compute(FloatField, args, { scale: 1 })).toEqual({
        kind: 'undefined',
        reason: 'the line has no direction',
      });
    }
  });
});
