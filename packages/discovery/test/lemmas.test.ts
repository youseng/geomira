/**
 * ADR-0035 decision 14: lemma tags. Each tag is matched on an instance of its result built from
 * the registry's tools (and the finder reports the fact with it), never on a non-instance;
 * every tool a tag reads is a registry tool; hints are one line.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { c, Figure, n } from '../../claims/test/helpers/build';
import { baseFigure } from '../../claims/test/helpers/corpus';
import { buildClosure, type FactData } from '../src/closure';
import { find } from '../src/find';
import { EULER, LEMMA_TOOLS, lemmaTag, MIQUEL, NINE_POINT, RADICAL, SIMSON } from '../src/lemmas';
import { REGISTRY, show, triangle } from './helpers';

const KINDS = claimKindRegistry();

function tag(f: Figure, kind: string, ...names: string[]) {
  const fact: FactData = { kind, args: names.map((x) => ({ id: f.id(x) })) };
  return lemmaTag(buildClosure(f.doc, REGISTRY, KINDS), fact);
}

describe('lemma tags (ADR-0035)', () => {
  it('names only registry tools; hints are one line', () => {
    for (const t of LEMMA_TOOLS) expect(REGISTRY.get(t), t).toBeDefined();
    for (const t of [EULER, NINE_POINT, SIMSON, RADICAL, MIQUEL]) {
      expect(t.hint).not.toContain('\n');
      expect(t.hint.length).toBeLessThan(120);
    }
  });

  it('Euler line: O, G, H (and N) of one triangle', () => {
    const f = baseFigure()
      .def('N', 'ninepoint_center', 'A', 'B', 'C')
      .def('O2', 'circumcenter', 'A', 'B', 'D');
    expect(tag(f, 'collinear', 'O', 'G_c', 'H')).toBe(EULER);
    expect(tag(f, 'collinear', 'H', 'N', 'O')).toBe(EULER);
    expect(tag(f, 'collinear', 'O2', 'G_c', 'H')).toBeUndefined();
    expect(tag(f, 'collinear', 'A', 'B', 'M_c')).toBeUndefined();
  });

  it('nine-point circle: midpoints, feet of the altitudes, midpoints of AH', () => {
    const f = baseFigure()
      .def('D_a', 'foot', 'A', c('line', 'B', 'C'))
      .def('D_b', 'foot', 'B', 'C', 'A')
      .def('K', 'midpoint', 'A', 'H')
      .def('nine', 'ninepoint_circle', 'A', 'B', 'C');
    expect(tag(f, 'concyclic', 'M_a', 'M_b', 'D_a', 'K')).toBe(NINE_POINT);
    expect(tag(f, 'concyclic', 'D_a', 'D_b', 'M_c', 'K')).toBe(NINE_POINT);
    expect(tag(f, 'on', 'D_a', 'nine')).toBe(NINE_POINT);
    expect(tag(f, 'concyclic', 'A', 'B', 'C', 'D')).toBeUndefined();
  });

  it('Simson line: the feet from one point to the three side lines', () => {
    const f = baseFigure()
      .add('P', c('on', 'w', n(2), n(1)))
      .def('X', 'foot', 'P', c('line', 'B', 'C'))
      .def('Y', 'foot', 'P', c('line', 'C', 'A'))
      .def('Z', 'foot', 'P', 'A', 'B')
      .def('Z2', 'foot', 'D', 'A', 'B');
    expect(tag(f, 'collinear', 'X', 'Y', 'Z')).toBe(SIMSON);
    expect(tag(f, 'collinear', 'X', 'Y', 'Z2')).toBeUndefined();
  });

  it('radical centre: radical axes of three circles', () => {
    const f = baseFigure()
      .def('k1', 'circle', 'A', n(3))
      .def('k2', 'circle', 'B', n(4))
      .def('k3', 'circle', 'C', n(2))
      .def('r12', 'radical_axis', 'k1', 'k2')
      .def('r23', 'radical_axis', 'k2', 'k3')
      .def('r31', 'radical_axis', 'k3', 'k1')
      .def('l', 'line', 'A', 'B');
    expect(tag(f, 'concurrent', 'r12', 'r23', 'r31')).toBe(RADICAL);
    expect(tag(f, 'concurrent', 'r12', 'r23', 'l')).toBeUndefined();
  });

  it('Miquel point: circles AEF, BFD, CDE through one point', () => {
    const f = new Figure()
      .point('A', 1, 5)
      .point('B', -3, 0)
      .point('C', 4, 1)
      .add('D', c('on', c('line', 'B', 'C'), n('1/3')))
      .add('E', c('on', c('line', 'C', 'A'), n('2/5')))
      .add('F', c('on', c('line', 'A', 'B'), n('3/4')))
      .def('k1', 'circle', 'A', 'E', 'F')
      .def('k2', 'circle', 'B', 'F', 'D')
      .def('M', 'other', 'k1', 'k2', 'F');
    expect(tag(f, 'concyclic', 'C', 'D', 'E', 'M')).toBe(MIQUEL);
    expect(tag(f, 'concyclic', 'A', 'B', 'C', 'M')).toBeUndefined();
  });

  it('the finder reports tagged facts with their hint', () => {
    const f = triangle();
    const r = find(
      { kind: 'find', doc: f.doc, seed: 9, budget: { n: 10, tests: 10 } },
      { registry: REGISTRY },
    );
    if (r.kind !== 'found') throw new Error(r.kind);
    const euler = r.facts.find((x) => x.tag !== undefined);
    expect(euler && show(f.doc, euler)).toBe('collinear(O, H, G_c)');
    expect(euler?.tag?.hint).toBe(EULER.hint);
  });
});
