/**
 * A line with an error is not applied at all (ADR-0009 decision 14; bug-fix round,
 * ADR-0028): statements that define several objects (`triangle`, `points`, `X, Y = …`) add
 * none of them when one fails, and later uses of their names say which line to fix.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { file, registry } from './helpers/lang';

function built(...lines: string[]) {
  const r = parse(file(...lines), registry);
  return {
    names: r.doc.objects.map((o) => o.name),
    errors: r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message),
  };
}

const CURVES = ['l = line((0, 0), (1, 0))', 'w = circle((0, 0), 1)'];

describe('no partly applied lines', () => {
  it('triangle AAB adds nothing', () => {
    const r = built('triangle AAB', 'M = midpoint(A, B)');
    expect(r.names).toEqual([]);
    expect(r.errors).toEqual([
      'triangle AAB names A twice',
      'A is not defined: its line 2 has an error',
      'B is not defined: its line 2 has an error',
    ]);
  });

  it('points A B with A existing adds no B', () => {
    const r = built('A = (0, 0)', 'points A B');
    expect(r.names).toEqual(['A']);
    expect(r.errors).toEqual(['the name A is already used']);
  });

  it('X, X = intersect(l, w) adds no X', () => {
    const r = built(...CURVES, 'X, X = intersect(l, w)');
    expect(r.names).toEqual(['l', 'w']);
    expect(r.errors).toEqual(['the name X is already used']);
  });

  it('A, Y = intersect(l, w) with A existing adds no Y', () => {
    const r = built('A = (5, 5)', ...CURVES, 'A, Y = intersect(l, w)', 'Z = midpoint(A, Y)');
    expect(r.names).toEqual(['A', 'l', 'w']);
    expect(r.errors).toEqual([
      'the name A is already used',
      'Y is not defined: its line 5 has an error',
    ]);
  });

  it('a waiting style of a name of the failed line is not used up', () => {
    const r = built('A = (0, 0)', 'style B [color=red]', 'points A B');
    expect(r.names).toEqual(['A']);
    expect(r.errors).toEqual(['B is not defined', 'the name A is already used']);
  });

  it('lines without an error are applied whole (as before)', () => {
    expect(built('points A B').names).toEqual(['A', 'B']);
    expect(built('triangle ABC').names).toEqual(['A', 'B', 'C', 'tri_ABC']);
    expect(built(...CURVES, 'X, Y = intersect(l, w)').names).toEqual(['l', 'w', 'X', 'Y']);
  });
});
