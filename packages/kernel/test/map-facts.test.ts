/**
 * ADR-0039: what the maps do is registry data. Every entry of the table names an existing tool
 * and overload, every term refers to the overload's argument positions and to registry tools
 * of that arity, the registry carries exactly the table's entries, and every image overload
 * (`apply`, the image sugar of the maps) says whose image it is. (Whether each declaration
 * HOLDS is checked by packages/discovery on registry-built figures: map-facts-hold.test.ts.)
 */
import { describe, expect, it } from 'vitest';
import { paramsKey } from '../src/guarantees';
import { imageOfFor, MAP_TABLE, mapFactsFor, withMapFacts } from '../src/map-facts';
import { createRegistry } from '../src/registry';
import type { GuaranteeTerm, MapFacts } from '../src/tool';

const registry = createRegistry();

function terms(m: MapFacts): GuaranteeTerm[] {
  return [
    ...(m.ratio === undefined ? [] : [m.ratio]),
    ...(m.turn === undefined ? [] : [m.turn]),
    ...(m.fixedPoints ?? []),
    ...(m.fixedCurve === undefined ? [] : [m.fixedCurve]),
    ...(m.invariantCurves ?? []),
    ...(m.center === undefined ? [] : [m.center]),
    ...(m.sends ?? []).flat(),
  ];
}

function positions(x: GuaranteeTerm): number[] {
  if (typeof x === 'number') return [x];
  return typeof x === 'object' && 'tool' in x ? x.args.flatMap(positions) : [];
}

function nested(x: GuaranteeTerm): { tool: string; arity: number }[] {
  if (typeof x !== 'object' || 'lit' in x) return [];
  return [{ tool: x.tool, arity: x.args.length }, ...x.args.flatMap(nested)];
}

describe('Signature.map and Signature.imageOf (ADR-0039)', () => {
  it('every table entry names an existing tool and overload', () => {
    for (const [name, entry] of Object.entries(MAP_TABLE)) {
      const keys = (registry.get(name)?.signatures ?? []).map(paramsKey);
      for (const key of Object.keys(entry)) expect(keys, `${name}(${key})`).toContain(key);
    }
  });

  it('the registry carries exactly the table entries, on overloads that build a transform', () => {
    let attached = 0;
    for (const t of registry.tools)
      for (const s of t.signatures) {
        const want = MAP_TABLE[t.name]?.[paramsKey(s)];
        expect(s.map, `${t.name}(${paramsKey(s)})`).toBe(want);
        if (want === undefined) continue;
        attached++;
        expect(s.output ?? t.outputKinds, t.name).toContain('transform');
      }
    expect(attached).toBe(Object.values(MAP_TABLE).reduce((n, e) => n + Object.keys(e).length, 0));
  });

  it('terms refer to argument positions of the overload and to registry tools of that arity', () => {
    for (const [name, entry] of Object.entries(MAP_TABLE))
      for (const [key, m] of Object.entries(entry)) {
        const arity = key.split(',').length;
        for (const x of terms(m)) {
          for (const p of positions(x)) expect(p, `${name}(${key})`).toBeLessThan(arity);
          for (const n of nested(x)) {
            const spec = registry.get(n.tool);
            expect(spec, n.tool).toBeDefined();
            expect(
              spec?.signatures.some((s) => s.params.length === n.arity),
              `${n.tool}/${String(n.arity)}`,
            ).toBe(true);
          }
        }
        if (m.involution === true)
          for (const [a, b] of m.sends ?? [])
            expect(
              (m.sends ?? []).some(([c, d]) => JSON.stringify([c, d]) === JSON.stringify([b, a])),
              `${name}: an involution sends both ways`,
            ).toBe(true);
      }
  });

  it('apply and the image sugar are images of their first figure argument', () => {
    expect(imageOfFor(registry.get('apply'), [['transform'], ['point']])).toEqual({
      of: 1,
      map: 0,
    });
    expect(imageOfFor(registry.get('reflect'), [['point'], ['line']])).toEqual({
      of: 0,
      map: { tool: 'reflect', args: [1] },
    });
    expect(imageOfFor(registry.get('rotate'), [['line'], ['point'], ['number']])).toEqual({
      of: 0,
      map: { tool: 'rotate', args: [1, 2] },
    });
    // A map overload is not an image; a tool without map data has neither.
    expect(imageOfFor(registry.get('reflect'), [['line']])).toBeUndefined();
    expect(mapFactsFor(registry.get('reflect'), [['line']])?.type).toBe('anti-similarity');
    expect(mapFactsFor(registry.get('midpoint'), [['point'], ['point']])).toBeUndefined();
    expect(imageOfFor(registry.get('midpoint'), [['point'], ['point']])).toBeUndefined();
  });

  it('unclear overloads give no data; a tool without map data is returned unchanged', () => {
    // reflect(X) with X of unknown kind: a line (the mirror) or a point (the half turn).
    expect(mapFactsFor(registry.get('reflect'), [undefined])).toBeUndefined();
    const midpoint = registry.get('midpoint');
    if (midpoint === undefined) throw new Error('midpoint');
    expect(withMapFacts(midpoint)).toBe(midpoint);
  });
});
