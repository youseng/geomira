/**
 * Run 14 (ADR-0032) properties beside the laws:
 *   - decision 4: every preset equals the composition of registry tools it is defined as,
 *     entry by entry, in all three fields (no preset has mapping code of its own);
 *   - decision 9: the chirality flag of image lines matches actual mirrored figures;
 *   - decision 13: the static kind 'mobius' (images of lines and circles may change kind, so
 *     the selector checks ask for a selector on intersect(l*, k) and accept along(±) there),
 *     and similarities keep ADR-0028's narrowing;
 *   - a tangency at the center maps to two parallel lines; the inversion circle and the
 *     points on it are fixed.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { objectKinds } from '../src/derived';
import { call, type Expr } from '../src/expr';
import { selectorDiagnostics } from '../src/selector-check';
import { Builder, REGISTRY, contextOf, evalDoc, num, pt, valueOf } from './helpers/doc';
import { ed, idOf, refOf } from './helpers/derived-fixture';
import { emptyDocument, type Document } from '../src/document';

const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];
const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);

type Expr2 = (d: Builder) => Expr;

/** The values of two definitions in one document of the points A = (0, 0), B = (3, 4), C = (5, 0), … */
function pair<X>(F: Field<X>, a: Expr2, b: Expr2) {
  const d = new Builder();
  d.point('A', 0, 0);
  d.point('B', 3, 4);
  d.point('C', 5, 0);
  d.point('D', 7, 2);
  d.point('E', 10, 0);
  d.add('x', a(d));
  d.add('y', b(d));
  const ev = evalDoc(d.doc, F, contextOf(d.doc));
  return [valueOf(d.doc, ev, 'x'), valueOf(d.doc, ev, 'y')];
}

describe('the presets are compositions of registry tools (decision 4)', () => {
  const cases: [string, Expr2, Expr2][] = [
    [
      'sqrt_bc',
      (d) => T('sqrt_bc', d.ref('A'), d.ref('B'), d.ref('C')),
      (d) =>
        T(
          'compose',
          T('reflect', T('bisector', d.ref('B'), d.ref('A'), d.ref('C'))),
          T(
            'inversion',
            d.ref('A'),
            T('mul', T('dist', d.ref('A'), d.ref('B')), T('dist', d.ref('A'), d.ref('C'))),
          ),
        ),
    ],
    [
      'orthocenter_inversion',
      (d) => T('orthocenter_inversion', d.ref('A'), d.ref('B'), d.ref('D')),
      (d) => {
        const H = T('orthocenter', d.ref('A'), d.ref('B'), d.ref('D'));
        const k = T(
          'div',
          T('power', H, T('circumcircle', d.ref('A'), d.ref('B'), d.ref('D'))),
          num(2),
        );
        return T('inversion', H, k);
      },
    ],
    [
      'inversion_fixing',
      (d) => T('inversion_fixing', d.ref('D'), T('circle', d.ref('A'), d.ref('C'))),
      (d) =>
        T('inversion', d.ref('D'), T('power', d.ref('D'), T('circle', d.ref('A'), d.ref('C')))),
    ],
    [
      'inversion_swap',
      (d) => T('inversion_swap', d.ref('A'), d.ref('C'), d.ref('E')),
      (d) =>
        T(
          'inversion',
          d.ref('A'),
          T('power', d.ref('A'), T('diameter_circle', d.ref('C'), d.ref('E'))),
        ),
    ],
    [
      'sqrt_bc2',
      (d) => T('sqrt_bc2', d.ref('A'), d.ref('B'), d.ref('C')),
      (d) =>
        T(
          'compose',
          T('reflect', T('bisector', d.ref('B'), d.ref('A'), d.ref('C'))),
          T(
            'inversion',
            d.ref('A'),
            T(
              'div',
              T('mul', T('dist', d.ref('A'), d.ref('B')), T('dist', d.ref('A'), d.ref('C'))),
              num(2),
            ),
          ),
        ),
    ],
    [
      'feet_inversion',
      (d) => T('feet_inversion', d.ref('A'), d.ref('B'), d.ref('C')),
      (d) =>
        T(
          'inversion',
          d.ref('A'),
          T('power', d.ref('A'), T('diameter_circle', d.ref('B'), d.ref('C'))),
        ),
    ],
  ];
  for (const [name, a, b] of cases)
    it(`${name}: equal in every field`, () => {
      for (const F of FIELDS) {
        const [x, y] = pair(F, a, b);
        expect(x, `${name} over ${F.name}`).toEqual(y);
        if (F !== ModPField || !name.startsWith('sqrt_bc'))
          expect(x?.kind, `${name} over ${F.name}`).toBe('transform');
      }
    });
});

