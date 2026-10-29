/**
 * Run 16c audit (16b queue, ADR-0044): on(…) without a parameter takes a line, a circle or a
 * conic with a known point (ADR-0042); the refusal names all three, and a conic is taken.
 */
import { describe, expect, it } from 'vitest';
import { diagnostics, firstError } from './helpers/lang';

describe('the words of on(…) without a parameter', () => {
  it('a point is refused with "a line, a circle or a conic"', () => {
    expect(firstError('A = (0, 0)\nP = on(A)').message).toBe(
      'on(…) takes a line, a circle or a conic',
    );
  });

  it('a conic through five points is taken', () => {
    const text = [
      'A = (2, 0)',
      'B = (0, 1)',
      'C = (-2, 0)',
      'D = (0, -1)',
      'E = (6/5, 4/5)',
      'k = conic(A, B, C, D, E)',
      'P = on(k)',
    ].join('\n');
    expect(diagnostics(text).filter((d) => d.severity === 'error')).toEqual([]);
  });
});
