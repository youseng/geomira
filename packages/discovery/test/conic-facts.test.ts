/**
 * Run 16b (ADR-0042), in the style of ADR-0039's cases: conconic joins "What is special?" through
 * the claim-kind registry, and nothing floods. Points on a conic and on a circle are conconic by
 * construction; a layer under conic_to_circle(k) or circle_to_centre(c, P) reports nothing that
 * holds by the map alone (the images of k's points are concyclic, k's known point is fixed, the
 * images of c's points stay on c). Next to each rule a close fact that is false, which it must
 * not derive.
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

/** The find jobs run for seconds (ADR-0039's trivial-facts tests allow the same). */
const SLOW = { timeout: 120_000 };

function found(doc: Document, tests = 60): FindResult {
  const r = find({ kind: 'find', doc, seed: 1, budget: { n: 20, tests } }, { registry: REGISTRY });
  if (r.kind !== 'found') throw new Error(JSON.stringify(r));
  return r;
}

const shown = (doc: Document, r: FindResult) =>
  r.facts.flatMap((f: FoundFact) => (f.chain ?? [f]).map((x) => show(doc, x)));

function fact(f: Figure, kind: string, ...names: string[]): FactData {
  return { kind, args: names.map((a) => ({ id: f.id(a) })) };
}

/** k through A, B, C, D, E (no three collinear) and P, Q on it. */
function conicFigure(): Figure {
  return new Figure()
    .point('A', 1, 3)
    .point('B', 0, 0)
    .point('C', 4, 0)
    .point('D', 5, 4)
    .point('E', -1, 2)
    .def('k', 'conic', 'A', 'B', 'C', 'D', 'E')
    .def('P', 'on', 'k', n(2), n(1))
    .def('Q', 'on', 'k', n(-1), n(3));
}

/** conicFigure, F free, g = conic_to_circle(k), the layer `circ` = image(g, main). */
function conicLayer(): Figure {
  return conicFigure().point('F', 2, 6).def('g', 'conic_to_circle', 'k').derived('circ', 'g');
}

/** w = circle(O, R) [noimage], S on w, M inside, t = circle_to_centre(w, M), U free, layer. */
function centreLayer(): Figure {
  const f = new Figure().point('O', 0, 0).point('R', 5, 0).def('w', 'circle', 'O', 'R');
  noimage(f, 'w');
  return f
    .def('S', 'on', 'w', n(2), n(1))
    .point('M', 1, 2)
    .def('t', 'circle_to_centre', 'w', 'M')
    .point('U', -2, 3)
    .derived('cen', 't');
}

describe('points on a conic: conconic by construction', SLOW, () => {
  const f = conicFigure();
  const k = drain(knowledgeSteps(f.doc, REGISTRY, KINDS));

  it('any six of the seven points of k follow; a free point does not', () => {
    expect(k.derives(fact(f, 'conconic', 'A', 'B', 'C', 'D', 'E', 'P'))).toBe('incidence');
    expect(k.derives(fact(f, 'conconic', 'Q', 'P', 'E', 'D', 'C', 'B'))).toBe('incidence');
    expect(k.derives(fact(f, 'on', 'Q', 'k'))).toBe('incidence');
    const g = conicFigure().point('F', 2, 6);
    const kg = drain(knowledgeSteps(g.doc, REGISTRY, KINDS));
    expect(kg.derives(fact(g, 'conconic', 'A', 'B', 'C', 'D', 'E', 'F'))).toBeUndefined();
    expect(kg.derives(fact(g, 'on', 'F', 'k'))).toBeUndefined();
  });

  it('six points of a circle are conconic; five of them and a free point are not', () => {
    const g = new Figure().point('O', 0, 0).point('R', 5, 0).def('w', 'circle', 'O', 'R');
    for (const [i, [u, v]] of [
      [2, 1],
      [-3, 1],
      [1, 3],
      [3, -4],
      [-1, -2],
    ].entries())
      g.def(`P_${String(i + 1)}`, 'on', 'w', n(u ?? 1), n(v ?? 1));
    g.point('X', 1, 1);
    const kg = drain(knowledgeSteps(g.doc, REGISTRY, KINDS));
    expect(kg.derives(fact(g, 'conconic', 'R', 'P_1', 'P_2', 'P_3', 'P_4', 'P_5'))).toBe(
      'incidence',
    );
    expect(kg.derives(fact(g, 'conconic', 'X', 'P_1', 'P_2', 'P_3', 'P_4', 'P_5'))).toBeUndefined();
  });

  it('"What is special?" reports nothing (seven points of one conic: one construction group)', () => {
    const r = found(f.doc);
    expect(shown(f.doc, r)).toEqual([]);
    const hidden = r.construction.shown.map((x) => show(f.doc, x));
    expect(hidden).toContain('conconic(A, B, C, D, E, P, Q)');
  });
});

describe('a conic_to_circle layer: nothing that holds by the map alone is a finding', SLOW, () => {
  const f = conicLayer();

  it('the images of k’s points are concyclic, A is fixed, P* is on k*', () => {
    const k = drain(knowledgeSteps(f.doc, REGISTRY, KINDS));
    expect(k.derives(fact(f, 'concyclic', 'B*', 'C*', 'D*', 'P*'))).toBe('incidence');
    expect(k.derives(fact(f, 'conconic', 'A*', 'B*', 'C*', 'D*', 'P*', 'Q*'))).toBe('incidence');
    expect(k.derives(fact(f, 'equal', 'A', 'A*'))).toBe('incidence');
    expect(k.derives(fact(f, 'on', 'P*', 'k*'))).toBeDefined();
    // Close facts that are false: B* fixed, F* on the image circle, F on k.
    expect(k.derives(fact(f, 'equal', 'B', 'B*'))).toBeUndefined();
    expect(k.derives(fact(f, 'concyclic', 'B*', 'C*', 'D*', 'F*'))).toBeUndefined();
    expect(k.derives(fact(f, 'on', 'F', 'k'))).toBeUndefined();
  });

  it('reports nothing', () => {
    expect(shown(f.doc, found(f.doc))).toEqual([]);
  });
});

describe('a circle_to_centre layer: nothing that holds by the map alone is a finding', SLOW, () => {
  const f = centreLayer();

  it('M* is the centre, S* stays on w', () => {
    const k = drain(knowledgeSteps(f.doc, REGISTRY, KINDS));
    expect(k.derives(fact(f, 'equal', 'M*', 'O'))).toBeDefined();
    expect(k.derives(fact(f, 'on', 'S*', 'w'))).toBe('incidence');
    expect(k.derives(fact(f, 'on', 'U*', 'w'))).toBeUndefined();
  });

  it('reports nothing', () => {
    expect(shown(f.doc, found(f.doc))).toEqual([]);
  });
});

it('a free point is not conconic with five points of k (the screen and the closure agree)', () => {
  const f = conicFigure().point('F', 2, 6);
  const r = found(f.doc);
  expect(r.facts.map((x) => x.kind)).not.toContain('conconic');
  expect(c).toBeDefined();
}, 120_000);
