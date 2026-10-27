/**
 * ADR-0035 decision 7: the construction rules, kind by kind, on facts the tools guarantee and
 * on near misses. A fact is hidden only when the closure derives it: parallels and
 * perpendiculars of drawn lines, a tangent at a point, points on a drawn circle, equal radii,
 * vertical angles at one vertex, directed angles of parallel arms. A fact whose arguments the
 * closure does not relate (another line, another circle, a literal it does not know, a kind
 * without a rule) is never hidden.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { rational } from '@geomira/num/rational';
import { c, Figure, n } from '../../claims/test/helpers/build';
import { buildClosure } from '../src/closure';
import type { ScreenArg } from '@geomira/claims/screen';
import { REGISTRY } from './helpers';

const KINDS = claimKindRegistry();

function figure(): Figure {
  return new Figure()
    .point('A', 0, 0)
    .point('B', 6, 0)
    .point('C', 2, 4)
    .point('D', 7, 3)
    .def('l', 'line', 'A', 'B')
    .def('m', 'parallel', 'C', 'l')
    .def('p', 'perp', 'C', 'l')
    .def('q', 'perp', 'D', 'l')
    .def('k', 'circle', 'A', 'B')
    .def('t', 'tangent', 'B', 'k')
    .add('P', c('on', 'k', n(3), n(1)))
    .def('E', 'midpoint', 'A', 'B')
    .def('k2', 'circle', 'C', n(2));
}

describe('construction rules', () => {
  const f = figure();
  const closure = buildClosure(f.doc, REGISTRY, KINDS);
  const arg = (x: string | number): ScreenArg =>
    typeof x === 'number' ? { lit: rational(BigInt(x)) } : { id: f.id(x) };
  const hidden = (kind: string, ...xs: (string | number)[]) =>
    closure.isConstruction({ kind, args: xs.map(arg) });

  it('parallel: the drawn parallel, and two perpendiculars to one line', () => {
    expect(hidden('parallel', 'l', 'm')).toBe(true);
    expect(hidden('parallel', 'p', 'q')).toBe(true);
    expect(hidden('parallel', 'l', 'p')).toBe(false);
    expect(hidden('parallel', 'l', 'l')).toBe(false);
    expect(hidden('parallel', 'A', 'l')).toBe(false);
  });

  it('perpendicular: the drawn perpendicular and lines parallel to it', () => {
    expect(hidden('perpendicular', 'p', 'l')).toBe(true);
    expect(hidden('perpendicular', 'm', 'q')).toBe(true);
    expect(hidden('perpendicular', 'l', 'm')).toBe(false);
    expect(hidden('perpendicular', 'A', 'l')).toBe(false);
  });

  it('on and tangent: points on their curves, the tangent at its point', () => {
    expect(hidden('on', 'P', 'k')).toBe(true);
    expect(hidden('on', 'B', 'k')).toBe(true);
    expect(hidden('on', 'E', 'l')).toBe(true);
    expect(hidden('on', 'C', 'k')).toBe(false);
    expect(hidden('on', 'C', 'A')).toBe(false);
    expect(hidden('tangent', 't', 'k')).toBe(true);
    expect(hidden('tangent', 'l', 'k')).toBe(false);
  });

  it('concurrent: lines through one known point; a line twice is not', () => {
    expect(hidden('concurrent', 'p', 'm', 't')).toBe(false);
    expect(hidden('concurrent', 'l', 'l', 'p')).toBe(false);
    expect(hidden('concurrent', 'l', 'A', 'p')).toBe(false);
  });

  it('length: radii of one circle; a ratio the closure does not know is not hidden', () => {
    expect(hidden('length', 'A', 'B', 'A', 'P', 1)).toBe(true);
    expect(hidden('length', 'A', 'B', 'A', 'E', 2)).toBe(true);
    expect(hidden('length', 'A', 'B', 'A', 'E', 3)).toBe(false);
    expect(hidden('length', 'A', 'C', 'A', 'P', 1)).toBe(false);
  });

  it('angles: the same arms at one vertex; parallel arms; other vertices are not', () => {
    expect(hidden('angle_eq', 'B', 'A', 'C', 'C', 'A', 'B')).toBe(true);
    // E is on ray AB here, but which ray is the configuration's: not a construction fact.
    expect(hidden('angle_eq', 'B', 'A', 'P', 'E', 'A', 'P')).toBe(false);
    expect(hidden('angle_eq', 'B', 'A', 'P', 'A', 'B', 'P')).toBe(false);
    expect(hidden('dangle', 1, 'B', 'A', 'C', 'E', 'A', 'C')).toBe(true);
    expect(hidden('dangle', 2, 'B', 'A', 'C', 'E', 'A', 'C')).toBe(false);
  });

  it('equal: one point class; a kind without a rule is never hidden', () => {
    expect(hidden('equal', 'E', 'E')).toBe(true);
    expect(hidden('equal', 'A', 'E')).toBe(false);
    expect(hidden('collinear', 'A', 'E', 'B')).toBe(true);
    expect(hidden('concyclic', 'A', 'B', 'P', 'C')).toBe(false);
    expect(hidden('angle_sum', 'B', 'A', 'C', 'C', 'A', 'B', 180)).toBe(false);
  });

  it('degenerate arguments are never construction facts', () => {
    expect(hidden('collinear', 'A', 'E', 'E')).toBe(false);
    expect(hidden('dangle', 1, 'A', 'A', 'C', 'E', 'A', 'C')).toBe(false);
    expect(hidden('concyclic', 'A', 'B', 'P', 'C', 'D')).toBe(false);
  });
});
