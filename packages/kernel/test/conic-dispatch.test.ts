/**
 * Capability dispatch E2 for conics (SPEC §18 E2, ADR-0042): a conic is accepted only where an
 * overload declares the capability `conic` (or a capability whose kinds include it). In every
 * other argument position of every registry tool (its examples, one position at a time) a
 * conic gives Undefined "… is a conic: <tool> does not take one" (or names a point at infinity
 * the example has elsewhere: that check comes first), in every field, never a
 * value computed as if it were a circle and never a throw.
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import type { Field } from '@geomira/num/field';
import { describe, expect, it } from 'vitest';
import { exampleDocument } from '../src/docs';
import { call, type Expr } from '../src/expr';
import type { ToolSpec } from '../src/tool';
import { capabilityKinds } from '../src/value';
import { evalDoc, pt, REGISTRY } from './helpers/doc';

const K: Expr = call('conic', [pt(2, 0), pt(0, 1), pt(-2, 0), pt(0, -1), pt('6/5', '4/5')]);
const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];

/** Whether some overload of `tool` with `arity` arguments takes a conic at position i. */
function takesConic(tool: ToolSpec, arity: number, i: number): boolean {
  return tool.signatures.some((s) => {
    const cap = s.params[i] ?? (arity > s.params.length ? s.rest : undefined);
    const fits = s.params.length === arity || (s.rest !== undefined && arity > s.params.length);
    return fits && cap !== undefined && capabilityKinds(cap).includes('conic');
  });
}

describe('E2: a conic where no overload takes one', () => {
  it('every tool, every example, every argument position: Undefined with the reason', () => {
    let checked = 0;
    let named = 0;
    for (const tool of REGISTRY.tools)
      for (const ex of tool.examples) {
        const doc = exampleDocument(tool, ex);
        const [x] = doc.objects;
        if (x?.def.kind !== 'call') continue;
        const args = x.def.args;
        args.forEach((a, i) => {
          if (a.kind !== 'call' || takesConic(tool, args.length, i)) return;
          const def = { ...x.def, args: args.map((b, j) => (j === i ? K : b)) };
          const d = { ...doc, objects: [{ ...x, def }] };
          for (const F of FIELDS) {
            const v = evalDoc(d, F).values.get(x.id);
            const what = `${tool.name} argument ${String(i + 1)} (${F.name})`;
            expect(v?.kind, what).toBe('undefined');
            // An example with a point at infinity elsewhere names that argument first.
            const reason = v?.kind === 'undefined' ? v.reason : '';
            expect(reason, what).toMatch(
              new RegExp(
                `^an argument is a (conic|point at infinity): ${tool.name} does not take one$`,
                'u',
              ),
            );
            if (reason.includes('conic')) named++;
          }
          checked++;
        });
      }
    expect(checked).toBeGreaterThan(100);
    expect(named).toBeGreaterThan(checked * FIELDS.length * 0.9);
  });

  it('where an overload takes a conic, it is computed (apply, intersect, tangent, on, pole, …)', () => {
    const takers = REGISTRY.tools.filter((t) =>
      t.signatures.some((s) =>
        [...s.params, ...(s.rest === undefined ? [] : [s.rest])].includes('conic'),
      ),
    );
    expect(takers.map((t) => t.name).sort()).toEqual(
      [
        'apply',
        'conic_center',
        'conic_to_circle',
        'intersect',
        'on',
        'other',
        'polar',
        'pole',
        'tangent',
        'tangent_from',
        'tangent_point',
      ].sort(),
    );
  });
});
