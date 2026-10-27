/**
 * ADR-0039 decisions 2–3, rule by rule on small figures: what the knowledge derives (midlines,
 * Thales circles, ratios, isosceles base angles, bisectors, homotheties, point reflections,
 * rotations) and, next to each, a close fact that is false, which it must not derive.
 */
import { describe, expect, it } from 'vitest';
import { evalClaim } from '@geomira/claims/eval-claim';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { fromInteger } from '@geomira/num/rational';
import { c, Figure, n } from '../../claims/test/helpers/build';
import { knowledgeSteps, type Knowledge } from '../src/derive';
import type { FactData } from '../src/closure';
import { withFact } from '../src/confirm';
import { drain } from '../src/ticking';
import { REGISTRY } from './helpers';

const KINDS = claimKindRegistry();

function knowledgeOf(f: Figure): Knowledge {
  return drain(knowledgeSteps(f.doc, REGISTRY, KINDS));
}

/** A fact over the figure's names; numbers are exact integer literals. */
function fact(f: Figure, kind: string, ...args: (string | number)[]): FactData {
  return {
    kind,
    args: args.map((a) => (typeof a === 'number' ? { lit: fromInteger(a) } : { id: f.id(a) })),
  };
}

function triangle(): Figure {
  return new Figure().point('A', 1, 5).point('B', -3, 0).point('C', 4, 1);
}

describe('midpoints (ADR-0039 decision 2)', () => {
  const f = triangle()
    .def('M', 'midpoint', 'A', 'B')
    .def('N', 'midpoint', 'A', 'C')
    .def('M_a', 'midpoint', 'B', 'C')
    .def('D', 'foot', 'A', 'B', 'C');
  const k = knowledgeOf(f);

  it('a midline is parallel to the third side and half of it', () => {
    expect(k.derives(fact(f, 'length', 'B', 'C', 'M', 'N', 2))).toBe('incidence');
    expect(k.derives(fact(f, 'dangle', 1, 'A', 'M', 'N', 'A', 'B', 'C'))).toBe('angles');
    expect(k.derives(fact(f, 'length', 'B', 'C', 'M', 'N', 3))).toBeUndefined();
    expect(k.derives(fact(f, 'dangle', 1, 'A', 'M', 'N', 'A', 'C', 'B'))).toBeUndefined();
  });

  it('two segments half of one segment are equal', () => {
    expect(k.derives(fact(f, 'length', 'M', 'N', 'B', 'M_a', 1))).toBe('incidence');
    expect(k.derives(fact(f, 'length', 'M', 'N', 'A', 'M', 1))).toBeUndefined();
  });

  it('Thales: the foot of an altitude is on the circle with diameter AB', () => {
    expect(k.derives(fact(f, 'length', 'M', 'D', 'M', 'A', 1))).toBe('incidence');
    expect(k.derives(fact(f, 'length', 'N', 'D', 'N', 'C', 1))).toBe('incidence');
    expect(k.derives(fact(f, 'length', 'M', 'D', 'M', 'C', 1))).toBeUndefined();
  });
});

describe('angles (ADR-0039 decision 3)', () => {
  const f = triangle()
    .def('O', 'circumcenter', 'A', 'B', 'C')
    .def('I', 'incenter', 'A', 'B', 'C')
    .def('J', 'excenter', 'A', 'B', 'C');
  const k = knowledgeOf(f);

  it('the base angles of an isosceles triangle are equal', () => {
    expect(k.derives(fact(f, 'dangle', 1, 'O', 'A', 'B', 'A', 'B', 'O'))).toBe('angles');
    expect(k.derives(fact(f, 'dangle', 1, 'O', 'A', 'B', 'A', 'C', 'O'))).toBeUndefined();
  });

  it('a bisector halves its angle, internal and external alike', () => {
    expect(k.derives(fact(f, 'dangle', 1, 'B', 'A', 'I', 'I', 'A', 'C'))).toBe('angles');
    // Mod 180° the external bisector at B halves ∡ABC too (it swaps the lines BA and BC).
    const external = fact(f, 'dangle', 1, 'A', 'B', 'J', 'J', 'B', 'C');
    expect(k.derives(external)).toBe('angles');
    const w = withFact(f.doc, external);
    expect(evalClaim(w.doc, w.id, REGISTRY).value).toBe('true');
    expect(k.derives(fact(f, 'dangle', 1, 'A', 'B', 'I', 'I', 'A', 'C'))).toBeUndefined();
  });

  it('an inscribed angle equals another on the same arc', () => {
    const g = triangle()
      .def('w', 'circumcircle', 'A', 'B', 'C')
      .add('P', c('on', 'w', n('1/3')));
    const kg = knowledgeOf(g);
    expect(kg.derives(fact(g, 'dangle', 1, 'A', 'P', 'B', 'A', 'C', 'B'))).toBe('angles');
    expect(kg.derives(fact(g, 'dangle', 1, 'A', 'P', 'B', 'A', 'C', 'P'))).toBeUndefined();
  });
});

describe('maps (ADR-0039 decisions 1–3)', () => {
  it('a homothety: P, X, X* collinear and XX* = |k − 1|·PX', () => {
    const f = new Figure()
      .point('P', 0, 0)
      .point('X', 2, 1)
      .def('h', 'homothety', 'P', n(3))
      .derived('img', 'h');
    const k = knowledgeOf(f);
    expect(k.derives(fact(f, 'collinear', 'P', 'X', 'X*'))).toBe('incidence');
    expect(k.derives(fact(f, 'length', 'X', 'X*', 'P', 'X', 2))).toBe('incidence');
    expect(k.derives(fact(f, 'length', 'P', 'X*', 'P', 'X', 3))).toBe('incidence');
    expect(k.derives(fact(f, 'length', 'X', 'X*', 'P', 'X', 3))).toBeUndefined();
  });

  it('a half turn: XX* = 2·PX', () => {
    const f = new Figure()
      .point('P', 0, 0)
      .point('X', 2, 1)
      .def('h', 'reflect', 'P')
      .derived('img', 'h');
    const k = knowledgeOf(f);
    expect(k.derives(fact(f, 'length', 'X', 'X*', 'P', 'X', 2))).toBe('incidence');
    expect(k.derives(fact(f, 'length', 'X', 'X*', 'P', 'X', 1))).toBeUndefined();
  });

  it('a rotation: the triangles P X X* are similar', () => {
    const f = new Figure()
      .point('P', 0, 0)
      .point('X', 2, 1)
      .point('Y', -1, 3)
      .def('r', 'rotate', 'P', n(60))
      .derived('img', 'r');
    const k = knowledgeOf(f);
    expect(k.derives(fact(f, 'dangle', 1, 'P', 'X', 'X*', 'P', 'Y', 'Y*'))).toBe('angles');
    expect(k.derives(fact(f, 'length', 'P', 'X', 'P', 'X*', 1))).toBe('incidence');
    expect(k.derives(fact(f, 'dangle', 1, 'P', 'X', 'X*', 'P', 'Y*', 'Y'))).toBeUndefined();
  });
});
