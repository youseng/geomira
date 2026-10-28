/**
 * Run 16a (ADR-0040 decisions 1–6): points at infinity. Parallel full lines meet at their ideal
 * point; every tool that does not declare one rejects it with a reason naming it (E2's kind
 * safety, over every overload of every tool); line(P, X∞) is the parallel, with the chirality
 * flag checked against actual mirrored figures (SPEC §4); static kinds; images.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../src/expr';
import { exprKinds, objectKinds } from '../src/derived';
import { atInfinityText, idealDegrees } from '../src/ideal';
import type { Capability, Value } from '../src/value';
import { capabilityKinds, hasCapability, isKnownKind, PROJECTIVE_KINDS } from '../src/value';
import { Builder, REGISTRY, evalDoc, num, pt, valueOf } from './helpers/doc';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
const line = (a: Expr, b: Expr) => T('line', a, b);
const FIELDS: readonly Field<unknown>[] = [FloatField, RationalField, ModPField];

/** A figure with X the point at infinity of the horizontal lines, and one object per capability. */
function figure(): Builder {
  const b = new Builder();
  b.point('A', 1, 2);
  b.point('B', 4, 6);
  b.point('C', -2, 5);
  b.add('X', T('intersect', line(pt(0, 0), pt(1, 0)), line(pt(0, 1), pt(1, 1))));
  b.add('l', line(b.ref('A'), b.ref('B')));
  b.add('w', T('circle', b.ref('A'), b.ref('C')));
  b.add('t', T('reflect', b.ref('l')));
  b.add('g', T('polygon', b.ref('A'), b.ref('B'), b.ref('C')));
  b.add('m', T('mark_segment', b.ref('A'), b.ref('B')));
  b.add('k', T('conic', b.ref('A'), b.ref('B'), b.ref('C'), pt(0, 0), pt(3, -1)));
  return b;
}

/** An argument expression of a capability in `figure()`; points are A, B, C in turn. */
function argFor(b: Builder, cap: Capability, i: number): Expr {
  switch (cap) {
    case 'point':
    case 'ppoint':
      return b.ref(['A', 'B', 'C'][i % 3] ?? 'A');
    case 'ideal':
      return b.ref('X');
    case 'curve':
    case 'linear':
      return b.ref('l');
    case 'round':
      return b.ref('w');
    case 'number':
      return num(2);
    case 'transform':
      return b.ref('t');
    case 'polygon':
      return b.ref('g');
    case 'annotation':
      return b.ref('m');
    case 'string':
      return { kind: 'str', value: 'M_a' };
    case 'conic':
      return b.ref('k');
  }
}

describe('E2 for points at infinity: every tool declares one or rejects it with its reason', () => {
  it('every overload of every tool, a point at infinity in each point position', () => {
    let declared = 0;
    let rejected = 0;
    for (const tool of REGISTRY.tools) {
      for (const sig of tool.signatures) {
        const caps = [...sig.params, ...(sig.rest === undefined ? [] : [sig.rest])];
        caps.forEach((cap, i) => {
          if (!capabilityKinds(cap).includes('point')) return;
          const b = figure();
          const args = caps.map((c, j) => (j === i ? b.ref('X') : argFor(b, c, j)));
          b.add('y', T(tool.name, ...args));
          for (const F of FIELDS) {
            const ev = evalDoc(b.doc, F);
            const values = args.map((a) => (a.kind === 'ref' ? ev.values.get(a.id) : undefined));
            const kinds = values.map((v) => v ?? { kind: 'number' });
            const takes = REGISTRY.resolve(tool.name, kinds).ok;
            const y = valueOf(b.doc, ev, 'y');
            if (takes) declared += 1;
            else {
              rejected += 1;
              expect(y, `${tool.name} #${String(i)}`).toEqual({
                kind: 'undefined',
                reason: `X is a point at infinity: ${tool.name} does not take one`,
              });
            }
          }
        });
      }
    }
    expect(declared).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(300);
  });

  it('only ppoint and ideal parameters take one; it is a known kind with no v1 capability', () => {
    const X: Value<number> = { kind: 'ideal_point', d: { x: 1, y: 0 }, chiral: false };
    expect(isKnownKind(X)).toBe(true);
    expect(PROJECTIVE_KINDS).toEqual(['ideal_point']);
    const caps: Capability[] = ['point', 'curve', 'linear', 'round', 'number', 'transform'];
    expect(caps.filter((c) => hasCapability(X, c))).toEqual([]);
    expect(hasCapability(X, 'ppoint') && hasCapability(X, 'ideal')).toBe(true);
    const O: Value<number> = { kind: 'point', x: 0, y: 0 };
    expect(hasCapability(O, 'ppoint')).toBe(true);
    expect(hasCapability(O, 'ideal')).toBe(false);
  });
});

