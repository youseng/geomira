/**
 * The maintainer's request after Run 17 (ADR-0039): "What is special?" must not show trivial
 * facts. Case 1: facts that hold by a map alone (an inversion, a reflection). Case 2:
 * consequences of shown or construction facts (inscribed angles, isosceles base angles). Case 3:
 * one fact per configuration (the nine points, one equal-length class), not one per subset.
 * Each hidden fact stays listed: under the construction facts, or under the fact it follows from.
 */
import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { find } from '../src/find';
import type { FindResult, FoundFact } from '../src/types';
import {
  homothetyFigure,
  incenterExcenterFigure,
  incenterInversionFigure,
  inversionCurvesFigure,
  inversionFigure,
  ninePointFigure,
  reflectionFigure,
  rotationFigure,
  spiralFigure,
} from './figures';
import { REGISTRY, show } from './helpers';

function found(doc: Document): FindResult {
  const r = find({ kind: 'find', doc, seed: 1, budget: { n: 20 } }, { registry: REGISTRY });
  if (r.kind !== 'found') throw new Error(JSON.stringify(r));
  return r;
}

/** Every text a reported fact shows: the fact itself, or the links of its class. */
function shownTexts(doc: Document, f: FoundFact): string[] {
  return (f.chain ?? [f]).map((x) => show(doc, x));
}

/** Every hidden fact the result lists: construction facts and each fact's consequences. */
function hiddenTexts(doc: Document, r: FindResult): string[] {
  return [
    ...r.construction.shown.map((x) => show(doc, x)),
    ...r.facts.flatMap((f) => (f.consequences?.shown ?? []).map((x) => show(doc, x))),
  ];
}

describe('case 1: facts that hold by the map alone are never findings', () => {
  it('inversion in w: nothing beyond the map is reported', () => {
    const f = inversionFigure();
    const r = found(f.doc);
    expect(r.facts.flatMap((x) => shownTexts(f.doc, x))).toEqual([]);
    const hidden = hiddenTexts(f.doc, r);
    for (const t of ['equal(A, A*)', 'collinear(O, B, B*)', 'concyclic(B, B*, C, C*)'])
      expect(hidden, t).toContain(t);
  });

  it('reflection in l: nothing beyond the map is reported', () => {
    const f = reflectionFigure();
    const r = found(f.doc);
    expect(r.facts.flatMap((x) => shownTexts(f.doc, x))).toEqual([]);
    const hidden = hiddenTexts(f.doc, r);
    for (const t of ['equal(A, A*)', 'length(C*, D*, C, D, 1)', 'concyclic(C, C*, D, D*)'])
      expect(hidden, t).toContain(t);
  });
});

describe('case 2: consequences of shown or construction facts are not findings', () => {
  const f = incenterExcenterFigure();
  const r = found(f.doc);
  const shown = r.facts.flatMap((x) => shownTexts(f.doc, x));

  it('ranks first the one equal-length class MB = MC = MI = MI_a', () => {
    const first = r.facts[0];
    expect(first?.kind).toBe('length');
    const names = (first?.objects ?? []).map((id) => f.doc.objects.find((o) => o.id === id)?.name);
    expect(new Set(names)).toEqual(new Set(['B', 'C', 'I', 'I_a', 'M']));
    expect(first?.chain?.length).toBe(3);
  });

  it('the collinearity of A, I, I_a, M is one construction fact (the maximal set)', () => {
    expect(r.construction.shown.map((x) => show(f.doc, x))).toContain('collinear(A, I, I_a, M)');
  });

  it('inscribed angles and isosceles base angles are hidden, and listed', () => {
    const consequences = [
      'dangle(1, A, M, C, A, B, C)',
      'dangle(1, A, C, M, A, B, M)',
      'dangle(1, I, B, M, A, I, B)',
      'dangle(1, I, C, M, A, I, C)',
    ];
    const hidden = hiddenTexts(f.doc, r);
    for (const t of consequences) {
      expect(shown, t).not.toContain(t);
      expect(hidden, t).toContain(t);
    }
    // Angle chasing over the bisectors and the circumcircle gives the base angles from the
    // construction alone; what follows from the class shown (M is the midpoint of I I_a) is
    // listed under it.
    expect(r.construction.shown.map((x) => show(f.doc, x))).toContain(
      'dangle(1, I, B, M, A, I, B)',
    );
    const under = (r.facts[0]?.consequences?.shown ?? []).map((x) => show(f.doc, x));
    expect(under).toContain('length(I, I_a, I, M, 2)');
    for (const h of r.facts[0]?.consequences?.shown ?? [])
      expect(h.parents).toEqual([r.facts[0]?.key]);
  });

  it('reports nothing but the class', () => {
    expect(r.facts).toHaveLength(1);
  });
});

describe('case 3: one fact per configuration, not one per subset', () => {
  const f = ninePointFigure();
  const r = found(f.doc);
  const name = (id: number) => f.doc.objects.find((o) => o.id === id)?.name;

  it('the nine points are ONE concyclic fact; no subset of them is reported', () => {
    const cyclic = r.facts.filter((x) => x.kind === 'concyclic');
    expect(cyclic).toHaveLength(1);
    expect(new Set(cyclic[0]?.objects.map(name))).toEqual(
      new Set(['M_a', 'M_b', 'M_c', 'D', 'E', 'F', 'K_a', 'K_b', 'K_c']),
    );
  });

  it('equal lengths are classes: no two reported facts share a pair of equal segments', () => {
    const seen = new Set<string>();
    for (const x of r.facts.filter((y) => y.kind === 'length'))
      for (const link of x.chain ?? [x]) {
        const t = show(f.doc, link);
        expect(seen.has(t), t).toBe(false);
        seen.add(t);
      }
  });
});

describe('case 3: the whole list', () => {
  it('the nine-point figure reports the circle and the class of its three diameters', () => {
    const f = ninePointFigure();
    const r = found(f.doc);
    // The circle is tagged (the nine-point circle), so it comes first.
    expect(r.facts.map((x) => shownTexts(f.doc, x).join(' & '))).toEqual([
      'concyclic(M_a, M_b, M_c, D, E, F, K_a, K_b, K_c)',
      'length(M_a, K_a, M_b, K_b, 1) & length(M_a, K_a, M_c, K_c, 1)',
    ]);
  }, 120_000);
});

describe('more maps: nothing that holds by the map alone (ADR-0039)', () => {
  for (const [name, make] of [
    ['rotation by 90°', rotationFigure],
    ['homothety with ratio 2', homothetyFigure],
    ['spiral similarity', spiralFigure],
    ['inversion of a line and a circle', inversionCurvesFigure],
  ] as const)
    it(
      name,
      () => {
        const f = make();
        expect(found(f.doc).facts.flatMap((x) => shownTexts(f.doc, x))).toEqual([]);
      },
      120_000,
    );

  it('the incenter–excenter figure under the inversion in circle(M, B): I and I_a are fixed', () => {
    const f = incenterInversionFigure();
    const r = found(f.doc);
    expect(r.facts.flatMap((x) => shownTexts(f.doc, x))).toEqual([
      'equal(I_a, I_a*)',
      'equal(I, I*)',
    ]);
  }, 120_000);
});
