import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { conicType, onConicSign } from '../src/conic';
import { Builder, evalDoc, valueOf, num, pt, REGISTRY } from './helpers/doc';

function circleConic(offset: number, scale = 1) {
  const b = new Builder();
  const points = [
    [5, 0],
    [0, 5],
    [-5, 0],
    [0, -5],
    [3, 4],
  ] as const;
  for (const [i, [x, y]] of points.entries())
    b.point('ABCDE'[i] ?? '', offset + x * scale, offset + y * scale);
  b.call('k', 'conic', ...'ABCDE'.split('').map((n) => b.ref(n)));
  for (const name of 'ABCDE') b.call(`t${name}`, 'tangent', b.ref(name), b.ref('k'));
  b.call('O', 'conic_center', b.ref('k'));
  b.point('P', offset + 5.01 * scale, offset);
  b.call('bad', 'tangent', b.ref('P'), b.ref('k'));
  return b;
}

describe('translation preserves locally well-conditioned geometry', () => {
  it('unsigned point and polygon area remain 1/2 after translating a unit triangle', () => {
    for (const offset of [0, 100000000, -100000000]) {
      const b = new Builder();
      b.point('A', offset, offset);
      b.point('B', offset + 1, offset);
      b.point('C', offset, offset + 1);
      b.call('p', 'polygon', b.ref('A'), b.ref('B'), b.ref('C'));
      b.call('s', 'area', b.ref('A'), b.ref('B'), b.ref('C'));
      b.call('r', 'area', b.ref('C'), b.ref('B'), b.ref('A'));
      b.call('u', 'area', b.ref('p'));
      const exact = valueOf(b.doc, evalDoc(b.doc, RationalField), 's');
      expect(exact.kind === 'number' ? exact.v : exact).toEqual({ num: 1n, den: 2n });
      for (const F of [FloatField, RationalField] as Field<unknown>[]) {
        const ev = evalDoc(b.doc, F);
        for (const name of ['s', 'r', 'u']) {
          const v = valueOf(b.doc, ev, name);
          expect(v.kind === 'number' ? F.toNumber(v.v) : v).toBe(0.5);
        }
      }
    }
  });
  for (const offset of [0, 100000, 1000000, -1000000]) {
    it(`preserves defining incidence, tangents and type at offset ${String(offset)}`, () => {
      const b = circleConic(offset);
      const ev = evalDoc(b.doc, FloatField);
      const k = valueOf(b.doc, ev, 'k');
      expect(k.kind).toBe('conic');
      if (k.kind !== 'conic') throw new Error('missing conic');
      for (const name of 'ABCDE') {
        const p = valueOf(b.doc, ev, name);
        if (p.kind !== 'point') throw new Error('missing point');
        expect(onConicSign(FloatField, k, p, { scale: 10 })).toBe(0);
        expect(valueOf(b.doc, ev, `t${name}`).kind).toBe('line');
      }
      expect(conicType(FloatField, k, { scale: 10 })).toBe('ellipse');
      expect(valueOf(b.doc, ev, 'bad').kind).toBe('undefined');
      const o = valueOf(b.doc, ev, 'O');
      expect(o.kind === 'point' ? [o.x, o.y] : o).toEqual([
        expect.closeTo(offset, 7),
        expect.closeTo(offset, 7),
      ]);
    });
  }
});

