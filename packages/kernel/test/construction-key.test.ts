/**
 * Construction keys (ADR-0029): every argument symmetry the registry declares, tested both
 * ways — the permuted call has the same key, and its exact value (RationalField) is the same
 * value ('value') or the same figure ('figure'); plus the negative cases (ray, circle(O, A),
 * free inputs, nested directions, orient without its flip).
 */
import * as Q from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { constructionKey, sameConstruction } from '../src/construction-key';
import { objectKinds } from '../src/derived';
import { call, lit, type Expr, type Selector } from '../src/expr';
import type { ArgSymmetry, ToolSpec } from '../src/tool';
import type { Value, Vec } from '../src/value';
import { Builder, contextOf, evalDoc, num, pt, REGISTRY, valueOf } from './helpers/doc';

type R = Q.Rational;

/** A 13-14-15 triangle ABC (rational side lengths), D, P, two circles meeting at (3, ±4). */
function fixture(): Builder {
  const b = new Builder();
  b.point('A', 5, 12);
  b.point('B', 0, 0);
  b.point('C', 14, 0);
  b.point('D', 9, 10);
  b.point('P', 3, 7);
  b.point('E', 5, 0);
  b.point('F', 6, 0);
  b.point('G', 3, 4);
  b.point('H', -4, -3);
  b.point('I', 4, 3);
  b.call('c', 'circle', b.ref('B'), b.ref('E'));
  b.call('d', 'circle', b.ref('F'), b.ref('G'));
  b.call('l', 'line', b.ref('H'), b.ref('I'));
  b.call('m', 'line', b.ref('A'), b.ref('C'));
  return b;
}

/** The sample arguments of each tool that declares a symmetry (names of fixture objects). */
const SAMPLES: Readonly<Record<string, readonly string[]>> = {
  line: ['A', 'B'],
  segment: ['A', 'B'],
  perp_bisector: ['A', 'B'],
  midpoint: ['A', 'B'],
  dist: ['A', 'B'],
  diameter_circle: ['A', 'B'],
  radical_axis: ['c', 'd'],
  circle: ['A', 'B', 'C'],
  circumcircle: ['A', 'B', 'C'],
  cline: ['A', 'B', 'C'],
  circumcenter: ['A', 'B', 'C'],
  orthocenter: ['A', 'B', 'C'],
  centroid: ['A', 'B', 'C'],
  incenter: ['A', 'B', 'C'],
  ninepoint_center: ['A', 'B', 'C'],
  incircle: ['A', 'B', 'C'],
  ninepoint_circle: ['A', 'B', 'C'],
  excenter: ['A', 'B', 'C'],
  excircle: ['A', 'B', 'C'],
  bisector: ['A', 'B', 'C'],
  ext_bisector: ['A', 'B', 'C'],
  foot: ['P', 'A', 'B'],
  polygon: ['A', 'B', 'C', 'D'],
  intersect: ['c', 'd'],
};

/** Selectors of a sample (intersect of two circles needs one). */
const SAMPLE_SELECTORS: Readonly<Record<string, readonly Selector[]>> = {
  intersect: [{ kind: 'orient', sign: 1 }],
};

/** Every arrangement of `n` arguments a symmetry allows (with orient's flip). */
function permutations(s: ArgSymmetry, n: number): { perm: number[]; flip: boolean }[] {
  const id = Array.from({ length: n }, (_, i) => i);
  switch (s.kind) {
    case 'permute': {
      const out: { perm: number[]; flip: boolean }[] = [];
      const orders = (xs: number[]): number[][] =>
        xs.length <= 1
          ? [xs]
          : xs.flatMap((x, i) => orders(xs.filter((_, j) => j !== i)).map((r) => [x, ...r]));
      for (const order of orders([...s.positions])) {
        const perm = [...id];
        s.positions.forEach((p, k) => (perm[p] = order[k] ?? p));
        const moved = s.positions.filter((p, k) => order[k] !== p).length;
        // Swaps of two positions are odd; a 3-cycle (all three moved) is even.
        const odd = moved === 2;
        out.push({ perm, flip: s.flipsOrient === true && odd });
      }
      return out;
    }
    case 'dihedral': {
      const rots = id.map((_, r) => id.map((i) => (i + r) % n));
      return [...rots, ...rots.map((p) => [...p].reverse())].map((perm) => ({ perm, flip: false }));
    }
    default:
      throw new Error('unknown symmetry');
  }
}

