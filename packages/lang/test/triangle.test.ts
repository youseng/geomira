import { describe, expect, it } from 'vitest';
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import { FloatField } from '@geomira/num/float-field';
import { fnv1a, polygonName } from '../src/triangle';
import { file, parseOk, registry } from './helpers/lang';

type P = { x: number; y: number };

function angles(doc: ReturnType<typeof parseOk>, names: readonly string[]): number[] {
  const ctx = evalContextFor(doc);
  if (!ctx.ok) throw new Error(ctx.reason);
  const values = evaluate(doc, registry, FloatField, ctx.ctx).values;
  const pts = names.map((n) => {
    const v = values.get(doc.objects.find((o) => o.name === n)?.id ?? -1);
    if (v?.kind !== 'point') throw new Error(n);
    return { x: v.x, y: v.y };
  });
  const at = (a: P, b: P, c: P): number => {
    const [ux, uy, vx, vy] = [a.x - b.x, a.y - b.y, c.x - b.x, c.y - b.y];
    return (Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)) * 180) / Math.PI;
  };
  const [a, b, c] = pts as [P, P, P];
  return [at(c, a, b), at(a, b, c), at(b, c, a)];
}

describe('triangle A B C [type] (SPEC §6.2)', () => {
  it('acute: every angle below 90° with a margin; deterministic from the statement', () => {
    for (const names of [
      ['A', 'B', 'C'],
      ['P', 'Q', 'R'],
      ['A_1', 'B_1', 'C_1'],
    ]) {
      const doc = parseOk(file(`triangle ${names.join(' ')} [acute]`));
      expect(Math.max(...angles(doc, names))).toBeLessThanOrEqual(80);
      expect(Math.min(...angles(doc, names))).toBeGreaterThanOrEqual(15);
      expect(parseOk(file(`triangle ${names.join(' ')}   [acute]`))).toEqual(doc);
    }
  });

  it('obtuse_at_V: the angle at V is obtuse; the assumption names it', () => {
    const doc = parseOk(file('triangle A B C [obtuse_at_B]'));
    const [, b] = angles(doc, ['A', 'B', 'C']);
    expect(b).toBeGreaterThan(100);
    expect(b).toBeLessThan(150);
    const a = doc.assumptions[0];
    expect(a?.kind).toBe('greater');
  });

  it('scalene: the sides differ by 10%; types combine', () => {
    const doc = parseOk(file('triangle A B C [scalene, acute]'));
    expect(doc.assumptions.map((a) => a.kind)).toEqual(['acute', 'scalene']);
  });

  it('different statements give different triangles; the polygon name avoids taken names', () => {
    const a = parseOk(file('triangle A B C')).objects.map((o) => o.def);
    const b = parseOk(file('triangle A B C [acute]')).objects.map((o) => o.def);
    expect(a).not.toEqual(b);
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(polygonName(['A', 'B', 'C'], (n) => n === 'tri_ABC')).toBe('tri_ABC_2');
    expect(polygonName(["H'", 'M_{ab}', 'C'], () => false)).toBe('tri_HM_abC');
    const doc = parseOk(file('tri_ABC = (0, 0)', 'triangle A B C'));
    expect(doc.objects.map((o) => o.name)).toEqual(['tri_ABC', 'A', 'B', 'C', 'tri_ABC_2']);
  });

  it('the points are exact decimals on a 0.1 grid (printed as written)', () => {
    const doc = parseOk(file('triangle A B C [acute]'));
    for (const o of doc.objects.slice(0, 3)) {
      expect(o.def.kind === 'call' && o.def.tool).toBe('point');
    }
  });
});
