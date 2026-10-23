/**
 * `circle(O, AB)` (bug-fix round, ADR-0028): ADR-0025 spreads the run into its points, so it
 * is the circle through O, A and B. That stays, but the line now gets a WARNING (it is still
 * applied) saying so and how to write the circle of centre O and radius AB.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { file, registry } from './helpers/lang';

const BASE = ['O = (0, 0)', 'A = (1, 3)', 'B = (4, 0)'];

describe('circle(O, AB)', () => {
  it('is the circle through O, A and B, with a warning that does not block', () => {
    const r = parse(file(...BASE, 'c = circle(O, AB)'), registry);
    expect(r.diagnostics).toEqual([
      {
        line: 5,
        column: 5,
        endColumn: 18,
        severity: 'warning',
        message: 'circle(O, AB) is the circle through O, A and B',
        hint: 'for centre O and radius AB write circle(O, dist(A, B))',
      },
    ]);
    expect(print(r.doc)).toContain('c = circle(O, A, B)');
  });

  it('also when nested', () => {
    const r = parse(file(...BASE, 'X = center(circle(O, AB))'), registry);
    expect(r.diagnostics.map((d) => [d.severity, d.message])).toEqual([
      ['warning', 'circle(O, AB) is the circle through O, A and B'],
    ]);
    expect(r.doc.objects.map((o) => o.name)).toContain('X');
  });

  it('the other forms give no warning', () => {
    for (const t of [
      'c = circle(O, dist(A, B))',
      'c = circle(O, A, B)',
      'c = circle(OAB)',
      'c = circle(O, A)',
      'c = OAB',
      'c = circle(AB, O)',
    ]) {
      expect(parse(file(...BASE, t), registry).diagnostics, t).toEqual([]);
    }
  });
});
