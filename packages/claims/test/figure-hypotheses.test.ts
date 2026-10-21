import { describe, expect, it } from 'vitest';
import { hypothesesInFigure } from '../src/figure-hypotheses';
import { c, Figure, n, REGISTRY } from './helpers/build';

/**
 * Note B of Run 8b (ADR-0008, ADR-0013): when the CURRENT figure violates an `assume` line,
 * the app says so plainly at the assumption, with the deciding measure.
 */

function obtuseAtB(): Figure {
  // ∠ABC = arccos(−3 / (3·√17)) ≈ 104.04°.
  return new Figure().point('A', 0, 3).point('B', 0, 0).point('C', 4, -1);
}

function only(f: Figure) {
  const [h] = hypothesesInFigure(f.doc, REGISTRY);
  if (h === undefined) throw new Error('no hypothesis');
  return h;
}

describe('hypothesesInFigure: each assumption in the current figure', () => {
  it('a violated acute(…) names the obtuse angle: "This figure is not acute: ∠B ≈ 104°"', () => {
    const h = only(obtuseAtB().assume('acute', 'A', 'B', 'C'));
    expect(h).toMatchObject({
      text: 'acute(A, B, C)',
      status: 'fails',
      message: 'This figure is not acute: ∠B ≈ 104°',
    });
  });

  it('a satisfied assumption has no message', () => {
    const f = new Figure().point('A', 1, 3).point('B', 0, 0).point('C', 4, 0);
    expect(only(f.assume('acute', 'A', 'B', 'C'))).toMatchObject({
      status: 'holds',
      message: null,
    });
  });

  it('within the band: ambiguous, said as "at the edge of"', () => {
    const f = new Figure().point('A', 0, 1).point('B', 0, 0).point('C', 1, '1/100000000');
    const h = only(f.assume('acute', 'A', 'B', 'C'));
    expect(h.status).toBe('ambiguous');
    expect(h.message).toBe('This figure is at the edge of acute(A, B, C): ∠B ≈ 90°');
  });

  it('comparisons give both measures, lengths and angles', () => {
    const f = obtuseAtB()
      .assume('greater', c('dist', 'A', 'B'), c('dist', 'B', 'C'))
      .assume('less', c('angle', 'A', 'B', 'C'), n(90))
      .assume('not_equal', c('dist', 'A', 'B'), n(3));
    const [g, l, ne] = hypothesesInFigure(f.doc, REGISTRY);
    expect(g).toMatchObject({
      text: 'AB > BC',
      status: 'fails',
      message: 'This figure does not satisfy AB > BC: AB ≈ 3, BC ≈ 4.12',
    });
    expect(l).toMatchObject({
      text: '∠ABC < 90',
      message: 'This figure does not satisfy ∠ABC < 90: ∠ABC ≈ 104°, 90',
    });
    expect(ne?.message).toBe('This figure does not satisfy AB ≠ 3: AB ≈ 3, 3');
  });

  it('scalene, convex, inside and in order', () => {
    const iso = new Figure().point('A', 0, 3).point('B', -2, 0).point('C', 2, 0);
    expect(only(iso.assume('scalene', 'A', 'B', 'C'))).toMatchObject({
      status: 'fails',
      message: 'This figure is not scalene: AB ≈ CA ≈ 3.61',
    });
    const quad = new Figure().point('A', 0, 0).point('B', 4, 0).point('C', 1, 1).point('D', 0, 4);
    expect(only(quad.assume('convex', 'A', 'B', 'C', 'D')).message).toBe(
      'This figure is not convex: A, B, C, D',
    );
    const tri = new Figure()
      .point('A', 0, 0)
      .point('B', 4, 0)
      .point('C', 0, 4)
      .point('P', 5, 5)
      .def('t', 'polygon', 'A', 'B', 'C');
    expect(only(tri.assume('inside', 'P', 't')).message).toBe(
      'This figure does not have P inside t',
    );
    const line = new Figure()
      .point('A', 0, 0)
      .point('B', 2, 0)
      .point('C', 1, 0)
      .def('l', 'line', 'A', 'B');
    expect(only(line.assume('in_order', 'A', 'B', 'C', 'l')).message).toBe(
      'This figure does not have A, B, C in order on l',
    );
  });

  it('an undefined argument: the assumption cannot be checked, with the reason', () => {
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 1, 0)
      .def('X', 'intersect', c('line', 'A', 'B'), c('line', 'A', 'B'));
    const h = only(f.assume('acute', 'A', 'B', 'X'));
    expect(h.status).toBe('undefined');
    expect(h.message).toMatch(/^This figure does not satisfy acute\(A, B, X\): X is undefined \(/u);
  });

  it('an assumption the claims package does not accept is invalid, with its reason', () => {
    const f = obtuseAtB().assume('right', 'A', 'B', 'C');
    expect(only(f)).toMatchObject({
      status: 'invalid',
      message: 'equality assumptions are not allowed: construct it instead of assuming right(…)',
    });
  });

  it('agrees with the tester: the status is checkAssumption on the same values', () => {
    const f = obtuseAtB().assume('acute', 'A', 'B', 'C').assume('scalene', 'A', 'B', 'C');
    expect(hypothesesInFigure(f.doc, REGISTRY).map((h) => h.status)).toEqual(['fails', 'holds']);
    expect(hypothesesInFigure(f.doc, REGISTRY).map((h) => h.id)).toEqual(
      f.doc.assumptions.map((a) => a.id),
    );
  });
});
