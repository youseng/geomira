/**
 * Found in the Run 10 audit: circle(O, A) and circle(O, r) accept a radius above EPS·scale (a
 * length), but every tool that USES a circle refused one with r² ≤ EPS·scale² (an area), i.e.
 * a radius up to about 3·10⁻⁵·scale: such a circle was drawn but had no intersections, tangent,
 * polar, power or gliders ("the circle has no positive radius"), and the incircle of a thin
 * triangle likewise. The radius is now decided as a length everywhere (ADR-0004: small and
 * large circles are judged alike).
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call } from '../src/expr';
import { createRegistry } from '../src/registry';
import type { Value } from '../src/value';
import { Builder, evalDoc, valueOf } from './helpers/doc';

const REGISTRY = createRegistry();

describe('small circles are circles for every tool', () => {
  it('a circle of radius 10⁻⁵ meets its diameter line and has a tangent and a polar', () => {
    const b = new Builder();
    const O = b.point('O', 0, 0);
    const A = b.point('A', '0.00001', 0);
    const Z = b.point('Z', 1, 0);
    const c = b.call('c', 'circle', O, A);
    const l = b.call('l', 'line', O, Z);
    b.add('X', call('intersect', [l, c], [{ kind: 'along', sign: 1 }]));
    b.add('t', call('tangent', [A, c]));
    b.add('p', call('polar', [Z, c]));
    b.add('w', call('power', [Z, c]));
    const ev = evalDoc(b.doc, FloatField);
    const X = valueOf(b.doc, ev, 'X');
    expect(X.kind === 'point' ? [X.x, X.y] : X).toEqual([0.00001, 0]);
    expect(valueOf(b.doc, ev, 't').kind).toBe('line');
    expect(valueOf(b.doc, ev, 'p').kind).toBe('line');
    expect(valueOf(b.doc, ev, 'w').kind).toBe('number');
  });

  it('the incircle of a thin triangle has a polar', () => {
    const b = new Builder();
    const [A, B, C] = [b.point('A', 0, 0), b.point('B', 1, 0), b.point('C', '0.5', '0.000001')];
    const ic = b.call('ic', 'incircle', A, B, C);
    b.add('pl', call('polar', [b.point('P', '0.5', 1), ic]));
    const ev = evalDoc(b.doc, FloatField);
    expect(valueOf(b.doc, ev, 'ic').kind).toBe('circle');
    expect(valueOf(b.doc, ev, 'pl').kind).toBe('line');
  });

  it('degenerate: r² zero, negative, or a radius within EPS·scale stays refused', () => {
    const P: Value<number> = { kind: 'point', x: 5, y: 0 };
    for (const r2 of [0, -1, -1e-20, 1e-20, 1e-19])
      expect(
        REGISTRY.get('polar')?.compute(
          FloatField,
          [P, { kind: 'circle', c: { x: 0, y: 0 }, r2, arc: null }],
          {
            scale: 1,
          },
        ),
        String(r2),
      ).toEqual({ kind: 'undefined', reason: 'the circle has no positive radius' });
    // Over Q a radius of 10⁻¹⁵ is a radius: zero tests are exact.
    const Q = { kind: 'point', x: { num: 5n, den: 1n }, y: { num: 0n, den: 1n } } as const;
    const O = { x: { num: 0n, den: 1n }, y: { num: 0n, den: 1n } };
    const tiny = { kind: 'circle', c: O, r2: { num: 1n, den: 10n ** 30n }, arc: null } as const;
    expect(REGISTRY.get('polar')?.compute(RationalField, [Q, tiny], { scale: 1 }).kind).toBe(
      'line',
    );
  });
});
