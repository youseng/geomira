/**
 * Property tests of the transformation tools (Run 4), spread into tools.property.test.ts's
 * PROPERTIES (whose meta-test checks that every registry tool has one). Every map here is
 * exact over Q (rotations by 90°), so each property is checked exactly and in floats.
 */
import type { Field } from '@geomira/num/field';
import { call, type Expr } from '../../src/expr';
import { vDot, vCross, vSub } from '../../src/geom';
import type { Value } from '../../src/value';
import { num } from './doc';
import { asPoint, samePoints, type Figure } from './figure';
import { BOTH, asCircle, asLine, type CircleProperty } from './circle-properties';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);

/** Two values agree component by component (zero test of the difference, as a length). */
export function sameValue<T>(F: Field<T>, f: Figure<T>, u: Value<T>, v: Value<T>): boolean {
  const close = (x: T, y: T) => F.isZero(F.sub(x, y), 'length', f.ctx);
  const pt = (p: { x: T; y: T }, q: { x: T; y: T }) => close(p.x, q.x) && close(p.y, q.y);
  if (u.kind === 'point' && v.kind === 'point') return pt(u, v);
  if (u.kind === 'circle' && v.kind === 'circle') {
    const anchors =
      u.anchor === undefined || v.anchor === undefined
        ? u.anchor === v.anchor
        : pt(u.anchor, v.anchor);
    // r² relative to its size: a near-collinear triangle has a huge circumradius.
    const r2 = F.div(F.sub(u.r2, v.r2), F.add(u.r2, v.r2));
    return pt(u.c, v.c) && F.isZero(r2, 'dimensionless', f.ctx) && anchors;
  }
  if (u.kind === 'line' && v.kind === 'line') return pt(u.p, v.p) && pt(u.d, v.d);
  return false;
}

