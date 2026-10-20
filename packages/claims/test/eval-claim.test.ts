import { describe, expect, it } from 'vitest';
import { evalClaim } from '../src/eval-claim';
import { c, Figure, n, REGISTRY } from './helpers/build';

/** B = (0, 0), C = (4, 0) and A, with H the orthocentre and ω the circumcircle. */
function triangle(ax: string | number, ay: string | number): Figure {
  return new Figure()
    .point('A', ax, ay)
    .point('B', 0, 0)
    .point('C', 4, 0)
    .def('H', 'orthocenter', 'A', 'B', 'C')
    .def('O', 'circumcenter', 'A', 'B', 'C')
    .def('w', 'circumcircle', 'A', 'B', 'C');
}

describe('evalClaim: three-valued, in the current figure', () => {
  it('∠BHC + ∠A = 180° holds exactly over Q in an acute triangle', () => {
    const f = triangle(1, 3);
    const id = f.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180));
    expect(evalClaim(f.doc, id, REGISTRY)).toEqual({ value: 'true', rung: 'exact over Q' });
  });

  it('B = (0,0), C = (4,0), A = (−1,2): ∠BHC = ∠A ≈ 41.6°, so the sum is false and the equality true', () => {
    const f = triangle(-1, 2);
    const sum = f.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180));
    const eq = f.claim('angle_eq', 'B', 'H', 'C', 'B', 'A', 'C');
    expect(evalClaim(f.doc, sum, REGISTRY)).toEqual({ value: 'false', rung: 'exact over Q' });
    expect(evalClaim(f.doc, eq, REGISTRY)).toEqual({ value: 'true', rung: 'exact over Q' });
  });

  it('a claim on an Undefined object is undefined, never true or false', () => {
    const f = triangle(1, 3)
      .def('l', 'line', 'A', 'B')
      .def('m', 'parallel', 'C', 'l')
      .def('X', 'intersect', 'l', 'm');
    const id = f.claim('collinear', 'X', 'A', 'B');
    const v = evalClaim(f.doc, id, REGISTRY);
    expect(v).toMatchObject({ value: 'undefined', status: 'undefined' });
    expect(v.value === 'undefined' ? v.reason : '').toMatch(/^X is undefined/);
  });

  it('degenerate NDG data → undefined("degenerate: …") naming the arguments', () => {
    const f = triangle(1, 3).def('M', 'midpoint', 'B', 'B');
    const id = f.claim('collinear', 'M', 'B', 'C');
    expect(evalClaim(f.doc, id, REGISTRY)).toEqual({
      value: 'undefined',
      status: 'degenerate',
      reason: 'degenerate: M and B coincide',
    });
  });

  it('the numeric rung decides closures with square roots (bisectors, the incircle)', () => {
    const f = triangle(1, 3)
      .def('I', 'incenter', 'A', 'B', 'C')
      .def('k', 'incircle', 'A', 'B', 'C');
    const conc = f.claim(
      'concurrent',
      c('bisector', 'B', 'A', 'C'),
      c('bisector', 'A', 'B', 'C'),
      c('bisector', 'A', 'C', 'B'),
    );
    const tan = f.claim('tangent', 'k', c('line', 'B', 'C'));
    const no = f.claim('tangent', 'k', 'w');
    expect(evalClaim(f.doc, conc, REGISTRY)).toEqual({ value: 'true', rung: 'numeric' });
    expect(evalClaim(f.doc, tan, REGISTRY)).toEqual({ value: 'true', rung: 'numeric' });
    expect(evalClaim(f.doc, no, REGISTRY)).toEqual({ value: 'false', rung: 'numeric' });
  });

  it('beyond the size budget the exact rung falls through to the numeric rung', () => {
    const f = triangle(1, 3);
    const id = f.claim('collinear', 'O', 'H', c('centroid', 'A', 'B', 'C'));
    expect(evalClaim(f.doc, id, REGISTRY)).toEqual({ value: 'true', rung: 'exact over Q' });
    expect(evalClaim(f.doc, id, REGISTRY, { budgetBits: 4 })).toEqual({
      value: 'true',
      rung: 'numeric',
    });
  });

  it('a residual of 1e-10 (relative) is never called false by the numeric rung', () => {
    // C is 1e-10·scale off the line AB: exactly false over Q, but the float rung must not say false.
    const f = new Figure().point('A', 0, 0).point('B', 1, 0).point('C', 2, '0.0000000002');
    const id = f.claim('collinear', 'A', 'B', 'C');
    expect(evalClaim(f.doc, id, REGISTRY)).toEqual({ value: 'false', rung: 'exact over Q' });
    const v = evalClaim(f.doc, id, REGISTRY, { budgetBits: 1 });
    // Perturbations of 1e-10·scale move the residual by as much: within the noise floor.
    expect(v.value).not.toBe('false');
    expect(v).toEqual({ value: 'true', rung: 'numeric' });
  });

  it('derived layers: under reflect(line(B, C)) the image H* of the orthocentre lies on ω (exact over Q)', () => {
    const f = triangle(1, 3)
      .def('t', 'reflect', c('line', 'B', 'C'))
      .derived('ref', 't');
    const id = f.claim('on', 'H*', 'w');
    expect(evalClaim(f.doc, id, REGISTRY)).toEqual({ value: 'true', rung: 'exact over Q' });
    const bad = f.claim('on', 'O*', 'w');
    expect(evalClaim(f.doc, bad, REGISTRY)).toEqual({ value: 'false', rung: 'exact over Q' });
  });

  it('invalid claims and assumptions are reported, not evaluated', () => {
    const f = triangle(1, 3);
    const unknown = f.claim('colinear', 'A', 'B', 'C');
    const arity = f.claim('collinear', 'A', 'B');
    const literal = f.claim('length', 'A', 'B', 'B', 'C', 'A');
    const kinds = f.claim('parallel', 'A', 'B');
    expect(evalClaim(f.doc, unknown, REGISTRY)).toMatchObject({
      status: 'invalid',
      reason: 'unknown claim "colinear"',
    });
    expect(evalClaim(f.doc, arity, REGISTRY)).toMatchObject({
      status: 'invalid',
      reason: 'collinear takes at least 3 arguments, got 2',
    });
    expect(evalClaim(f.doc, literal, REGISTRY)).toMatchObject({
      status: 'invalid',
      reason: 'length: argument 5 must be an exact number',
    });
    expect(evalClaim(f.doc, kinds, REGISTRY)).toMatchObject({ status: 'invalid' });
    expect(evalClaim(f.doc, 999, REGISTRY)).toMatchObject({
      status: 'invalid',
      reason: 'there is no claim #999',
    });
    const g = triangle(1, 3);
    const id = g.claim('collinear', 'A', 'B', 'C');
    g.assume('equal', c('dist', 'A', 'B'), c('dist', 'A', 'C'));
    expect(evalClaim(g.doc, id, REGISTRY)).toMatchObject({
      status: 'invalid',
      reason:
        'assume equal: equality assumptions are not allowed: construct it instead of assuming equal(…)',
    });
  });

  it('is deterministic: the same document and seed give the same value', () => {
    const f = triangle(1, 3).def('k', 'incircle', 'A', 'B', 'C');
    const id = f.claim('tangent', 'k', c('line', 'A', 'C'));
    expect(evalClaim(f.doc, id, REGISTRY, { seed: 5 })).toEqual(
      evalClaim(f.doc, id, REGISTRY, { seed: 5 }),
    );
  });
});
