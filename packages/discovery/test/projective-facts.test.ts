/**
 * Run 16a (ADR-0040 decision 18), in the style of ADR-0039's cases: the cross-ratio kinds join
 * "What is special?" through the claim-kind registry, harmonic facts are found on lines and on
 * circles, and nothing floods: a projective layer reports nothing that holds by the map alone,
 * and a harmonic quadruple and the pencil that cuts it out are one fact, the other listed under
 * it. The rules, next to each a close fact that is false, which they must not derive.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import type { Document } from '@geomira/kernel/document';
import { c, Figure, n } from '../../claims/test/helpers/build';
import { knowledgeSteps } from '../src/derive';
import type { FactData } from '../src/closure';
import { find } from '../src/find';
import { drain } from '../src/ticking';
import type { FindResult, FoundFact } from '../src/types';
import { noimage } from './figures';
import { REGISTRY, show } from './helpers';

const KINDS = claimKindRegistry();

function found(doc: Document, tests = 60): FindResult {
  const r = find({ kind: 'find', doc, seed: 1, budget: { n: 20, tests } }, { registry: REGISTRY });
  if (r.kind !== 'found') throw new Error(JSON.stringify(r));
  return r;
}

function lazy(doc: Document, tests?: number): () => FindResult {
  let r: FindResult | undefined;
  return () => (r ??= found(doc, tests));
}

const shownTexts = (doc: Document, f: FoundFact) => (f.chain ?? [f]).map((x) => show(doc, x));
const shown = (doc: Document, r: FindResult) => r.facts.flatMap((x) => shownTexts(doc, x));
const hidden = (doc: Document, r: FindResult) => [
  ...r.construction.shown.map((x) => show(doc, x)),
  ...r.facts.flatMap((f) => (f.consequences?.shown ?? []).map((x) => show(doc, x))),
];

function fact(f: Figure, kind: string, ...names: string[]): FactData {
  return { kind, args: names.map((a) => ({ id: f.id(a) })) };
}

/** A, B, l = line(A, B) [noimage], f = send_to_infinity(l), C, D, M, X = the point at infinity of CD. */
function projectiveLayer(): Figure {
  const f = new Figure().point('A', 0, 0).point('B', 4, 1).def('l', 'line', 'A', 'B');
  noimage(f, 'l');
  return f
    .def('f', 'send_to_infinity', 'l')
    .point('C', 1, 3)
    .point('D', 4, 5)
    .def('M', 'midpoint', 'C', 'D')
    .def('X', 'harmonic_conjugate', 'C', 'D', 'M')
    .derived('inf', 'f');
}

/** A complete quadrilateral ABCD: E = AB ∩ CD, F = AD ∩ BC, P = AC ∩ BD, X = AC ∩ EF. */
function quadrilateral(): Figure {
  return new Figure()
    .point('A', 0, 0)
    .point('B', 5, 1)
    .point('C', 6, 5)
    .point('D', 1, 3)
    .def('E', 'intersect', c('line', 'A', 'B'), c('line', 'C', 'D'))
    .def('F', 'intersect', c('line', 'A', 'D'), c('line', 'B', 'C'))
    .def('P', 'intersect', c('line', 'A', 'C'), c('line', 'B', 'D'))
    .def('X', 'intersect', c('line', 'A', 'C'), c('line', 'E', 'F'));
}

/** A, B, C on w; T = the pole of AC (the tangents at A and C meet there); D = the second point of TB. */
function harmonicQuadrilateral(): Figure {
  return new Figure()
    .point('O', 0, 0)
    .point('R', 5, 0)
    .def('w', 'circle', 'O', 'R')
    .def('A', 'on', 'w', n(2), n(1))
    .def('B', 'on', 'w', n(-3), n(1))
    .def('C', 'on', 'w', n(1), n(3))
    .def('T', 'pole', c('line', 'A', 'C'), 'w')
    .def('m', 'line', 'T', 'B')
    .def('D', 'other', 'm', 'w', 'B');
}

