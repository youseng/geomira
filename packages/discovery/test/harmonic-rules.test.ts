/**
 * Run 16c audit (mutation shard `discovery`, ADR-0040 decision 18): the section rule on a LINE
 * (the earlier tests used a circle) in both directions and with a literal, and the inversion
 * rule (P, Q; X, X*) = −1 with its arrangements; next to each, close facts that are false,
 * which the rules must not derive.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { fromInteger } from '@geomira/num/rational';
import { along, c, Figure } from '../../claims/test/helpers/build';
import { knowledgeSteps } from '../src/derive';
import type { FactData } from '../src/closure';
import { drain } from '../src/ticking';
import { inversionFigure, reflectionFigure } from './figures';
import { REGISTRY } from './helpers';

const KINDS = claimKindRegistry();
const SLOW = { timeout: 120_000 };

function fact(f: Figure, kind: string, names: string[], lit?: number): FactData {
  const args = names.map((a) => ({ id: f.id(a) }));
  return { kind, args: lit === undefined ? args : [...args, { lit: fromInteger(lit) }] };
}

/** A complete quadrilateral ABCD (P = AC ∩ BD, X = AC ∩ EF) and the lines from F to A, C, P, X. */
function pencil(): Figure {
  return new Figure()
    .point('A', 0, 0)
    .point('B', 5, 1)
    .point('C', 6, 5)
    .point('D', 1, 3)
    .def('E', 'intersect', c('line', 'A', 'B'), c('line', 'C', 'D'))
    .def('F', 'intersect', c('line', 'A', 'D'), c('line', 'B', 'C'))
    .def('P', 'intersect', c('line', 'A', 'C'), c('line', 'B', 'D'))
    .def('X', 'intersect', c('line', 'A', 'C'), c('line', 'E', 'F'))
    .def('fa', 'line', 'F', 'A')
    .def('fc', 'line', 'F', 'C')
    .def('fp', 'line', 'F', 'P')
    .def('fx', 'line', 'F', 'X')
    .def('aa', 'line', 'A', 'C')
    .def('ap', 'line', 'A', 'P');
}

describe('the section rule on a line', SLOW, () => {
  const f = pencil();
  const given = (x: FactData) => drain(knowledgeSteps(f.doc, REGISTRY, KINDS, { extra: [x] }));

  it('four collinear points give the lines to them from a point off their line, and back', () => {
    const k = given(fact(f, 'harmonic', ['A', 'C', 'P', 'X']));
    expect(k.derives(fact(f, 'harmonic_lines', ['fa', 'fc', 'fp', 'fx']))).toBe('incidence');
    expect(k.derives(fact(f, 'harmonic_lines', ['fa', 'fp', 'fc', 'fx']))).toBeUndefined();
    const back = given(fact(f, 'harmonic_lines', ['fa', 'fc', 'fp', 'fx']));
    expect(back.derives(fact(f, 'harmonic', ['A', 'C', 'P', 'X']))).toBe('incidence');
    expect(back.derives(fact(f, 'harmonic', ['A', 'P', 'C', 'X']))).toBeUndefined();
  });

  it('a cross ratio keeps its literal', () => {
    const k = given(fact(f, 'cross_ratio', ['A', 'C', 'P', 'X'], -1));
    expect(k.derives(fact(f, 'cross_ratio_lines', ['fa', 'fc', 'fp', 'fx'], -1))).toBe('incidence');
    expect(k.derives(fact(f, 'cross_ratio_lines', ['fa', 'fc', 'fp', 'fx'], 2))).toBeUndefined();
  });

  it('lines from a point ON the line of the four points are no pencil (they coincide)', () => {
    const k = given(fact(f, 'harmonic', ['A', 'C', 'P', 'X']));
    // aa and ap are the same line (A, C, P collinear): not four distinct lines.
    expect(k.derives(fact(f, 'harmonic_lines', ['aa', 'ap', 'fp', 'fx']))).toBeUndefined();
  });

  it('nothing from the construction alone', () => {
    const k = drain(knowledgeSteps(f.doc, REGISTRY, KINDS));
    expect(k.derives(fact(f, 'harmonic_lines', ['fa', 'fc', 'fp', 'fx']))).toBeUndefined();
  });
});

describe('the inversion rule (P, Q; X, X*) = −1', SLOW, () => {
  const f = inversionFigure()
    .def('m', 'line', 'O', 'B')
    .add('P', c('intersect', 'm', 'w', along(1)))
    .add('Q', c('intersect', 'm', 'w', along(-1)));
  const k = drain(knowledgeSteps(f.doc, REGISTRY, KINDS));

  it('holds in every arrangement of the harmonic symmetry', () => {
    for (const names of [
      ['P', 'Q', 'B', 'B*'],
      ['Q', 'P', 'B', 'B*'],
      ['P', 'Q', 'B*', 'B'],
      ['B', 'B*', 'P', 'Q'],
      ['B*', 'B', 'Q', 'P'],
    ])
      expect(k.derives(fact(f, 'harmonic', names)), names.join(' ')).toBeDefined();
  });

  it('not for another arrangement, another point, or a point and another image', () => {
    expect(k.derives(fact(f, 'harmonic', ['P', 'B', 'Q', 'B*']))).toBeUndefined();
    expect(k.derives(fact(f, 'harmonic', ['P', 'Q', 'C', 'C*']))).toBeUndefined();
    expect(k.derives(fact(f, 'harmonic', ['P', 'Q', 'B', 'C*']))).toBeUndefined();
  });

  it('not for a reflection', () => {
    const r = reflectionFigure().def('m', 'line', 'C', 'C*').def('X', 'intersect', 'm', 'l');
    const kr = drain(knowledgeSteps(r.doc, REGISTRY, KINDS));
    expect(kr.derives(fact(r, 'harmonic', ['A', 'B', 'C', 'C*']))).toBeUndefined();
  });
});
