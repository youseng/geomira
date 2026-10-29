import { describe, expect, it } from 'vitest';
import { checkInvariants } from '@geomira/kernel/invariants';
import { formatDiagnostic, hasErrors, join, warning } from '../src/diagnostic';
import { parse } from '../src/parse';
import { diagnostics, file, firstError, registry } from './helpers/lang';

const messages = (text: string): string[] => diagnostics(text).map((d) => d.message);

describe('error paths of the builder (each statement with an error is left out)', () => {
  it('derived layers whose images clash: at the second rule, or at the object that makes the clash', () => {
    const atRule = parse(
      file(
        '@layer one = image(t, main)',
        '@layer two = image(t, main)',
        'A = (1, 0)',
        't = reflect((0, 0))',
      ),
      registry,
    );
    expect(atRule.diagnostics.map((d) => [d.line, d.message])).toEqual([
      [3, 'layer two: the image name A* of A in layer two is already used'],
    ]);
    expect(atRule.doc.objects.map((o) => o.name)).toEqual(['A', 't', 'A*']);
    const atObject = parse(
      file(
        '@layer one = image(t, main)',
        '@layer two = image(t, main)',
        't = reflect((0, 0))',
        'A = (1, 0)',
        'B = (2, 0)',
      ),
      registry,
    );
    expect(atObject.diagnostics.map((d) => d.line)).toEqual([5, 6]);
    expect(atObject.diagnostics[0]?.message).toBe(
      'the image name A* of A in layer two is already used',
    );
    expect(checkInvariants(atObject.doc)).toEqual([]);
  });

  it('derived-layer lines: unknown source, the layer itself, a bad suffix, an excluded name that never comes', () => {
    expect(firstError('@layer t = image(T, nowhere)').message).toBe('there is no layer "nowhere"');
    expect(firstError('@layer t = image(T, t)').message).toBe(
      'a derived layer cannot image itself',
    );
    expect(firstError('@layer t = image(T, main) [suffix=a]').hint).toBe(
      'write [suffix=*] or [suffix=**]',
    );
    expect(messages('@layer t = image(s, main) [exclude=Q]\ns = reflect((0, 0))')).toEqual([
      'Q is not defined',
    ]);
    expect(firstError('@layer main = image(s, main)').message).toBe(
      'the main layer cannot be a derived layer',
    );
    expect(firstError('@layer a [main]\n@layer b [main]').message).toBe(
      'the main layer is declared twice',
    );
    expect(
      firstError('@layer s = image(T, main)\nT = reflect((0, 0))\nT = reflect((1, 1))').message,
    ).toBe('the name T is already used');
  });

  it('a transformation whose own line has an error', () => {
    expect(messages('@layer t = image(s, main)\ns = reflect(nothing)')).toEqual([
      's is not defined: its line 3 has an error',
      'unknown name "nothing"',
    ]);
  });

  it('on(obj) without a parameter needs a line or a circle with a value', () => {
    expect(firstError('A = (0, 0)\nP = on(A)').message).toBe(
      'on(…) takes a line, a circle or a conic',
    );
    expect(firstError('A = (0, 0)\nl = line(A, A)\nP = on(l)').message).toContain(
      "needs the object's value to choose one",
    );
  });

  it('attribute values: wrong kinds and ranges', () => {
    expect(firstError('A = (0, 0) [width=red]').message).toContain('"width" takes a number');
    expect(firstError('A = (0, 0) [width=-1]').message).toContain('"width" takes a number');
    expect(firstError('A = (0, 0) [hidden=maybe]').message).toBe('"hidden" is true or false');
    expect(firstError('A = (0, 0) [label=word]').message).toBe('"label" takes a quoted text');
    expect(firstError('A = (0, 0) [color=1]').message).toBe(
      '"color" takes a word or a quoted text',
    );
    expect(firstError('A = (0, 0) [color=a,b]').message).toBe('a definition has no attribute "b"');
    expect(firstError('A = (0, 0) [layers="x"]').message).toBe('"layers" takes a list of names');
    expect(firstError('A = (0, 0) [layers=-main]').message).toBe('"layers" takes a list of names');
    expect(firstError('A = (0, 0) [label=-"x"]').message).toBe('a string cannot be negative');
    expect(firstError('A = (0, 0) [label=- x]').message).toBe(
      'nothing may separate "-" from its value',
    );
    expect(firstError('A = (0, 0) [=1]').message).toContain('expected an attribute name');
    expect(firstError('A = (0, 0) [color=]').message).toContain('expected a value');
    expect(firstError('A = (0, 0) [color=red').message).toContain('expected "]"');
    expect(firstError('A = (0, 0) color=red').hint).toBe('attributes go in brackets: [color=red]');
    expect(firstError('@layer a [order=x]').message).toContain('"order" takes a number');
    expect(firstError('@view v [viewport=1,2]').message).toContain('viewport takes three numbers');
    expect(firstError('@view v [layers=nope]').message).toBe('there is no layer "nope"');
    expect(firstError('@view v\n@view v').message).toBe('the view name v is already used');
    expect(firstError('@view v [colour=red]').message).toBe('a view has no attribute "colour"');
  });

  it('claims: the name attribute', () => {
    expect(firstError('A = (0, 0)\nclaim A = A [name=A]').message).toBe(
      'the name A is already used',
    );
    expect(firstError('A = (0, 0)\nclaim A = A [name=x]\nclaim A = A [name=x]').message).toBe(
      'the name x is already used',
    );
    expect(firstError('A = (0, 0)\nclaim A = A [name=claim]').message).toBe('"claim" is a keyword');
    expect(firstError('A = (0, 0)\nclaim A = A [title=x]').message).toBe(
      'a claim has no attribute "title"',
    );
    expect(firstError('A = (0, 0)\nclaim collinear(A, A, A, near(A))').message).toContain(
      'takes no selectors',
    );
  });

  it('directives: forms', () => {
    expect(firstError('@version x').message).toBe('@version takes a whole number');
    expect(firstError('@title untitled').message).toBe('@title takes a quoted text');
    expect(firstError('@title "a"\n@title "b"').message).toBe('@title is given twice');
    expect(firstError('@viewport 1 2').message).toContain('three numbers');
    expect(firstError('@layer').message).toContain('expected layer name');
    expect(firstError('@layer x = picture(T, main)').message).toContain(
      'expected image(T, source)',
    );
    expect(firstError('label A').message).toContain('expected the label text in quotes');
    expect(firstError('triangle A B').message).toBe('triangle takes three point names, found 2');
    expect(firstError('triangle A B C [obtuse_at_A, obtuse_at_B]').message).toBe(
      'a triangle has at most one obtuse angle',
    );
    expect(firstError('3 = 4').message).toContain('expected a statement');
  });

  it('syntax inside expressions', () => {
    expect(firstError('x = (1, 2').message).toContain('expected ")"');
    expect(firstError('x = (1').message).toContain('expected ")"');
    expect(firstError('x = midpoint(').message).toContain('expected an expression');
    expect(firstError('x = "a"').message).toContain('expected an expression');
    expect(firstError('x = on_arc(A, B, not)').message).toContain('unknown tool');
    expect(
      firstError(
        'A = (0,0)\nB = (1,0)\nω = circle(A, B)\nX = intersect(line(A, B), ω, on_arc(A, B))',
      ).hint,
    ).toBe('on_arc(B, C, A) or on_arc(B, C, not A)');
    expect(firstError('A = (0,0)\nX = intersect(A, A, along(+, +))').message).toContain(
      'expected ")"',
    );
  });

  it('assumption notation errors', () => {
    expect(firstError('A = (0,0)\nassume A, A in order of A').message).toContain(
      'expected "in order on"',
    );
    expect(firstError('A = (0,0)\nassume A').message).toBe('this is not a condition');
    expect(firstError('A = (0,0)\nassume A = ').message).toContain('construct it');
    expect(firstError('A = (0,0)\nassume ∠AAA').message).toContain('expected <, > or ≠');
    expect(firstError('A = (0,0)\nassume A ?').message).toContain('unexpected character');
    expect(firstError('A = (0,0)\nassume AA/AA < 2').message).toContain('compare lengths');
  });

  it('claim notation errors', () => {
    expect(firstError('A = (0,0)\nclaim ∠AA = ∠AAA').message).toBe(
      '∠ needs three point names, found 2',
    );
    expect(firstError('A = (0,0)\nclaim ∠(A, A) = ∠AAA').message).toContain('takes three points');
    expect(firstError('A = (0,0)\nclaim ∠AAA + 3 = 4').message).toBe('expected a second angle');
    expect(firstError('A = (0,0)\nclaim dist(A) = AA').message).toBe('dist takes two points');
    expect(firstError('A = (0,0)\nclaim angle(A) = ∠AAA').message).toBe('angle takes three points');
    expect(firstError('A = (0,0)\nclaim AA = 2·A').message).toContain('expected a segment');
    expect(firstError('A = (0,0)\nclaim ∡AAA = 2∡AAA').message).toBe(
      'this relation is not a claim the language knows',
    );
  });
});

describe('diagnostic helpers', () => {
  it('format, join, hasErrors', () => {
    const w = warning({ line: 2, column: 3, endColumn: 3 }, 'm', 'h');
    expect(w.endColumn).toBe(4);
    expect(formatDiagnostic(w)).toBe('line 2, column 3: m (hint: h)');
    expect(hasErrors([w])).toBe(false);
    expect(hasErrors(diagnostics('x = ('))).toBe(true);
    expect(
      join({ line: 1, column: 5, endColumn: 6 }, { line: 1, column: 2, endColumn: 3 }),
    ).toEqual({ line: 1, column: 2, endColumn: 6 });
    expect(
      join({ line: 1, column: 5, endColumn: 6 }, { line: 2, column: 2, endColumn: 3 }),
    ).toEqual({ line: 1, column: 5, endColumn: 6 });
  });
});
