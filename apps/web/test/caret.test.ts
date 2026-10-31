/** ADR-0047: the caret kept as a line and a column when Ctrl+Enter prints the text again. */
import { describe, expect, it } from 'vitest';
import { lineColumnOf, offsetOf } from '../src/caret';

describe('caret as line and column', () => {
  const text = 'A = (0, 0)\nM = midpoint(A,B)\nB = (4, 0)';

  it('round-trips every offset of a text', () => {
    for (let o = 0; o <= text.length; o++) expect(offsetOf(text, lineColumnOf(text, o))).toBe(o);
  });

  it('the end of a line stays the end of that line when the printing widens it', () => {
    const at = lineColumnOf(text, text.indexOf('M = midpoint(A,B)') + 'M = midpoint(A,B)'.length);
    const printed = text.replace('midpoint(A,B)', 'midpoint(A, B)');
    expect(offsetOf(printed, at)).toBe(printed.indexOf('\nB ='));
    expect(offsetOf(printed, { ...at, column: 99 })).toBe(printed.indexOf('\nB ='));
  });

  it('a caret inside a line keeps its column', () => {
    const at = lineColumnOf(text, text.indexOf('B)'));
    expect(at).toEqual({ line: 1, column: 'M = midpoint(A,'.length });
    const printed = text.replace('midpoint(A,B)', 'midpoint(A, B)');
    expect(offsetOf(printed, at)).toBe(printed.indexOf(' B)'));
  });

  it('clamps lines and columns', () => {
    expect(offsetOf(text, { line: 99, column: 0 })).toBe(text.lastIndexOf('\n') + 1);
    expect(offsetOf(text, { line: -1, column: -1 })).toBe(0);
    expect(lineColumnOf(text, 999)).toEqual({ line: 2, column: 'B = (4, 0)'.length, atEnd: true });
    expect(offsetOf('', { line: 0, column: 3 })).toBe(0);
  });
});