function flipped(s: Selector, flip: boolean): Selector {
  return flip && s.kind === 'orient' ? { kind: 'orient', sign: s.sign === 1 ? -1 : 1 } : s;
}

const eq = (a: R, b: R) => Q.eq(a, b);
const sameVec = (a: Vec<R>, b: Vec<R>) => eq(a.x, b.x) && eq(a.y, b.y);
const cross = (u: Vec<R>, v: Vec<R>) => Q.sub(Q.mul(u.x, v.y), Q.mul(u.y, v.x));
const minus = (u: Vec<R>, v: Vec<R>): Vec<R> => ({ x: Q.sub(u.x, v.x), y: Q.sub(u.y, v.y) });
const plus = (u: Vec<R>, v: Vec<R>): Vec<R> => ({ x: Q.add(u.x, v.x), y: Q.add(u.y, v.y) });

/** Whether two exact values are the same point set (directions, anchors, vertex order aside). */
function sameFigure(a: Value<R>, b: Value<R>): boolean {
  if (a.kind === 'point' && b.kind === 'point') return sameVec(a, b);
  if (a.kind === 'number' && b.kind === 'number') return eq(a.v, b.v);
  if (a.kind === 'circle' && b.kind === 'circle') return sameVec(a.c, b.c) && eq(a.r2, b.r2);
  if (a.kind === 'line' && b.kind === 'line') {
    const carrier = Q.isZero(cross(a.d, b.d)) && Q.isZero(cross(minus(b.p, a.p), a.d));
    if (a.lo === null && a.hi === null) return carrier && b.lo === null && b.hi === null;
    const [a0, a1, b0, b1] = [a.p, plus(a.p, a.d), b.p, plus(b.p, b.d)];
    const segs = a.lo !== null && a.hi !== null && b.lo !== null && b.hi !== null;
    return segs && ((sameVec(a0, b0) && sameVec(a1, b1)) || (sameVec(a0, b1) && sameVec(a1, b0)));
  }
  if (a.kind === 'polygon' && b.kind === 'polygon') {
    const n = a.pts.length;
    if (b.pts.length !== n) return false;
    const at = (i: number) => b.pts[((i % n) + n) % n];
    return a.pts.some((_, r) =>
      [1, -1].some((dir) =>
        a.pts.every((p, i) => {
          const q = at(r + dir * i);
          return q !== undefined && sameVec(p, q);
        }),
      ),
    );
  }
  return false;
}

function symmetricTools(): ToolSpec[] {
  return REGISTRY.tools.filter((t) => t.signatures.some((s) => (s.symmetry ?? []).length > 0));
}

