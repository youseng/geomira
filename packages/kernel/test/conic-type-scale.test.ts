/**
 * Run 16c audit (ADR-0044): the type of a conic in floats is decided at the figure's scale. A
 * conic is a parabola when its centre is at infinity for the figure (its largest real semi-axis
 * beyond scale/EPS, the band before that), not when ac − b² over a² + 2b² + c², an ASPECT RATIO,
 * is small. The thin hyperbola (x − 0.3)²/0.01 − (y − 0.2)²/10⁸ = 1 (the image of a small
 * hyperbola under a projective map), centre in the figure, was called a parabola: its foci
 * and centre came out as garbage (its foci (0.3 ± 10⁴, 0.2) lie on the transverse axis).
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../src/expr';
import { Builder, evalDoc, pt, valueOf } from './helpers/doc';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
const P = (x: number, y: number) => pt(String(x), String(y));

function figure(): Builder {
  const b = new Builder();
  const pts = [
    [0.4, 0.2],
    [0.2, 0.2],
    [0.425, 0.275],
    [0.425, 0.125],
    [0.175, 0.275],
  ] as const;
  b.add('h', T('conic', ...pts.map(([x, y]) => P(x, y))));
  b.add(
    'f',
    T(
      'projective',
      ...[P(0, 0.2), P(1, 0.2), P(0, 0.20001), P(1, 0.20001)],
      ...[P(0, 0.2), P(1, 0.2), P(0, 1.2), P(1, 1.2)],
    ),
  );
  b.add('k', T('apply', b.ref('f'), b.ref('h')));
  b.add('O', T('conic_center', b.ref('k')));
  b.add('F1', call('foci', [b.ref('k')], [{ kind: 'near', p: P(10000, 0) }]));
  b.add('F2', call('foci', [b.ref('k')], [{ kind: 'near', p: P(-10000, 0) }]));
  return b;
}

describe('a thin hyperbola with its centre in the figure is a hyperbola', () => {
  const b = figure();
  const ev = evalDoc(b.doc, FloatField);
  const xy = (n: string) => {
    const v = valueOf(b.doc, ev, n);
    return v.kind === 'point' ? [v.x, v.y] : v;
  };

  it('its centre is (0.3, 0.2), not a point at infinity', () => {
    expect(xy('O')).toEqual([expect.closeTo(0.3, 6), expect.closeTo(0.2, 6)]);
  });

  it('a conic through five points of y = x² stays a parabola', () => {
    const b2 = new Builder();
    b2.add('k', T('conic', P(0, 0), P(1, 1), P(-1, 1), P(2, 4), P(-2, 4)));
    b2.add('O', T('conic_center', b2.ref('k')));
    expect(valueOf(b2.doc, evalDoc(b2.doc, FloatField), 'O').kind).toBe('ideal_point');
  });

  it('its foci are (0.3 ± 10⁴, 0.2), each picked by near', () => {
    expect(xy('F1')).toEqual([expect.closeTo(10000.3, 1), expect.closeTo(0.2, 3)]);
    expect(xy('F2')).toEqual([expect.closeTo(-9999.7, 1), expect.closeTo(0.2, 3)]);
  });
});