// Rational points/scales are deliberately dyadic so translation does not round the inputs.
describe('translated/scaled downstream conic operations', () => {
  for (const scale of [0.5, 1, 8])
    for (const offset of [0, 100000, 1000000, -1000000]) {
      it(`scale ${String(scale)}, offset ${String(offset)} agrees with RationalField`, () => {
        const b = circleConic(offset, scale);
        b.point('L', offset - 10 * scale, offset);
        b.point('R', offset + 10 * scale, offset);
        b.call('l', 'line', b.ref('L'), b.ref('R'));
        b.add('X', {
          kind: 'call',
          tool: 'intersect',
          args: [b.ref('l'), b.ref('k')],
          selectors: [{ kind: 'near', p: b.ref('A') }],
        });
        b.call('g', 'on', b.ref('k'), num(1), num(1));
        b.call('m', 'translate', b.ref('L'), b.ref('R'));
        b.call('im', 'apply', b.ref('m'), b.ref('k'));
        b.call('A_i', 'apply', b.ref('m'), b.ref('A'));
        b.call('t_i', 'tangent', b.ref('A_i'), b.ref('im'));
        const exact = evalDoc(b.doc, RationalField);
        const float = evalDoc(b.doc, FloatField);
        for (const name of ['A', 'B', 'C', 'D', 'E', 'O', 'X', 'g', 'A_i']) {
          const v = valueOf(b.doc, float, name);
          const q = valueOf(b.doc, exact, name);
          expect(v.kind, name).toBe('point');
          expect(q.kind, name).toBe('point');
          if (v.kind !== 'point' || q.kind !== 'point') throw new Error(name);
          expect(v.x).toBeCloseTo(RationalField.toNumber(q.x), 7);
          expect(v.y).toBeCloseTo(RationalField.toNumber(q.y), 7);
        }
        expect(valueOf(b.doc, float, 't_i').kind).toBe('line');
        const k = valueOf(b.doc, float, 'k');
        const g = valueOf(b.doc, float, 'g');
        if (k.kind !== 'conic' || g.kind !== 'point') throw new Error('missing geometry');
        expect(onConicSign(FloatField, k, g, { scale: 20 * scale })).toBe(0);
      });
    }
});

describe('local area invariants at representative scales', () => {
  for (const scale of [0.5, 1, 8])
    for (const offset of [0, -100000000, 100000000]) {
      it(`scale ${String(scale)} offset ${String(offset)} preserves rectangle and collinearity`, () => {
        const b = new Builder();
        b.point('A', offset, offset);
        b.point('B', offset + 4 * scale, offset);
        b.point('C', offset + 4 * scale, offset + 2 * scale);
        b.point('D', offset, offset + 2 * scale);
        b.point('E', offset + scale, offset);
        b.call('s', 'area', ...'ABCD'.split('').map((n) => b.ref(n)));
        b.call('r', 'area', ...'DCBA'.split('').map((n) => b.ref(n)));
        b.call('z', 'area', ...'AEB'.split('').map((n) => b.ref(n)));
        const ev = evalDoc(b.doc, FloatField);
        for (const name of ['s', 'r', 'z']) {
          const n = valueOf(b.doc, ev, name);
          expect(n.kind === 'number' ? n.v : n).toBe(name === 'z' ? 0 : 8 * scale * scale);
        }
      });
    }
});

it('seeded dyadic translations/scalings keep conic incidence and tangent normals', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -1000000, max: 1000000 }),
      fc.constantFrom(0.5, 1, 2, 8),
      (offset, scale) => {
        const b = circleConic(offset, scale);
        const ev = evalDoc(b.doc, FloatField);
        const k = valueOf(b.doc, ev, 'k');
        if (k.kind !== 'conic') throw new Error('missing conic');
        for (const [name, dx, dy] of [
          ['A', 5, 0],
          ['B', 0, 5],
          ['C', -5, 0],
          ['D', 0, -5],
          ['E', 3, 4],
        ] as const) {
          const p = valueOf(b.doc, ev, name),
            t = valueOf(b.doc, ev, `t${name}`);
          if (p.kind !== 'point' || t.kind !== 'line') throw new Error('missing geometry');
          expect(onConicSign(FloatField, k, p, { scale: 10 * scale })).toBe(0);
          const tangentDotRadius = t.d.x * dx + t.d.y * dy;
          expect(Math.abs(tangentDotRadius) / Math.hypot(t.d.x, t.d.y)).toBeLessThan(1e-9);
        }
      },
    ),
    { seed: 720726, numRuns: 32 },
  );
});