describe('every declared symmetry gives the same key and the same exact value', () => {
  it('each tool with a symmetry has a sample here', () => {
    expect(
      symmetricTools()
        .map((t) => t.name)
        .filter((n) => SAMPLES[n] === undefined),
    ).toEqual([]);
  });

  for (const tool of symmetricTools()) {
    it(tool.name, () => {
      const names = SAMPLES[tool.name] ?? [];
      const b = fixture();
      const args = names.map((n) => b.ref(n));
      const sels = SAMPLE_SELECTORS[tool.name] ?? [];
      const base = b.add('base', call(tool.name, args, sels));
      const kinds = () => objectKinds(b.doc, REGISTRY);
      const sig = tool.signatures.find(
        (s) =>
          s.symmetry !== undefined && (s.rest !== undefined || s.params.length === args.length),
      );
      expect(sig, 'a symmetric overload of the sample arity').toBeDefined();
      let k = 0;
      for (const s of sig?.symmetry ?? []) {
        for (const { perm, flip } of permutations(s, args.length)) {
          const def = call(
            tool.name,
            perm.map((i) => args[i] ?? args[0] ?? num(0)),
            sels.map((x) => flipped(x, flip)),
          );
          const key = constructionKey(def, REGISTRY, kinds());
          expect(key, `${tool.name} ${perm.join('')}`).toBe(
            constructionKey(call(tool.name, args, sels), REGISTRY, kinds()),
          );
          b.add(`x${String(k++)}`, def);
        }
      }
      const ev = evalDoc(b.doc, RationalField, contextOf(b.doc));
      const v0 = ev.values.get(base.id);
      expect(v0?.kind).not.toBe('undefined');
      expect(v0?.kind).not.toBe('inexact');
      let j = 0;
      for (const s of sig?.symmetry ?? []) {
        for (const { perm } of permutations(s, args.length)) {
          const v = valueOf(b.doc, ev, `x${String(j++)}`);
          expect(perm.length).toBe(args.length);
          if (v0 === undefined) throw new Error('no value');
          if (s.same === 'value') expect(v, `${tool.name} ${s.same}`).toEqual(v0);
          else expect(sameFigure(v, v0), `${tool.name} figure`).toBe(true);
        }
      }
    });
  }
});

