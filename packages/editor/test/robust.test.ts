/**
 * robust.ts: the local responses (one LOCAL_SIGMA·scale deviation of each free input at a
 * time: both coordinates of free points, the parameter of every glider form) and the
 * firmness of deciding distances measured against them.
 */
import { describe, expect, it } from 'vitest';
import { LOCAL_SIGMA } from '@geomira/claims/constants';
import { evalContextFor } from '@geomira/kernel/context';
import { firmness, localResponses, matched } from '../src/robust';
import { editorOf, idOf, registry } from './helpers/editor';

describe('local responses', () => {
  it('move each free input by one local deviation: points (x, y) and gliders (t, θ, (u : v))', () => {
    const s = editorOf(
      [
        'A = (0, 0)',
        'B = (4, 0)',
        'l = line(A, B)',
        'P = on(l, 1/2)',
        'c = circle(A, B)',
        'Q = on(c, 1, 0)',
        'k = circle(A, 2)',
        'R = on(k, 0)',
        'M = midpoint(A, B)',
      ].join('\n'),
    );
    const c = evalContextFor(s.doc);
    if (!c.ok) throw new Error(c.reason);
    const h = LOCAL_SIGMA * c.ctx.scale;
    const rs = localResponses(s.doc, s.values.values, registry, c.ctx);
    // A (x, y), B (x, y), P, Q, R: seven responses; M is constructed.
    expect(rs).toHaveLength(7);
    const moved = (name: string) =>
      rs.map((r) => {
        const [v, w] = [r.get(idOf(s, name)), s.values.values.get(idOf(s, name))];
        return v?.kind === 'point' && w?.kind === 'point' ? Math.hypot(v.x - w.x, v.y - w.y) : NaN;
      });
    expect(moved('A')[0]).toBeCloseTo(h, 12);
    // Gliders move by one deviation of arc or length (to first order).
    for (const [name, i] of [
      ['P', 4],
      ['Q', 5],
      ['R', 6],
    ] as const)
      expect(moved(name)[i]).toBeCloseTo(h, 2);
  });

  it('firmness: |distance| over its deviation; untouched distances are infinitely firm', () => {
    const base = new Map([[1, { kind: 'number' as const, v: 4 }]]);
    const r1 = new Map([[1, { kind: 'number' as const, v: 4.3 }]]);
    const r2 = new Map([[1, { kind: 'number' as const, v: 3.6 }]]);
    const q = (vals: ReadonlyMap<number, { kind: string; v?: number }>) => {
      const v = vals.get(1);
      return v?.v === undefined ? undefined : [v.v, 7];
    };
    expect(firmness(base, [r1, r2], q)).toBeCloseTo(4 / 0.5, 12);
    expect(firmness(base, [base], q)).toBe(Number.POSITIVE_INFINITY);
    expect(firmness(base, [new Map()], q)).toBe(0);
    expect(firmness(new Map(), [r1], q)).toBe(0);
  });

  it('matched pairs candidates with the reference ones (least total motion)', () => {
    const [a, b] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(
      matched(
        [
          { x: 9, y: 1 },
          { x: 1, y: 1 },
        ],
        [a, b],
      ),
    ).toEqual([
      { x: 1, y: 1 },
      { x: 9, y: 1 },
    ]);
    expect(matched([{ x: 2, y: 0 }], [a, b])).toEqual([{ x: 2, y: 0 }, undefined]);
    expect(matched([], [a, b])).toBeUndefined();
  });
});
