/**
 * ADR-0035: the construction facts of the tools are registry data. Every entry of the table
 * names an existing tool and overload (none can go stale), every nested term names a registry
 * tool with an overload of its arity, and the registry's signatures carry exactly the table's
 * entries. (Whether each guarantee HOLDS is checked by packages/discovery, which may evaluate
 * claims: guarantees-hold.test.ts.)
 */
import { describe, expect, it } from 'vitest';
import { GUARANTEE_TABLE, paramsKey, withGuarantees } from '../src/guarantees';
import { createRegistry } from '../src/registry';
import type { GuaranteeTerm } from '../src/tool';

const registry = createRegistry();

function nestedTools(x: GuaranteeTerm): { tool: string; arity: number }[] {
  if (typeof x !== 'object' || 'lit' in x) return [];
  return [{ tool: x.tool, arity: x.args.length }, ...x.args.flatMap(nestedTools)];
}

describe('Signature.guarantees (ADR-0035)', () => {
  it('every table entry names an existing tool and overload', () => {
    for (const [name, entry] of Object.entries(GUARANTEE_TABLE)) {
      const spec = registry.get(name);
      expect(spec, name).toBeDefined();
      const keys = (spec?.signatures ?? []).map(paramsKey);
      for (const key of Object.keys(entry)) expect(keys, `${name}(${key})`).toContain(key);
    }
  });

  it('the registry carries exactly the table entries on its overloads', () => {
    let attached = 0;
    for (const t of registry.tools)
      for (const s of t.signatures) {
        const want = GUARANTEE_TABLE[t.name]?.[paramsKey(s)];
        expect(s.guarantees, `${t.name}(${paramsKey(s)})`).toBe(want);
        if (want !== undefined) attached++;
      }
    expect(attached).toBe(
      Object.values(GUARANTEE_TABLE).reduce((n, e) => n + Object.keys(e).length, 0),
    );
  });

  it('terms refer to the result, to argument positions of the overload, and to registry tools', () => {
    for (const [name, entry] of Object.entries(GUARANTEE_TABLE))
      for (const [key, facts] of Object.entries(entry)) {
        const arity = key.split(',').length;
        const positions = (x: GuaranteeTerm): number[] =>
          typeof x === 'number'
            ? [x]
            : typeof x === 'object' && 'tool' in x
              ? x.args.flatMap(positions)
              : [];
        for (const f of facts) {
          expect(f.args.length, `${name}: ${f.claim}`).toBeGreaterThan(0);
          for (const p of f.args.flatMap(positions)) {
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p, `${name}(${key}): ${f.claim}`).toBeLessThan(arity);
          }
          for (const n of f.args.flatMap(nestedTools)) {
            const spec = registry.get(n.tool);
            expect(spec, n.tool).toBeDefined();
            expect(
              spec?.signatures.some((s) => s.params.length === n.arity),
              `${n.tool}/${String(n.arity)}`,
            ).toBe(true);
          }
        }
      }
  });

  it('a tool without an entry is returned unchanged; one with an entry keeps everything else', () => {
    const point = registry.get('point');
    const raw = point === undefined ? undefined : { ...point, name: 'not_in_table' };
    if (raw === undefined) throw new Error('point');
    expect(withGuarantees(raw)).toBe(raw);
    const mid = registry.get('midpoint');
    expect(mid?.signatures[0]?.guarantees?.map((g) => g.claim)).toEqual(['collinear', 'length']);
    expect(mid?.signatures[0]?.symmetry).toBeDefined();
  });

  it('paramsKey writes a rest capability with an ellipsis', () => {
    expect(paramsKey({ params: ['point', 'point', 'point'], rest: 'point' })).toBe(
      'point,point,point,point…',
    );
    expect(paramsKey({ params: [] })).toBe('');
  });
});
