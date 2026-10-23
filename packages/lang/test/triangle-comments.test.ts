/**
 * Comments of a `triangle` line on existing points (bug-fix round, ADR-0028): they went to
 * the first vertex's own definition, an earlier line. They now go to the first object the
 * line makes: its first new vertex, or the polygon when every vertex exists.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { file, registry } from './helpers/lang';

function printed(...lines: string[]): string {
  const r = parse(file(...lines), registry);
  expect(r.diagnostics).toEqual([]);
  const text = print(r.doc);
  expect(print(parse(text, registry).doc)).toBe(text);
  return text;
}

describe('comments of a triangle line', () => {
  it('on three existing points: the polygon', () => {
    const text = printed(
      'A = (0, 0)',
      'B = (4, 0)',
      'C = (1, 3)',
      '# the triangle',
      'triangle ABC  # inl',
    );
    expect(text).toBe(
      '@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\n# the triangle\ntri_ABC = polygon(A, B, C)  # inl\n',
    );
  });

  it('with one existing point: the first new vertex', () => {
    const text = printed('A = (0, 0)', '# the triangle', 'triangle ABC');
    const lines = text.split('\n');
    expect(lines[1]).toBe('A = (0, 0)');
    expect(lines[2]).toBe('# the triangle');
    expect(lines[3]).toMatch(/^B = \(/u);
  });

  it('with new points only: the first vertex (as before)', () => {
    const lines = printed('# the triangle', 'triangle ABC').split('\n');
    expect(lines[1]).toBe('# the triangle');
    expect(lines[2]).toMatch(/^A = \(/u);
  });
});