describe('the chirality flag of image lines matches mirrored figures (decision 9)', () => {
  /** The image line's direction in the figure and in its mirror image (y ↦ −y). */
  function directions(mirror: boolean, def: (b: Builder) => Expr) {
    const s = mirror ? -1 : 1;
    const b = new Builder();
    b.point('O', 1, s * 2);
    b.point('A', 4, s * 3);
    b.point('C', 3, s * 5);
    b.add('x', def(b));
    const v = valueOf(b.doc, evalDoc(b.doc, FloatField), 'x');
    if (v.kind !== 'line') throw new Error(`expected a line, got ${v.kind}`);
    return { d: v.d, chiral: v.chiral };
  }
  const check = (def: (b: Builder) => Expr) => {
    const [u, w] = [directions(false, def), directions(true, def)];
    // Mirror u's direction: (x, y) ↦ (x, −y). Same sense: achiral; reversed: chiral.
    const dot = u.d.x * w.d.x - u.d.y * w.d.y;
    expect(u.chiral).toBe(w.chiral);
    expect(dot < 0).toBe(u.chiral);
  };
  it('a circle through the center → a chiral line', () => {
    check((b) =>
      T('apply', T('inversion', b.ref('O'), num(3)), T('circle', b.ref('C'), b.ref('O'))),
    );
    check((b) =>
      T('apply', T('inversion', b.ref('O'), num(-5)), T('circle', b.ref('A'), b.ref('O'))),
    );
  });
  it('a line through the center keeps its flag (both flags)', () => {
    check((b) => T('apply', T('inversion', b.ref('O'), num(3)), T('line', b.ref('O'), b.ref('A'))));
    check((b) =>
      T(
        'apply',
        T('inversion', b.ref('O'), num(3)),
        T('perp', b.ref('O'), T('line', b.ref('A'), b.ref('C'))),
      ),
    );
  });
  it('through a composed map with an anti-similarity', () => {
    check((b) =>
      T(
        'apply',
        T(
          'compose',
          T('reflect', T('line', b.ref('A'), b.ref('C'))),
          T('inversion', b.ref('O'), num(2)),
        ),
        T('circle', b.ref('C'), b.ref('O')),
      ),
    );
  });
});

/** O, A, B, C; l = line(A, B), k = line(O, C); f = inversion(O, 4); t = rotate(O, 90). */
function figure(): Document {
  let doc = emptyDocument();
  const add = (name: string, def: Expr): void => {
    doc = ed(doc, { kind: 'add', object: { name, def } });
  };
  add('O', pt(0, 0));
  add('A', pt(1, 2));
  add('B', pt(3, 1));
  add('C', pt(0, 5));
  add('l', T('line', refOf(doc, 'A'), refOf(doc, 'B')));
  add('k', T('line', refOf(doc, 'O'), refOf(doc, 'C')));
  add('f', T('inversion', refOf(doc, 'O'), num(4)));
  add('t', T('rotate', refOf(doc, 'O'), num(90)));
  add('g', T('compose', refOf(doc, 't'), refOf(doc, 'f')));
  return ed(doc, {
    kind: 'addDerivedLayer',
    spec: { name: 'inv', transform: idOf(doc, 'f'), source: 'main' },
  });
}

describe("the static kind 'mobius' (decision 13)", () => {
  it('maps that may be Möbius carry it; images of curves may be lines or circles', () => {
    const doc = figure();
    const kinds = objectKinds(doc, REGISTRY);
    const of = (n: string) => kinds.get(idOf(doc, n));
    expect(of('f')).toEqual(['transform', 'mobius']);
    expect(of('t')).toEqual(['transform']);
    expect(of('g')).toEqual(['transform', 'mobius']);
    expect(of('l*')).toEqual(['line', 'circle']);
    expect(of('A*')).toEqual(['point']);
    const withT = ed(doc, {
      kind: 'add',
      object: { name: 'm', def: T('apply', refOf(doc, 't'), refOf(doc, 'l')) },
    });
    expect(objectKinds(withT, REGISTRY).get(idOf(withT, 'm'))).toEqual(['line']);
  });

  it('intersect(l*, k) asks for a selector, and along(+) is accepted on it', () => {
    const doc = figure();
    const bare = ed(doc, {
      kind: 'add',
      object: { name: 'P', def: T('intersect', refOf(doc, 'l*'), refOf(doc, 'k')) },
    });
    expect(
      selectorDiagnostics(bare, REGISTRY)
        .map((d) => d.message)
        .join(),
    ).toMatch(/selector/);
    const chosen = ed(doc, {
      kind: 'add',
      object: {
        name: 'P',
        def: call('intersect', [refOf(doc, 'l*'), refOf(doc, 'k')], [{ kind: 'along', sign: 1 }]),
      },
    });
    expect(selectorDiagnostics(chosen, REGISTRY)).toEqual([]);
    const ev = evalDoc(chosen, RationalField, contextOf(chosen));
    expect(valueOf(chosen, ev, 'l*').kind).toBe('circle');
    expect(valueOf(chosen, ev, 'P').kind).toBe('point');
  });
});

describe('special positions', () => {
  it('a tangency at the center maps to two parallel lines', () => {
    for (const F of [FloatField, RationalField] as Field<unknown>[]) {
      const [c, t] = pair(
        F,
        (d) => T('apply', T('inversion', d.ref('A'), num(4)), T('circle', d.ref('C'), d.ref('A'))),
        (d) =>
          T(
            'apply',
            T('inversion', d.ref('A'), num(4)),
            T('tangent', d.ref('A'), T('circle', d.ref('C'), d.ref('A'))),
          ),
      );
      expect([c?.kind, t?.kind]).toEqual(['line', 'line']);
      if (c?.kind !== 'line' || t?.kind !== 'line') continue;
      expect(F.toNumber(F.sub(F.mul(c.d.x, t.d.y), F.mul(c.d.y, t.d.x)))).toBe(0);
    }
  });
  it('the inversion circle and its points are fixed', () => {
    for (const F of [FloatField, RationalField] as Field<unknown>[]) {
      const [P, w] = pair(
        F,
        (d) => T('apply', T('inversion', T('circle', d.ref('A'), d.ref('C'))), d.ref('B')),
        (d) =>
          T(
            'apply',
            T('inversion', T('circle', d.ref('A'), d.ref('C'))),
            T('circle', d.ref('A'), d.ref('C')),
          ),
      );
      expect(P?.kind === 'point' && [F.toNumber(P.x), F.toNumber(P.y)]).toEqual([3, 4]);
      expect(
        w?.kind === 'circle' && [F.toNumber(w.c.x), F.toNumber(w.c.y), F.toNumber(w.r2)],
      ).toEqual([0, 0, 25]);
    }
  });
});