describe('intersect: parallel full lines meet at their ideal point', () => {
  it('the first line’s direction and flag, in every field', () => {
    for (const F of FIELDS) {
      const b = figure();
      b.add('Y', T('intersect', line(pt(0, 0), pt(2, 1)), line(pt(0, 3), pt(4, 5))));
      const v = valueOf(b.doc, evalDoc(b.doc, F), 'Y');
      expect(v.kind === 'ideal_point' && [F.toNumber(v.d.x), F.toNumber(v.d.y), v.chiral]).toEqual([
        2,
        1,
        false,
      ]);
    }
  });

  it('with a selector, parallel lines stay Undefined (a selector judges a position)', () => {
    const b = figure();
    const lines = [line(pt(0, 0), pt(2, 1)), line(pt(0, 3), pt(4, 5))];
    b.add('Y', call('intersect', lines, [{ kind: 'near', p: pt(0, 0) }]));
    expect(valueOf(b.doc, evalDoc(b.doc, RationalField), 'Y')).toEqual({
      kind: 'undefined',
      reason: 'parallel lines',
    });
  });

  it('a dependent of an ideal point names it; a dependent of that is "undefined" as before', () => {
    const b = figure();
    b.add('M', T('midpoint', b.ref('X'), b.ref('A')));
    b.add('N', T('midpoint', b.ref('M'), b.ref('A')));
    const ev = evalDoc(b.doc, FloatField);
    expect(valueOf(b.doc, ev, 'M')).toEqual({
      kind: 'undefined',
      reason: 'X is a point at infinity: midpoint does not take one',
    });
    expect(valueOf(b.doc, ev, 'N')).toEqual({ kind: 'undefined', reason: 'M is undefined' });
  });
});

describe('line(P, X∞): the parallel, its flag checked against mirrored figures (SPEC §4)', () => {
  /** The direction of line(P, X∞), X∞ the meeting point of two lines through A and B. */
  function direction(points: readonly (readonly [number, number])[], chiralLines: boolean) {
    const [a, b2, p] = points.map(([x, y]) => pt(x, y));
    if (a === undefined || b2 === undefined || p === undefined) throw new Error('points');
    const b = new Builder();
    const base = line(a, b2);
    const X = chiralLines
      ? T('intersect', T('perp', a, base), T('perp', b2, base))
      : T('intersect', base, T('parallel', p, base));
    b.add('k', T('line', p, X));
    const v = valueOf(b.doc, evalDoc(b.doc, RationalField), 'k');
    if (v.kind !== 'line') throw new Error(v.kind);
    return { d: [RationalField.toNumber(v.d.x), RationalField.toNumber(v.d.y)], chiral: v.chiral };
  }

  for (const chiralLines of [false, true]) {
    it(`${chiralLines ? 'chiral' : 'achiral'} direction: the flag says how d mirrors`, () => {
      const pts: readonly (readonly [number, number])[] = [
        [1, 2],
        [5, 3],
        [-2, 4],
      ];
      // Mirror in the x axis: (x, y) ↦ (x, −y).
      const mirrored = pts.map(([x, y]) => [x, -y] as const);
      const [u, w] = [direction(pts, chiralLines), direction(mirrored, chiralLines)];
      expect(u.chiral).toBe(chiralLines);
      const reflected = [u.d[0] ?? 0, -(u.d[1] ?? 0)];
      // Achiral: the computed direction is the mirrored one; chiral: its opposite.
      const dot = (reflected[0] ?? 0) * (w.d[0] ?? 0) + (reflected[1] ?? 0) * (w.d[1] ?? 0);
      expect(Math.sign(dot)).toBe(chiralLines ? -1 : 1);
    });
  }
});

describe('static kinds and images', () => {
  it('intersect of lines may be a point at infinity; line(P, X) is a line', () => {
    const b = figure();
    const table = objectKinds(b.doc, REGISTRY);
    expect(table.get(b.id('X'))).toEqual(['point', 'ideal_point']);
    expect(exprKinds(T('line', b.ref('A'), b.ref('X')), table, REGISTRY)).toEqual(['line']);
  });

  it('under a map that may be projective, points and points at infinity exchange', () => {
    const b = figure();
    b.add('f', T('send_to_infinity', b.ref('l')));
    const table = objectKinds(b.doc, REGISTRY);
    expect(table.get(b.id('f'))).toEqual(['transform', 'projective']);
    expect(exprKinds(T('apply', b.ref('f'), b.ref('A')), table, REGISTRY)).toEqual([
      'point',
      'ideal_point',
    ]);
    expect(exprKinds(T('apply', b.ref('f'), b.ref('l')), table, REGISTRY)).toEqual(['line']);
    expect(exprKinds(T('apply', b.ref('t'), b.ref('A')), table, REGISTRY)).toEqual(['point']);
    const both = T('compose', b.ref('f'), T('inversion', b.ref('A'), num(2)));
    expect(exprKinds(both, table, REGISTRY)).toEqual(['transform', 'mobius', 'projective']);
  });

  it('a similarity maps the direction; a derived layer images the point at infinity', () => {
    const b = figure();
    b.add('r', T('rotate', pt(0, 0), num(90)));
    b.add('Y', T('apply', b.ref('r'), b.ref('X')));
    const v = valueOf(b.doc, evalDoc(b.doc, RationalField), 'Y');
    expect(
      v.kind === 'ideal_point' && [v.d.x, v.d.y].map((x) => RationalField.toNumber(x)),
    ).toEqual([0, 1]);
  });
});

describe('how a point at infinity is named (Objects panel, scene, exports)', () => {
  it('its direction as an angle modulo 180°', () => {
    expect(idealDegrees({ x: 1, y: 0 })).toBe(0);
    expect(idealDegrees({ x: -1, y: 0 })).toBe(0);
    expect(idealDegrees({ x: 0, y: 1 })).toBe(90);
    expect(idealDegrees({ x: 0, y: -1 })).toBe(90);
    expect(idealDegrees({ x: 2, y: 1 })).toBe(26.57);
    expect(idealDegrees({ x: -1, y: 1 })).toBe(135);
    expect(idealDegrees({ x: 1, y: -1e-9 })).toBe(0);
    expect(idealDegrees({ x: Number.NaN, y: 1 })).toBe(0);
    expect(atInfinityText({ x: 1, y: 1 })).toBe('at infinity, direction 45°');
  });
});