describe('declared symmetries (the maintainer’s list)', () => {
  const b = fixture();
  const kinds = objectKinds(b.doc, REGISTRY);
  const key = (tool: string, names: readonly string[], sels: readonly Selector[] = []) =>
    constructionKey(
      call(
        tool,
        names.map((n) => b.ref(n)),
        sels,
      ),
      REGISTRY,
      kinds,
    );

  it.each([
    ['line', ['A', 'B'], ['B', 'A']],
    ['segment', ['A', 'B'], ['B', 'A']],
    ['circle', ['A', 'B', 'C'], ['C', 'A', 'B']],
    ['cline', ['A', 'B', 'C'], ['B', 'C', 'A']],
    ['midpoint', ['A', 'B'], ['B', 'A']],
    ['perp_bisector', ['A', 'B'], ['B', 'A']],
    ['dist', ['A', 'B'], ['B', 'A']],
    ['radical_axis', ['c', 'd'], ['d', 'c']],
    ['diameter_circle', ['A', 'B'], ['B', 'A']],
    ['incircle', ['A', 'B', 'C'], ['B', 'A', 'C']],
    ['ninepoint_circle', ['A', 'B', 'C'], ['C', 'B', 'A']],
    ['excenter', ['A', 'B', 'C'], ['A', 'C', 'B']],
    ['excircle', ['A', 'B', 'C'], ['A', 'C', 'B']],
    ['bisector', ['A', 'B', 'C'], ['C', 'B', 'A']],
    ['ext_bisector', ['A', 'B', 'C'], ['C', 'B', 'A']],
    ['foot', ['P', 'A', 'B'], ['P', 'B', 'A']],
    ['polygon', ['A', 'B', 'C', 'D'], ['C', 'B', 'A', 'D']],
    ['polygon', ['A', 'B', 'C', 'D'], ['B', 'C', 'D', 'A']],
    ['intersect', ['l', 'm'], ['m', 'l']],
  ] as const)('%s(%j) = %s(%j)', (tool, a, c) => {
    expect(key(tool, a)).toBeDefined();
    expect(key(tool, a)).toBe(key(tool, c));
  });

  it('circumcircle(A, B, C) is circle(B, C, A)', () => {
    expect(key('circumcircle', ['A', 'B', 'C'])).toBe(key('circle', ['B', 'C', 'A']));
  });

  it('intersect(c, d, orient(+)) = intersect(d, c, orient(-)), not intersect(d, c, orient(+))', () => {
    const plus: Selector[] = [{ kind: 'orient', sign: 1 }];
    const minusSel: Selector[] = [{ kind: 'orient', sign: -1 }];
    expect(key('intersect', ['c', 'd'], plus)).toBe(key('intersect', ['d', 'c'], minusSel));
    expect(key('intersect', ['c', 'd'], plus)).not.toBe(key('intersect', ['d', 'c'], plus));
    const ev = evalDoc(
      [
        ['p', ['c', 'd'], plus] as const,
        ['q', ['d', 'c'], plus] as const,
        ['r', ['d', 'c'], minusSel] as const,
      ].reduce((bb, [n, args, s]) => {
        bb.add(
          n,
          call(
            'intersect',
            args.map((x) => bb.ref(x)),
            s,
          ),
        );
        return bb;
      }, fixture()).doc,
      RationalField,
    );
    const pts = [...ev.values.values()].slice(-3);
    expect(pts[0]).toEqual(pts[2]);
    expect(pts[0]).not.toEqual(pts[1]);
  });

  it('intersect(l, c, along(+)) = intersect(c, l, along(+)): along measures on the line', () => {
    const along: Selector[] = [{ kind: 'along', sign: 1 }];
    expect(key('intersect', ['l', 'c'], along)).toBe(key('intersect', ['c', 'l'], along));
    const bb = fixture();
    bb.add('p', call('intersect', [bb.ref('l'), bb.ref('c')], along));
    bb.add('q', call('intersect', [bb.ref('c'), bb.ref('l')], along));
    const ev = evalDoc(bb.doc, RationalField);
    expect(valueOf(bb.doc, ev, 'p')).toEqual(valueOf(bb.doc, ev, 'q'));
    expect(valueOf(bb.doc, ev, 'p')).toEqual({
      kind: 'point',
      x: Q.fromInteger(4),
      y: Q.fromInteger(3),
    });
  });

  it('the selectors that do not depend on the order keep their meaning under the swap', () => {
    const sels: Selector[][] = [
      [{ kind: 'near', p: b.ref('I') }],
      [{ kind: 'far_from', p: b.ref('I') }],
      [{ kind: 'other', p: b.ref('G') }],
      [{ kind: 'same_side', q: b.ref('A'), l: call('line', [b.ref('B'), b.ref('E')]) }],
    ];
    for (const s of sels) {
      const [x, y] = s[0]?.kind === 'other' ? ['c', 'd'] : ['l', 'c'];
      expect(key('intersect', [x, y], s)).toBe(key('intersect', [y, x], s));
      const bb = fixture();
      bb.add('p', call('intersect', [bb.ref(x), bb.ref(y)], s));
      bb.add('q', call('intersect', [bb.ref(y), bb.ref(x)], s));
      const ev = evalDoc(bb.doc, RationalField);
      expect(valueOf(bb.doc, ev, 'p').kind).toBe('point');
      expect(valueOf(bb.doc, ev, 'p')).toEqual(valueOf(bb.doc, ev, 'q'));
    }
  });
});

