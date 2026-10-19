/** Property tests of the Run 3a tools, part 2 (see circle-properties.ts). */
import { call } from '../../src/expr';
import { vSub } from '../../src/geom';
import { num } from './doc';
import { asNum, asPoint, samePoints, type Figure } from './figure';
import {
  FLOAT,
  anchorIs,
  asCircle,
  asLine,
  onCircle,
  onLine,
  parallel,
  perpendicular,
  power,
  sameNumbers,
  type CircleProperty,
} from './circle-properties';

/** dist(a, b)² equals r² of circle `c` (names; dist is a number value). */
function distIsRadius<T>(f: Figure<T>, d: string, c: string): boolean {
  const x = asNum(f.get(d));
  return f.F.isZero(f.F.sub(f.F.mul(x, x), asCircle(f.get(c)).r2), 'area', f.ctx);
}

export const CIRCLE_PROPERTIES_2: readonly CircleProperty[] = [
  {
    tools: ['diameter_circle', 'on'],
    name: 'Thales: X on diameter_circle(A, B) sees AB at a right angle; anchored at A, through B',
    build: (b, [A, B]) => {
      const d = b.call('d', 'diameter_circle', A, B);
      b.call('X', 'on', d, num(2), num(5));
    },
    required: ['d'],
    check: (f) => {
      const [X, A, B] = [asPoint(f.get('X')), asPoint(f.get('A')), asPoint(f.get('B'))];
      return (
        perpendicular(f, vSub(f.F, X, A), vSub(f.F, X, B)) &&
        anchorIs(f, 'd', 'A') &&
        onCircle(f, 'B', 'd')
      );
    },
  },
  {
    tools: ['ninepoint_circle', 'midpoint', 'orthocenter', 'circumcenter', 'center'],
    name: 'ninepoint_circle passes through the midpoints, is centred at the midpoint of OH, anchored at M_a',
    build: (b, [A, B, C]) => {
      b.call('n', 'ninepoint_circle', A, B, C);
      b.call('M_a', 'midpoint', B, C);
      b.call('M_b', 'midpoint', C, A);
      b.call('M_c', 'midpoint', A, B);
      b.call('N', 'center', b.ref('n'));
      b.call('N_2', 'midpoint', call('circumcenter', [A, B, C]), call('orthocenter', [A, B, C]));
    },
    required: ['n'],
    check: (f) =>
      ['M_a', 'M_b', 'M_c'].every((p) => onCircle(f, p, 'n')) &&
      samePoints(f, 'N', 'N_2') &&
      anchorIs(f, 'n', 'M_a'),
  },
  {
    tools: ['tangent', 'polar', 'on'],
    name: 'tangent(P, c) passes through P perpendicular to OP; for P on c the polar is the tangent',
    build: (b, [A, B]) => {
      const c = b.call('c', 'circle', A, B);
      const P = b.call('P', 'on', c, num(3), num(-2));
      b.call('t', 'tangent', P, c);
      b.call('p', 'polar', P, c);
    },
    required: ['t'],
    check: (f) => {
      const [t, p] = [asLine(f.get('t')), asLine(f.get('p'))];
      const radius = vSub(f.F, asPoint(f.get('P')), asPoint(f.get('A')));
      return (
        onLine(f, 'P', 't') &&
        perpendicular(f, t.d, radius) &&
        onLine(f, 'P', 'p') &&
        parallel(f, t.d, p.d) &&
        t.chiral &&
        p.chiral
      );
    },
  },
  {
    tools: ['polar'],
    name: 'polar(C, c): the points X with (X − O)·(C − O) = r², perpendicular to OC',
    build: (b, [A, B, C]) => {
      const c = b.call('c', 'circle', A, B);
      b.call('q', 'polar', C, c);
    },
    required: ['q'],
    check: (f) => {
      const [q, c] = [asLine(f.get('q')), asCircle(f.get('c'))];
      const w = vSub(f.F, asPoint(f.get('C')), c.c);
      const x = vSub(f.F, q.p, c.c);
      const dot = f.F.add(f.F.mul(x.x, w.x), f.F.mul(x.y, w.y));
      return perpendicular(f, q.d, w) && f.F.isZero(f.F.sub(dot, c.r2), 'area', f.ctx);
    },
  },
  {
    tools: ['radical_axis', 'on'],
    name: 'every point of radical_axis(c1, c2) has equal powers to c1 and c2',
    build: (b, [A, B, C, D]) => {
      const l = b.call('l', 'radical_axis', call('circle', [A, B]), call('circle', [C, D]));
      b.call('X', 'on', l, num('2/5'));
      b.call('c_1', 'circle', A, B);
      b.call('c_2', 'circle', C, D);
    },
    required: ['l'],
    check: (f) => {
      const X = asPoint(f.get('X'));
      const [p1, p2] = [
        power(f.F, X, asCircle(f.get('c_1'))),
        power(f.F, X, asCircle(f.get('c_2'))),
      ];
      return f.F.isZero(f.F.sub(p1, p2), 'area', f.ctx) && asLine(f.get('l')).chiral;
    },
  },
  {
    tools: ['other', 'on', 'line'],
    name: 'line and circle: other(l, c, P) lies on both, and other(l, c, ·) is an involution',
    build: (b, [A, B, C]) => {
      const c = b.call('c', 'circle', A, B);
      const P = b.call('P', 'on', c, num(5), num(3));
      const l = b.call('l', 'line', P, C);
      const Q = b.call('Q', 'other', l, c, P);
      b.call('R', 'other', c, l, Q);
    },
    required: ['Q', 'R'],
    check: (f) => onCircle(f, 'Q', 'c') && onLine(f, 'Q', 'l') && samePoints(f, 'R', 'P'),
  },
  {
    tools: ['other', 'circle'],
    name: 'two circles through C: other(c1, c2, C) lies on both, and other(c2, c1, ·) maps it back to C',
    build: (b, [A, B, C]) => {
      const [c1, c2] = [b.call('c_1', 'circle', A, C), b.call('c_2', 'circle', B, C)];
      const Q = b.call('Q', 'other', c1, c2, C);
      b.call('R', 'other', c2, c1, Q);
    },
    required: ['Q', 'R'],
    check: (f) => onCircle(f, 'Q', 'c_1') && onCircle(f, 'Q', 'c_2') && samePoints(f, 'R', 'C'),
  },
  {
    tools: ['incenter', 'incircle', 'dist'],
    name: 'the incircle is centred at the incenter, touches the three sides, anchored on BC',
    build: (b, [A, B, C]) => {
      const I = b.call('I', 'incenter', A, B, C);
      b.call('i', 'incircle', A, B, C);
      b.call('d_a', 'dist', I, call('line', [B, C]));
      b.call('d_b', 'dist', I, call('line', [C, A]));
      b.call('d_c', 'dist', I, call('line', [A, B]));
      b.call('l_a', 'line', B, C);
      b.call('T', 'center', b.ref('i'));
    },
    required: ['i'],
    check: (f) => {
      const anchor = asCircle(f.get('i')).anchor;
      return (
        samePoints(f, 'T', 'I') &&
        ['d_a', 'd_b', 'd_c'].every((d) => distIsRadius(f, d, 'i')) &&
        anchor !== undefined &&
        f.F.isZero(power(f.F, anchor, asCircle(f.get('i'))), 'area', f.ctx) &&
        parallel(f, vSub(f.F, anchor, asPoint(f.get('B'))), asLine(f.get('l_a')).d)
      );
    },
    fields: FLOAT,
  },
  {
    tools: ['excenter', 'excircle', 'dist'],
    name: 'the excircle opposite A is centred at the excenter, touches the three side lines, anchored on BC',
    build: (b, [A, B, C]) => {
      const J = b.call('J', 'excenter', A, B, C);
      b.call('e', 'excircle', A, B, C);
      b.call('d_a', 'dist', J, call('line', [B, C]));
      b.call('d_b', 'dist', J, call('line', [C, A]));
      b.call('d_c', 'dist', J, call('line', [A, B]));
      b.call('T', 'center', b.ref('e'));
    },
    required: ['e'],
    check: (f) =>
      samePoints(f, 'T', 'J') && ['d_a', 'd_b', 'd_c'].every((d) => distIsRadius(f, d, 'e')),
    fields: FLOAT,
  },
  {
    tools: ['bisector', 'ext_bisector', 'angle'],
    name: 'bisector(A, B, C) halves ∠ABC; ext_bisector is perpendicular to it; flags achiral / chiral',
    build: (b, [A, B, C]) => {
      const l = b.call('l', 'bisector', A, B, C);
      b.call('m', 'ext_bisector', A, B, C);
      const X = b.call('X', 'on', l, num(1));
      b.call('a_1', 'angle', A, B, X);
      b.call('a_2', 'angle', X, B, C);
    },
    required: ['l'],
    check: (f) => {
      const [l, m] = [asLine(f.get('l')), asLine(f.get('m'))];
      return sameNumbers(f, 'a_1', 'a_2') && perpendicular(f, l.d, m.d) && !l.chiral && m.chiral;
    },
    fields: FLOAT,
  },
];
