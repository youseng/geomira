/**
 * Derived layers (SPEC §8.2, ADR-0007), through applyDocEdit: suffix, [noimage], exclude,
 * every other geometric source object imaged (no closure-based exclusion, Undefined
 * images allowed), no images of numbers or maps, reserved names, placement (I4), chaining,
 * cycle rejection, deletion with the rule, gliders on image circles stay exact.
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { syncDerived } from '../src/derived';
import { call } from '../src/expr';
import { REGISTRY, contextOf, evalDoc, num, pt, valueOf } from './helpers/doc';
import { base, ed, idOf, imaged, names, refOf, refused, T } from './helpers/derived-fixture';

describe('a derived layer images every geometric object of its source', () => {
  it("images the map's own defining points, not numbers, measures or the map", () => {
    const { doc } = imaged();
    expect(names(doc)).toEqual(['A', 'B', 'C', 'D', 'd', 'k', 's', 'A*', 'B*', 'C*', 'D*']);
    const ev = evalDoc(doc, RationalField, contextOf(doc));
    // spiral(A, B, C, D) takes A to C and B to D.
    expect(valueOf(doc, ev, 'A*')).toEqual(valueOf(doc, ev, 'C'));
    expect(valueOf(doc, ev, 'B*')).toEqual(valueOf(doc, ev, 'D'));
  });

  it('the suffix is configurable (one or more *); anything else is refused', () => {
    const { doc } = imaged('**');
    expect(names(doc).slice(-4)).toEqual(['A**', 'B**', 'C**', 'D**']);
    const err = refused(base(), {
      kind: 'addDerivedLayer',
      spec: { name: 'x', transform: idOf(base(), 's'), source: 'main', suffix: "'" },
    });
    expect(err).toBe(`the suffix must be one or more *, not "'"`);
  });

  it('an Undefined source has an Undefined image (it exists)', () => {
    const { doc } = imaged();
    const withU = ed(doc, {
      kind: 'add',
      object: { name: 'U', def: T('midpoint', refOf(doc, 'A'), refOf(doc, 'd')) },
    });
    const ev = evalDoc(withU, FloatField, contextOf(withU));
    expect(valueOf(withU, ev, 'U').kind).toBe('undefined');
    expect(valueOf(withU, ev, 'U*')).toEqual({ kind: 'undefined', reason: 'U is undefined' });
    const O = ed(withU, {
      kind: 'add',
      object: {
        name: 'O',
        def: T(
          'intersect',
          T('line', refOf(doc, 'A'), refOf(doc, 'B')),
          T('line', pt(0, 1), pt(1, 1)),
        ),
      },
    });
    expect(valueOf(O, evalDoc(O, FloatField, contextOf(O)), 'O*').kind).toBe('undefined');
  });

  it('a non-geometric object gets no image; redefining a source as a number removes its image (with dependents)', () => {
    const { doc, layer } = imaged();
    const m = ed(doc, {
      kind: 'add',
      object: {
        name: 'M',
        def: T('midpoint', refOf(doc, 'A*'), refOf(doc, 'C*')),
        layers: [layer],
      },
    });
    const r = ed(m, {
      kind: 'redefine',
      id: idOf(m, 'C'),
      def: T('dist', refOf(m, 'A'), refOf(m, 'D')),
    });
    expect(names(r)).not.toContain('C*');
    expect(r.applied.removed.objects).toEqual([idOf(m, 'C*'), idOf(m, 'M')]);
    const back = ed(r, { kind: 'redefine', id: idOf(r, 'C'), def: pt(1, 3) });
    expect(names(back)).toContain('C*');
  });
});

describe('[noimage] and exclude', () => {
  it('[noimage] removes the image and its dependents; clearing it brings the image back', () => {
    const { doc, layer } = imaged();
    const m = ed(doc, {
      kind: 'add',
      object: { name: 'M', def: T('midpoint', refOf(doc, 'B*'), refOf(doc, 'C')), layers: [layer] },
    });
    const s = ed(m, { kind: 'style', id: idOf(m, 'B'), style: { noimage: true } });
    expect(names(s)).not.toContain('B*');
    expect(s.applied.removed.objects).toEqual([idOf(m, 'B*'), idOf(m, 'M')]);
    const u = ed(s, { kind: 'style', id: idOf(s, 'B'), style: {} });
    expect(names(u)).toContain('B*');
    expect(u.applied.added).toEqual([idOf(u, 'B*')]);
    // B* comes back right after the later of B and s.
    expect(names(u).indexOf('B*')).toBe(names(u).indexOf('s') + 1);
  });

  it('exclude removes images; the excluded object can be included again', () => {
    const { doc, layer } = imaged();
    const x = ed(doc, {
      kind: 'updateRule',
      layerId: layer,
      patch: { exclude: [idOf(doc, 'A'), idOf(doc, 'D')] },
    });
    expect(names(x).filter((n) => n.endsWith('*'))).toEqual(['B*', 'C*']);
    const y = ed(x, { kind: 'updateRule', layerId: layer, patch: { exclude: [] } });
    expect(
      names(y)
        .filter((n) => n.endsWith('*'))
        .sort(),
    ).toEqual(['A*', 'B*', 'C*', 'D*']);
    expect(refused(doc, { kind: 'updateRule', layerId: layer, patch: { exclude: [999] } })).toBe(
      'there is no object #999 to exclude',
    );
  });
});

describe('reserved names and managed objects', () => {
  it('managed names are reserved; managed objects follow their source only', () => {
    const { doc } = imaged();
    expect(refused(doc, { kind: 'add', object: { name: 'B*', def: pt(1, 1) } })).toBe(
      'B* is the image of B in layer img',
    );
    expect(refused(doc, { kind: 'rename', id: idOf(doc, 'C'), name: 'D*' })).toBe(
      'D* is the image of D in layer img',
    );
    const why =
      'A* is the image of A in layer img: it follows A; exclude A from the layer or style it [noimage] instead';
    expect(refused(doc, { kind: 'remove', id: idOf(doc, 'A*') })).toBe(why);
    expect(refused(doc, { kind: 'rename', id: idOf(doc, 'A*'), name: 'Z' })).toBe(why);
    expect(refused(doc, { kind: 'redefine', id: idOf(doc, 'A*'), def: pt(0, 0) })).toBe(why);
    expect(refused(doc, { kind: 'setLayers', id: idOf(doc, 'A*'), layers: ['main'] })).toBe(why);
    expect(refused(doc, { kind: 'move', id: idOf(doc, 'A*'), index: 0 })).toBe(why);
    // Styling an image is allowed (colour, dash, …).
    expect(
      ed(doc, { kind: 'style', id: idOf(doc, 'A*'), style: { color: 'red' } }).objects.find(
        (o) => o.name === 'A*',
      )?.style,
    ).toEqual({ color: 'red' });
  });

  it('renaming a source renames its images', () => {
    const { doc } = imaged();
    const r = ed(doc, { kind: 'rename', id: idOf(doc, 'C'), name: 'P_1' });
    expect(names(r)).toContain('P_1*');
  });

  it('two rules that would give one name are refused', () => {
    const { doc } = imaged();
    const err = refused(doc, {
      kind: 'addDerivedLayer',
      spec: { name: 'two', transform: idOf(doc, 's'), source: 'main' },
    });
    expect(err).toBe('the image name A* of A in layer two is already used');
    const ok = ed(doc, {
      kind: 'addDerivedLayer',
      spec: { name: 'two', transform: idOf(doc, 's'), source: 'main', suffix: '**' },
    });
    expect(names(ok)).toContain('A**');
  });

  it('the transformation of a rule must be one, and stays one', () => {
    const doc = base();
    expect(
      refused(doc, {
        kind: 'addDerivedLayer',
        spec: { name: 'x', transform: idOf(doc, 'd'), source: 'main' },
      }),
    ).toBe('d is not a transformation');
    expect(
      refused(doc, {
        kind: 'addDerivedLayer',
        spec: { name: 'x', transform: 999, source: 'main' },
      }),
    ).toBe('there is no object #999');
    expect(
      refused(doc, {
        kind: 'addDerivedLayer',
        spec: { name: 'x', transform: idOf(doc, 's'), source: 'L99' },
      }),
    ).toBe('there is no layer "L99"');
    const { doc: d2 } = imaged();
    expect(refused(d2, { kind: 'redefine', id: idOf(d2, 's'), def: num(3) })).toBe(
      's is the transformation of layer img',
    );
    expect(
      refused(d2, {
        kind: 'redefine',
        id: idOf(d2, 's'),
        def: T('reflect', refOf(d2, 'A'), refOf(d2, 'B')),
      }),
    ).toBe('s is the transformation of layer img');
  });
});

describe('placement (I4), redefining and moving the map', () => {
  it('images sit after the later of source and map; new sources append their image', () => {
    const { doc } = imaged();
    const e = ed(doc, { kind: 'add', object: { name: 'E', def: pt(7, 7) } });
    expect(names(e).slice(-2)).toEqual(['E', 'E*']);
    expect(e.applied.added).toEqual([idOf(e, 'E*')]);
  });

  it('redefining the map re-evaluates every image (ids kept); its own images cannot define it', () => {
    const { doc } = imaged();
    const r = ed(doc, {
      kind: 'redefine',
      id: idOf(doc, 's'),
      def: T('reflect', T('line', refOf(doc, 'A'), refOf(doc, 'B'))),
    });
    expect(r.objects.map((o) => o.id)).toEqual(doc.objects.map((o) => o.id));
    const ev = evalDoc(r, RationalField, contextOf(r));
    expect(valueOf(r, ev, 'C*')).toEqual({
      kind: 'point',
      x: { num: 1n, den: 1n },
      y: { num: -3n, den: 1n },
    });
    const err = refused(doc, {
      kind: 'redefine',
      id: idOf(doc, 's'),
      def: T('reflect', refOf(doc, 'A*')),
    });
    expect(err).toBe('cycle: s cannot depend on A*, which depends on s');
  });

  it('moving the map later moves its images after it (I4 re-validated)', () => {
    const { doc } = imaged();
    const e = ed(doc, { kind: 'add', object: { name: 'E', def: pt(7, 7) } });
    const m = ed(e, { kind: 'move', id: idOf(e, 's'), index: e.objects.length - 1 });
    expect(names(m)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'd',
      'k',
      'E',
      's',
      'A*',
      'B*',
      'C*',
      'D*',
      'E*',
    ]);
    // A map defined late: images of earlier sources follow it.
    const late = ed(e, { kind: 'move', id: idOf(e, 'E'), index: 0 });
    expect(names(late)[0]).toBe('E');
    expect(refused(e, { kind: 'move', id: idOf(e, 'A'), index: 99 })).toBe(
      'index 99 is outside the construction order',
    );
  });

  it('a new transform in the rule redefines every image in place', () => {
    const { doc, layer } = imaged();
    const t = ed(doc, {
      kind: 'add',
      object: { name: 'h', def: T('homothety', refOf(doc, 'A'), num(2)) },
    });
    const r = ed(t, { kind: 'updateRule', layerId: layer, patch: { transform: idOf(t, 'h') } });
    expect(names(r)).toEqual(['A', 'B', 'C', 'D', 'd', 'k', 's', 'h', 'A*', 'B*', 'C*', 'D*']);
    const ev = evalDoc(r, RationalField, contextOf(r));
    expect(valueOf(r, ev, 'B*')).toEqual({
      kind: 'point',
      x: { num: 8n, den: 1n },
      y: { num: 0n, den: 1n },
    });
    const own = ed(r, { kind: 'add', object: { name: 'g', def: T('reflect', refOf(r, 'B*')) } });
    expect(
      refused(own, { kind: 'updateRule', layerId: layer, patch: { transform: idOf(own, 'g') } }),
    ).toBe('cycle: a transformation depends on its own images');
  });
});

describe('chaining, cycles, deletion', () => {
  it('rules chain (images of images), and adding to main fills the chain', () => {
    const { doc, layer } = imaged();
    const two = ed(doc, {
      kind: 'addDerivedLayer',
      spec: { name: 'two', transform: idOf(doc, 's'), source: layer },
    });
    // Each image of an image sits right after its source (the later of source and map).
    expect(names(two).slice(-8)).toEqual(['A*', 'A**', 'B*', 'B**', 'C*', 'C**', 'D*', 'D**']);
    const e = ed(two, { kind: 'add', object: { name: 'E', def: pt(7, 7) } });
    expect(names(e).slice(-3)).toEqual(['E', 'E*', 'E**']);
    const ev = evalDoc(e, RationalField, contextOf(e));
    // s∘s takes A to s(C).
    expect(valueOf(e, ev, 'A**')).toEqual(valueOf(e, ev, 'C*'));
    const r = ed(e, { kind: 'rename', id: idOf(e, 'E'), name: 'F' });
    expect(names(r).slice(-3)).toEqual(['F', 'F*', 'F**']);
    const s2 = ed(e, {
      kind: 'updateRule',
      layerId: layer,
      patch: { suffix: '***' },
    });
    expect(names(s2)).toContain('E***');
    expect(names(s2)).toContain('E****');
  });

  it('cycles of rules are refused; a layer cannot image itself', () => {
    const { doc, layer } = imaged();
    const two = ed(doc, {
      kind: 'addDerivedLayer',
      spec: { name: 'two', transform: idOf(doc, 's'), source: layer },
    });
    const twoId = must2(two.applied.layerId);
    expect(refused(two, { kind: 'updateRule', layerId: layer, patch: { source: twoId } })).toBe(
      'cycle: layer two leads back to the derived layer',
    );
    expect(refused(two, { kind: 'updateRule', layerId: layer, patch: { source: layer } })).toBe(
      'a derived layer cannot image itself',
    );
    expect(refused(two, { kind: 'updateRule', layerId: 'main', patch: {} })).toBe(
      'layer "main" has no rule',
    );
  });

  it('deleting the rule deletes its managed objects (with dependents), the layer stays', () => {
    const { doc, layer } = imaged();
    const m = ed(doc, {
      kind: 'add',
      object: { name: 'M', def: T('midpoint', refOf(doc, 'A*'), refOf(doc, 'B')), layers: [layer] },
    });
    const q = ed(m, { kind: 'add', object: { name: 'Q', def: pt(3, 3), layers: [layer] } });
    const r = ed(q, { kind: 'removeRule', layerId: layer });
    expect(names(r)).toEqual(['A', 'B', 'C', 'D', 'd', 'k', 's', 'Q']);
    expect(r.applied.removed.objects).toEqual(['A*', 'B*', 'C*', 'D*', 'M'].map((n) => idOf(q, n)));
    expect(r.layers.find((l) => l.id === layer)?.rule).toBeUndefined();
    const gone = ed(q, { kind: 'removeLayer', id: layer });
    expect(names(gone)).toEqual(['A', 'B', 'C', 'D', 'd', 'k', 's', 'Q']);
    const noT = ed(q, { kind: 'remove', id: idOf(q, 's') });
    expect(noT.applied.removed.clearedRules).toEqual([layer]);
  });

  it('moving an object into or out of the source layer adds or removes its image', () => {
    const { doc, layer } = imaged();
    const p = ed(doc, { kind: 'addLayer', name: 'aux' });
    const aux = must2(p.applied.layerId);
    const e = ed(p, { kind: 'add', object: { name: 'E', def: pt(7, 7), layers: [aux] } });
    expect(names(e)).not.toContain('E*');
    const inMain = ed(e, { kind: 'setLayers', id: idOf(e, 'E'), layers: [aux, 'main'] });
    expect(names(inMain)).toContain('E*');
    const out = ed(inMain, { kind: 'setLayers', id: idOf(e, 'E'), layers: [aux] });
    expect(names(out)).not.toContain('E*');
    // Removing "aux" moves E back to main: its image appears.
    const back = ed(e, { kind: 'removeLayer', id: aux });
    expect(names(back).slice(-2)).toEqual(['E', 'E*']);
    expect(layer).not.toBe(aux);
  });
});

describe('apply(T, circle) maps the anchor: gliders on image circles stay exact', () => {
  it('on(c*, u, v) is exact over Q and lies on c*', () => {
    const { doc, layer } = imaged();
    const c = ed(doc, {
      kind: 'add',
      object: { name: 'ω', def: T('circle', refOf(doc, 'A'), refOf(doc, 'B'), refOf(doc, 'C')) },
    });
    const g = ed(c, {
      kind: 'add',
      object: { name: 'G', def: call('on', [refOf(c, 'ω*'), num(3), num(-2)]), layers: [layer] },
    });
    const ev = evalDoc(g, RationalField, contextOf(g));
    const [w, G] = [valueOf(g, ev, 'ω*'), valueOf(g, ev, 'G')];
    if (w.kind !== 'circle' || G.kind !== 'point') throw new Error('kinds');
    expect(w.anchor).toBeDefined();
    const F = RationalField;
    const [dx, dy] = [F.sub(G.x, w.c.x), F.sub(G.y, w.c.y)];
    expect(F.eq(F.add(F.mul(dx, dx), F.mul(dy, dy)), w.r2)).toBe(true);
    // The glider at (u : 0) is the image of the anchor A of ω: s(A) = C.
    const a = ed(g, {
      kind: 'redefine',
      id: idOf(g, 'G'),
      def: call('on', [refOf(g, 'ω*'), num(1), num(0)]),
    });
    expect(valueOf(a, evalDoc(a, F, contextOf(a)), 'G')).toEqual(
      valueOf(a, evalDoc(a, F, contextOf(a)), 'C'),
    );
  });
});

describe('syncDerived', () => {
  it('returns a synced document unchanged (idempotent)', () => {
    const { doc } = imaged();
    const r = syncDerived(doc, REGISTRY);
    expect(r.ok && r.doc).toEqual(doc);
    expect(r.ok && r.added).toEqual([]);
  });
});

function must2(x: string | undefined): string {
  if (x === undefined) throw new Error('missing layer id');
  return x;
}