describe('what is not the same construction', () => {
  const b = fixture();
  const kinds = objectKinds(b.doc, REGISTRY);
  const key = (def: Expr) => constructionKey(def, REGISTRY, kinds);
  const r = (n: string) => b.ref(n);

  it('ray(A, B) is not ray(B, A); circle(O, A) is not circle(A, O)', () => {
    expect(key(call('ray', [r('A'), r('B')]))).not.toBe(key(call('ray', [r('B'), r('A')])));
    expect(key(call('circle', [r('A'), r('B')]))).not.toBe(key(call('circle', [r('B'), r('A')])));
  });

  it('a polygon with its vertices in another (non-dihedral) order is another polygon', () => {
    const p = (ns: string[]) => key(call('polygon', ns.map(r)));
    expect(p(['A', 'B', 'C', 'D'])).not.toBe(p(['A', 'C', 'B', 'D']));
  });

  it('dist(P, l) has no symmetry (only dist of two points does)', () => {
    expect(key(call('dist', [r('P'), r('l')]))).not.toBe(key(call('dist', [r('l'), r('P')])));
  });

  it('free inputs have no key: point, on, param, also nested', () => {
    expect(key(pt(1, 2))).toBeUndefined();
    expect(key(call('on', [r('l'), num('1/2')]))).toBeUndefined();
    expect(key(call('param', [num(0), num(1), num('1/2')]))).toBeUndefined();
    expect(key(call('midpoint', [r('A'), pt(1, 2)]))).toBeUndefined();
    expect(
      key(call('intersect', [r('l'), r('c')], [{ kind: 'near', p: pt(1, 2) }])),
    ).toBeUndefined();
    const bb = fixture();
    bb.add('X', pt(1, 2));
    bb.add('g', call('on', [bb.ref('l'), num('1/2')]));
    expect(sameConstruction(bb.doc, pt(1, 2), REGISTRY)).toBeUndefined();
    expect(
      sameConstruction(bb.doc, call('on', [bb.ref('l'), num('1/2')]), REGISTRY),
    ).toBeUndefined();
  });

  it('a nested line keeps its direction: along(+) on line(A, B) is along(-) on line(B, A)', () => {
    const along = (s: 1 | -1): Selector[] => [{ kind: 'along', sign: s }];
    const nested = (x: string, y: string, s: 1 | -1) =>
      call('intersect', [call('line', [r(x), r(y)]), r('c')], along(s));
    expect(key(nested('H', 'I', 1))).not.toBe(key(nested('I', 'H', 1)));
    const bb = fixture();
    bb.add('p', nested('H', 'I', 1));
    bb.add('q', nested('I', 'H', 1));
    bb.add('s', nested('I', 'H', -1));
    const ev = evalDoc(bb.doc, RationalField);
    expect(valueOf(bb.doc, ev, 'p')).not.toEqual(valueOf(bb.doc, ev, 'q'));
    expect(valueOf(bb.doc, ev, 'p')).toEqual(valueOf(bb.doc, ev, 's'));
  });

  it('a nested call keeps its value symmetries: line(midpoint(A, B), C) = line(C, midpoint(B, A))', () => {
    expect(key(call('line', [call('midpoint', [r('A'), r('B')]), r('C')]))).toBe(
      key(call('line', [r('C'), call('midpoint', [r('B'), r('A')])])),
    );
  });

  it('literals by exact value; references by id; selectors in order', () => {
    expect(key(call('circle', [r('A'), lit(Q.rational(1n, 2n), '0.5')]))).toBe(
      key(call('circle', [r('A'), num('2/4')])),
    );
    expect(key(call('midpoint', [r('A'), r('B')]))).not.toBe(
      key(call('midpoint', [r('A'), r('C')])),
    );
  });
});

describe('sameConstruction on a document', () => {
  it('finds the earlier object, skips `except` and managed images', () => {
    const b = fixture();
    const l = b.id('l');
    const def = call('line', [b.ref('I'), b.ref('H')]);
    expect(sameConstruction(b.doc, def, REGISTRY)?.name).toBe('l');
    expect(sameConstruction(b.doc, def, REGISTRY, { except: l })).toBeUndefined();
    const managed = {
      ...b.doc,
      objects: b.doc.objects.map((o) => (o.id === l ? { ...o, managedBy: 'img' } : o)),
    };
    expect(sameConstruction(managed, def, REGISTRY)).toBeUndefined();
    const cache = new WeakMap<Expr, string | null>();
    expect(sameConstruction(b.doc, def, REGISTRY, { cache })?.name).toBe('l');
    expect(sameConstruction(b.doc, def, REGISTRY, { cache })?.name).toBe('l');
  });
});
