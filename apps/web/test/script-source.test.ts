import { describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import {
  commandLines,
  diagnosticRange,
  highlightSource,
  signatureAt,
  lineAt,
  sourceCompletionsAllowed,
} from '../src/script-source';

describe('script source assistance', () => {
  it('converts only command separators and preserves quoted, nested and commented text', () => {
    const input = '@title "a;\\"b"; A=(0,0); claim harmonic(A,B;C,D) # keep; comment';
    expect(commandLines(input)).toBe(
      '@title "a;\\"b"\nA=(0,0)\nclaim harmonic(A,B;C,D) # keep; comment',
    );
    expect(commandLines('  # comment; untouched\nA=(0,0)')).toBe('  # comment; untouched\nA=(0,0)');
  });
  it('highlights the exact original source including Unicode, escapes and comments', () => {
    const text = 'ω = circle(A, 2) # radius\n@title "🟢 geometry"\n';
    expect(
      highlightSource(text)
        .map((p) => p.text)
        .join(''),
    ).toBe(text);
    expect(highlightSource(text).some((p) => p.kind === 'comment')).toBe(true);
  });
  it('selects a diagnostic span in UTF-16 units on another line', () => {
    const text = '# 🟢\nω = midpoint(A, Missing)\n';
    const [start, end] = diagnosticRange(text, {
      line: 2,
      column: 17,
      endColumn: 24,
      severity: 'error',
      message: 'missing',
      hint: '',
    });
    expect(text.slice(start, end)).toBe('Missing');
  });
  it('reads the innermost registry signature without interpreting strings or comments as calls', () => {
    const registry = createRegistry();
    expect(signatureAt('O=midpoint(A, center(', 21, registry)).toContain('center(');
    expect(signatureAt('@title "midpoint("', 18, registry)).toBeNull();
    expect(signatureAt('# midpoint(', 11, registry)).toBeNull();
  });
});

it('handles the first empty line and clamps stale carets after source replacement', () => {
  expect(lineAt('\nA=(0,0)', 0)).toEqual({ start: 0, text: '', cursor: 0 });
  expect(lineAt('A', 999)).toEqual({ start: 0, text: 'A', cursor: 1 });
  expect(sourceCompletionsAllowed('# midpoint', 10)).toBe(false);
  expect(sourceCompletionsAllowed('@title "midp', 12)).toBe(false);
  expect(sourceCompletionsAllowed('M=midp', 6)).toBe(true);
});
