/**
 * ADR-0035 decision 14: lemma tags over the forms a figure may take, and their non-instances.
 * A tag follows the construction, not one spelling of it: midpoint(H, A) as well as
 * midpoint(A, H), a foot by its line or by two points, a point "on" the nine-point circle or on
 * a Miquel circle, a radical centre from common chords as well as from radical_axis. Near
 * misses (two feet on one side line, side midpoints alone, a fourth point on the Euler line,
 * other claim kinds) are never tagged.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { c, Figure, n, orient, other } from '../../claims/test/helpers/build';
import { baseFigure } from '../../claims/test/helpers/corpus';
import { buildClosure, type FactData } from '../src/closure';
import { lemmaTag, lemmaTagger, MIQUEL, NINE_POINT, RADICAL, SIMSON } from '../src/lemmas';
import { REGISTRY } from './helpers';

const KINDS = claimKindRegistry();

function tag(f: Figure, kind: string, ...names: string[]) {
  const fact: FactData = { kind, args: names.map((x) => ({ id: f.id(x) })) };
  return lemmaTag(buildClosure(f.doc, REGISTRY, KINDS), fact);
}

describe('lemma tags: forms and near misses', () => {
  it('nine-point circle: midpoint(H, A) in either order, a foot by two points', () => {
    const f = baseFigure()
      .def('K', 'midpoint', 'H', 'A')
      .def('L', 'midpoint', 'B', 'H')
      .def('D_c', 'foot', 'C', 'A', 'B');
    expect(tag(f, 'concyclic', 'K', 'L', 'M_a', 'D_c')).toBe(NINE_POINT);
    expect(tag(f, 'concyclic', 'M_b', 'K', 'L', 'M_c')).toBe(NINE_POINT);
  });

  it('nine-point circle: a point on the drawn ninepoint_circle', () => {
    const f = baseFigure()
      .def('nine', 'ninepoint_circle', 'A', 'B', 'C')
      .def('K', 'midpoint', 'A', 'H');
    expect(tag(f, 'on', 'K', 'nine')).toBe(NINE_POINT);
    expect(tag(f, 'on', 'M_a', 'nine')).toBe(NINE_POINT);
    expect(tag(f, 'on', 'D', 'nine')).toBeUndefined();
  });

  it('side midpoints of two triangles are not the nine-point circle', () => {
    const f = baseFigure().def('P', 'midpoint', 'D', 'E').def('Q', 'midpoint', 'E', 'F');
    expect(tag(f, 'concyclic', 'M_a', 'M_b', 'P', 'Q')).toBeUndefined();
  });

  it('Simson: two feet on one side line are not a Simson line', () => {
    const f = baseFigure()
      .add('P', c('on', 'w', n(2), n(1)))
      .def('X', 'foot', 'P', 'B', 'C')
      .def('X2', 'foot', 'P', c('line', 'C', 'B'))
      .def('Y', 'foot', 'P', 'C', 'A')
      .def('Z', 'foot', 'P', c('line', 'A', 'B'));
    expect(tag(f, 'collinear', 'X', 'Y', 'Z')).toBe(SIMSON);
    expect(tag(f, 'collinear', 'X', 'X2', 'Y')).toBeUndefined();
  });

  it('a fourth point on the Euler line, and other kinds, are not tagged', () => {
    const f = baseFigure().def('N', 'ninepoint_center', 'A', 'B', 'C');
    expect(tag(f, 'collinear', 'O', 'G_c', 'H', 'N')).toBeUndefined();
    expect(tag(f, 'equal', 'O', 'H')).toBeUndefined();
    expect(tag(f, 'concurrent', 'O', 'H')).toBeUndefined();
  });

  it('five concyclic points: the nine-point circle by its members; any five, untagged', () => {
    const f = baseFigure().def('K', 'midpoint', 'A', 'H').def('D_c', 'foot', 'C', 'A', 'B');
    expect(tag(f, 'concyclic', 'M_a', 'M_b', 'M_c', 'K', 'D_c')).toBe(NINE_POINT);
    expect(tag(f, 'concyclic', 'A', 'B', 'C', 'D', 'E')).toBeUndefined();
  });

  it('radical centre: the common chords of three meeting circles', () => {
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 6, 0)
      .point('C', 2, 5)
      .def('k1', 'circle', 'A', n(5))
      .def('k2', 'circle', 'B', n(5))
      .def('k3', 'circle', 'C', n(4))
      .def('X12', 'intersect', 'k1', 'k2', orient(1))
      .def('Y12', 'intersect', 'k1', 'k2', other('X12'))
      .def('X23', 'intersect', 'k2', 'k3', orient(1))
      .def('Y23', 'intersect', 'k2', 'k3', other('X23'))
      .def('X31', 'intersect', 'k3', 'k1', orient(1))
      .def('Y31', 'intersect', 'k3', 'k1', other('X31'))
      .def('a', 'line', 'X12', 'Y12')
      .def('b', 'line', 'X23', 'Y23')
      .def('d', 'line', 'X31', 'Y31')
      .def('e', 'line', 'A', 'B');
    expect(tag(f, 'concurrent', 'a', 'b', 'd')).toBe(RADICAL);
    expect(tag(f, 'concurrent', 'a', 'b', 'e')).toBeUndefined();
  });

  it('Miquel: M on the third circle CDE', () => {
    const f = new Figure()
      .point('A', 1, 5)
      .point('B', -3, 0)
      .point('C', 4, 1)
      .add('D', c('on', c('line', 'B', 'C'), n('1/3')))
      .add('E', c('on', c('line', 'C', 'A'), n('2/5')))
      .add('F', c('on', c('line', 'A', 'B'), n('3/4')))
      .def('k1', 'circle', 'A', 'E', 'F')
      .def('k2', 'circle', 'B', 'F', 'D')
      .def('k3', 'circle', 'C', 'D', 'E')
      .def('M', 'other', 'k1', 'k2', 'F');
    expect(tag(f, 'on', 'M', 'k3')).toBe(MIQUEL);
    expect(tag(f, 'on', 'A', 'k1')).toBeUndefined();
  });

  it('one tagger per closure answers as lemmaTag does, fact after fact', () => {
    const f = baseFigure()
      .def('N', 'ninepoint_center', 'A', 'B', 'C')
      .def('K', 'midpoint', 'A', 'H')
      .def('D_c', 'foot', 'C', 'A', 'B');
    const closure = buildClosure(f.doc, REGISTRY, KINDS);
    const tagger = lemmaTagger(closure);
    const facts: FactData[] = [
      ['collinear', 'O', 'G_c', 'H'],
      ['concyclic', 'M_a', 'M_b', 'K', 'D_c'],
      ['collinear', 'A', 'B', 'M_c'],
      ['collinear', 'H', 'N', 'O'],
    ].map(([kind = '', ...names]) => ({ kind, args: names.map((x) => ({ id: f.id(x) })) }));
    for (const fact of facts) expect(tagger(fact)).toBe(lemmaTag(closure, fact));
    expect(facts.map((x) => tagger(x)?.name)).toEqual([
      'Euler line',
      'Nine-point circle',
      undefined,
      'Euler line',
    ]);
  });
});
