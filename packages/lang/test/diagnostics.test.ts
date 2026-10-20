import { describe, expect, it } from 'vitest';
import { diagnostics, firstError, file } from './helpers/lang';
import { parse } from '../src/parse';
import { registry } from './helpers/lang';

const TRI = ['A = (1, 3)', 'B = (0, 0)', 'C = (4, 0)', 'ω = circumcircle(A, B, C)'];
const at = (text: string): [number, number, number] => {
  const d = firstError(text);
  return [d.line, d.column, d.endColumn];
};

describe('every diagnostic has a line, a column range and a fix hint', () => {
  it('did you mean M_a? (names)', () => {
    const d = firstError('Ma = (0, 0)');
    expect(d.message).toBe('"Ma" is not a valid name: did you mean M_a?');
    expect(d.hint).toBe('write M_a');
    expect([d.line, d.column]).toEqual([1, 1]);
  });

  it('a bare index → a selector hint, at the call (kernel selector-check, ADR-0006)', () => {
    const text = [...TRI, 'X = midpoint(A, intersect(line(A, B), ω, 2))'].join('\n');
    const d = firstError(text);
    expect(d.message).toContain('bare index');
    expect(d.message).toContain('use a selector');
    expect(d.hint).toBe('replace the index by a selector');
    expect([d.line, d.column]).toEqual([5, 17]);
  });

  it('a two-candidate call without a selector; along(±) where only orient(±) applies', () => {
    const missing = firstError([...TRI, 'X = intersect(line(A, B), ω)'].join('\n'));
    expect(missing.message).toContain('can have two candidates and the call has no selector');
    expect(missing.hint).toContain('add a selector');
    const mis = firstError([...TRI, 'X = intersect(ω, circle(B, A), along(+))'].join('\n'));
    expect(mis.message).toContain('along(±) does not apply to circle ∩ circle');
    expect(mis.hint).toBe('use orient(±) instead');
    const none = firstError([...TRI, 'X = midpoint(A, B, near(C))'].join('\n'));
    expect(none.message).toContain('midpoint takes no selectors');
  });

  it('reserved managed names', () => {
    const t = file(
      '@layer inv = image(s, main)',
      'A = (1, 0)',
      's = reflect((0, 0))',
      'A* = (2, 2)',
    );
    const d = diagnostics(t).find((x) => x.severity === 'error');
    expect(d?.message).toBe('A* is the image of A in layer inv');
    expect(d?.line).toBe(5);
    expect(firstError('k* = 1').message).toContain('reserved for images');
  });

  it('a starred name followed by an operand: write a * b', () => {
    const d = firstError('a = 2\nb = a* a');
    expect(d.hint).toBe('write a * … for multiplication');
  });

  it('unknown tools and names, with suggestions', () => {
    expect(firstError('A = (0, 0)\nM = midpont(A, A)').message).toBe(
      'unknown tool "midpont": did you mean midpoint?',
    );
    expect(firstError('circ = circle((0, 0), 1)\nX = on(cirk, 1, 2)').message).toBe(
      'unknown name "cirk": did you mean circ?',
    );
    expect(firstError('k = 1\nX = k(2)').message).toBe('k is an object, not a tool');
  });

  it('order: defined later, built from itself, a failed line', () => {
    expect(firstError('M = midpoint(A, A)\nA = (0, 0)').message).toBe(
      'A is defined later, on line 3',
    );
    expect(firstError('A = midpoint(A, A)').message).toBe('A cannot be built from itself');
    const ds = diagnostics('A = (0, 0)\nB = midpoint(A, Z)\nC = midpoint(B, A)');
    expect(ds.map((d) => d.message)).toEqual([
      'unknown name "Z"',
      'B is not defined: its line 3 has an error',
    ]);
  });

  it("argument kinds no overload takes (the registry's message)", () => {
    const d = firstError('A = (0, 0)\nl = line(A, (1, 1))\nM = midpoint(A, l)');
    expect(d.message).toBe(
      'midpoint does not accept (point, line); signatures: midpoint(point, point)',
    );
  });

  it("claims: the claims package's own problems (claimProblem)", () => {
    expect(firstError([...TRI, 'claim collinear(A, B)'].join('\n')).message).toBe(
      'collinear takes at least 3 arguments, got 2',
    );
    expect(firstError([...TRI, 'claim length(A, B, C, A, B)'].join('\n')).message).toBe(
      'length: argument 5 must be an exact number',
    );
    expect(firstError([...TRI, 'claim frobnicate(A, B)'].join('\n')).message).toBe(
      'unknown claim "frobnicate"',
    );
    expect(firstError([...TRI, 'claim AB = CD'].join('\n')).message).toBe('unknown name "D"');
    expect(firstError([...TRI, 'claim AB < AC'].join('\n')).message).toContain('expected "="');
    expect(firstError([...TRI, 'claim ∠ABC = 3'].join('\n')).message).toBe(
      'this relation is not a claim the language knows',
    );
    expect(firstError([...TRI, 'claim ∠A + ∠B = 90'].join('\n')).message).toBe(
      '∠ needs three point names, found 1',
    );
  });

  it('assumptions: assumptionProblem (construct it), open conditions only', () => {
    expect(firstError([...TRI, 'assume equal(A, B)'].join('\n')).message).toContain('construct it');
    expect(firstError([...TRI, 'assume AB = AC'].join('\n')).message).toContain('construct it');
    expect(firstError([...TRI, 'assume AB ≤ AC'].join('\n')).hint).toBe('use < or >');
    expect(firstError([...TRI, 'assume acute(A, B)'].join('\n')).message).toBe(
      'acute takes three points',
    );
    expect(firstError([...TRI, 'assume ∠ABC < AB'].join('\n')).message).toBe(
      'compare angles with angles and lengths with lengths',
    );
  });

  it('syntax: positions point at the offending token', () => {
    expect(at('A = midpoint(A,')).toEqual([1, 16, 17]);
    expect(at('A = (0, 0) 3')).toEqual([1, 12, 13]);
    expect(firstError('A = (0, 0) 3').message).toBe('unexpected "3"');
    expect(firstError('x = 1/0').message).toContain('denominator is zero');
    expect(firstError('x = 1e-3').hint).toContain('0.001');
    expect(firstError('x = AB').hint).toContain('dist(A, B)');
    expect(firstError('x = ∡ABC').hint).toContain('dangle(A, B, C)');
    expect(firstError('x = intersect(a, along(+), b)').message).toContain(
      'selectors come after the arguments',
    );
    expect(firstError('x = intersect(a, b, along(2))').hint).toBe('write along(+) or along(-)');
  });

  it('directives and attributes', () => {
    expect(firstError('@frob').message).toBe('unknown directive @frob');
    expect(firstError('@viewport 0 0 0').message).toBe('the zoom must be positive');
    expect(firstError('@layer a [opacity=2]').message).toContain('[0, 1]');
    expect(firstError('@layer a\n@layer a').message).toBe('the layer name a is already used');
    expect(firstError('A = (0, 0) [colour=red]').hint).toContain('color');
    expect(firstError('A = (0, 0) [dash=wavy]').message).toBe('dash is solid, dashed, dotted');
    expect(firstError('A = (0, 0) [hidden, hidden]').message).toBe(
      'the attribute "hidden" is given twice',
    );
    expect(firstError('A = (0, 0) [layers=nope]').message).toBe('there is no layer "nope"');
    expect(firstError('@layer t = image(T, main)').message).toBe(
      'the transformation T is not defined',
    );
    expect(firstError('A = (0, 0)\n@layer t = image(A, main)').message).toBe(
      'layer t: A is not a transformation',
    );
    expect(firstError('style Q [hidden]').message).toBe('Q is not defined');
    expect(firstError('triangle A B C [acute, obtuse_at_A]').message).toBe(
      'an acute triangle has no obtuse angle',
    );
    expect(firstError('triangle A B C [right]').message).toContain('not a triangle type');
    expect(firstError('@version 1\n@version 1').message).toBe('@version is given twice');
  });

  it('a missing @version is a warning, not an error', () => {
    const r = parse('A = (0, 0)', registry);
    expect(r.diagnostics).toEqual([
      {
        line: 1,
        column: 1,
        endColumn: 2,
        severity: 'warning',
        message: 'no @version line: read as version 1',
        hint: 'add @version 1 as the first line',
      },
    ]);
    expect(r.doc.objects).toHaveLength(1);
  });

  it('every hint is non-empty', () => {
    const texts = [
      'Ma = 1',
      'x = (',
      'claim',
      'assume',
      '@layer',
      'A = (0,0) [',
      'x = "',
      'triangle A',
      'label A 3',
      '@view v [layers=q]',
      'x = on(q)',
      'x = 2a',
    ];
    for (const t of texts)
      for (const d of diagnostics(t))
        expect(d.hint.length, `${t}: ${d.message}`).toBeGreaterThan(0);
  });
});