export const TRANSFORM_PROPERTIES: readonly CircleProperty[] = [
  {
    tools: ['reflect'],
    name: 'reflect(C, line(A, B)): the midpoint of C and C* is on AB and CC* ⟂ AB; twice is C; reflect(C, A) = 2A − C',
    build: (b, [A, B, C]) => {
      b.call('X', 'reflect', C, T('line', A, B));
      b.call('M', 'midpoint', C, b.ref('X'));
      b.call('Y', 'reflect', b.ref('X'), T('line', A, B));
      b.call('H', 'reflect', C, A);
      b.call('H_2', 'divide', C, A, num(2));
    },
    required: ['X', 'M'],
    check: (f) => {
      const { F } = f;
      const [A, B, C, X, M] = ['A', 'B', 'C', 'X', 'M'].map((n) => asPoint(f.get(n)));
      if (A === undefined || B === undefined || C === undefined || X === undefined) return false;
      if (M === undefined) return false;
      const ab = vSub(F, B, A);
      return (
        F.isZero(vCross(F, vSub(F, M, A), ab), 'area', f.ctx) &&
        F.isZero(vDot(F, vSub(F, X, C), ab), 'area', f.ctx) &&
        samePoints(f, 'Y', 'C') &&
        samePoints(f, 'H', 'H_2')
      );
    },
    fields: BOTH,
  },
  {
    tools: ['rotate'],
    name: 'rotate(C, A, 90): |AC*| = |AC|, AC* ⟂ AC counter-clockwise; rotate by 360° is the identity',
    build: (b, [A, , C]) => {
      b.call('X', 'rotate', C, A, num(90));
      b.call('Y', 'rotate', C, A, num(-270));
      b.call('Z', 'rotate', C, A, num(360));
    },
    required: ['X'],
    check: (f) => {
      const { F } = f;
      const [A, C, X] = ['A', 'C', 'X'].map((n) => asPoint(f.get(n)));
      if (A === undefined || C === undefined || X === undefined) return false;
      const [u, v] = [vSub(F, C, A), vSub(F, X, A)];
      return (
        F.isZero(vDot(F, u, v), 'area', f.ctx) &&
        F.isZero(F.sub(vCross(F, u, v), vDot(F, u, u)), 'area', f.ctx) &&
        samePoints(f, 'X', 'Y') &&
        samePoints(f, 'Z', 'C')
      );
    },
    fields: BOTH,
  },
  {
    tools: ['homothety'],
    name: 'homothety(C, A, k) = divide(A, C, k) for k = 2/3, −3; ratio −1 is the half turn',
    build: (b, [A, , C]) => {
      b.call('X', 'homothety', C, A, num('2/3'));
      b.call('X_2', 'divide', A, C, num('2/3'));
      b.call('Y', 'homothety', C, A, num(-3));
      b.call('Y_2', 'divide', A, C, num(-3));
      b.call('Z', 'homothety', C, A, num(-1));
      b.call('Z_2', 'reflect', C, A);
    },
    required: ['X'],
    check: (f) =>
      samePoints(f, 'X', 'X_2') && samePoints(f, 'Y', 'Y_2') && samePoints(f, 'Z', 'Z_2'),
    fields: BOTH,
  },
  {
    tools: ['translate'],
    name: 'translate(C, A, B): A, B, C*, C is a parallelogram (diagonals bisect)',
    build: (b, [A, B, C]) => {
      b.call('X', 'translate', C, A, B);
      b.call('M', 'midpoint', A, b.ref('X'));
      b.call('N', 'midpoint', B, C);
    },
    required: ['X'],
    check: (f) => samePoints(f, 'M', 'N'),
    fields: BOTH,
  },
  {
    tools: ['spiral'],
    name: 'spiral(A, B, C, D) takes A to C and B to D, and the midpoint of AB to that of CD',
    build: (b, [A, B, C, D]) => {
      b.call('X', 'spiral', A, A, B, C, D);
      b.call('Y', 'spiral', B, A, B, C, D);
      b.call('M', 'spiral', T('midpoint', A, B), A, B, C, D);
      b.call('N', 'midpoint', C, D);
    },
    required: ['X'],
    check: (f) => samePoints(f, 'X', 'C') && samePoints(f, 'Y', 'D') && samePoints(f, 'M', 'N'),
    fields: BOTH,
  },
  {
    tools: ['compose'],
    name: 'compose(S, T)(D) = S(T(D)); two reflections in lines through A fix A',
    build: (b, [A, B, C, D]) => {
      b.add('s', T('reflect', T('line', A, B)));
      b.add('t', T('spiral', A, C, B, D));
      b.call('X', 'apply', T('compose', b.ref('s'), b.ref('t')), D);
      b.call('Y', 'apply', b.ref('s'), T('apply', b.ref('t'), D));
      b.call('R', 'apply', T('compose', b.ref('s'), T('reflect', T('line', A, C))), A);
    },
    required: ['X'],
    check: (f) => samePoints(f, 'X', 'Y') && samePoints(f, 'R', 'A'),
    fields: BOTH,
  },
  {
    tools: ['inverse'],
    name: 'inverse(spiral(A, B, C, D)) takes C to A and D to B',
    build: (b, [A, B, C, D]) => {
      b.add('t', T('inverse', T('spiral', A, B, C, D)));
      b.call('X', 'apply', b.ref('t'), C);
      b.call('Y', 'apply', b.ref('t'), D);
    },
    required: ['X'],
    check: (f) => samePoints(f, 'X', 'A') && samePoints(f, 'Y', 'B'),
    fields: BOTH,
  },
  {
    tools: ['apply'],
    name: 'apply(T, circle(A, B, C)) = circle(T(A), T(B), T(C)) with the anchor mapped; lines likewise',
    build: (b, [A, B, C, D]) => {
      b.add('t', T('compose', T('reflect', T('line', D, A)), T('homothety', B, num('-3/2'))));
      const img = (p: Expr) => T('apply', b.ref('t'), p);
      b.call('c', 'apply', b.ref('t'), T('circle', A, B, C));
      b.call('k', 'circle', img(A), img(B), img(C));
      b.call('l', 'apply', b.ref('t'), T('line', A, C));
      b.call('m', 'line', img(A), img(C));
    },
    required: ['c', 'k'],
    check: (f) =>
      sameValue(f.F, f, f.get('c'), f.get('k')) &&
      sameValue(f.F, f, f.get('l'), f.get('m')) &&
      asLine(f.get('l')).chiral === asLine(f.get('m')).chiral &&
      asCircle(f.get('c')).anchor !== undefined,
    fields: BOTH,
  },
];