describe('a projective layer: nothing that holds by the map alone is a finding', () => {
  const f = projectiveLayer();
  const result = lazy(f.doc);

  it('reports nothing', () => {
    expect(shown(f.doc, result())).toEqual([]);
  });

  it('the images’ collinearity, their harmonic quadruple and X* on l follow from the construction', () => {
    const k = drain(knowledgeSteps(f.doc, REGISTRY, KINDS));
    expect(k.derives(fact(f, 'collinear', 'C*', 'D*', 'M*', 'X*'))).toBe('incidence');
    expect(k.derives(fact(f, 'harmonic', 'C*', 'D*', 'M*', 'X*'))).toBe('transport');
    expect(k.derives(fact(f, 'on', 'X*', 'l'))).toBe('incidence');
    // Close facts that are false: (C*, M*; D*, X*) = 2, M* on l.
    expect(k.derives(fact(f, 'harmonic', 'C*', 'M*', 'D*', 'X*'))).toBeUndefined();
    expect(k.derives(fact(f, 'on', 'M*', 'l'))).toBeUndefined();
    expect(hidden(f.doc, result())).toContain('collinear(C*, D*, M*, X*)');
  });

  it('a point at infinity is never a candidate', () => {
    const r = result();
    const X = f.id('X');
    for (const x of [...r.facts, ...r.construction.shown]) expect(x.objects).not.toContain(X);
  });
});

describe('harmonic facts on a line: the complete quadrilateral', () => {
  it('finds (A, C; P, X) = −1 and nothing else', () => {
    const f = quadrilateral();
    expect(shown(f.doc, found(f.doc))).toEqual(['harmonic(A, C, P, X)']);
  });

  it('the pencil from F that cuts it out is listed under it, not reported again', () => {
    const f = quadrilateral()
      .def('fa', 'line', 'F', 'A')
      .def('fb', 'line', 'F', 'B')
      .def('fp', 'line', 'F', 'P')
      .def('fe', 'line', 'F', 'E');
    const r = found(f.doc);
    expect(shown(f.doc, r)).toEqual(['harmonic(A, C, P, X)']);
    const under = (r.facts[0]?.consequences?.shown ?? []).map((x) => show(f.doc, x));
    expect(under).toEqual(['harmonic_lines(fa, fb, fp, fe)']);
  });
});

describe('harmonic facts on a circle: the tangents at A and C meet on BD', () => {
  const f = harmonicQuadrilateral();
  // The four-point facts come after the smaller ones in the test order: a larger test budget.
  const result = lazy(f.doc, 400);

  it('finds (A, C; B, D) = −1, and the kite O, A, T, C (OA = OC, TA = TC)', () => {
    const s = shown(f.doc, result());
    expect(s).toContain('harmonic(A, C, B, D)');
    expect(s).toContain('harmonic(O, T, A, C)');
    expect(s.filter((t) => t.startsWith('harmonic'))).toHaveLength(2);
  });
});

describe('the section rule (pencil ↔ points, ADR-0040 decision 18)', () => {
  const f = harmonicQuadrilateral()
    .def('Q', 'on', 'w', n(-1), n(2))
    .def('qa', 'line', 'Q', 'A')
    .def('qb', 'line', 'Q', 'B')
    .def('qc', 'line', 'Q', 'C')
    .def('qd', 'line', 'Q', 'D');
  const given = (x: FactData) => drain(knowledgeSteps(f.doc, REGISTRY, KINDS, { extra: [x] }));

  it('four points of a circle and the lines to them from a fifth point of it', () => {
    const k = given(fact(f, 'harmonic', 'A', 'C', 'B', 'D'));
    expect(k.derives(fact(f, 'harmonic_lines', 'qa', 'qc', 'qb', 'qd'))).toBe('incidence');
    expect(k.derives(fact(f, 'harmonic_lines', 'qc', 'qa', 'qd', 'qb'))).toBe('incidence');
    // (qa, qb; qc, qd) is another cross ratio: not derived.
    expect(k.derives(fact(f, 'harmonic_lines', 'qa', 'qb', 'qc', 'qd'))).toBeUndefined();
    const back = given(fact(f, 'harmonic_lines', 'qa', 'qc', 'qb', 'qd'));
    expect(back.derives(fact(f, 'harmonic', 'A', 'C', 'B', 'D'))).toBe('incidence');
    expect(back.derives(fact(f, 'harmonic', 'A', 'B', 'C', 'D'))).toBeUndefined();
  });

  it('nothing is derived from the construction alone', () => {
    const k = drain(knowledgeSteps(f.doc, REGISTRY, KINDS));
    expect(k.derives(fact(f, 'harmonic_lines', 'qa', 'qc', 'qb', 'qd'))).toBeUndefined();
    expect(k.derives(fact(f, 'harmonic', 'A', 'C', 'B', 'D'))).toBeUndefined();
  });
});
