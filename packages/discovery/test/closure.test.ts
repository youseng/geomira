/**
 * ADR-0035 decision 7: the closure of the construction facts. Facts that follow from the
 * definitions are construction facts; theorems (facts that need an argument) are not.
 */
import { describe, expect, it } from 'vitest';
import { rational } from '@geomira/num/rational';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { c, Figure, n, REGISTRY } from '../../claims/test/helpers/build';
import { baseFigure } from '../../claims/test/helpers/corpus';
import { buildClosure, type FactData } from '../src/closure';

const KINDS = claimKindRegistry();
const ONE = { lit: rational(1n) };

function fact(
  f: Figure,
  kind: string,
  ...names: (string | { lit: ReturnType<typeof rational> })[]
): FactData {
  return { kind, args: names.map((x) => (typeof x === 'string' ? { id: f.id(x) } : x)) };
}

function closure(f: Figure) {
  return buildClosure(f.doc, REGISTRY, KINDS);
}

describe('the closure of construction facts (ADR-0035)', () => {
  it('a midpoint is collinear with its ends and halves the segment; the median goes through G', () => {
    const f = baseFigure().def('m', 'line', 'A', 'M_a');
    const cl = closure(f);
    expect(cl.isConstruction(fact(f, 'collinear', 'M_a', 'B', 'C'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'collinear', 'C', 'M_a', 'B'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'length', 'B', 'M_a', 'M_a', 'C', ONE))).toBe(true);
    expect(cl.isConstruction(fact(f, 'length', 'M_a', 'C', 'B', 'M_a', ONE))).toBe(true);
    expect(cl.isConstruction(fact(f, 'on', 'G_c', 'm'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'collinear', 'A', 'G_c', 'M_a'))).toBe(true);
    // Theorems are not construction facts.
    expect(cl.isConstruction(fact(f, 'collinear', 'O', 'G_c', 'H'))).toBe(false);
    expect(cl.isConstruction(fact(f, 'length', 'A', 'B', 'A', 'C', ONE))).toBe(false);
  });

  it('circles through their points, radii through the centre; the circumcentre is equidistant', () => {
    const f = baseFigure()
      .add('P', c('on', 'w', n(2), n(1)))
      .def('k', 'circle', 'A', 'B', 'P');
    const cl = closure(f);
    expect(cl.isConstruction(fact(f, 'on', 'A', 'w'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'concyclic', 'A', 'B', 'C', 'P'))).toBe(true);
    // k shares A, B, P with ω: the same circle, so C is on k by construction too.
    expect(cl.isConstruction(fact(f, 'on', 'C', 'k'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'length', 'O', 'A', 'O', 'B', ONE))).toBe(true);
    expect(cl.isConstruction(fact(f, 'length', 'O', 'P', 'O', 'C', ONE))).toBe(true);
    expect(cl.isConstruction(fact(f, 'concyclic', 'A', 'B', 'C', 'H'))).toBe(false);
    expect(cl.isConstruction(fact(f, 'on', 'H', 'w'))).toBe(false);
  });

  it('parallels and perpendiculars, and lines perpendicular to one line are parallel', () => {
    const f = baseFigure()
      .def('l', 'line', 'B', 'C')
      .def('p', 'perp', 'A', 'l')
      .def('q', 'perp', 'O', 'l')
      .def('r', 'parallel', 'H', 'l')
      .def('s', 'perp_bisector', 'B', 'C');
    const cl = closure(f);
    expect(cl.isConstruction(fact(f, 'perpendicular', 'p', 'l'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'parallel', 'p', 'q'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'parallel', 'r', 'l'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'perpendicular', 'p', 'r'))).toBe(true);
    // q (through O, ⟂ BC) and s (the perpendicular bisector, through O) are ONE line by
    // construction: parallel(s, q) is degenerate, not a fact, and M_a lies on q.
    expect(cl.isConstruction(fact(f, 'parallel', 's', 'q'))).toBe(false);
    expect(cl.isConstruction(fact(f, 'on', 'M_a', 'q'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'on', 'M_a', 's'))).toBe(true);
    // O on the perpendicular bisector of BC is a theorem's step (OB = OC), not declared here:
    // the circumcentre's guarantee says it, through perp_bisector(B, C).
    expect(cl.isConstruction(fact(f, 'on', 'O', 's'))).toBe(true);
    // The altitude through A passes through H: a theorem (the orthocentre is defined by it).
    expect(cl.isConstruction(fact(f, 'on', 'H', 'p'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'concurrent', 'p', 's', 'q'))).toBe(false);
  });

  it('intersections lie on both curves; concurrence through a point of all three', () => {
    const f = baseFigure()
      .def('a', 'line', 'A', 'M_a')
      .def('b', 'line', 'B', 'M_b')
      .def('cc', 'line', 'C', 'M_c')
      .def('X', 'intersect', 'a', 'b');
    const cl = closure(f);
    expect(cl.isConstruction(fact(f, 'on', 'X', 'a'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'collinear', 'X', 'A', 'M_a'))).toBe(true);
    // The three medians concur: through G by the centroid's guarantees.
    expect(cl.isConstruction(fact(f, 'concurrent', 'a', 'b', 'cc'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'equal', 'X', 'G_c'))).toBe(false);
  });

  it('directed angles with arms on the same lines; undirected ones only for the same arms', () => {
    const f = baseFigure()
      .add('P', c('on', c('line', 'B', 'A'), n(3)))
      .add('Q', c('on', c('line', 'B', 'C'), n(-1)));
    const cl = closure(f);
    expect(cl.isConstruction(fact(f, 'dangle', ONE, 'A', 'B', 'C', 'P', 'B', 'Q'))).toBe(true);
    // Q is on the ray opposite to C: ∠PBQ = 180° − ∠ABC, supplementary, so never hidden.
    expect(cl.isConstruction(fact(f, 'angle_eq', 'A', 'B', 'C', 'P', 'B', 'Q'))).toBe(false);
    expect(cl.isConstruction(fact(f, 'angle_eq', 'A', 'B', 'C', 'C', 'B', 'A'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'dangle', ONE, 'A', 'B', 'C', 'B', 'C', 'A'))).toBe(false);
    expect(cl.isConstruction(fact(f, 'angle_eq', 'A', 'B', 'C', 'B', 'C', 'A'))).toBe(false);
  });

  it('given facts join the closure (the ranking uses them); an unknown kind is never hidden', () => {
    const f = baseFigure();
    const given = fact(f, 'collinear', 'O', 'G_c', 'H');
    const cl = buildClosure(f.doc, REGISTRY, KINDS, { extra: [given] });
    expect(cl.isConstruction(fact(f, 'collinear', 'H', 'O', 'G_c'))).toBe(true);
    expect(cl.isConstruction({ kind: 'no_such_kind', args: [{ id: f.id('A') }] })).toBe(false);
  });

  it('a free input never matches another; repeated constructions are one point', () => {
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 4, 0)
      .point('C', 4, 0)
      .def('M', 'midpoint', 'A', 'B')
      .def('N', 'midpoint', 'B', 'A');
    const cl = closure(f);
    expect(cl.isConstruction(fact(f, 'equal', 'M', 'N'))).toBe(true);
    expect(cl.isConstruction(fact(f, 'equal', 'B', 'C'))).toBe(false);
  });
});