it('translated conic/conic intersections and common tangents keep their branches', () => {
  for (const offset of [0, 100000, 1000000]) {
    const b = circleConic(offset);
    b.call(
      'j',
      'conic',
      ...[
        [5, 0],
        [0, 5],
        [-5, 0],
        [0, -5],
        [3, 4],
      ].map(([x, y]) => pt(offset + 12 + (x ?? 0), offset + (y ?? 0))),
    );
    b.call(
      'h',
      'conic',
      ...[
        [5, 0],
        [0, 5],
        [-5, 0],
        [0, -5],
        [3, 4],
      ].map(([x, y]) => pt(offset + 6 + (x ?? 0), offset + (y ?? 0))),
    );
    const ev = evalDoc(b.doc, FloatField);
    const k = valueOf(b.doc, ev, 'k'),
      j = valueOf(b.doc, ev, 'j'),
      h = valueOf(b.doc, ev, 'h');
    const tangents = REGISTRY.get('tangent')?.candidates?.(FloatField, [k, j], { scale: 25 }) ?? [];
    expect(tangents).toHaveLength(4);
    expect(tangents.every((t) => t.kind === 'line')).toBe(true);
    const points = REGISTRY.get('intersect')?.candidates?.(FloatField, [k, h], { scale: 20 }) ?? [];
    expect(points).toHaveLength(2);
    for (const p of points) {
      if (p.kind !== 'point') throw new Error('missing intersection');
      expect(p.x - offset).toBeCloseTo(3, 7);
      expect(Math.abs(p.y - offset)).toBeCloseTo(4, 7);
    }
  }
});

it('a center-crossing chord keeps two intersections at a very large conic scale', () => {
  for (const scale of [1, 100000000]) {
    const b = new Builder();
    const P = (x: number, y: number) => pt(x * scale, y * scale);
    b.add('k', {
      kind: 'call',
      tool: 'conic',
      args: [P(2, 0), P(0, 1), P(-2, 0), P(0, -1), P(1.2, 0.8)],
      selectors: [],
    });
    b.call('l', 'line', P(-3, 0), P(3, 0));
    for (const sign of [1, -1] as const)
      b.add(sign === 1 ? 'X' : 'Y', {
        kind: 'call',
        tool: 'intersect',
        args: [b.ref('l'), b.ref('k')],
        selectors: [{ kind: 'along', sign }],
      });
    b.add('Z', {
      kind: 'call',
      tool: 'other',
      args: [b.ref('l'), b.ref('k'), P(2, 0)],
      selectors: [],
    });
    const ev = evalDoc(b.doc, FloatField);
    for (const [name, wanted] of [
      ['X', 2],
      ['Y', -2],
      ['Z', -2],
    ] as const) {
      const p = valueOf(b.doc, ev, name);
      expect(p.kind).toBe('point');
      if (p.kind !== 'point') throw new Error('missing chord point');
      expect(p.x / scale).toBeCloseTo(wanted, 12);
      expect(p.y).toBe(0);
    }
  }
});

it('binary local construction retains exact zero coefficients of rational conics', () => {
  const b = new Builder();
  b.call('h', 'conic', pt(1, 1), pt(2, 0.5), pt(-1, -1), pt(4, 0.25), pt(0.5, 2));
  b.call('p', 'conic', pt(0, -3), pt(1, -2), pt(-1, -2), pt(2, 1), pt(-2, 1));
  const exact = evalDoc(b.doc, RationalField),
    approximate = evalDoc(b.doc, FloatField);
  for (const name of ['h', 'p']) {
    const q = valueOf(b.doc, exact, name),
      k = valueOf(b.doc, approximate, name);
    if (q.kind !== 'conic' || k.kind !== 'conic') throw new Error('missing conic');
    const exactZero = name === 'h' ? q.e : q.c;
    const approximateZero = name === 'h' ? k.e : k.c;
    expect(RationalField.eq(exactZero, RationalField.zero)).toBe(true);
    expect(approximateZero).toBe(0);
  }
});

it('a stationary midpoint in a hyperbola gap does not create a false double intersection', () => {
  for (const scale of [1, 100000000]) {
    const b = new Builder();
    const P = (x: number, y: number) => pt(x * scale, y * scale);
    b.call('h', 'conic', P(1, 1), P(2, 0.5), P(-1, -1), P(4, 0.25), P(0.5, 2));
    b.call('l', 'line', P(-2, 2), P(2, -2));
    b.add('X', {
      kind: 'call',
      tool: 'intersect',
      args: [b.ref('l'), b.ref('h')],
      selectors: [{ kind: 'along', sign: 1 }],
    });
    const v = valueOf(b.doc, evalDoc(b.doc, FloatField), 'X');
    expect(v.kind).toBe('undefined');
    if (v.kind !== 'undefined') throw new Error('expected a missing intersection');
    expect(v.reason).toContain('misses');
  }
});
