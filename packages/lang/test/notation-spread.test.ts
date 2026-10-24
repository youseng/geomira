/**
 * ADR-0025's spread forms inside claim and assumption notation (bug-fix round, ADR-0028):
 * `dist(AB)`, `length(AB)`, `angle(ABC)` and `∠(ABC)` on a side of a relation read as in
 * definitions (dist(A, B), angle(A, B, C)). A wrong count is reported at the call, not at the
 * `=` after it.
 */
import { describe, expect, it } from 'vitest';
import { print } from '../src/print';
import { file, firstError, parseOk } from './helpers/lang';

const BASE = ['A = (1, 3)', 'B = (0, 0)', 'C = (4, 0)', 'D = (6, 6)'];

function last(...lines: string[]): string {
  const text = print(parseOk(file(...BASE, ...lines)));
  return text.trimEnd().split('\n').at(-1) ?? '';
}

describe('spread forms on the sides of claims and assumptions', () => {
  it('reads them as their points', () => {
    expect(last('claim dist(AB) = dist(CD)')).toBe('claim AB = CD');
    expect(last('claim length(AB) = 2·distance(CD)')).toBe('claim AB = 2·CD');
    expect(last('claim dist(AB)/dist(CD) = 2')).toBe('claim AB/CD = 2');
    expect(last('claim angle(ABC) = angle(BCA)')).toBe('claim ∠ABC = ∠BCA');
    expect(last('claim ∠(ABC) = ∠BCA')).toBe('claim ∠ABC = ∠BCA');
    expect(last('claim angle(ABC) + angle(BCA) = 90')).toBe('claim ∠ABC + ∠BCA = 90');
    expect(last('assume dist(AB) < dist(AC)')).toBe('assume AB < AC');
    expect(last('assume angle(ABC) > 90')).toBe('assume ∠ABC > 90');
  });

  it('the same text with the points apart reads the same', () => {
    expect(last('claim dist(AB) = dist(CD)')).toBe(last('claim dist(A, B) = dist(C, D)'));
    expect(last('assume angle(ABC) > 90')).toBe(last('assume angle(A, B, C) > 90'));
  });

  it('a wrong count is reported at the call', () => {
    const d = firstError(['A = (1, 3)', 'B = (0, 0)', 'claim dist(A) = dist(A, B)'].join('\n'));
    expect(d.message).toBe('dist takes two points');
    expect([d.line, d.column, d.endColumn]).toEqual([3, 7, 14]);
    const a = firstError(['A = (1, 3)', 'B = (0, 0)', 'assume angle(AB) > 90'].join('\n'));
    expect(a.message).toBe('angle takes three points');
    expect([a.line, a.column, a.endColumn]).toEqual([3, 8, 17]);
  });
});
